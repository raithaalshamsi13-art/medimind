/**
 * SQLite implementation of FamilyRepository.
 *
 * Cascade deletes (a member's medicines, conditions and links) are done by
 * the foreign keys declared in schema v3, which is why `remove` is a single
 * DELETE. The partial unique index on (user_id) WHERE is_self = 1 means the
 * database itself refuses a second "Me".
 */

import {
  AVATAR_COLORS,
  BLOOD_TYPES,
  GENDERS,
  RELATIONSHIPS,
  type AvatarColor,
  type BloodType,
  type FamilyMember,
  type FamilyMemberInput,
  type Gender,
  type Relationship,
} from '@/domain/familyMember';
import { isoNow } from '@/lib/datetime';
import { appError, customError, toAppError } from '@/lib/errors';
import { newId } from '@/lib/ids';
import { fail, ok, type Result } from '@/lib/result';

import type { SqlDatabase } from '../types';
import type { FamilyRepository } from './FamilyRepository';

type MemberRow = {
  id: string;
  user_id: string;
  name: string;
  relationship: string;
  custom_relationship: string | null;
  date_of_birth: string | null;
  avatar_color: string;
  is_self: number;
  created_at: string;
  updated_at: string;
  gender: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  blood_type: string | null;
  profile_setup_done: number;
};

function toRelationship(value: string): Relationship {
  return (RELATIONSHIPS as readonly string[]).includes(value) ? (value as Relationship) : 'OTHER';
}

function toGender(value: string | null): Gender | null {
  return value !== null && (GENDERS as readonly string[]).includes(value) ? (value as Gender) : null;
}

function toBloodType(value: string | null): BloodType | null {
  return value !== null && (BLOOD_TYPES as readonly string[]).includes(value)
    ? (value as BloodType)
    : null;
}

function toAvatarColor(value: string): AvatarColor {
  return (AVATAR_COLORS as readonly string[]).includes(value) ? (value as AvatarColor) : 'primary';
}

