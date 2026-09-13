/**
 * SQLite implementations of ReminderRepository and DoseRepository.
 *
 * JSON columns (`times`, `days`, `notification_ids`) are small arrays that are
 * always read and written whole, so a text column is simpler and safer than a
 * side table. Cascades come from the schema v5 foreign keys.
 */

import {
  DOSE_STATUSES,
  REMINDER_FREQUENCIES,
  type Dose,
  type DoseStatus,
  type Reminder,
  type ReminderCreateInput,
  type ReminderFrequency,
  type ReminderInput,
  type Weekday,
} from '@/domain/reminder';
import { isoNow } from '@/lib/datetime';
import { appError, toAppError } from '@/lib/errors';
import { newId } from '@/lib/ids';
import { fail, ok, type Result } from '@/lib/result';

import type { SqlDatabase } from '../types';
import type { DoseRepository, DoseSeed, ReminderRepository } from './ReminderRepository';

type ReminderRow = {
  id: string;
  user_id: string;
  member_id: string;
  medication_id: string;
  times: string;
  dose_label: string | null;
  frequency: string;
  days: string;
  start_date: string | null;
  end_date: string | null;
  enabled: number;
  notification_ids: string;
  created_at: string;
  updated_at: string;
};

type DoseRow = {
  id: string;
  user_id: string;
  member_id: string;
  medication_id: string;
  reminder_id: string;
  scheduled_at: string;
  status: string;
  acted_at: string | null;
  follow_up_notification_id: string | null;
  created_at: string;
  updated_at: string;
};

function parseJsonArray<T>(text: string, guard: (v: unknown) => v is T): T[] {
  try {
    const parsed: unknown = JSON.parse(text);
    return Array.isArray(parsed) ? parsed.filter(guard) : [];
  } catch {
    return [];
  }
}

const isString = (v: unknown): v is string => typeof v === 'string';
const isWeekday = (v: unknown): v is Weekday => typeof v === 'number' && v >= 0 && v <= 6;

function toFrequency(value: string): ReminderFrequency {
  return (REMINDER_FREQUENCIES as readonly string[]).includes(value)
    ? (value as ReminderFrequency)
    : 'DAILY';
}

function toStatus(value: string): DoseStatus {
  return (DOSE_STATUSES as readonly string[]).includes(value) ? (value as DoseStatus) : 'UPCOMING';
}

