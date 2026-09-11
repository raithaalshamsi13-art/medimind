/**
 * Repository behaviour, verified against BOTH implementations.
 *
 * The same suite runs twice — once against real SQLite and once against the
 * JSON fallback used in the browser. That is the point: the two backends must
 * be indistinguishable to a screen, including their ordering, their null
 * handling and their NOT_FOUND semantics. If the fallback ever drifts, these
 * tests fail rather than the browser build quietly behaving differently.
 *
 * The per-user isolation cases are the security-critical ones: a medicine must
 * be unreachable from another user's id, whether reading, updating or deleting.
 */

import { runMigrations } from '@/db/migrations';
import { JsonMedicationRepository } from '@/db/repositories/JsonMedicationRepository';
import type { MedicationRepository } from '@/db/repositories/MedicationRepository';
import { SqliteMedicationRepository } from '@/db/repositories/SqliteMedicationRepository';
import type { MedicationInput } from '@/domain/medication';

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

const BASE_INPUT: MedicationInput = {
  name: 'Paracetamol',
  dosage: '500 mg',
  instructions: 'Take with food',
  expirationDate: '2027-04-30',
  frequency: 'Twice daily',
  notes: null,
};

let openDatabase: TestDatabase | null = null;

const backends = [
  {
    name: 'SqliteMedicationRepository',
    async make(): Promise<MedicationRepository> {
      openDatabase = createTestDatabase();
      await runMigrations(openDatabase);
      return new SqliteMedicationRepository(openDatabase);
    },
  },
  {
    name: 'JsonMedicationRepository',
    async make(): Promise<MedicationRepository> {
      const mock = jest.requireMock('expo-secure-store') as { __store: Map<string, string> };
      mock.__store.clear();
      return new JsonMedicationRepository();
    },
  },
];

