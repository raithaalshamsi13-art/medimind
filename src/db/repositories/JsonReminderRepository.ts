/**
 * JSON fallback implementations of ReminderRepository and DoseRepository
 * (browser only). Same behaviour as the SQLite classes, including the
 * one-reminder-per-medicine rule, the unique (reminder, scheduled time) pair
 * and the per-user scoping of `ensureDoses`. Cascades from deleting a
 * medicine or family member are done by the owning JSON repositories.
 */

import type {
  Dose,
  DoseStatus,
  Reminder,
  ReminderCreateInput,
  ReminderInput,
} from '@/domain/reminder';
import { isoNow } from '@/lib/datetime';
import { appError } from '@/lib/errors';
import { newId } from '@/lib/ids';
import { fail, ok, type Result } from '@/lib/result';
import { readJson, STORAGE_KEYS, writeJson } from '@/lib/storage';

import type { DoseRepository, DoseSeed, ReminderRepository } from './ReminderRepository';

async function readList<T>(key: string): Promise<Result<T[]>> {
  const stored = await readJson<T[]>(key);
  if (!stored.ok) return fail(stored.error);
  return ok(Array.isArray(stored.value) ? stored.value : []);
}

export class JsonReminderRepository implements ReminderRepository {
  readonly kind = 'json' as const;

  private readAll(): Promise<Result<Reminder[]>> {
    return readList<Reminder>(STORAGE_KEYS.reminders);
  }

  private writeAll(reminders: Reminder[]): Promise<Result<void>> {
    return writeJson(STORAGE_KEYS.reminders, reminders);
  }

  async listForUser(userId: string): Promise<Result<Reminder[]>> {
    const all = await this.readAll();
    if (!all.ok) return fail(all.error);
    return ok(all.value.filter((r) => r.userId === userId));
  }

  async getById(userId: string, id: string): Promise<Result<Reminder | null>> {
    const all = await this.readAll();
    if (!all.ok) return fail(all.error);
    return ok(all.value.find((r) => r.id === id && r.userId === userId) ?? null);
  }

  async getForMedication(userId: string, medicationId: string): Promise<Result<Reminder | null>> {
    const all = await this.readAll();
    if (!all.ok) return fail(all.error);
    return ok(
      all.value.find((r) => r.medicationId === medicationId && r.userId === userId) ?? null,
    );
  }

  async create(userId: string, input: ReminderCreateInput): Promise<Result<Reminder>> {
    const all = await this.readAll();
    if (!all.ok) return fail(all.error);
    if (all.value.some((r) => r.medicationId === input.medicationId)) {
      return fail(appError('DATABASE_ERROR', 'a reminder already exists for this medicine'));
    }

    const now = isoNow();
    const reminder: Reminder = {
      id: newId(),
      userId,
      memberId: input.memberId,
      medicationId: input.medicationId,
      times: input.times,
      doseLabel: input.doseLabel,
      frequency: input.frequency,
      days: input.days,
      startDate: input.startDate,
      endDate: input.endDate,
      enabled: input.enabled,
      notificationIds: [],
      createdAt: now,
      updatedAt: now,
    };
    const saved = await this.writeAll([...all.value, reminder]);
    if (!saved.ok) return fail(saved.error);
    return ok(reminder);
  }

  async update(userId: string, id: string, input: ReminderInput): Promise<Result<Reminder>> {
    const all = await this.readAll();
    if (!all.ok) return fail(all.error);
    const index = all.value.findIndex((r) => r.id === id && r.userId === userId);
    if (index === -1) return fail(appError('NOT_FOUND'));

    const updated: Reminder = {
      ...all.value[index],
      times: input.times,
      doseLabel: input.doseLabel,
      frequency: input.frequency,
      days: input.days,
      startDate: input.startDate,
      endDate: input.endDate,
      enabled: input.enabled,
      updatedAt: isoNow(),
    };
    const next = [...all.value];
    next[index] = updated;
    const saved = await this.writeAll(next);
    if (!saved.ok) return fail(saved.error);
    return ok(updated);
  }

  async setNotificationIds(userId: string, id: string, ids: string[]): Promise<Result<void>> {
    const all = await this.readAll();
    if (!all.ok) return fail(all.error);
    const index = all.value.findIndex((r) => r.id === id && r.userId === userId);
    if (index === -1) return fail(appError('NOT_FOUND'));
    const next = [...all.value];
    next[index] = { ...all.value[index], notificationIds: ids };
    return this.writeAll(next);
  }

