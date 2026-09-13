/**
 * Notifications where there are none (web, tests). Every call succeeds and
 * does nothing; `isAvailable` is false so the Schedule tab can say
 * "Notifications are not available in the browser".
 */

import type { NotificationPermission, NotificationService } from './NotificationService';

export class NoopNotificationService implements NotificationService {
  readonly isAvailable = false;

  async getPermission(): Promise<NotificationPermission> {
    return 'denied';
  }

  async requestPermission(): Promise<NotificationPermission> {
    return 'denied';
  }

  async scheduleReminder(): Promise<string[]> {
    return [];
  }

  async scheduleMissedFollowUp(): Promise<string | null> {
    return null;
  }

  async cancel(): Promise<void> {}

  async cancelAll(): Promise<void> {}

  subscribe(): () => void {
    return () => {};
  }
}
