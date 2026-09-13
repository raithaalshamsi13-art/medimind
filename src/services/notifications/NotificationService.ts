/**
 * Local-notification contract.
 *
 * Two implementations, same pattern as everything else in `services/`:
 *   ExpoNotificationService  the real one, on the phone (expo-notifications)
 *   NoopNotificationService  web and any environment without notifications —
 *                            every call succeeds and does nothing, and
 *                            `isAvailable` is false so screens can say so
 *
 * The wording of every notification is fixed here in one place:
 *   reminder:  "Time for your medicine" — "<Name>, <dose label>"
 *   follow-up: "You may have missed a dose" — never "take it now"
 */

import type { Reminder } from '@/domain/reminder';

export type NotificationPermission = 'granted' | 'denied' | 'undetermined';

export interface NotificationService {
  /** False on web and when the native module is missing. */
  readonly isAvailable: boolean;

  getPermission(): Promise<NotificationPermission>;
  requestPermission(): Promise<NotificationPermission>;

  /**
   * Schedule the repeating notifications for one reminder (one per time,
   * daily or weekly per chosen day). Returns the OS identifiers.
   */
  scheduleReminder(reminder: Reminder, medicationName: string): Promise<string[]>;

  /**
   * One gentle, one-off follow-up at `at`. Returns the identifier, or null
   * when not scheduled (no permission, in the past, unavailable).
   */
  scheduleMissedFollowUp(at: Date, medicationName: string, doseId: string): Promise<string | null>;

  cancel(identifiers: string[]): Promise<void>;
  cancelAll(): Promise<void>;
}