export function mapReminderRow(row: ReminderRow): Reminder {
  return {
    id: row.id,
    userId: row.user_id,
    memberId: row.member_id,
    medicationId: row.medication_id,
    times: parseJsonArray(row.times, isString),
    doseLabel: row.dose_label,
    frequency: toFrequency(row.frequency),
    days: parseJsonArray(row.days, isWeekday),
    startDate: row.start_date,
    endDate: row.end_date,
    enabled: row.enabled === 1,
    notificationIds: parseJsonArray(row.notification_ids, isString),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDoseRow(row: DoseRow): Dose {
  return {
    id: row.id,
    userId: row.user_id,
    memberId: row.member_id,
    medicationId: row.medication_id,
    reminderId: row.reminder_id,
    scheduledAt: row.scheduled_at,
    status: toStatus(row.status),
    actedAt: row.acted_at,
    followUpNotificationId: row.follow_up_notification_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const REMINDER_COLUMNS = `
  id, user_id, member_id, medication_id, times, dose_label, frequency, days,
  start_date, end_date, enabled, notification_ids, created_at, updated_at
`;

const DOSE_COLUMNS = `
  id, user_id, member_id, medication_id, reminder_id, scheduled_at, status,
  acted_at, follow_up_notification_id, created_at, updated_at
`;

export class SqliteReminderRepository implements ReminderRepository {
  readonly kind = 'sqlite' as const;

  constructor(private readonly db: SqlDatabase) {}

  async listForUser(userId: string): Promise<Result<Reminder[]>> {
    try {
      const rows = await this.db.getAllAsync<ReminderRow>(
        `SELECT ${REMINDER_COLUMNS} FROM reminders WHERE user_id = ? ORDER BY created_at ASC, rowid ASC`,
        [userId],
      );
      return ok(rows.map(mapReminderRow));
    } catch (error) {
      return fail(toAppError(error, 'DATABASE_ERROR'));
    }
  }

  async getById(userId: string, id: string): Promise<Result<Reminder | null>> {
    try {
      const row = await this.db.getFirstAsync<ReminderRow>(
        `SELECT ${REMINDER_COLUMNS} FROM reminders WHERE id = ? AND user_id = ?`,
        [id, userId],
      );
      return ok(row ? mapReminderRow(row) : null);
    } catch (error) {
      return fail(toAppError(error, 'DATABASE_ERROR'));
    }
  }

  async getForMedication(userId: string, medicationId: string): Promise<Result<Reminder | null>> {
    try {
      const row = await this.db.getFirstAsync<ReminderRow>(
        `SELECT ${REMINDER_COLUMNS} FROM reminders WHERE medication_id = ? AND user_id = ?`,
        [medicationId, userId],
      );
      return ok(row ? mapReminderRow(row) : null);
    } catch (error) {
      return fail(toAppError(error, 'DATABASE_ERROR'));
    }
  }

  async create(userId: string, input: ReminderCreateInput): Promise<Result<Reminder>> {
    const now = isoNow();
    const reminder: Reminder = {
      id: newId(),
      userId,
      memberId: input.memberId,
      medicationId: input.medicationId,
      times: input.times,
      doseLabel: input.doseLabel,
      frequency: input.frequency,
      days: input.days,
      startDate: input.startDate,
      endDate: input.endDate,
      enabled: input.enabled,
      notificationIds: [],
      createdAt: now,
      updatedAt: now,
    };
    try {
      await this.db.runAsync(
        `INSERT INTO reminders (${REMINDER_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          reminder.id,
          reminder.userId,
          reminder.memberId,
          reminder.medicationId,
          JSON.stringify(reminder.times),
          reminder.doseLabel,
          reminder.frequency,
          JSON.stringify(reminder.days),
          reminder.startDate,
          reminder.endDate,
          reminder.enabled ? 1 : 0,
          JSON.stringify(reminder.notificationIds),
          reminder.createdAt,
          reminder.updatedAt,
        ],
      );
      return ok(reminder);
    } catch (error) {
      return fail(toAppError(error, 'DATABASE_ERROR'));
    }
  }

  async update(userId: string, id: string, input: ReminderInput): Promise<Result<Reminder>> {
    try {
      const result = await this.db.runAsync(
        `UPDATE reminders
            SET times = ?, dose_label = ?, frequency = ?, days = ?, start_date = ?, end_date = ?,
                enabled = ?, updated_at = ?
          WHERE id = ? AND user_id = ?`,
        [
          JSON.stringify(input.times),
          input.doseLabel,
          input.frequency,
          JSON.stringify(input.days),
          input.startDate,
          input.endDate,
          input.enabled ? 1 : 0,
          isoNow(),
          id,
          userId,
        ],
      );
      if (result.changes === 0) return fail(appError('NOT_FOUND'));
      const updated = await this.getById(userId, id);
      if (!updated.ok) return updated;
      if (!updated.value) return fail(appError('NOT_FOUND'));
      return ok(updated.value);
    } catch (error) {
      return fail(toAppError(error, 'DATABASE_ERROR'));
    }
  }

  async setNotificationIds(userId: string, id: string, ids: string[]): Promise<Result<void>> {
    try {
      const result = await this.db.runAsync(
        `UPDATE reminders SET notification_ids = ? WHERE id = ? AND user_id = ?`,
        [JSON.stringify(ids), id, userId],
      );
      if (result.changes === 0) return fail(appError('NOT_FOUND'));
      return ok(undefined);
    } catch (error) {
      return fail(toAppError(error, 'DATABASE_ERROR'));
    }
  }

  async remove(userId: string, id: string): Promise<Result<void>> {
    try {
      const result = await this.db.runAsync(`DELETE FROM reminders WHERE id = ? AND user_id = ?`, [
        id,
        userId,
      ]);
      if (result.changes === 0) return fail(appError('NOT_FOUND'));
      return ok(undefined);
    } catch (error) {
      return fail(toAppError(error, 'DATABASE_ERROR'));
    }
  }
}

export class SqliteDoseRepository implements DoseRepository {
  readonly kind = 'sqlite' as const;

  constructor(private readonly db: SqlDatabase) {}

  async listBetween(userId: string, from: string, to: string): Promise<Result<Dose[]>> {
    try {
      const rows = await this.db.getAllAsync<DoseRow>(
        `SELECT ${DOSE_COLUMNS} FROM doses
          WHERE user_id = ? AND scheduled_at >= ? AND scheduled_at <= ?
          ORDER BY scheduled_at ASC, rowid ASC`,
        [userId, from, to],
      );
      return ok(rows.map(mapDoseRow));
    } catch (error) {
      return fail(toAppError(error, 'DATABASE_ERROR'));
    }
  }

  async ensureDoses(userId: string, seeds: DoseSeed[]): Promise<Result<void>> {
    if (seeds.length === 0) return ok(undefined);
    try {
      const now = isoNow();
      await this.db.withTransactionAsync(async () => {
        for (const seed of seeds) {
          // INSERT … SELECT keeps the reminder scoped to this user: a seed
          // for someone else's reminder inserts nothing.
          await this.db.runAsync(
            `INSERT OR IGNORE INTO doses
               (id, user_id, member_id, medication_id, reminder_id, scheduled_at, status,
                acted_at, follow_up_notification_id, created_at, updated_at)
             SELECT ?, r.user_id, r.member_id, r.medication_id, r.id, ?, 'UPCOMING', NULL, NULL, ?, ?
               FROM reminders r WHERE r.id = ? AND r.user_id = ?`,
            [newId(), seed.scheduledAt, now, now, seed.reminderId, userId],
          );
        }
      });
      return ok(undefined);
    } catch (error) {
      return fail(toAppError(error, 'DATABASE_ERROR'));
    }
  }

  async setStatus(
    userId: string,
    id: string,
    status: DoseStatus,
    actedAt: string | null,
  ): Promise<Result<Dose>> {
    try {
      const result = await this.db.runAsync(
        `UPDATE doses SET status = ?, acted_at = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
        [status, actedAt, isoNow(), id, userId],
      );
      if (result.changes === 0) return fail(appError('NOT_FOUND'));
      const row = await this.db.getFirstAsync<DoseRow>(
        `SELECT ${DOSE_COLUMNS} FROM doses WHERE id = ? AND user_id = ?`,
        [id, userId],
      );
      if (!row) return fail(appError('NOT_FOUND'));
      return ok(mapDoseRow(row));
    } catch (error) {
      return fail(toAppError(error, 'DATABASE_ERROR'));
    }
  }

  async setFollowUpNotificationId(
    userId: string,
    id: string,
    notificationId: string | null,
  ): Promise<Result<void>> {
    try {
      const result = await this.db.runAsync(
        `UPDATE doses SET follow_up_notification_id = ? WHERE id = ? AND user_id = ?`,
        [notificationId, id, userId],
      );
      if (result.changes === 0) return fail(appError('NOT_FOUND'));
      return ok(undefined);
    } catch (error) {
      return fail(toAppError(error, 'DATABASE_ERROR'));
    }
  }

  async markMissedBefore(userId: string, cutoff: string, actedAt: string): Promise<Result<number>> {
    try {
      const result = await this.db.runAsync(
        `UPDATE doses SET status = 'MISSED', acted_at = ?, updated_at = ?
          WHERE user_id = ? AND status = 'UPCOMING' AND scheduled_at < ?`,
        [actedAt, isoNow(), userId, cutoff],
      );
      return ok(result.changes);
    } catch (error) {
      return fail(toAppError(error, 'DATABASE_ERROR'));
    }
  }
}
