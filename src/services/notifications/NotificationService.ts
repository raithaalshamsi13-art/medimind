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

/** What the user did with a notification. */
export type NotificationResponse =
  /** Pressed the Taken / Skip action on a reminder notification. */
  | { kind: 'mark'; reminderId: string; time: string; status: 'TAKEN' | 'SKIPPED' }
  /** Pressed Snooze: remind again in a few minutes. */
  | { kind: 'snooze'; reminderId: string; time: string }
  /** Tapped the notification itself — open the schedule (and announce the dose). */
  | { kind: 'open'; reminderId?: string; time?: string };

/** A reminder notification arriving while the app is open. */
export type NotificationArrival = { reminderId: string; time: string };

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

  /** Listen for taps and action buttons. Returns an unsubscribe function. */
  subscribe(handler: (response: NotificationResponse) => void): () => void;

  /** Listen for reminders that arrive while the app is in the foreground. */
  subscribeArrivals(handler: (arrival: NotificationArrival) => void): () => void;

  /** One more nudge for the same dose in `minutes`. Returns the id or null. */
  scheduleSnooze(
    reminderId: string,
    time: string,
    medicationName: string,
    doseLabel: string | null,
    minutes: number,
  ): Promise<string | null>;
}
