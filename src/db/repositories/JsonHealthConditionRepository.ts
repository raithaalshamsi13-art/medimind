/**
 * JSON fallback implementation of HealthConditionRepository (browser only).
 *
 * Mirrors the SQLite behaviour exactly, including the cascade: SQLite drops a
 * deleted condition's links through a foreign key, so this class edits the
 * stored medicines to strip the id by hand. The shared test suite checks both
 * backends do the same thing.
 */

import type { HealthCondition, HealthConditionInput } from '@/domain/healthCondition';
import type { Medication } from '@/domain/medication';
import { isoNow } from '@/lib/datetime';
import { appError } from '@/lib/errors';
import { newId } from '@/lib/ids';
import { fail, ok, type Result } from '@/lib/result';
import { readJson, STORAGE_KEYS, writeJson } from '@/lib/storage';

import type { HealthConditionRepository } from './HealthConditionRepository';

export class JsonHealthConditionRepository implements HealthConditionRepository {
  readonly kind = 'json' as const;

  private async readAll(): Promise<Result<HealthCondition[]>> {
    const stored = await readJson<HealthCondition[]>(STORAGE_KEYS.healthConditions);
    if (!stored.ok) return fail(stored.error);
    return ok(Array.isArray(stored.value) ? stored.value : []);
  }

  private async writeAll(conditions: HealthCondition[]): Promise<Result<void>> {
    return writeJson(STORAGE_KEYS.healthConditions, conditions);
  }

  async listForUser(userId: string): Promise<Result<HealthCondition[]>> {
    const all = await this.readAll();
    if (!all.ok) return fail(all.error);
    // The array is in insertion order, which is what the SQL's
    // `ORDER BY created_at, rowid` produces — two conditions added in the
    // same millisecond still come back in the order they were added.
    return ok(all.value.filter((condition) => condition.userId === userId));
  }

  async getById(userId: string, id: string): Promise<Result<HealthCondition | null>> {
    const all = await this.readAll();
    if (!all.ok) return fail(all.error);
    return ok(all.value.find((c) => c.id === id && c.userId === userId) ?? null);
  }

  async create(userId: string, input: HealthConditionInput): Promise<Result<HealthCondition>> {
    const all = await this.readAll();
    if (!all.ok) return fail(all.error);

    const now = isoNow();
    const condition: HealthCondition = {
      id: newId(),
      userId,
      type: input.type,
      customName: input.customName,
      reading: input.reading,
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
    };

    const saved = await this.writeAll([...all.value, condition]);
    if (!saved.ok) return fail(saved.error);
    return ok(condition);
  }

  async update(
    userId: string,
    id: string,
    input: HealthConditionInput,
  ): Promise<Result<HealthCondition>> {
    const all = await this.readAll();
    if (!all.ok) return fail(all.error);

    const index = all.value.findIndex((c) => c.id === id && c.userId === userId);
    if (index === -1) return fail(appError('NOT_FOUND'));

    const updated: HealthCondition = {
      ...all.value[index],
      type: input.type,
      customName: input.customName,
      reading: input.reading,
      notes: input.notes,
      updatedAt: isoNow(),
    };
    const next = [...all.value];
    next[index] = updated;

    const saved = await this.writeAll(next);
    if (!saved.ok) return fail(saved.error);
    return ok(updated);
  }

  async remove(userId: string, id: string): Promise<Result<void>> {
    const all = await this.readAll();
    if (!all.ok) return fail(all.error);

    const next = all.value.filter((c) => !(c.id === id && c.userId === userId));
    if (next.length === all.value.length) return fail(appError('NOT_FOUND'));

    const saved = await this.writeAll(next);
    if (!saved.ok) return saved;

    // Cascade by hand: drop the id from any medicine that linked to it.
    const medications = await readJson<Medication[]>(STORAGE_KEYS.medications);
    if (!medications.ok) return fail(medications.error);
    const list = Array.isArray(medications.value) ? medications.value : [];
    let touched = false;
    const cleaned = list.map((medication) => {
      const ids = medication.conditionIds ?? [];
      if (!ids.includes(id)) return medication;
      touched = true;
      return { ...medication, conditionIds: ids.filter((linked) => linked !== id) };
    });
    return touched ? writeJson(STORAGE_KEYS.medications, cleaned) : ok(undefined);
  }
}
