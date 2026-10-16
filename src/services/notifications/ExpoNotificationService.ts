/**
 * Local notifications through expo-notifications.
 *
 * WHAT IS SCHEDULED (see `buildNotificationPlan` in domain/reminder.ts)
 *   - a reminder with no date window: one repeating trigger per time — daily,
 *     or weekly per chosen weekday — which iOS fires with the app closed
 *   - a reminder with a start/end date (a course, or a one-off): one dated
 *     notification per occurrence up to two weeks ahead, re-planned on every
 *     launch / foreground
 *   Every one carries `{ kind: 'dose', reminderId, time }` so the app can find
 *   the dose when the user taps Taken / Skip / Snooze on it
 *   - a one-off follow-up per dose, scheduled by the dose store at
 *     scheduled time + grace, cancelled when the dose is marked
 *
 * Runs inside Expo Go on iOS. Permission is requested once, with the reason
 * shown by the Schedule tab beforehand; a denied permission makes every
 * schedule call return no ids rather than throwing.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { buildNotificationPlan, type Reminder } from '@/domain/reminder';
import { tNow } from '@/i18n';

import type {
  NotificationArrival,
  NotificationPermission,
  NotificationResponse,
  NotificationService,
} from './NotificationService';
import { useSettingsStore } from '@/stores/useSettingsStore';

export const DOSE_CATEGORY = 'MEDIMIND_DOSE';
export const ACTION_TAKEN = 'TAKEN';
export const ACTION_SKIPPED = 'SKIPPED';
export const ACTION_SNOOZE = 'SNOOZE';

/** Sound only when the alert style asks for it; "voice only" keeps the banner silent. */
function notificationSound(): 'default' | undefined {
  const { voiceAlertsEnabled, alertStyle } = useSettingsStore.getState();
  return voiceAlertsEnabled && alertStyle === 'voice' ? undefined : 'default';
}

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
      shouldPlaySound: notificationSound() !== undefined,
      shouldSetBadge: false,
    }),
  });

  await Notifications.setNotificationCategoryAsync(DOSE_CATEGORY, [
    { identifier: ACTION_TAKEN, buttonTitle: tNow('notif.taken'), options: { opensAppToForeground: false } },
    { identifier: ACTION_SKIPPED, buttonTitle: tNow('notif.skip'), options: { opensAppToForeground: false } },
    { identifier: ACTION_SNOOZE, buttonTitle: tNow('notif.snooze'), options: { opensAppToForeground: false } },
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

    for (const step of buildNotificationPlan(reminder)) {
      const content: Notifications.NotificationContentInput = {
        title: tNow('notif.title'),
        body,
        categoryIdentifier: DOSE_CATEGORY,
        sound: notificationSound(),
        data: { kind: 'dose', reminderId: reminder.id, time: step.time } satisfies DoseNotificationData,
      };
      const trigger: Notifications.NotificationTriggerInput =
        step.kind === 'daily'
          ? { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: step.hour, minute: step.minute, channelId: 'reminders' }
          : step.kind === 'weekly'
            ? {
                type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
                weekday: step.weekday,
                hour: step.hour,
                minute: step.minute,
                channelId: 'reminders',
              }
            : { type: Notifications.SchedulableTriggerInputTypes.DATE, date: step.at, channelId: 'reminders' };
      ids.push(await Notifications.scheduleNotificationAsync({ content, trigger }));
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
        sound: notificationSound(),
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

  async pruneDoseNotifications(keepIds: string[]): Promise<void> {
    // Anything the OS still holds for a reminder we no longer track (an id
    // lost to a reinstall or a crash mid-save) would ring as a duplicate.
    const keep = new Set(keepIds);
    const pending = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
    const stale = pending.filter((n) => {
      const data = n.content.data as Partial<DoseNotificationData> | undefined;
      return data?.kind === 'dose' && !keep.has(n.identifier);
    });
    await Promise.all(stale.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {})));
  }

  subscribe(handler: (response: NotificationResponse) => void): () => void {
    void configureOnce();
    const translate = (response: Notifications.NotificationResponse): NotificationResponse | null => {
      const data = response.notification.request.content.data as Partial<DoseNotificationData> | undefined;
      const action = response.actionIdentifier;
      if (data?.kind === 'dose' && data.reminderId && data.time) {
        if (action === ACTION_TAKEN || action === ACTION_SKIPPED) {
          return {
            kind: 'mark',
            reminderId: data.reminderId,
            time: data.time,
            status: action === ACTION_TAKEN ? 'TAKEN' : 'SKIPPED',
          };
        }
        if (action === ACTION_SNOOZE) {
          return { kind: 'snooze', reminderId: data.reminderId, time: data.time };
        }
        return { kind: 'open', reminderId: data.reminderId, time: data.time };
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

  subscribeArrivals(handler: (arrival: NotificationArrival) => void): () => void {
    void configureOnce();
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as Partial<DoseNotificationData> | undefined;
      if (data?.kind === 'dose' && data.reminderId && data.time) {
        handler({ reminderId: data.reminderId, time: data.time });
      }
    });
    return () => subscription.remove();
  }

  async scheduleSnooze(
    reminderId: string,
    time: string,
    medicationName: string,
    doseLabel: string | null,
    minutes: number,
  ): Promise<string | null> {
    await configureOnce();
    if ((await this.getPermission()) !== 'granted') return null;
    return Notifications.scheduleNotificationAsync({
      content: {
        title: tNow('notif.title'),
        body: doseLabel ? tNow('notif.body', { name: medicationName, dose: doseLabel }) : medicationName,
        categoryIdentifier: DOSE_CATEGORY,
        sound: notificationSound(),
        data: { kind: 'dose', reminderId, time } satisfies DoseNotificationData,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(60, minutes * 60),
        channelId: 'reminders',
      },
    });
  }
}
