/**
 * Speaks a reminder when it arrives with the app open, or when the app is
 * opened from one, and handles Snooze. Mounted once in the root layout.
 *
 * Each dose is announced at most once per day (reminder + time + date), so a
 * notification that arrives and is then tapped does not get read twice.
 */

import { useEffect, useRef } from 'react';

import { localDateKey } from '@/domain/reminder';
import { getLanguage, tNow } from '@/i18n';
import { getNotificationService } from '@/services/notifications';
import { getVoiceService } from '@/services/voice/VoiceService';
import { useMedicationStore } from '@/stores/useMedicationStore';
import { useReminderStore } from '@/stores/useReminderStore';
import { useSettingsStore } from '@/stores/useSettingsStore';

export const SNOOZE_MINUTES = 10;

/** The sentence spoken for one reminder, in the current language. */
export function reminderAnnouncement(medicationName: string, doseLabel: string | null): string {
  return doseLabel
    ? tNow('voice.reminderWithDose', { name: medicationName, dose: doseLabel })
    : tNow('voice.reminder', { name: medicationName });
}

function describe(reminderId: string): { name: string; dose: string | null } | null {
  const reminder = useReminderStore.getState().reminders.find((r) => r.id === reminderId);
  if (!reminder) return null;
  const medication = useMedicationStore.getState().medications.find((m) => m.id === reminder.medicationId);
  return { name: medication?.name ?? tNow('common.medicine'), dose: reminder.doseLabel };
}

export function useVoiceAnnouncer(userId: string | null) {
  const spoken = useRef(new Set<string>());

  useEffect(() => {
    if (!userId) return;
    const notifications = getNotificationService();

    const announce = (reminderId: string, time: string) => {
      const { voiceAlertsEnabled, alertStyle } = useSettingsStore.getState();
      if (!voiceAlertsEnabled || alertStyle === 'sound') return;
      const key = `${reminderId}|${localDateKey(new Date())}|${time}`;
      if (spoken.current.has(key)) return;
      const details = describe(reminderId);
      if (!details) return;
      spoken.current.add(key);
      void getVoiceService().speak(reminderAnnouncement(details.name, details.dose), getLanguage());
    };

    const stopArrivals = notifications.subscribeArrivals(({ reminderId, time }) => announce(reminderId, time));

    const stopResponses = notifications.subscribe((response) => {
      if (response.kind === 'open' && response.reminderId && response.time) {
        announce(response.reminderId, response.time);
      }
      if (response.kind === 'snooze') {
        const details = describe(response.reminderId);
        void notifications.scheduleSnooze(
          response.reminderId,
          response.time,
          details?.name ?? tNow('common.medicine'),
          details?.dose ?? null,
          SNOOZE_MINUTES,
        );
      }
    });

    return () => {
      stopArrivals();
      stopResponses();
    };
  }, [userId]);
}