describe.each(backends)('$name', ({ make }) => {
  let repository: MedicationRepository;

  beforeEach(async () => {
    repository = await make();
  });

  afterEach(() => {
    openDatabase?.close();
    openDatabase = null;
  });

  describe('create', () => {
    it('stores a medicine and applies the safe defaults', async () => {
      const result = await repository.create(ALICE, BASE_INPUT);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const medication = result.value;
      expect(medication.id).toEqual(expect.any(String));
      expect(medication.userId).toBe(ALICE);
      expect(medication.name).toBe('Paracetamol');
      expect(medication.dosage).toBe('500 mg');
      expect(medication.expirationDate).toBe('2027-04-30');

      // Safety is NOT decided here — only MedicationSafetyService may set it.
      expect(medication.safetyStatus).toBe('UNKNOWN');
      expect(medication.source).toBe('MANUAL');
      expect(medication.archived).toBe(false);
      expect(medication.scanConfidence).toBeNull();
    });

    it('keeps unknown fields as null rather than inventing a value', async () => {
      const result = await repository.create(ALICE, {
        name: 'Mystery tablets',
        dosage: null,
        instructions: null,
        expirationDate: null,
        frequency: null,
        notes: null,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.dosage).toBeNull();
      expect(result.value.expirationDate).toBeNull();
      expect(result.value.instructions).toBeNull();
      expect(result.value.frequency).toBeNull();
    });

    it('records provenance when a medicine comes from a scan', async () => {
      const result = await repository.create(ALICE, {
        ...BASE_INPUT,
        source: 'SCAN',
        scanConfidence: 0.82,
        imageUri: 'file:///label.jpg',
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.source).toBe('SCAN');
      expect(result.value.scanConfidence).toBeCloseTo(0.82);
      expect(result.value.imageUri).toBe('file:///label.jpg');
    });
  });

  describe('structured fields (schema v2)', () => {
    it('stores kind and form, and leaves them null when not chosen', async () => {
      const chosen = await repository.create(ALICE, {
        ...BASE_INPUT,
        kind: 'OTC',
        form: 'TABLET',
      });
      expect(chosen.ok && chosen.value).toMatchObject({ kind: 'OTC', form: 'TABLET', conditionIds: [] });

      const unchosen = await repository.create(ALICE, BASE_INPUT);
      expect(unchosen.ok && unchosen.value).toMatchObject({ kind: null, form: null, conditionIds: [] });

      if (!chosen.ok) return;
      const updated = await repository.update(ALICE, chosen.value.id, {
        ...BASE_INPUT,
        kind: 'PRESCRIPTION',
        form: null,
      });
      expect(updated.ok && updated.value).toMatchObject({ kind: 'PRESCRIPTION', form: null });

      const listed = await repository.listForUser(ALICE);
      expect(listed.ok && listed.value.find((m) => m.id === chosen.value.id)?.kind).toBe(
        'PRESCRIPTION',
      );
    });
  });

  describe('listForUser', () => {
    it('returns only the requesting user’s medicines', async () => {
      await repository.create(ALICE, { ...BASE_INPUT, name: 'Alice medicine' });
      await repository.create(BOB, { ...BASE_INPUT, name: 'Bob medicine' });

      const result = await repository.listForUser(ALICE);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toHaveLength(1);
      expect(result.value[0].name).toBe('Alice medicine');
    });

    it('sorts by name, ignoring capitalisation', async () => {
      await repository.create(ALICE, { ...BASE_INPUT, name: 'zinc' });
      await repository.create(ALICE, { ...BASE_INPUT, name: 'Aspirin' });
      await repository.create(ALICE, { ...BASE_INPUT, name: 'ibuprofen' });

      const result = await repository.listForUser(ALICE);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.map((m) => m.name)).toEqual(['Aspirin', 'ibuprofen', 'zinc']);
    });

    it('returns an empty list for a user with no medicines', async () => {
      const result = await repository.listForUser(ALICE);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toEqual([]);
    });
  });

  describe('getById', () => {
    it('returns the medicine for its owner', async () => {
      const created = await repository.create(ALICE, BASE_INPUT);
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      const result = await repository.getById(ALICE, created.value.id);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value?.name).toBe('Paracetamol');
    });

    it('does NOT return another user’s medicine', async () => {
      const created = await repository.create(ALICE, BASE_INPUT);
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      // Bob knows the id but must still get nothing back.
      const result = await repository.getById(BOB, created.value.id);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toBeNull();
    });
  });

  describe('update', () => {
    it('changes the editable fields and keeps createdAt', async () => {
      const created = await repository.create(ALICE, BASE_INPUT);
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      const result = await repository.update(ALICE, created.value.id, {
        ...BASE_INPUT,
        name: 'Paracetamol 1g',
        dosage: '1000 mg',
        notes: 'Prescribed by Dr Ahmed',
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.name).toBe('Paracetamol 1g');
      expect(result.value.dosage).toBe('1000 mg');
      expect(result.value.notes).toBe('Prescribed by Dr Ahmed');
      expect(result.value.createdAt).toBe(created.value.createdAt);
    });

    it('can clear a field back to null', async () => {
      const created = await repository.create(ALICE, BASE_INPUT);
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      const result = await repository.update(ALICE, created.value.id, {
        ...BASE_INPUT,
        expirationDate: null,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.expirationDate).toBeNull();
    });

    it('refuses to update another user’s medicine', async () => {
      const created = await repository.create(ALICE, BASE_INPUT);
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      const result = await repository.update(BOB, created.value.id, {
        ...BASE_INPUT,
        name: 'Hijacked',
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('NOT_FOUND');

      // And the original is untouched.
      const original = await repository.getById(ALICE, created.value.id);
      expect(original.ok).toBe(true);
      if (!original.ok) return;
      expect(original.value?.name).toBe('Paracetamol');
    });

    it('reports NOT_FOUND for an id that does not exist', async () => {
      const result = await repository.update(ALICE, 'no-such-id', BASE_INPUT);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('NOT_FOUND');
    });
  });

  describe('remove', () => {
    it('deletes the medicine', async () => {
      const created = await repository.create(ALICE, BASE_INPUT);
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      const removed = await repository.remove(ALICE, created.value.id);
      expect(removed.ok).toBe(true);

      const list = await repository.listForUser(ALICE);
      expect(list.ok).toBe(true);
      if (!list.ok) return;
      expect(list.value).toEqual([]);
    });

    it('reports NOT_FOUND when deleting twice', async () => {
      const created = await repository.create(ALICE, BASE_INPUT);
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      await repository.remove(ALICE, created.value.id);
      const second = await repository.remove(ALICE, created.value.id);

      expect(second.ok).toBe(false);
      if (second.ok) return;
      expect(second.error.code).toBe('NOT_FOUND');
    });

    it('refuses to delete another user’s medicine', async () => {
      const created = await repository.create(ALICE, BASE_INPUT);
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      const result = await repository.remove(BOB, created.value.id);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('NOT_FOUND');

      // Alice's medicine survives.
      const list = await repository.listForUser(ALICE);
      expect(list.ok).toBe(true);
      if (!list.ok) return;
      expect(list.value).toHaveLength(1);
    });
  });
});