  async remove(userId: string, id: string): Promise<Result<void>> {
    const all = await this.readAll();
    if (!all.ok) return fail(all.error);
    const next = all.value.filter((r) => !(r.id === id && r.userId === userId));
    if (next.length === all.value.length) return fail(appError('NOT_FOUND'));
    const saved = await this.writeAll(next);
    if (!saved.ok) return saved;
    // Cascade: the reminder's doses go with it.
    const doses = await readList<Dose>(STORAGE_KEYS.doses);
    if (!doses.ok) return fail(doses.error);
    const kept = doses.value.filter((d) => d.reminderId !== id);
    return kept.length === doses.value.length ? ok(undefined) : writeJson(STORAGE_KEYS.doses, kept);
  }
}

export class JsonDoseRepository implements DoseRepository {
  readonly kind = 'json' as const;

  private readAll(): Promise<Result<Dose[]>> {
    return readList<Dose>(STORAGE_KEYS.doses);
  }

  private writeAll(doses: Dose[]): Promise<Result<void>> {
    return writeJson(STORAGE_KEYS.doses, doses);
  }

  async listBetween(userId: string, from: string, to: string): Promise<Result<Dose[]>> {
    const all = await this.readAll();
    if (!all.ok) return fail(all.error);
    return ok(
      all.value
        .filter((d) => d.userId === userId && d.scheduledAt >= from && d.scheduledAt <= to)
        .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)),
    );
  }

  async ensureDoses(userId: string, seeds: DoseSeed[]): Promise<Result<void>> {
    if (seeds.length === 0) return ok(undefined);
    const all = await this.readAll();
    if (!all.ok) return fail(all.error);
    const reminders = await readList<Reminder>(STORAGE_KEYS.reminders);
    if (!reminders.ok) return fail(reminders.error);
    const mine = new Map(reminders.value.filter((r) => r.userId === userId).map((r) => [r.id, r]));

    const existing = new Set(all.value.map((d) => `${d.reminderId}|${d.scheduledAt}`));
    const now = isoNow();
    const added: Dose[] = [];
    for (const seed of seeds) {
      const reminder = mine.get(seed.reminderId);
      if (!reminder) continue; // not this user's reminder
      const key = `${seed.reminderId}|${seed.scheduledAt}`;
      if (existing.has(key)) continue;
      existing.add(key);
      added.push({
        id: newId(),
        userId,
        memberId: reminder.memberId,
        medicationId: reminder.medicationId,
        reminderId: reminder.id,
        scheduledAt: seed.scheduledAt,
        status: 'UPCOMING',
        actedAt: null,
        followUpNotificationId: null,
        createdAt: now,
        updatedAt: now,
      });
    }
    return added.length === 0 ? ok(undefined) : this.writeAll([...all.value, ...added]);
  }

  async setStatus(
    userId: string,
    id: string,
    status: DoseStatus,
    actedAt: string | null,
  ): Promise<Result<Dose>> {
    const all = await this.readAll();
    if (!all.ok) return fail(all.error);
    const index = all.value.findIndex((d) => d.id === id && d.userId === userId);
    if (index === -1) return fail(appError('NOT_FOUND'));
    const updated: Dose = { ...all.value[index], status, actedAt, updatedAt: isoNow() };
    const next = [...all.value];
    next[index] = updated;
    const saved = await this.writeAll(next);
    if (!saved.ok) return fail(saved.error);
    return ok(updated);
  }

  async setFollowUpNotificationId(
    userId: string,
    id: string,
    notificationId: string | null,
  ): Promise<Result<void>> {
    const all = await this.readAll();
    if (!all.ok) return fail(all.error);
    const index = all.value.findIndex((d) => d.id === id && d.userId === userId);
    if (index === -1) return fail(appError('NOT_FOUND'));
    const next = [...all.value];
    next[index] = { ...all.value[index], followUpNotificationId: notificationId };
    return this.writeAll(next);
  }

  async markMissedBefore(userId: string, cutoff: string, actedAt: string): Promise<Result<number>> {
    const all = await this.readAll();
    if (!all.ok) return fail(all.error);
    let count = 0;
    const now = isoNow();
    const next = all.value.map((d) => {
      if (d.userId !== userId || d.status !== 'UPCOMING' || d.scheduledAt >= cutoff) return d;
      count += 1;
      return { ...d, status: 'MISSED' as const, actedAt, updatedAt: now };
    });
    if (count === 0) return ok(0);
    const saved = await this.writeAll(next);
    if (!saved.ok) return fail(saved.error);
    return ok(count);
  }
}
