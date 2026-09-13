/**
 * JSON fallback implementation of FamilyRepository (browser only).
 *
 * Mirrors SqliteFamilyRepository, including the two cross-table behaviours
 * SQLite gets from the schema: `ensureSelf` adopts member-less medicines and
 * conditions, and `remove` deletes the member's medicines and conditions by
 * hand (SQLite cascades through foreign keys). The shared test suite checks
 * both backends behave the same.
 */

import type { FamilyMember, FamilyMemberInput, Relationship } from '@/domain/familyMember';
import type { HealthCondition } from '@/domain/healthCondition';
import type { Medication } from '@/domain/medication';
import { isoNow } from '@/lib/datetime';
import { appError, customError } from '@/lib/errors';
import { newId } from '@/lib/ids';
import { fail, ok, type Result } from '@/lib/result';
import { readJson, STORAGE_KEYS, writeJson } from '@/lib/storage';

import type { FamilyRepository } from './FamilyRepository';
import { ONLY_ONE_SELF, SELF_CANNOT_BE_REMOVED } from './SqliteFamilyRepository';

async function readList<T>(key: string): Promise<Result<T[]>> {
  const stored = await readJson<T[]>(key);
  if (!stored.ok) return fail(stored.error);
  return ok(Array.isArray(stored.value) ? stored.value : []);
}

export class JsonFamilyRepository implements FamilyRepository {
  readonly kind = 'json' as const;

  private async readAll(): Promise<Result<FamilyMember[]>> {
    const list = await readList<FamilyMember>(STORAGE_KEYS.familyMembers);
    if (!list.ok) return list;
    // Rows written before schema v4 have no health-profile fields.
    return ok(
      list.value.map((member) => ({
        ...member,
        gender: member.gender ?? null,
        heightCm: member.heightCm ?? null,
        weightKg: member.weightKg ?? null,
        bloodType: member.bloodType ?? null,
        profileSetupDone: member.profileSetupDone ?? false,
      })),
    );
  }

  private writeAll(members: FamilyMember[]): Promise<Result<void>> {
    return writeJson(STORAGE_KEYS.familyMembers, members);
  }

  async listForUser(userId: string): Promise<Result<FamilyMember[]>> {
    const all = await this.readAll();
    if (!all.ok) return fail(all.error);
    const mine = all.value.filter((m) => m.userId === userId);
    // Self first; the rest keep insertion order (stable sort).
    return ok([...mine.filter((m) => m.isSelf), ...mine.filter((m) => !m.isSelf)]);
  }

  async getById(userId: string, id: string): Promise<Result<FamilyMember | null>> {
    const all = await this.readAll();
    if (!all.ok) return fail(all.error);
    return ok(all.value.find((m) => m.id === id && m.userId === userId) ?? null);
  }

  async ensureSelf(userId: string, name: string): Promise<Result<FamilyMember>> {
    const all = await this.readAll();
    if (!all.ok) return fail(all.error);

    const existing = all.value.find((m) => m.userId === userId && m.isSelf);
    if (existing) return ok(existing);

    const now = isoNow();
    const self: FamilyMember = {
      id: newId(),
      userId,
      name: name.trim().length > 0 ? name.trim() : 'Me',
      relationship: 'ME',
      customRelationship: null,
      dateOfBirth: null,
      gender: null,
      heightCm: null,
      weightKg: null,
      bloodType: null,
      avatarColor: 'primary',
      isSelf: true,
      profileSetupDone: false,
      createdAt: now,
      updatedAt: now,
    };
    const saved = await this.writeAll([...all.value, self]);
    if (!saved.ok) return fail(saved.error);

    // Adopt everything recorded before family profiles existed.
    const adoptMedications = await this.reassign<Medication>(STORAGE_KEYS.medications, userId, self.id);
    if (!adoptMedications.ok) return fail(adoptMedications.error);
    const adoptConditions = await this.reassign<HealthCondition>(
      STORAGE_KEYS.healthConditions,
      userId,
      self.id,
    );
    if (!adoptConditions.ok) return fail(adoptConditions.error);

    return ok(self);
  }

