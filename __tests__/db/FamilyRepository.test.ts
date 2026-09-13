/**
 * Family-member repository behaviour, verified against BOTH backends.
 *
 * The cases that matter most are the cross-table ones: `ensureSelf` adopting
 * data recorded before family profiles existed, and `remove` taking a
 * member's medicines and conditions with them — SQLite does both through the
 * schema, JSON does both by hand, and the two must agree.
 */

import { runMigrations } from '@/db/migrations';
import type { FamilyRepository } from '@/db/repositories/FamilyRepository';
import type { HealthConditionRepository } from '@/db/repositories/HealthConditionRepository';
import { JsonFamilyRepository } from '@/db/repositories/JsonFamilyRepository';
import { JsonHealthConditionRepository } from '@/db/repositories/JsonHealthConditionRepository';
import { JsonMedicationRepository } from '@/db/repositories/JsonMedicationRepository';
import type { MedicationRepository } from '@/db/repositories/MedicationRepository';
import { SqliteFamilyRepository } from '@/db/repositories/SqliteFamilyRepository';
import { SqliteHealthConditionRepository } from '@/db/repositories/SqliteHealthConditionRepository';
import { SqliteMedicationRepository } from '@/db/repositories/SqliteMedicationRepository';
import type { FamilyMemberInput } from '@/domain/familyMember';

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

const MOTHER: FamilyMemberInput = {
  name: 'Fatima',
  relationship: 'MOTHER',
  customRelationship: null,
  dateOfBirth: '1960-03-15',
  avatarColor: 'info',
};

const MEDICINE = {
  name: 'Amlodipine',
  dosage: '5 mg',
  instructions: null,
  expirationDate: null,
  frequency: 'Once daily',
  notes: null,
};

const CONDITION = {
  type: 'HIGH_BLOOD_PRESSURE' as const,
  customName: null,
  reading: '130/85',
  notes: null,
};

type Repos = {
  family: FamilyRepository;
  medications: MedicationRepository;
  conditions: HealthConditionRepository;
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
        conditions: new SqliteHealthConditionRepository(openDatabase),
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
        conditions: new JsonHealthConditionRepository(),
      };
    },
    teardown() {},
  },
];

