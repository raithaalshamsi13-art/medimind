/**
 * Health-condition repository behaviour, verified against BOTH backends —
 * including the one cross-table rule: removing a condition unlinks it from
 * every medicine (a foreign-key cascade in SQLite, done by hand in JSON).
 */

import { runMigrations } from '@/db/migrations';
import type { HealthConditionRepository } from '@/db/repositories/HealthConditionRepository';
import { JsonHealthConditionRepository } from '@/db/repositories/JsonHealthConditionRepository';
import { JsonMedicationRepository } from '@/db/repositories/JsonMedicationRepository';
import type { MedicationRepository } from '@/db/repositories/MedicationRepository';
import { SqliteHealthConditionRepository } from '@/db/repositories/SqliteHealthConditionRepository';
import { SqliteMedicationRepository } from '@/db/repositories/SqliteMedicationRepository';
import type { HealthConditionInput } from '@/domain/healthCondition';

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

const BP: HealthConditionInput = {
  type: 'HIGH_BLOOD_PRESSURE',
  customName: null,
  reading: '130/85',
  notes: null,
};
const MIGRAINE: HealthConditionInput = {
  type: 'OTHER',
  customName: 'Migraine',
  reading: null,
  notes: 'Worse in bright light',
};

type Backend = {
  name: string;
  make(): Promise<{ conditions: HealthConditionRepository; medications: MedicationRepository }>;
  teardown(): void;
};

let openDatabase: TestDatabase | null = null;

const backends: Backend[] = [
  {
    name: 'sqlite',
    async make() {
      openDatabase = createTestDatabase();
      await runMigrations(openDatabase);
      return {
        conditions: new SqliteHealthConditionRepository(openDatabase),
        medications: new SqliteMedicationRepository(openDatabase),
      };
    },
    teardown() {
      openDatabase?.close();
      openDatabase = null;
    },
  },
  {
    name: 'json',
    async make() {
      const secureStore = jest.requireMock('expo-secure-store') as { __store: Map<string, string> };
      secureStore.__store.clear();
      return {
        conditions: new JsonHealthConditionRepository(),
        medications: new JsonMedicationRepository(),
      };
    },
    teardown() {},
  },
];

describe.each(backends)('$name HealthConditionRepository', (backend) => {
  let conditions: HealthConditionRepository;
  let medications: MedicationRepository;

  beforeEach(async () => {
    ({ conditions, medications } = await backend.make());
  });

  afterEach(() => backend.teardown());

  it('creates, lists (oldest first), updates and removes', async () => {
    const first = await conditions.create(ALICE, BP);
    const second = await conditions.create(ALICE, MIGRAINE);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    const list = await conditions.listForUser(ALICE);
    expect(list.ok && list.value.map((c) => c.id)).toEqual([first.value.id, second.value.id]);

    const updated = await conditions.update(ALICE, first.value.id, { ...BP, reading: '128/82' });
    expect(updated.ok && updated.value.reading).toBe('128/82');
    expect(updated.ok && updated.value.createdAt).toBe(first.value.createdAt);

    const removed = await conditions.remove(ALICE, second.value.id);
    expect(removed.ok).toBe(true);
    const after = await conditions.listForUser(ALICE);
    expect(after.ok && after.value.map((c) => c.id)).toEqual([first.value.id]);
  });

  it('keeps users apart', async () => {
    const mine = await conditions.create(ALICE, BP);
    if (!mine.ok) throw new Error('create failed');

    expect((await conditions.listForUser(BOB)).ok && (await conditions.listForUser(BOB))).toMatchObject({
      value: [],
    });
    expect(await conditions.getById(BOB, mine.value.id)).toMatchObject({ ok: true, value: null });
    expect(await conditions.update(BOB, mine.value.id, MIGRAINE)).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND' },
    });
    expect(await conditions.remove(BOB, mine.value.id)).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND' },
    });
  });

  it('reports NOT_FOUND for an unknown id', async () => {
    expect(await conditions.update(ALICE, 'nope', BP)).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND' },
    });
    expect(await conditions.remove(ALICE, 'nope')).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND' },
    });
  });

  describe('links to medicines', () => {
    const MEDICINE = {
      name: 'Amlodipine',
      dosage: '5 mg',
      instructions: null,
      expirationDate: null,
      frequency: 'Once daily',
      notes: null,
    };

    it('stores the link and returns it with the medicine', async () => {
      const bp = await conditions.create(ALICE, BP);
      if (!bp.ok) throw new Error('create failed');

      const created = await medications.create(ALICE, { ...MEDICINE, conditionIds: [bp.value.id] });
      expect(created.ok && created.value.conditionIds).toEqual([bp.value.id]);

      const listed = await medications.listForUser(ALICE);
      expect(listed.ok && listed.value[0]?.conditionIds).toEqual([bp.value.id]);
      const fetched = created.ok ? await medications.getById(ALICE, created.value.id) : null;
      expect(fetched?.ok && fetched.value?.conditionIds).toEqual([bp.value.id]);
    });

    it('drops a link to a condition that is not this user’s', async () => {
      const bobs = await conditions.create(BOB, BP);
      if (!bobs.ok) throw new Error('create failed');

      const created = await medications.create(ALICE, {
        ...MEDICINE,
        conditionIds: [bobs.value.id, 'made-up-id'],
      });
      expect(created.ok && created.value.conditionIds).toEqual([]);
    });

    it('replaces links on update and keeps them when the field is omitted', async () => {
      const bp = await conditions.create(ALICE, BP);
      const migraine = await conditions.create(ALICE, MIGRAINE);
      if (!bp.ok || !migraine.ok) throw new Error('create failed');

      const created = await medications.create(ALICE, { ...MEDICINE, conditionIds: [bp.value.id] });
      if (!created.ok) throw new Error('create failed');

      const swapped = await medications.update(ALICE, created.value.id, {
        ...MEDICINE,
        conditionIds: [migraine.value.id],
      });
      expect(swapped.ok && swapped.value.conditionIds).toEqual([migraine.value.id]);

      const untouched = await medications.update(ALICE, created.value.id, MEDICINE);
      expect(untouched.ok && untouched.value.conditionIds).toEqual([migraine.value.id]);

      const cleared = await medications.update(ALICE, created.value.id, {
        ...MEDICINE,
        conditionIds: [],
      });
      expect(cleared.ok && cleared.value.conditionIds).toEqual([]);
    });

    it('removing a condition unlinks it from every medicine', async () => {
      const bp = await conditions.create(ALICE, BP);
      const migraine = await conditions.create(ALICE, MIGRAINE);
      if (!bp.ok || !migraine.ok) throw new Error('create failed');

      const created = await medications.create(ALICE, {
        ...MEDICINE,
        conditionIds: [bp.value.id, migraine.value.id],
      });
      if (!created.ok) throw new Error('create failed');

      expect((await conditions.remove(ALICE, bp.value.id)).ok).toBe(true);

      const after = await medications.getById(ALICE, created.value.id);
      expect(after.ok && after.value?.conditionIds).toEqual([migraine.value.id]);
    });

    it('removing a medicine removes its links but not the condition', async () => {
      const bp = await conditions.create(ALICE, BP);
      if (!bp.ok) throw new Error('create failed');
      const created = await medications.create(ALICE, { ...MEDICINE, conditionIds: [bp.value.id] });
      if (!created.ok) throw new Error('create failed');

      expect((await medications.remove(ALICE, created.value.id)).ok).toBe(true);
      const still = await conditions.getById(ALICE, bp.value.id);
      expect(still.ok && still.value?.id).toBe(bp.value.id);
    });
  });
});
