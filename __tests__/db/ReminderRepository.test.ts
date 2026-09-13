/**
 * Reminder and dose repositories, verified against BOTH backends, including
 * the cascades: deleting a medicine or a family member takes its reminder and
 * doses with it (foreign keys in SQLite, by hand in JSON).
 */

import { runMigrations } from '@/db/migrations';
import type { FamilyRepository } from '@/db/repositories/FamilyRepository';
import { JsonFamilyRepository } from '@/db/repositories/JsonFamilyRepository';
import { JsonMedicationRepository } from '@/db/repositories/JsonMedicationRepository';
import { JsonDoseRepository, JsonReminderRepository } from '@/db/repositories/JsonReminderRepository';
import type { MedicationRepository } from '@/db/repositories/MedicationRepository';
import type { DoseRepository, ReminderRepository } from '@/db/repositories/ReminderRepository';
import { SqliteFamilyRepository } from '@/db/repositories/SqliteFamilyRepository';
import { SqliteMedicationRepository } from '@/db/repositories/SqliteMedicationRepository';
import { SqliteDoseRepository, SqliteReminderRepository } from '@/db/repositories/SqliteReminderRepository';
import type { ReminderInput } from '@/domain/reminder';

import { createTestDatabase, type TestDatabase } from '../helpers/testDatabase';

jest.mock('expo-crypto', () => {
  const nodeCrypto = require('crypto');
  return { randomUUID: () => nodeCrypto.randomUUID() };
});

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    __store: store,
    isAvailableAsync: async () => true,
    getItemAsync: async (key: string) => (store.has(key) ? store.get(key) : null),
    setItemAsync: async (key: string, value: string) => {
      store.set(key, value);
    },
    deleteItemAsync: async (key: string) => {
      store.delete(key);
    },
  };
});

const ALICE = 'user-alice';
const BOB = 'user-bob';

const INPUT: ReminderInput = {
  times: ['08:00', '20:00'],
  doseLabel: '500 mg',
  frequency: 'DAILY',
  days: [],
  startDate: null,
  endDate: null,
  enabled: true,
};

type Repos = {
  family: FamilyRepository;
  medications: MedicationRepository;
  reminders: ReminderRepository;
  doses: DoseRepository;
};

let openDatabase: TestDatabase | null = null;

const backends = [
  {
    name: 'sqlite',
    async make(): Promise<Repos> {
      openDatabase = createTestDatabase();
      await runMigrations(openDatabase);
      return {
        family: new SqliteFamilyRepository(openDatabase),
        medications: new SqliteMedicationRepository(openDatabase),
        reminders: new SqliteReminderRepository(openDatabase),
        doses: new SqliteDoseRepository(openDatabase),
      };
    },
    teardown() {
      openDatabase?.close();
      openDatabase = null;
    },
  },
  {
    name: 'json',
    async make(): Promise<Repos> {
      const secureStore = jest.requireMock('expo-secure-store') as { __store: Map<string, string> };
      secureStore.__store.clear();
      return {
        family: new JsonFamilyRepository(),
        medications: new JsonMedicationRepository(),
        reminders: new JsonReminderRepository(),
        doses: new JsonDoseRepository(),
      };
    },
    teardown() {},
  },
];

