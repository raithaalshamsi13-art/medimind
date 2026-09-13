/**
 * Web build: no notifications. Metro picks this file instead of index.ts,
 * so `expo-notifications` never enters the browser bundle (the same
 * platform split as `db/database.web.ts` and `ui/DateField.web.tsx`).
 */

import { NoopNotificationService } from './NoopNotificationService';
import type { NotificationService } from './NotificationService';

const service: NotificationService = new NoopNotificationService();

export function getNotificationService(): NotificationService {
  return service;
}

export type { NotificationPermission, NotificationService } from './NotificationService';
