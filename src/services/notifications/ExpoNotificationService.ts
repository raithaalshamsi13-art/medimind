/**
 * Local notifications through expo-notifications.
 *
 * WHAT IS SCHEDULED
 *   - for each reminder time: a repeating trigger — daily, or weekly on each
 *     chosen weekday — carrying `{ kind: 'dose', reminderId, time }` so the
 *     app can find the dose when the user taps Taken / Skip on it
 *   - a one-off follow-up per dose, scheduled by the dose store at
 *     scheduled time + grace, cancelled when the dose is marked
 *
 * Runs inside Expo Go on iOS. Permission is requested once, with the reason
 * shown by the Schedule tab beforehand; a denied permission makes every
 * schedule call return no ids rather than throwing.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { Reminder } from '@/domain/reminder';
import { tNow } from '@/i18n';

import type {
  NotificationPermission,
  NotificationResponse,
  NotificationService,
} from './NotificationService';

export const DOSE_CATEGORY = 'MEDIMIND_DOSE';
export const ACTION_TAKEN = 'TAKEN';
export const ACTION_SKIPPED = 'SKIPPED';

export type DoseNotificationData = {
  kind: 'dose' | 'follow-up';
  reminderId?: string;
  time?: string;
  doseId?: string;
};

let configured = false;

async function configureOnce(): Promise<void> {
  if (configured) return;
  configured = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  await Notifications.setNotificationCategoryAsync(DOSE_CATEGORY, [
    { identifier: ACTION_TAKEN, buttonTitle: tNow('notif.taken'), options: { opensAppToForeground: false } },
    { identifier: ACTION_SKIPPED, buttonTitle: tNow('notif.skip'), options: { opensAppToForeground: false } },
  ]);

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: tNow('notif.channel'),
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
  }
}

function toPermission(status: Notifications.PermissionStatus): NotificationPermission {
  if (status === Notifications.PermissionStatus.GRANTED) return 'granted';
  if (status === Notifications.PermissionStatus.DENIED) return 'denied';
  return 'undetermined';
}

export class ExpoNotificationService implements NotificationService {
  readonly isAvailable = true;

  async getPermission(): Promise<NotificationPermission> {
    const { status } = await Notifications.getPermissionsAsync();
    return toPermission(status);
  }

  async requestPermission(): Promise<NotificationPermission> {
    await configureOnce();
    const { status } = await Notifications.requestPermissionsAsync();
    return toPermission(status);
  }

  async scheduleReminder(reminder: Reminder, medicationName: string): Promise<string[]> {
    await configureOnce();
    if ((await this.getPermission()) !== 'granted') return [];

    const ids: string[] = [];
    const body = reminder.doseLabel ? tNow('notif.body', { name: medicationName, dose: reminder.doseLabel }) : medicationName;

    for (const time of reminder.times) {
      const [hour, minute] = time.split(':').map(Number);
      const content: Notifications.NotificationContentInput = {
        title: tNow('notif.title'),
        body,
        categoryIdentifier: DOSE_CATEGORY,
        sound: 'default',
        data: { kind: 'dose', reminderId: reminder.id, time } satisfies DoseNotificationData,
      };

      if (reminder.frequency === 'SPECIFIC_DAYS') {
        for (const day of reminder.days) {
          ids.push(
            await Notifications.scheduleNotificationAsync({
              content,
              trigger: {
                type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
                weekday: day + 1, // expo: 1 = Sunday
                hour: hour ?? 8,
                minute: minute ?? 0,
                channelId: 'reminders',
              },
            }),
          );
        }
      } else {
        ids.push(
          await Notifications.scheduleNotificationAsync({
            content,
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DAILY,
              hour: hour ?? 8,
              minute: minute ?? 0,
              channelId: 'reminders',
            },
          }),
        );
      }
    }
    return ids;
  }

  async scheduleMissedFollowUp(at: Date, medicationName: string, doseId: string): Promise<string | null> {
    await configureOnce();
    if (at.getTime() <= Date.now()) return null;
    if ((await this.getPermission()) !== 'granted') return null;

    return Notifications.scheduleNotificationAsync({
      content: {
        title: tNow('notif.missedTitle'),
        body: tNow('notif.missedBody', { name: medicationName }),
        sound: 'default',
        data: { kind: 'follow-up', doseId } satisfies DoseNotificationData,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: at,
        channelId: 'reminders',
      },
    });
  }

  async cancel(identifiers: string[]): Promise<void> {
    await Promise.all(
      identifiers.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})),
    );
  }

  async cancelAll(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  subscribe(handler: (response: NotificationResponse) => void): () => void {
    void configureOnce();
    const translate = (response: Notifications.NotificationResponse): NotificationResponse | null => {
      const data = response.notification.request.content.data as Partial<DoseNotificationData> | undefined;
      const action = response.actionIdentifier;
      if (
        data?.kind === 'dose' &&
        data.reminderId &&
        data.time &&
        (action === ACTION_TAKEN || action === ACTION_SKIPPED)
      ) {
        return {
          kind: 'mark',
          reminderId: data.reminderId,
          time: data.time,
          status: action === ACTION_TAKEN ? 'TAKEN' : 'SKIPPED',
        };
      }
      return { kind: 'open' };
    };

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const translated = translate(response);
      if (translated) handler(translated);
    });
    // A notification tapped while the app was closed arrives here instead.
    void Notifications.getLastNotificationResponseAsync().then((last) => {
      if (last) {
        const translated = translate(last);
        if (translated) handler(translated);
      }
    });
    return () => subscription.remove();
  }
}
