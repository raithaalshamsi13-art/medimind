/**
 * SQLite implementation of HealthConditionRepository.
 *
 * As with medicines, `user_id = ?` is in every WHERE clause. Deleting a
 * condition relies on the `ON DELETE CASCADE` on medication_conditions, which
 * only works because database.ts turns `PRAGMA foreign_keys` on.
 */

import {
  CONDITION_TYPES,
  type ConditionType,
  type HealthCondition,
  type HealthConditionInput,
} from '@/domain/healthCondition';
import { isoNow } from '@/lib/datetime';
import { appError, toAppError } from '@/lib/errors';
import { newId } from '@/lib/ids';
import { fail, ok, type Result } from '@/lib/result';

import type { SqlDatabase } from '../types';
import type { HealthConditionRepository } from './HealthConditionRepository';

type ConditionRow = {
  id: string;
  user_id: string;
  type: string;
  custom_name: string | null;
  reading: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function toConditionType(value: string): ConditionType {
  return (CONDITION_TYPES as readonly string[]).includes(value)
    ? (value as ConditionType)
    : 'OTHER';
}

function mapRow(row: ConditionRow): HealthCondition {
  return {
    id: row.id,
    userId: row.user_id,
    type: toConditionType(row.type),
    customName: row.custom_name,
    reading: row.reading,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_COLUMNS = `id, user_id, type, custom_name, reading, notes, created_at, updated_at`;

export class SqliteHealthConditionRepository implements HealthConditionRepository {
  readonly kind = 'sqlite' as const;

  constructor(private readonly db: SqlDatabase) {}

  async listForUser(userId: string): Promise<Result<HealthCondition[]>> {
    try {
      const rows = await this.db.getAllAsync<ConditionRow>(
        `SELECT ${SELECT_COLUMNS} FROM health_conditions
          WHERE user_id = ?
          ORDER BY created_at ASC, rowid ASC`,
        [userId],
      );
      return ok(rows.map(mapRow));
    } catch (error) {
      return fail(toAppError(error, 'DATABASE_ERROR'));
    }
  }

  async getById(userId: string, id: string): Promise<Result<HealthCondition | null>> {
    try {
      const row = await this.db.getFirstAsync<ConditionRow>(
        `SELECT ${SELECT_COLUMNS} FROM health_conditions WHERE id = ? AND user_id = ?`,
        [id, userId],
      );
      return ok(row ? mapRow(row) : null);
    } catch (error) {
      return fail(toAppError(error, 'DATABASE_ERROR'));
    }
  }

  async create(userId: string, input: HealthConditionInput): Promise<Result<HealthCondition>> {
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

    try {
      await this.db.runAsync(
        `INSERT INTO health_conditions
           (id, user_id, type, custom_name, reading, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          condition.id,
          condition.userId,
          condition.type,
          condition.customName,
          condition.reading,
          condition.notes,
          condition.createdAt,
          condition.updatedAt,
        ],
      );
      return ok(condition);
    } catch (error) {
      return fail(toAppError(error, 'DATABASE_ERROR'));
    }
  }

  async update(
    userId: string,
    id: string,
    input: HealthConditionInput,
  ): Promise<Result<HealthCondition>> {
    try {
      const result = await this.db.runAsync(
        `UPDATE health_conditions
            SET type = ?, custom_name = ?, reading = ?, notes = ?, updated_at = ?
          WHERE id = ? AND user_id = ?`,
        [input.type, input.customName, input.reading, input.notes, isoNow(), id, userId],
      );
      if (result.changes === 0) return fail(appError('NOT_FOUND'));

      const updated = await this.getById(userId, id);
      if (!updated.ok) return fail(updated.error);
      if (!updated.value) return fail(appError('NOT_FOUND'));
      return ok(updated.value);
    } catch (error) {
      return fail(toAppError(error, 'DATABASE_ERROR'));
    }
  }

  async remove(userId: string, id: string): Promise<Result<void>> {
    try {
      const result = await this.db.runAsync(
        `DELETE FROM health_conditions WHERE id = ? AND user_id = ?`,
        [id, userId],
      );
      if (result.changes === 0) return fail(appError('NOT_FOUND'));
      return ok(undefined);
    } catch (error) {
      return fail(toAppError(error, 'DATABASE_ERROR'));
    }
  }
}
