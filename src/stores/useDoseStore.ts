/**
 * Dose state — the TRACK part of the workflow.
 *
 * `load` does three things in order:
 *   1. materialise: create UPCOMING rows for every reminder occurrence in the
 *      window (the last HISTORY_DAYS days through today) that does not exist yet
 *   2. sweep: mark UPCOMING doses whose grace period has passed as MISSED
 *   3. read the window back
 *
 * Doses are only ever recorded. Nothing here tells anyone to take a dose.
 */

import { addDays, subDays } from 'date-fns';
import { create } from 'zustand';

import { getDoseRepository, type DoseSeed } from '@/db/repositories';
import {
  dateKeysBetween,
  localDateKey,
  MISSED_GRACE_MINUTES,
  occurrencesOn,
  scheduledDate,
  type Dose,
  type DoseStatus,
  type Reminder,
} from '@/domain/reminder';
import { isoNow } from '@/lib/datetime';
import type { AppError } from '@/lib/errors';
import { toAppError } from '@/lib/errors';
import { getNotificationService } from '@/services/notifications';

import { useMedicationStore } from './useMedicationStore';
import { useSettingsStore } from './useSettingsStore';

/** How many past days the Schedule tab shows as history. */
export const HISTORY_DAYS = 7;

function localStamp(date: Date): string {
  const key = localDateKey(date);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${key}T${hh}:${mm}`;
}

type DoseState = {
  doses: Dose[];
  isLoading: boolean;
  isSaving: boolean;
  error: AppError | null;

  /** Materialise + sweep + read, for the given reminders (all members). */
  load: (userId: string, reminders: Reminder[], now?: Date) => Promise<void>;
  markDose: (userId: string, id: string, status: DoseStatus) => Promise<boolean>;
  /** From a notification action: the dose for this reminder at this time today. */
  markFromNotification: (
    userId: string,
    reminderId: string,
    time: string,
    status: 'TAKEN' | 'SKIPPED',
  ) => Promise<boolean>;
  clearError: () => void;
  clear: () => void;
};

export const useDoseStore = create<DoseState>((set, get) => {
  const read = async (userId: string, now: Date): Promise<void> => {
    const repository = await getDoseRepository();
    const from = `${localDateKey(subDays(now, HISTORY_DAYS))}T00:00`;
    const to = `${localDateKey(addDays(now, 1))}T00:00`;
    const result = await repository.listBetween(userId, from, to);
    if (result.ok) set({ doses: result.value });
    else set({ error: result.error });
  };

  /**
   * Phase 12: one gentle follow-up per dose, at scheduled time + grace, for
   * today's doses that are still ahead and have none yet. Cancelled the
   * moment the dose is marked. Skipped entirely when notifications are off
   * or unavailable.
   */
  const scheduleFollowUps = async (userId: string, now: Date): Promise<void> => {
    const notifications = getNotificationService();
    if (!notifications.isAvailable || !useSettingsStore.getState().notificationsEnabled) return;
    const repository = await getDoseRepository();
    const names = new Map(useMedicationStore.getState().medications.map((m) => [m.id, m.name]));
    const todayKey = localDateKey(now);

    for (const dose of get().doses) {
      if (dose.status !== 'UPCOMING' || dose.followUpNotificationId) continue;
      if (!dose.scheduledAt.startsWith(todayKey)) continue;
      const at = new Date(scheduledDate(dose.scheduledAt).getTime() + MISSED_GRACE_MINUTES * 60 * 1000);
      if (at.getTime() <= now.getTime()) continue;
      const id = await notifications.scheduleMissedFollowUp(at, names.get(dose.medicationId) ?? 'Your medicine', dose.id);
      if (id) await repository.setFollowUpNotificationId(userId, dose.id, id);
    }
  };

  return {
    doses: [],
    isLoading: false,
    isSaving: false,
    error: null,

    load: async (userId, reminders, now = new Date()) => {
      set({ isLoading: true, error: null });
      try {
        const repository = await getDoseRepository();

        const seeds: DoseSeed[] = [];
        for (const key of dateKeysBetween(subDays(now, HISTORY_DAYS), now)) {
          const day = new Date(`${key}T12:00`);
          for (const reminder of reminders) {
            if (reminder.userId !== userId) continue;
            for (const scheduledAt of occurrencesOn(reminder, day)) {
              seeds.push({
                reminderId: reminder.id,
                medicationId: reminder.medicationId,
                memberId: reminder.memberId,
                scheduledAt,
              });
            }
          }
        }
        const ensured = await repository.ensureDoses(userId, seeds);
        if (!ensured.ok) {
          set({ isLoading: false, error: ensured.error });
          return;
        }

        const cutoff = localStamp(new Date(now.getTime() - MISSED_GRACE_MINUTES * 60 * 1000));
        const swept = await repository.markMissedBefore(userId, cutoff, isoNow());
        if (!swept.ok) {
          set({ isLoading: false, error: swept.error });
          return;
        }

        await read(userId, now);
        await scheduleFollowUps(userId, now);
        set({ isLoading: false });
      } catch (error) {
        set({ isLoading: false, error: toAppError(error, 'DATABASE_ERROR') });
      }
    },

    markDose: async (userId, id, status) => {
      set({ isSaving: true, error: null });
      try {
        const repository = await getDoseRepository();
        const result = await repository.setStatus(
          userId,
          id,
          status,
          status === 'UPCOMING' ? null : isoNow(),
        );
        if (!result.ok) {
          set({ isSaving: false, error: result.error });
          return false;
        }
        // A dose that has been dealt with needs no "you may have missed" nudge.
        if (status !== 'UPCOMING' && result.value.followUpNotificationId) {
          await getNotificationService().cancel([result.value.followUpNotificationId]);
          await repository.setFollowUpNotificationId(userId, id, null);
        }
        await read(userId, new Date());
        set({ isSaving: false });
        return true;
      } catch (error) {
        set({ isSaving: false, error: toAppError(error, 'DATABASE_ERROR') });
        return false;
      }
    },

    markFromNotification: async (userId, reminderId, time, status) => {
      const todayKey = localDateKey(new Date());
      const scheduledAt = `${todayKey}T${time}`;
      let dose = get().doses.find((d) => d.reminderId === reminderId && d.scheduledAt === scheduledAt);
      if (!dose) {
        // The row may not exist yet if the app was closed all day.
        await read(userId, new Date());
        dose = get().doses.find((d) => d.reminderId === reminderId && d.scheduledAt === scheduledAt);
      }
      if (!dose) return false;
      return get().markDose(userId, dose.id, status);
    },

    clearError: () => set({ error: null }),

    clear: () => set({ doses: [], error: null, isLoading: false, isSaving: false }),
  };
});

export const selectDoses = (state: DoseState): Dose[] => state.doses;

/** Plain helper for `useMemo`: one member's doses on one local day, ascending. */
export function dosesOn(doses: Dose[], dateKey: string, memberId: string | null): Dose[] {
  if (!memberId) return [];
  return doses.filter((d) => d.memberId === memberId && d.scheduledAt.startsWith(dateKey));
}

/** Plain helper: doses grouped by day, newest day first, for the history list. */
export function dosesByDay(doses: Dose[], memberId: string | null): { day: string; doses: Dose[] }[] {
  const groups = new Map<string, Dose[]>();
  for (const dose of doses) {
    if (memberId && dose.memberId !== memberId) continue;
    const day = dose.scheduledAt.slice(0, 10);
    const list = groups.get(day) ?? [];
    list.push(dose);
    groups.set(day, list);
  }
  return [...groups.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([day, list]) => ({ day, doses: list }));
}