function mapRow(row: MemberRow): FamilyMember {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    relationship: toRelationship(row.relationship),
    customRelationship: row.custom_relationship,
    dateOfBirth: row.date_of_birth,
    avatarColor: toAvatarColor(row.avatar_color),
    gender: toGender(row.gender),
    heightCm: row.height_cm,
    weightKg: row.weight_kg,
    bloodType: toBloodType(row.blood_type),
    isSelf: row.is_self === 1,
    profileSetupDone: row.profile_setup_done === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_COLUMNS = `
  id, user_id, name, relationship, custom_relationship, date_of_birth,
  avatar_color, is_self, created_at, updated_at,
  gender, height_cm, weight_kg, blood_type, profile_setup_done
`;

export const SELF_CANNOT_BE_REMOVED = 'Your own profile cannot be removed. You can edit it instead.';
export const ONLY_ONE_SELF = 'Only one profile can be “Me”. Choose another relationship.';

export class SqliteFamilyRepository implements FamilyRepository {
  readonly kind = 'sqlite' as const;

  constructor(private readonly db: SqlDatabase) {}

  async listForUser(userId: string): Promise<Result<FamilyMember[]>> {
    try {
      const rows = await this.db.getAllAsync<MemberRow>(
        `SELECT ${SELECT_COLUMNS} FROM family_members
          WHERE user_id = ?
          ORDER BY is_self DESC, created_at ASC, rowid ASC`,
        [userId],
      );
      return ok(rows.map(mapRow));
    } catch (error) {
      return fail(toAppError(error, 'DATABASE_ERROR'));
    }
  }

  async getById(userId: string, id: string): Promise<Result<FamilyMember | null>> {
    try {
      const row = await this.db.getFirstAsync<MemberRow>(
        `SELECT ${SELECT_COLUMNS} FROM family_members WHERE id = ? AND user_id = ?`,
        [id, userId],
      );
      return ok(row ? mapRow(row) : null);
    } catch (error) {
      return fail(toAppError(error, 'DATABASE_ERROR'));
    }
  }

  async ensureSelf(userId: string, name: string): Promise<Result<FamilyMember>> {
    try {
      const existing = await this.db.getFirstAsync<MemberRow>(
        `SELECT ${SELECT_COLUMNS} FROM family_members WHERE user_id = ? AND is_self = 1`,
        [userId],
      );
      if (existing) return ok(mapRow(existing));

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

      await this.db.withTransactionAsync(async () => {
        await this.insert(self);
        // Adopt everything recorded before family profiles existed.
        await this.db.runAsync(
          `UPDATE medications SET member_id = ? WHERE user_id = ? AND member_id IS NULL`,
          [self.id, userId],
        );
        await this.db.runAsync(
          `UPDATE health_conditions SET member_id = ? WHERE user_id = ? AND member_id IS NULL`,
          [self.id, userId],
        );
      });
      return ok(self);
    } catch (error) {
      return fail(toAppError(error, 'DATABASE_ERROR'));
    }
  }

  async create(userId: string, input: FamilyMemberInput): Promise<Result<FamilyMember>> {
    if (input.relationship === 'ME') return fail(customError('NOT_ALLOWED', ONLY_ONE_SELF));

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
      // Only the self profile is ever asked the sign-up step.
      profileSetupDone: true,
      createdAt: now,
      updatedAt: now,
    };
    try {
      await this.insert(member);
      return ok(member);
    } catch (error) {
      return fail(toAppError(error, 'DATABASE_ERROR'));
    }
  }

  async update(userId: string, id: string, input: FamilyMemberInput): Promise<Result<FamilyMember>> {
    try {
      const current = await this.getById(userId, id);
      if (!current.ok) return current;
      if (!current.value) return fail(appError('NOT_FOUND'));

      // The self profile is always ME; nobody else may become ME.
      if (current.value.isSelf === false && input.relationship === 'ME') {
        return fail(customError('NOT_ALLOWED', ONLY_ONE_SELF));
      }
      const relationship: Relationship = current.value.isSelf ? 'ME' : input.relationship;
      const customRelationship = relationship === 'OTHER' ? input.customRelationship : null;

      const result = await this.db.runAsync(
        `UPDATE family_members
            SET name = ?, relationship = ?, custom_relationship = ?, date_of_birth = ?,
                avatar_color = ?, gender = ?, height_cm = ?, weight_kg = ?, blood_type = ?,
                updated_at = ?
          WHERE id = ? AND user_id = ?`,
        [
          input.name,
          relationship,
          customRelationship,
          input.dateOfBirth,
          input.avatarColor,
          input.gender,
          input.heightCm,
          input.weightKg,
          input.bloodType,
          isoNow(),
          id,
          userId,
        ],
      );
      if (result.changes === 0) return fail(appError('NOT_FOUND'));

      const updated = await this.getById(userId, id);
      if (!updated.ok) return updated;
      if (!updated.value) return fail(appError('NOT_FOUND'));
      return ok(updated.value);
    } catch (error) {
      return fail(toAppError(error, 'DATABASE_ERROR'));
    }
  }

  async remove(userId: string, id: string): Promise<Result<void>> {
    try {
      const current = await this.getById(userId, id);
      if (!current.ok) return fail(current.error);
      if (!current.value) return fail(appError('NOT_FOUND'));
      if (current.value.isSelf) return fail(customError('NOT_ALLOWED', SELF_CANNOT_BE_REMOVED));

      const result = await this.db.runAsync(
        `DELETE FROM family_members WHERE id = ? AND user_id = ? AND is_self = 0`,
        [id, userId],
      );
      if (result.changes === 0) return fail(appError('NOT_FOUND'));
      return ok(undefined);
    } catch (error) {
      return fail(toAppError(error, 'DATABASE_ERROR'));
    }
  }

  private async insert(member: FamilyMember): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO family_members (
         id, user_id, name, relationship, custom_relationship, date_of_birth,
         avatar_color, is_self, created_at, updated_at,
         gender, height_cm, weight_kg, blood_type, profile_setup_done
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        member.id,
        member.userId,
        member.name,
        member.relationship,
        member.customRelationship,
        member.dateOfBirth,
        member.avatarColor,
        member.isSelf ? 1 : 0,
        member.createdAt,
        member.updatedAt,
        member.gender,
        member.heightCm,
        member.weightKg,
        member.bloodType,
        member.profileSetupDone ? 1 : 0,
      ],
    );
  }

  async markProfileSetupDone(userId: string, id: string): Promise<Result<FamilyMember>> {
    try {
      const result = await this.db.runAsync(
        `UPDATE family_members SET profile_setup_done = 1, updated_at = ? WHERE id = ? AND user_id = ?`,
        [isoNow(), id, userId],
      );
      if (result.changes === 0) return fail(appError('NOT_FOUND'));
      const updated = await this.getById(userId, id);
      if (!updated.ok) return updated;
      if (!updated.value) return fail(appError('NOT_FOUND'));
      return ok(updated.value);
    } catch (error) {
      return fail(toAppError(error, 'DATABASE_ERROR'));
    }
  }
}
