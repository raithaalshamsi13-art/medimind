/**
 * Reminder and dose data access contracts.
 *
 * Same rules as every other repository: every method takes `userId`, every
 * implementation scopes by it, screens see only the interface.
 *
 * Doses are created lazily: `ensureDoses` inserts the UPCOMING rows for the
 * occurrences it is given and leaves existing rows (whatever their status)
 * untouched — the (reminder, scheduled time) pair is unique.
 */

import type {
  Dose,
  DoseStatus,
  Reminder,
  ReminderCreateInput,
  ReminderInput,
} from '@/domain/reminder';
import type { Result } from '@/lib/result';

import type { MedicationRepositoryKind } from './MedicationRepository';

export type ReminderRepository = {
  readonly kind: MedicationRepositoryKind;

  /** All of one user's reminders (every member). */
  listForUser(userId: string): Promise<Result<Reminder[]>>;
  getById(userId: string, id: string): Promise<Result<Reminder | null>>;
  /** The reminder for one medicine, or null. At most one per medicine. */
  getForMedication(userId: string, medicationId: string): Promise<Result<Reminder | null>>;
  create(userId: string, input: ReminderCreateInput): Promise<Result<Reminder>>;
  update(userId: string, id: string, input: ReminderInput): Promise<Result<Reminder>>;
  /** Replace the stored OS notification ids after (re)scheduling. */
  setNotificationIds(userId: string, id: string, ids: string[]): Promise<Result<void>>;
  remove(userId: string, id: string): Promise<Result<void>>;
};

export type DoseSeed = {
  reminderId: string;
  medicationId: string;
  memberId: string;
  scheduledAt: string;
};

export type DoseRepository = {
  readonly kind: MedicationRepositoryKind;

  /** Doses with `from <= scheduledAt <= to` (inclusive, string compare), ascending. */
  listBetween(userId: string, from: string, to: string): Promise<Result<Dose[]>>;
  /** Insert UPCOMING rows for any seed that does not exist yet. */
  ensureDoses(userId: string, seeds: DoseSeed[]): Promise<Result<void>>;
  setStatus(userId: string, id: string, status: DoseStatus, actedAt: string | null): Promise<Result<Dose>>;
  setFollowUpNotificationId(userId: string, id: string, notificationId: string | null): Promise<Result<void>>;
  /** Mark every UPCOMING dose scheduled before `cutoff` as MISSED. Returns how many. */
  markMissedBefore(userId: string, cutoff: string, actedAt: string): Promise<Result<number>>;
};
