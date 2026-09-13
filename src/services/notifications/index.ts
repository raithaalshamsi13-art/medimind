/**
 * Notification service factory (native build). The web build is
 * `index.web.ts`. Falls back to the no-op service if the native module
 * cannot be loaded, so a missing module can never crash the app.
 */

import { NoopNotificationService } from './NoopNotificationService';
import type { NotificationService } from './NotificationService';

let service: NotificationService | null = null;

export function getNotificationService(): NotificationService {
  if (service) return service;
  try {
    // Required lazily so Jest (and any environment without the native
    // module) gets the no-op service instead of a load-time crash.
    const { ExpoNotificationService } = require('./ExpoNotificationService') as typeof import('./ExpoNotificationService');
    service = new ExpoNotificationService();
  } catch (error) {
    console.warn(
      '[MediMind] expo-notifications unavailable; reminders will not notify. ' +
        `${error instanceof Error ? error.message : String(error)}`,
    );
    service = new NoopNotificationService();
  }
  return service;
}

/** Tests: force a specific implementation. */
export function setNotificationService(next: NotificationService | null): void {
  service = next;
}

export type { NotificationPermission, NotificationService } from './NotificationService';