  async create(userId: string, input: FamilyMemberInput): Promise<Result<FamilyMember>> {
    if (input.relationship === 'ME') return fail(customError('NOT_ALLOWED', ONLY_ONE_SELF));

    const all = await this.readAll();
    if (!all.ok) return fail(all.error);

    const now = isoNow();
    const member: FamilyMember = {
      id: newId(),
      userId,
      name: input.name,
      relationship: input.relationship,
      customRelationship: input.customRelationship,
      dateOfBirth: input.dateOfBirth,
      gender: input.gender,
      heightCm: input.heightCm,
      weightKg: input.weightKg,
      bloodType: input.bloodType,
      avatarColor: input.avatarColor,
      isSelf: false,
      profileSetupDone: true,
      createdAt: now,
      updatedAt: now,
    };
    const saved = await this.writeAll([...all.value, member]);
    if (!saved.ok) return fail(saved.error);
    return ok(member);
  }

  async update(userId: string, id: string, input: FamilyMemberInput): Promise<Result<FamilyMember>> {
    const all = await this.readAll();
    if (!all.ok) return fail(all.error);

    const index = all.value.findIndex((m) => m.id === id && m.userId === userId);
    if (index === -1) return fail(appError('NOT_FOUND'));
    const current = all.value[index];

    if (!current.isSelf && input.relationship === 'ME') {
      return fail(customError('NOT_ALLOWED', ONLY_ONE_SELF));
    }
    const relationship: Relationship = current.isSelf ? 'ME' : input.relationship;

    const updated: FamilyMember = {
      ...current,
      name: input.name,
      relationship,
      customRelationship: relationship === 'OTHER' ? input.customRelationship : null,
      dateOfBirth: input.dateOfBirth,
      gender: input.gender,
      heightCm: input.heightCm,
      weightKg: input.weightKg,
      bloodType: input.bloodType,
      avatarColor: input.avatarColor,
      updatedAt: isoNow(),
    };
    const next = [...all.value];
    next[index] = updated;
    const saved = await this.writeAll(next);
    if (!saved.ok) return fail(saved.error);
    return ok(updated);
  }

  async remove(userId: string, id: string): Promise<Result<void>> {
    const all = await this.readAll();
    if (!all.ok) return fail(all.error);

    const member = all.value.find((m) => m.id === id && m.userId === userId);
    if (!member) return fail(appError('NOT_FOUND'));
    if (member.isSelf) return fail(customError('NOT_ALLOWED', SELF_CANNOT_BE_REMOVED));

    const saved = await this.writeAll(all.value.filter((m) => m !== member));
    if (!saved.ok) return saved;

    // Cascade by hand: everything recorded for this member goes with them.
    const medications = await readList<Medication>(STORAGE_KEYS.medications);
    if (!medications.ok) return fail(medications.error);
    const keptMedications = medications.value.filter(
      (m) => !(m.userId === userId && m.memberId === id),
    );
    if (keptMedications.length !== medications.value.length) {
      const written = await writeJson(STORAGE_KEYS.medications, keptMedications);
      if (!written.ok) return written;
    }

    const conditions = await readList<HealthCondition>(STORAGE_KEYS.healthConditions);
    if (!conditions.ok) return fail(conditions.error);
    const keptConditions = conditions.value.filter(
      (c) => !(c.userId === userId && c.memberId === id),
    );
    if (keptConditions.length !== conditions.value.length) {
      return writeJson(STORAGE_KEYS.healthConditions, keptConditions);
    }
    return ok(undefined);
  }

  async markProfileSetupDone(userId: string, id: string): Promise<Result<FamilyMember>> {
    const all = await this.readAll();
    if (!all.ok) return fail(all.error);
    const index = all.value.findIndex((m) => m.id === id && m.userId === userId);
    if (index === -1) return fail(appError('NOT_FOUND'));
    const updated: FamilyMember = { ...all.value[index], profileSetupDone: true, updatedAt: isoNow() };
    const next = [...all.value];
    next[index] = updated;
    const saved = await this.writeAll(next);
    if (!saved.ok) return fail(saved.error);
    return ok(updated);
  }

  /** Give every member-less row of this user to `memberId`. */
  private async reassign<T extends { userId: string; memberId?: string | null }>(
    key: string,
    userId: string,
    memberId: string,
  ): Promise<Result<void>> {
    const list = await readList<T>(key);
    if (!list.ok) return fail(list.error);
    let touched = false;
    const next = list.value.map((row) => {
      if (row.userId !== userId || (row.memberId ?? null) !== null) return row;
      touched = true;
      return { ...row, memberId };
    });
    return touched ? writeJson(key, next) : ok(undefined);
  }
}
