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
  MEDICATION_FORMS,
  MEDICATION_KINDS,
  MEDICATION_SOURCES,
  SAFETY_STATUSES,
  type Medication,
  type MedicationCreateInput,
  type MedicationForm,
  type MedicationInput,
  type MedicationKind,
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
  kind: string | null;
  form: string | null;
};

type LinkRow = { medication_id: string; condition_id: string };

function toKind(value: string | null): MedicationKind | null {
  return value !== null && (MEDICATION_KINDS as readonly string[]).includes(value)
    ? (value as MedicationKind)
    : null;
}

function toForm(value: string | null): MedicationForm | null {
  return value !== null && (MEDICATION_FORMS as readonly string[]).includes(value)
    ? (value as MedicationForm)
    : null;
}

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

/** snake_case row → camelCase domain object. Links are attached separately. */
function mapRow(row: MedicationRow, conditionIds: string[] = []): Medication {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    kind: toKind(row.kind),
    form: toForm(row.form),
    conditionIds,
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
  created_at, updated_at, kind, form
`;

/** De-duplicate and drop blanks so a bad caller cannot write junk links. */
function normaliseConditionIds(ids: string[] | undefined): string[] {
  return Array.from(new Set((ids ?? []).filter((id) => id.length > 0)));
}

export class SqliteMedicationRepository implements MedicationRepository {
  readonly kind = 'sqlite' as const;
  readonly isPersistent = true;

  constructor(private readonly db: SqlDatabase) {}

  /** medication_id → condition ids, for one user, in one query. */
  private async linksForUser(userId: string): Promise<Map<string, string[]>> {
    const rows = await this.db.getAllAsync<LinkRow>(
      `SELECT medication_id, condition_id FROM medication_conditions
        WHERE user_id = ? ORDER BY rowid ASC`,
      [userId],
    );
    const byMedication = new Map<string, string[]>();
    for (const row of rows) {
      const list = byMedication.get(row.medication_id) ?? [];
      list.push(row.condition_id);
      byMedication.set(row.medication_id, list);
    }
    return byMedication;
  }

  /**
   * Replace a medicine's links. Runs inside the caller's transaction. Links to
   * a condition that is not this user's are refused by the WHERE clause on the
   * lookup, so one user can never reference another user's condition.
   */
  private async writeLinks(userId: string, medicationId: string, ids: string[]): Promise<void> {
    await this.db.runAsync(
      `DELETE FROM medication_conditions WHERE medication_id = ? AND user_id = ?`,
      [medicationId, userId],
    );
    for (const conditionId of ids) {
      await this.db.runAsync(
        `INSERT INTO medication_conditions (medication_id, condition_id, user_id)
         SELECT ?, id, user_id FROM health_conditions WHERE id = ? AND user_id = ?`,
        [medicationId, conditionId, userId],
      );
    }
  }

  async listForUser(userId: string): Promise<Result<Medication[]>> {
    try {
      const rows = await this.db.getAllAsync<MedicationRow>(
        `SELECT ${SELECT_COLUMNS}
           FROM medications
          WHERE user_id = ? AND archived = 0
          ORDER BY name COLLATE NOCASE ASC`,
        [userId],
      );
      const links = await this.linksForUser(userId);
      return ok(rows.map((row) => mapRow(row, links.get(row.id) ?? [])));
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
      if (!row) return ok(null);
      const links = await this.db.getAllAsync<LinkRow>(
        `SELECT medication_id, condition_id FROM medication_conditions
          WHERE medication_id = ? AND user_id = ? ORDER BY rowid ASC`,
        [id, userId],
      );
      return ok(mapRow(row, links.map((link) => link.condition_id)));
    } catch (error) {
      return fail(toAppError(error, 'DATABASE_ERROR'));
    }
  }

  async create(userId: string, input: MedicationCreateInput): Promise<Result<Medication>> {
    const now = isoNow();
    const conditionIds = normaliseConditionIds(input.conditionIds);
    const medication: Medication = {
      id: newId(),
      userId,
      name: input.name,
      kind: input.kind ?? null,
      form: input.form ?? null,
      conditionIds,
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
      await this.db.withTransactionAsync(async () => {
        await this.db.runAsync(
          `INSERT INTO medications (
             id, user_id, name, dosage, instructions, expiration_date, frequency,
             safety_status, source, scan_confidence, notes, image_uri, archived,
             created_at, updated_at, kind, form
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
            medication.kind,
            medication.form,
          ],
        );
        await this.writeLinks(userId, medication.id, conditionIds);
      });
      // Report the links that were actually stored (a foreign id is dropped).
      return this.getById(userId, medication.id).then((stored) =>
        stored.ok && stored.value ? ok(stored.value) : ok(medication),
      );
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
      let changes = 0;
      await this.db.withTransactionAsync(async () => {
        const result = await this.db.runAsync(
          `UPDATE medications
              SET name = ?, dosage = ?, instructions = ?, expiration_date = ?,
                  frequency = ?, notes = ?, kind = ?, form = ?, updated_at = ?
            WHERE id = ? AND user_id = ?`,
          [
            input.name,
            input.dosage,
            input.instructions,
            input.expirationDate,
            input.frequency,
            input.notes,
            input.kind ?? null,
            input.form ?? null,
            isoNow(),
            id,
            userId,
          ],
        );
        changes = result.changes;
        if (changes > 0 && input.conditionIds !== undefined) {
          await this.writeLinks(userId, id, normaliseConditionIds(input.conditionIds));
        }
      });

      // Nothing changed => no such medicine for this user.
      if (changes === 0) {
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
