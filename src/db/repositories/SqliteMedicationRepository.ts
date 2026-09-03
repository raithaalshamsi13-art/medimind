/**
 * SQLite implementation — the real data layer used on the device.
 *
 * Two things to notice in the SQL below:
 *   1. `user_id = ?` appears in the WHERE clause of every single statement,
 *      including reads by primary key. That is the per-user isolation rule
 *      enforced at the query level rather than trusted to the caller.
 *   2. `update` and `remove` inspect `result.changes`. Zero rows changed means
 *      the id did not exist *for this user*, which we report as NOT_FOUND
 *      instead of silently succeeding.
 */

import {
  MEDICATION_SOURCES,
  SAFETY_STATUSES,
  type Medication,
  type MedicationCreateInput,
  type MedicationInput,
  type MedicationSource,
  type SafetyStatus,
} from '@/domain/medication';
import { isoNow } from '@/lib/datetime';
import { appError, toAppError } from '@/lib/errors';
import { newId } from '@/lib/ids';
import { fail, ok, type Result } from '@/lib/result';

import type { SqlDatabase } from '../types';
import type { MedicationRepository } from './MedicationRepository';

/** Raw column shape, snake_case exactly as stored. */
type MedicationRow = {
  id: string;
  user_id: string;
  name: string;
  dosage: string | null;
  instructions: string | null;
  expiration_date: string | null;
  frequency: string | null;
  safety_status: string;
  source: string;
  scan_confidence: number | null;
  notes: string | null;
  image_uri: string | null;
  archived: number;
  created_at: string;
  updated_at: string;
};

function toSafetyStatus(value: string): SafetyStatus {
  return (SAFETY_STATUSES as readonly string[]).includes(value)
    ? (value as SafetyStatus)
    : 'UNKNOWN';
}

function toSource(value: string): MedicationSource {
  return (MEDICATION_SOURCES as readonly string[]).includes(value)
    ? (value as MedicationSource)
    : 'MANUAL';
}

/** snake_case row → camelCase domain object. */
function mapRow(row: MedicationRow): Medication {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    dosage: row.dosage,
    instructions: row.instructions,
    expirationDate: row.expiration_date,
    frequency: row.frequency,
    safetyStatus: toSafetyStatus(row.safety_status),
    source: toSource(row.source),
    scanConfidence: row.scan_confidence,
    notes: row.notes,
    imageUri: row.image_uri,
    // SQLite has no boolean type — 0/1 is stored, enforced by a CHECK.
    archived: row.archived === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_COLUMNS = `
  id, user_id, name, dosage, instructions, expiration_date, frequency,
  safety_status, source, scan_confidence, notes, image_uri, archived,
  created_at, updated_at
`;

export class SqliteMedicationRepository implements MedicationRepository {
  readonly kind = 'sqlite' as const;
  readonly isPersistent = true;

  constructor(private readonly db: SqlDatabase) {}

  async listForUser(userId: string): Promise<Result<Medication[]>> {
    try {
      const rows = await this.db.getAllAsync<MedicationRow>(
        `SELECT ${SELECT_COLUMNS}
           FROM medications
          WHERE user_id = ? AND archived = 0
          ORDER BY name COLLATE NOCASE ASC`,
        [userId],
      );
      return ok(rows.map(mapRow));
    } catch (error) {
      return fail(toAppError(error, 'DATABASE_ERROR'));
    }
  }

  async getById(userId: string, id: string): Promise<Result<Medication | null>> {
    try {
      const row = await this.db.getFirstAsync<MedicationRow>(
        `SELECT ${SELECT_COLUMNS}
           FROM medications
          WHERE id = ? AND user_id = ?`,
        [id, userId],
      );
      return ok(row ? mapRow(row) : null);
    } catch (error) {
      return fail(toAppError(error, 'DATABASE_ERROR'));
    }
  }

  async create(userId: string, input: MedicationCreateInput): Promise<Result<Medication>> {
    const now = isoNow();
    const medication: Medication = {
      id: newId(),
      userId,
      name: input.name,
      dosage: input.dosage,
      instructions: input.instructions,
      expirationDate: input.expirationDate,
      frequency: input.frequency,
      // Left UNKNOWN on purpose. MedicationSafetyService (Milestone 4) is the
      // only thing allowed to decide a safety status.
      safetyStatus: 'UNKNOWN',
      source: input.source ?? 'MANUAL',
      scanConfidence: input.scanConfidence ?? null,
      notes: input.notes,
      imageUri: input.imageUri ?? null,
      archived: false,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await this.db.runAsync(
        `INSERT INTO medications (
           id, user_id, name, dosage, instructions, expiration_date, frequency,
           safety_status, source, scan_confidence, notes, image_uri, archived,
           created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          medication.id,
          medication.userId,
          medication.name,
          medication.dosage,
          medication.instructions,
          medication.expirationDate,
          medication.frequency,
          medication.safetyStatus,
          medication.source,
          medication.scanConfidence,
          medication.notes,
          medication.imageUri,
          medication.archived ? 1 : 0,
          medication.createdAt,
          medication.updatedAt,
        ],
      );
      return ok(medication);
    } catch (error) {
      return fail(toAppError(error, 'DATABASE_ERROR'));
    }
  }

  async update(
    userId: string,
    id: string,
    input: MedicationInput,
  ): Promise<Result<Medication>> {
    try {
      const result = await this.db.runAsync(
        `UPDATE medications
            SET name = ?, dosage = ?, instructions = ?, expiration_date = ?,
                frequency = ?, notes = ?, updated_at = ?
          WHERE id = ? AND user_id = ?`,
        [
          input.name,
          input.dosage,
          input.instructions,
          input.expirationDate,
          input.frequency,
          input.notes,
          isoNow(),
          id,
          userId,
        ],
      );

      // Nothing changed => no such medicine for this user.
      if (result.changes === 0) {
        return fail(appError('NOT_FOUND'));
      }

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
        `DELETE FROM medications WHERE id = ? AND user_id = ?`,
        [id, userId],
      );

      if (result.changes === 0) {
        return fail(appError('NOT_FOUND'));
      }
      return ok(undefined);
    } catch (error) {
      return fail(toAppError(error, 'DATABASE_ERROR'));
    }
  }
}