describe.each(backends)('$name FamilyRepository', (backend) => {
  let family: FamilyRepository;
  let medications: MedicationRepository;
  let conditions: HealthConditionRepository;

  beforeEach(async () => {
    ({ family, medications, conditions } = await backend.make());
  });

  afterEach(() => backend.teardown());

  describe('ensureSelf', () => {
    it('creates "Me" once and returns the same profile afterwards', async () => {
      const first = await family.ensureSelf(ALICE, 'Alice');
      const second = await family.ensureSelf(ALICE, 'Someone else');
      expect(first.ok && second.ok).toBe(true);
      if (!first.ok || !second.ok) return;
      expect(first.value).toMatchObject({ name: 'Alice', relationship: 'ME', isSelf: true });
      expect(second.value.id).toBe(first.value.id);

      const list = await family.listForUser(ALICE);
      expect(list.ok && list.value).toHaveLength(1);
    });

    it('adopts medicines and conditions recorded before family profiles existed', async () => {
      const orphanMedicine = await medications.create(ALICE, MEDICINE);
      const orphanCondition = await conditions.create(ALICE, CONDITION);
      expect(orphanMedicine.ok && orphanMedicine.value.memberId).toBeNull();
      expect(orphanCondition.ok && orphanCondition.value.memberId).toBeNull();

      const self = await family.ensureSelf(ALICE, 'Alice');
      if (!self.ok) throw new Error('ensureSelf failed');

      const adoptedMedicine = orphanMedicine.ok
        ? await medications.getById(ALICE, orphanMedicine.value.id)
        : null;
      expect(adoptedMedicine?.ok && adoptedMedicine.value?.memberId).toBe(self.value.id);
      const adoptedCondition = orphanCondition.ok
        ? await conditions.getById(ALICE, orphanCondition.value.id)
        : null;
      expect(adoptedCondition?.ok && adoptedCondition.value?.memberId).toBe(self.value.id);
    });

    it('does not touch another user’s data', async () => {
      const bobs = await medications.create(BOB, MEDICINE);
      await family.ensureSelf(ALICE, 'Alice');
      const still = bobs.ok ? await medications.getById(BOB, bobs.value.id) : null;
      expect(still?.ok && still.value?.memberId).toBeNull();
    });
  });

  describe('members', () => {
    it('lists "Me" first, then others in the order added', async () => {
      const mother = await family.create(ALICE, MOTHER);
      const self = await family.ensureSelf(ALICE, 'Alice');
      const son = await family.create(ALICE, { ...MOTHER, name: 'Khalid', relationship: 'SON' });
      if (!mother.ok || !self.ok || !son.ok) throw new Error('setup failed');

      const list = await family.listForUser(ALICE);
      expect(list.ok && list.value.map((m) => m.name)).toEqual(['Alice', 'Fatima', 'Khalid']);
    });

    it('refuses a second "Me"', async () => {
      await family.ensureSelf(ALICE, 'Alice');
      expect(await family.create(ALICE, { ...MOTHER, relationship: 'ME' })).toMatchObject({
        ok: false,
        error: { code: 'NOT_ALLOWED' },
      });
      const mother = await family.create(ALICE, MOTHER);
      if (!mother.ok) throw new Error('create failed');
      expect(
        await family.update(ALICE, mother.value.id, { ...MOTHER, relationship: 'ME' }),
      ).toMatchObject({ ok: false, error: { code: 'NOT_ALLOWED' } });
    });

    it('keeps the self profile as "Me" whatever the edit says', async () => {
      const self = await family.ensureSelf(ALICE, 'Alice');
      if (!self.ok) throw new Error('ensureSelf failed');
      const updated = await family.update(ALICE, self.value.id, {
        ...MOTHER,
        name: 'Alice Smith',
        relationship: 'DAUGHTER',
      });
      expect(updated.ok && updated.value).toMatchObject({
        name: 'Alice Smith',
        relationship: 'ME',
        isSelf: true,
      });
    });

    it('updates an ordinary member and keeps createdAt', async () => {
      const mother = await family.create(ALICE, MOTHER);
      if (!mother.ok) throw new Error('create failed');
      const updated = await family.update(ALICE, mother.value.id, {
        ...MOTHER,
        relationship: 'OTHER',
        customRelationship: 'Aunt',
        avatarColor: 'success',
      });
      expect(updated.ok && updated.value).toMatchObject({
        relationship: 'OTHER',
        customRelationship: 'Aunt',
        avatarColor: 'success',
        createdAt: mother.value.createdAt,
      });
    });

    it('keeps users apart', async () => {
      const mother = await family.create(ALICE, MOTHER);
      if (!mother.ok) throw new Error('create failed');
      expect(await family.getById(BOB, mother.value.id)).toMatchObject({ ok: true, value: null });
      expect(await family.update(BOB, mother.value.id, MOTHER)).toMatchObject({
        ok: false,
        error: { code: 'NOT_FOUND' },
      });
      expect(await family.remove(BOB, mother.value.id)).toMatchObject({
        ok: false,
        error: { code: 'NOT_FOUND' },
      });
      const bobs = await family.listForUser(BOB);
      expect(bobs.ok && bobs.value).toEqual([]);
    });
  });

  describe('remove', () => {
    it('refuses to remove the self profile', async () => {
      const self = await family.ensureSelf(ALICE, 'Alice');
      if (!self.ok) throw new Error('ensureSelf failed');
      expect(await family.remove(ALICE, self.value.id)).toMatchObject({
        ok: false,
        error: { code: 'NOT_ALLOWED' },
      });
      expect(await family.getById(ALICE, self.value.id)).toMatchObject({ ok: true });
    });

    it('takes the member’s medicines and conditions with them, and nobody else’s', async () => {
      const self = await family.ensureSelf(ALICE, 'Alice');
      const mother = await family.create(ALICE, MOTHER);
      if (!self.ok || !mother.ok) throw new Error('setup failed');

      const mine = await medications.create(ALICE, { ...MEDICINE, memberId: self.value.id });
      const hers = await medications.create(ALICE, {
        ...MEDICINE,
        name: 'Metformin',
        memberId: mother.value.id,
      });
      const herCondition = await conditions.create(ALICE, {
        ...CONDITION,
        memberId: mother.value.id,
      });
      if (!mine.ok || !hers.ok || !herCondition.ok) throw new Error('setup failed');

      expect((await family.remove(ALICE, mother.value.id)).ok).toBe(true);

      const remaining = await medications.listForUser(ALICE);
      expect(remaining.ok && remaining.value.map((m) => m.id)).toEqual([mine.value.id]);
      const remainingConditions = await conditions.listForUser(ALICE);
      expect(remainingConditions.ok && remainingConditions.value).toEqual([]);
      expect(await family.getById(ALICE, mother.value.id)).toMatchObject({ ok: true, value: null });
    });

    it('reports NOT_FOUND for an unknown id', async () => {
      expect(await family.remove(ALICE, 'nope')).toMatchObject({
        ok: false,
        error: { code: 'NOT_FOUND' },
      });
    });
  });

  it('stores the member on medicines and conditions', async () => {
    const mother = await family.create(ALICE, MOTHER);
    if (!mother.ok) throw new Error('create failed');

    const medicine = await medications.create(ALICE, { ...MEDICINE, memberId: mother.value.id });
    expect(medicine.ok && medicine.value.memberId).toBe(mother.value.id);
    const listed = await medications.listForUser(ALICE);
    expect(listed.ok && listed.value[0]?.memberId).toBe(mother.value.id);

    const condition = await conditions.create(ALICE, { ...CONDITION, memberId: mother.value.id });
    expect(condition.ok && condition.value.memberId).toBe(mother.value.id);
  });
});