describe.each(backends)('$name reminders and doses', (backend) => {
  let repos: Repos;
  let memberId: string;
  let medicationId: string;

  async function setup(userId = ALICE) {
    const self = await repos.family.ensureSelf(userId, 'Alice');
    if (!self.ok) throw new Error('ensureSelf failed');
    const medicine = await repos.medications.create(userId, {
      name: 'Paracetamol',
      dosage: '500 mg',
      instructions: null,
      expirationDate: null,
      frequency: 'Twice daily',
      notes: null,
      memberId: self.value.id,
    });
    if (!medicine.ok) throw new Error('medicine failed');
    return { memberId: self.value.id, medicationId: medicine.value.id };
  }

  beforeEach(async () => {
    repos = await backend.make();
    ({ memberId, medicationId } = await setup());
  });

  afterEach(() => backend.teardown());

  it('creates, reads, updates and removes a reminder', async () => {
    const created = await repos.reminders.create(ALICE, { ...INPUT, medicationId, memberId });
    expect(created.ok && created.value).toMatchObject({
      times: ['08:00', '20:00'],
      doseLabel: '500 mg',
      enabled: true,
      notificationIds: [],
    });
    if (!created.ok) return;

    const forMedicine = await repos.reminders.getForMedication(ALICE, medicationId);
    expect(forMedicine.ok && forMedicine.value?.id).toBe(created.value.id);

    const updated = await repos.reminders.update(ALICE, created.value.id, {
      ...INPUT,
      times: ['09:00'],
      frequency: 'SPECIFIC_DAYS',
      days: [1, 3],
      enabled: false,
    });
    expect(updated.ok && updated.value).toMatchObject({ times: ['09:00'], days: [1, 3], enabled: false });

    expect((await repos.reminders.setNotificationIds(ALICE, created.value.id, ['n1', 'n2'])).ok).toBe(true);
    const withIds = await repos.reminders.getById(ALICE, created.value.id);
    expect(withIds.ok && withIds.value?.notificationIds).toEqual(['n1', 'n2']);

    expect((await repos.reminders.remove(ALICE, created.value.id)).ok).toBe(true);
    expect(await repos.reminders.getById(ALICE, created.value.id)).toMatchObject({ ok: true, value: null });
  });

  it('allows one reminder per medicine', async () => {
    expect((await repos.reminders.create(ALICE, { ...INPUT, medicationId, memberId })).ok).toBe(true);
    expect((await repos.reminders.create(ALICE, { ...INPUT, medicationId, memberId })).ok).toBe(false);
  });

  it('keeps users apart', async () => {
    const created = await repos.reminders.create(ALICE, { ...INPUT, medicationId, memberId });
    if (!created.ok) throw new Error('create failed');
    expect(await repos.reminders.getById(BOB, created.value.id)).toMatchObject({ ok: true, value: null });
    expect(await repos.reminders.update(BOB, created.value.id, INPUT)).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND' },
    });
    expect(await repos.reminders.remove(BOB, created.value.id)).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND' },
    });
    // Bob cannot seed doses onto Alice's reminder.
    await repos.doses.ensureDoses(BOB, [
      { reminderId: created.value.id, medicationId, memberId, scheduledAt: '2026-09-14T08:00' },
    ]);
    const bobs = await repos.doses.listBetween(BOB, '2026-09-14T00:00', '2026-09-15T00:00');
    expect(bobs.ok && bobs.value).toEqual([]);
  });

  describe('doses', () => {
    let reminderId: string;

    beforeEach(async () => {
      const created = await repos.reminders.create(ALICE, { ...INPUT, medicationId, memberId });
      if (!created.ok) throw new Error('create failed');
      reminderId = created.value.id;
    });

    const seed = (scheduledAt: string) => ({ reminderId, medicationId, memberId, scheduledAt });

    it('creates UPCOMING rows once, never duplicating an occurrence', async () => {
      await repos.doses.ensureDoses(ALICE, [seed('2026-09-14T08:00'), seed('2026-09-14T20:00')]);
      await repos.doses.ensureDoses(ALICE, [seed('2026-09-14T08:00'), seed('2026-09-15T08:00')]);

      const list = await repos.doses.listBetween(ALICE, '2026-09-14T00:00', '2026-09-16T00:00');
      expect(list.ok && list.value.map((d) => [d.scheduledAt, d.status])).toEqual([
        ['2026-09-14T08:00', 'UPCOMING'],
        ['2026-09-14T20:00', 'UPCOMING'],
        ['2026-09-15T08:00', 'UPCOMING'],
      ]);
      expect(list.ok && list.value[0]).toMatchObject({ memberId, medicationId, reminderId });
    });

    it('marks a dose and keeps its status when re-seeded', async () => {
      await repos.doses.ensureDoses(ALICE, [seed('2026-09-14T08:00')]);
      const list = await repos.doses.listBetween(ALICE, '2026-09-14T00:00', '2026-09-15T00:00');
      if (!list.ok) throw new Error('list failed');
      const dose = list.value[0];

      const taken = await repos.doses.setStatus(ALICE, dose.id, 'TAKEN', '2026-09-14T08:05:00.000Z');
      expect(taken.ok && taken.value).toMatchObject({ status: 'TAKEN', actedAt: '2026-09-14T08:05:00.000Z' });

      await repos.doses.ensureDoses(ALICE, [seed('2026-09-14T08:00')]);
      const again = await repos.doses.listBetween(ALICE, '2026-09-14T00:00', '2026-09-15T00:00');
      expect(again.ok && again.value.map((d) => d.status)).toEqual(['TAKEN']);

      expect(await repos.doses.setStatus(BOB, dose.id, 'SKIPPED', null)).toMatchObject({
        ok: false,
        error: { code: 'NOT_FOUND' },
      });
    });

    it('sweeps only UPCOMING doses before the cutoff into MISSED', async () => {
      await repos.doses.ensureDoses(ALICE, [
        seed('2026-09-14T08:00'),
        seed('2026-09-14T14:00'),
        seed('2026-09-14T20:00'),
      ]);
      const list = await repos.doses.listBetween(ALICE, '2026-09-14T00:00', '2026-09-15T00:00');
      if (!list.ok) throw new Error('list failed');
      await repos.doses.setStatus(ALICE, list.value[0].id, 'TAKEN', 'x');

      const swept = await repos.doses.markMissedBefore(ALICE, '2026-09-14T16:00', 'now');
      expect(swept.ok && swept.value).toBe(1);

      const after = await repos.doses.listBetween(ALICE, '2026-09-14T00:00', '2026-09-15T00:00');
      expect(after.ok && after.value.map((d) => d.status)).toEqual(['TAKEN', 'MISSED', 'UPCOMING']);
    });

    it('stores and clears the follow-up notification id', async () => {
      await repos.doses.ensureDoses(ALICE, [seed('2026-09-14T08:00')]);
      const list = await repos.doses.listBetween(ALICE, '2026-09-14T00:00', '2026-09-15T00:00');
      if (!list.ok) throw new Error('list failed');
      const id = list.value[0].id;
      expect((await repos.doses.setFollowUpNotificationId(ALICE, id, 'f1')).ok).toBe(true);
      const withId = await repos.doses.listBetween(ALICE, '2026-09-14T00:00', '2026-09-15T00:00');
      expect(withId.ok && withId.value[0].followUpNotificationId).toBe('f1');
      expect((await repos.doses.setFollowUpNotificationId(ALICE, id, null)).ok).toBe(true);
    });
  });

  describe('cascades', () => {
    it('removing the medicine removes its reminder and doses', async () => {
      const created = await repos.reminders.create(ALICE, { ...INPUT, medicationId, memberId });
      if (!created.ok) throw new Error('create failed');
      await repos.doses.ensureDoses(ALICE, [
        { reminderId: created.value.id, medicationId, memberId, scheduledAt: '2026-09-14T08:00' },
      ]);

      expect((await repos.medications.remove(ALICE, medicationId)).ok).toBe(true);
      expect(await repos.reminders.getById(ALICE, created.value.id)).toMatchObject({ ok: true, value: null });
      const doses = await repos.doses.listBetween(ALICE, '2026-01-01T00:00', '2027-01-01T00:00');
      expect(doses.ok && doses.value).toEqual([]);
    });

    it('removing a family member removes their reminders and doses, not others’', async () => {
      const mother = await repos.family.create(ALICE, {
        name: 'Fatima',
        relationship: 'MOTHER',
        customRelationship: null,
        dateOfBirth: null,
        gender: null,
        heightCm: null,
        weightKg: null,
        bloodType: null,
        avatarColor: 'info',
      });
      if (!mother.ok) throw new Error('create failed');
      const hers = await repos.medications.create(ALICE, {
        name: 'Metformin',
        dosage: null,
        instructions: null,
        expirationDate: null,
        frequency: null,
        notes: null,
        memberId: mother.value.id,
      });
      if (!hers.ok) throw new Error('create failed');

      const mine = await repos.reminders.create(ALICE, { ...INPUT, medicationId, memberId });
      const herReminder = await repos.reminders.create(ALICE, {
        ...INPUT,
        medicationId: hers.value.id,
        memberId: mother.value.id,
      });
      if (!mine.ok || !herReminder.ok) throw new Error('create failed');
      await repos.doses.ensureDoses(ALICE, [
        { reminderId: mine.value.id, medicationId, memberId, scheduledAt: '2026-09-14T08:00' },
        {
          reminderId: herReminder.value.id,
          medicationId: hers.value.id,
          memberId: mother.value.id,
          scheduledAt: '2026-09-14T08:00',
        },
      ]);

      expect((await repos.family.remove(ALICE, mother.value.id)).ok).toBe(true);

      const reminders = await repos.reminders.listForUser(ALICE);
      expect(reminders.ok && reminders.value.map((r) => r.id)).toEqual([mine.value.id]);
      const doses = await repos.doses.listBetween(ALICE, '2026-01-01T00:00', '2027-01-01T00:00');
      expect(doses.ok && doses.value.map((d) => d.reminderId)).toEqual([mine.value.id]);
    });
  });
});
