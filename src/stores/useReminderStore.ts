/**
 * Reminder state: every reminder of the signed-in account, keyed by medicine.
 *
 * Notifications are scheduled and cancelled here — the store is the one
 * place that knows a reminder changed — through the NotificationService
 * interface, so the web build (which has no notifications) uses a no-op.
 */

import { create } from 'zustand';

import { getReminderRepository } from '@/db/repositories';
import type { Reminder, ReminderCreateInput, ReminderInput } from '@/domain/reminder';
import type { AppError } from '@/lib/errors';
import { toAppError } from '@/lib/errors';
import { getNotificationService } from '@/services/notifications';

type ReminderState = {
  reminders: Reminder[];
  isLoading: boolean;
  isSaving: boolean;
  error: AppError | null;

  load: (userId: string) => Promise<void>;
  createReminder: (
    userId: string,
    input: ReminderCreateInput,
    medicationName: string,
  ) => Promise<Reminder | null>;
  updateReminder: (
    userId: string,
    id: string,
    input: ReminderInput,
    medicationName: string,
  ) => Promise<boolean>;
  removeReminder: (userId: string, id: string) => Promise<boolean>;
  /** Cancel the OS notifications of every reminder for one medicine (before deleting it). */
  cancelForMedication: (userId: string, medicationId: string) => Promise<void>;
  /** Re-schedule every enabled reminder (after permission is granted or the toggle flips). */
  rescheduleAll: (userId: string, medicationNames: Map<string, string>) => Promise<void>;
  clearError: () => void;
  clear: () => void;
};

export const useReminderStore = create<ReminderState>((set, get) => {
  const refresh = async (userId: string): Promise<void> => {
    const repository = await getReminderRepository();
    const result = await repository.listForUser(userId);
    if (result.ok) set({ reminders: result.value });
    else set({ error: result.error });
  };

  /** Cancel old notifications, schedule new ones, store the ids. */
  const syncNotifications = async (
    userId: string,
    reminder: Reminder,
    medicationName: string,
  ): Promise<void> => {
    const notifications = getNotificationService();
    const repository = await getReminderRepository();
    await notifications.cancel(reminder.notificationIds);
    const ids = reminder.enabled ? await notifications.scheduleReminder(reminder, medicationName) : [];
    await repository.setNotificationIds(userId, reminder.id, ids);
  };

  return {
    reminders: [],
    isLoading: false,
    isSaving: false,
    error: null,

    load: async (userId) => {
      set({ isLoading: true, error: null });
      try {
        await refresh(userId);
        set({ isLoading: false });
      } catch (error) {
        set({ isLoading: false, error: toAppError(error, 'DATABASE_ERROR') });
      }
    },

    createReminder: async (userId, input, medicationName) => {
      set({ isSaving: true, error: null });
      try {
        const repository = await getReminderRepository();
        const result = await repository.create(userId, input);
        if (!result.ok) {
          set({ isSaving: false, error: result.error });
          return null;
        }
        await syncNotifications(userId, result.value, medicationName);
        await refresh(userId);
        set({ isSaving: false });
        return get().reminders.find((r) => r.id === result.value.id) ?? result.value;
      } catch (error) {
        set({ isSaving: false, error: toAppError(error, 'DATABASE_ERROR') });
        return null;
      }
    },

    updateReminder: async (userId, id, input, medicationName) => {
      set({ isSaving: true, error: null });
      try {
        const repository = await getReminderRepository();
        const result = await repository.update(userId, id, input);
        if (!result.ok) {
          set({ isSaving: false, error: result.error });
          return false;
        }
        await syncNotifications(userId, result.value, medicationName);
        await refresh(userId);
        set({ isSaving: false });
        return true;
      } catch (error) {
        set({ isSaving: false, error: toAppError(error, 'DATABASE_ERROR') });
        return false;
      }
    },

    removeReminder: async (userId, id) => {
      set({ isSaving: true, error: null });
      try {
        const existing = get().reminders.find((r) => r.id === id);
        if (existing) await getNotificationService().cancel(existing.notificationIds);
        const repository = await getReminderRepository();
        const result = await repository.remove(userId, id);
        if (!result.ok) {
          set({ isSaving: false, error: result.error });
          return false;
        }
        await refresh(userId);
        set({ isSaving: false });
        return true;
      } catch (error) {
        set({ isSaving: false, error: toAppError(error, 'DATABASE_ERROR') });
        return false;
      }
    },

    cancelForMedication: async (userId, medicationId) => {
      const notifications = getNotificationService();
      for (const reminder of get().reminders) {
        if (reminder.userId === userId && reminder.medicationId === medicationId) {
          await notifications.cancel(reminder.notificationIds);
        }
      }
    },

    rescheduleAll: async (userId, medicationNames) => {
      try {
        for (const reminder of get().reminders) {
          if (reminder.userId !== userId) continue;
          await syncNotifications(userId, reminder, medicationNames.get(reminder.medicationId) ?? 'your medicine');
        }
        await refresh(userId);
      } catch (error) {
        set({ error: toAppError(error, 'DATABASE_ERROR') });
      }
    },

    clearError: () => set({ error: null }),

    clear: () => set({ reminders: [], error: null, isLoading: false, isSaving: false }),
  };
});

/** Safe selector: the stored array reference. */
export const selectReminders = (state: ReminderState): Reminder[] => state.reminders;

/** Plain helper for `useMemo`. */
export function reminderForMedication(reminders: Reminder[], medicationId: string): Reminder | null {
  return reminders.find((r) => r.medicationId === medicationId) ?? null;
}
