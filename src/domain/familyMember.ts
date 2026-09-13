/**
 * Family members — the people whose medicines one account manages.
 *
 * ONE ACCOUNT, MANY PROFILES
 * A family member is a profile under the signed-in user's account, not a
 * separate login. The account holder is represented the same way as everyone
 * else, as the profile flagged `isSelf` ("Me"), so every medicine screen works
 * identically whether it is showing your own medicines or your mother's.
 *
 * Every medicine and health condition carries a `memberId`. That is the whole
 * separation mechanism: the repositories scope by account (`userId`) as they
 * always did, and the screens filter by member. One person's medicines can
 * never appear under another's because they are different rows with different
 * member ids — not because a screen remembers to hide them.
 */

import { differenceInYears, parseISO } from 'date-fns';
import { z } from 'zod';

export const RELATIONSHIPS = [
  'ME',
  'MOTHER',
  'FATHER',
  'SPOUSE',
  'SON',
  'DAUGHTER',
  'GRANDMOTHER',
  'GRANDFATHER',
  'OTHER',
] as const;
export type Relationship = (typeof RELATIONSHIPS)[number];

export const RELATIONSHIP_LABELS: Record<Relationship, string> = {
  ME: 'Me',
  MOTHER: 'Mother',
  FATHER: 'Father',
  SPOUSE: 'Spouse / partner',
  SON: 'Son',
  DAUGHTER: 'Daughter',
  GRANDMOTHER: 'Grandmother',
  GRANDFATHER: 'Grandfather',
  OTHER: 'Other',
};

/** Relationships offered when adding someone else — "Me" already exists. */
export const ADDABLE_RELATIONSHIPS: readonly Relationship[] = RELATIONSHIPS.filter(
  (relationship) => relationship !== 'ME',
);

/**
 * Avatar colours are theme *roles*, not hex values, so they follow the
 * selected palette and dark mode (see `MemberAvatar`).
 */
export const AVATAR_COLORS = ['primary', 'info', 'success', 'warning', 'danger'] as const;
export type AvatarColor = (typeof AVATAR_COLORS)[number];

export const AVATAR_COLOR_LABELS: Record<AvatarColor, string> = {
  primary: 'Blue',
  info: 'Sky',
  success: 'Green',
  warning: 'Amber',
  danger: 'Red',
};

// ---------------------------------------------------------------------------
// Personal health profile fields (schema v4)
//
// Stored so the assistant can be told that a factor MAY be relevant, and so
// the person's page can show them. The app itself never calculates anything
// from them: no dose from weight, no verdict from age. See AGENTS.md.
// ---------------------------------------------------------------------------

export const GENDERS = ['FEMALE', 'MALE', 'UNSPECIFIED'] as const;
export type Gender = (typeof GENDERS)[number];

export const GENDER_LABELS: Record<Gender, string> = {
  FEMALE: 'Female',
  MALE: 'Male',
  UNSPECIFIED: 'Prefer not to say',
};

export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'UNKNOWN'] as const;
export type BloodType = (typeof BLOOD_TYPES)[number];

export function bloodTypeLabel(bloodType: BloodType): string {
  return bloodType === 'UNKNOWN' ? "Don't know" : bloodType.replace('-', '−');
}

/** Plausible human ranges — typo guards, not medical limits. */
export const HEIGHT_CM_RANGE = { min: 30, max: 250 } as const;
export const WEIGHT_KG_RANGE = { min: 1, max: 400 } as const;

export type FamilyMember = {
  id: string;
  userId: string;
  name: string;
  relationship: Relationship;
  /** The user's own wording when relationship is OTHER. */
  customRelationship: string | null;
  /** "yyyy-MM-dd" or null. Optional: age is a convenience, not a requirement. */
  dateOfBirth: string | null;
  gender: Gender | null;
  heightCm: number | null;
  weightKg: number | null;
  bloodType: BloodType | null;
  avatarColor: AvatarColor;
  /** True for the account holder's own profile. Exactly one per account. */
  isSelf: boolean;
  /**
   * True once the account holder has seen the "tell us about yourself" step
   * (saved or skipped). Only meaningful on the self profile.
   */
  profileSetupDone: boolean;
  createdAt: string;
  updatedAt: string;
};

/** "172 cm", "68.5 kg" — or null when not recorded. */
export function formatHeight(heightCm: number | null): string | null {
  return heightCm === null ? null : `${Number.isInteger(heightCm) ? heightCm : heightCm.toFixed(1)} cm`;
}

export function formatWeight(weightKg: number | null): string | null {
  return weightKg === null ? null : `${Number.isInteger(weightKg) ? weightKg : weightKg.toFixed(1)} kg`;
}

/** "Mother", or the custom wording, or "Me". */
export function relationshipLabel(
  member: Pick<FamilyMember, 'relationship' | 'customRelationship'>,
): string {
  if (member.relationship === 'OTHER' && member.customRelationship) {
    return member.customRelationship;
  }
  return RELATIONSHIP_LABELS[member.relationship];
}

/** Whole years, or null when no date of birth was given. */
export function ageOf(member: Pick<FamilyMember, 'dateOfBirth'>, today: Date = new Date()): number | null {
  if (!member.dateOfBirth) return null;
  const born = parseISO(member.dateOfBirth);
  if (Number.isNaN(born.getTime())) return null;
  const years = differenceInYears(today, born);
  return years < 0 ? null : years;
}

/** Up to two initials for the avatar: "Fatima Al Ali" → "FA". */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';
  return `${first}${last}`.toUpperCase();
}

/** "Mother's medicines" / "My medicines" — used for headings and banners. */
export function possessive(member: Pick<FamilyMember, 'name' | 'isSelf'>, noun: string): string {
  if (member.isSelf) return `My ${noun}`;
  const name = member.name.trim();
  return `${name}${name.endsWith('s') ? '’' : '’s'} ${noun}`;
}

/** Pick a colour for a new member that is least used so far. */
export function nextAvatarColor(existing: readonly Pick<FamilyMember, 'avatarColor'>[]): AvatarColor {
  const counts = new Map<AvatarColor, number>(AVATAR_COLORS.map((c) => [c, 0]));
  for (const member of existing) counts.set(member.avatarColor, (counts.get(member.avatarColor) ?? 0) + 1);
  let best: AvatarColor = AVATAR_COLORS[0];
  for (const color of AVATAR_COLORS) {
    if ((counts.get(color) ?? 0) < (counts.get(best) ?? 0)) best = color;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function emptyToNull(value: unknown): unknown {
  if (typeof value !== 'string') return value ?? null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isPastOrToday(value: string): boolean {
  const date = parseISO(value);
  return !Number.isNaN(date.getTime()) && date.getTime() <= Date.now();
}

/** "" → null; "72,5" → 72.5; anything else → the string (so the number check fails). */
function optionalNumber(value: unknown): unknown {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return value ?? null;
  const trimmed = value.trim().replace(',', '.');
  if (trimmed.length === 0) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : trimmed;
}

function measurement(range: { min: number; max: number }, label: string, unit: string) {
  return z.preprocess(
    optionalNumber,
    z
      .number({ message: `Please enter ${label} as a number, in ${unit}.` })
      .min(range.min, `Please check the ${label} — it should be between ${range.min} and ${range.max} ${unit}.`)
      .max(range.max, `Please check the ${label} — it should be between ${range.min} and ${range.max} ${unit}.`)
      .transform((n) => Math.round(n * 10) / 10)
      .nullable(),
  );
}

/** Just the health-profile fields, shared by the sign-up step and the member form. */
export const healthProfileSchema = z.object({
  dateOfBirth: z.preprocess(
    emptyToNull,
    z
      .string()
      .regex(ISO_DATE, 'Please choose the date of birth from the calendar.')
      .refine(isPastOrToday, 'The date of birth cannot be in the future.')
      .nullable(),
  ),
  gender: z.preprocess(emptyToNull, z.enum(GENDERS).nullable()),
  heightCm: measurement(HEIGHT_CM_RANGE, 'height', 'cm'),
  weightKg: measurement(WEIGHT_KG_RANGE, 'weight', 'kg'),
  bloodType: z.preprocess(emptyToNull, z.enum(BLOOD_TYPES).nullable()),
});

export type HealthProfileInput = {
  dateOfBirth: string | null;
  gender: Gender | null;
  heightCm: number | null;
  weightKg: number | null;
  bloodType: BloodType | null;
};

/** Raw strings from the form. */
export type HealthProfileFormValues = {
  dateOfBirth: string;
  gender: Gender | '';
  heightCm: string;
  weightKg: string;
  bloodType: BloodType | '';
};

export const EMPTY_HEALTH_PROFILE_FORM: HealthProfileFormValues = {
  dateOfBirth: '',
  gender: '',
  heightCm: '',
  weightKg: '',
  bloodType: '',
};

export function toHealthProfileFormValues(
  member: Pick<FamilyMember, 'dateOfBirth' | 'gender' | 'heightCm' | 'weightKg' | 'bloodType'>,
): HealthProfileFormValues {
  return {
    dateOfBirth: member.dateOfBirth ?? '',
    gender: member.gender ?? '',
    heightCm: member.heightCm === null ? '' : String(member.heightCm),
    weightKg: member.weightKg === null ? '' : String(member.weightKg),
    bloodType: member.bloodType ?? '',
  };
}

export const familyMemberInputSchema = z
  .object({
    ...healthProfileSchema.shape,
    name: z.preprocess(
      (value) => (typeof value === 'string' ? value.trim() : value),
      z
        .string()
        .min(1, 'Please enter their name.')
        .max(60, 'Please use a shorter name (60 characters or fewer).'),
    ),
    relationship: z.enum(RELATIONSHIPS, { message: 'Please choose a relationship.' }),
    customRelationship: z.preprocess(
      emptyToNull,
      z.string().max(40, 'Please use 40 characters or fewer.').nullable(),
    ),
    avatarColor: z.enum(AVATAR_COLORS),
  })
  .superRefine((value, ctx) => {
    if (value.relationship === 'OTHER' && !value.customRelationship) {
      ctx.addIssue({
        code: 'custom',
        path: ['customRelationship'],
        message: 'Please say how this person is related to you.',
      });
    }
  })
  .transform((value) => ({
    ...value,
    customRelationship: value.relationship === 'OTHER' ? value.customRelationship : null,
  }));

export type FamilyMemberInput = HealthProfileInput & {
  name: string;
  relationship: Relationship;
  customRelationship: string | null;
  avatarColor: AvatarColor;
};

export type FamilyMemberFormValues = HealthProfileFormValues & {
  name: string;
  relationship: Relationship | '';
  customRelationship: string;
  avatarColor: AvatarColor;
};

export function emptyFamilyMemberForm(avatarColor: AvatarColor = 'primary'): FamilyMemberFormValues {
  return { ...EMPTY_HEALTH_PROFILE_FORM, name: '', relationship: '', customRelationship: '', avatarColor };
}

export function toFamilyMemberFormValues(member: FamilyMember): FamilyMemberFormValues {
  return {
    ...toHealthProfileFormValues(member),
    name: member.name,
    relationship: member.relationship,
    customRelationship: member.customRelationship ?? '',
    avatarColor: member.avatarColor,
  };
}

/** The stored member's profile fields as an input, so a partial edit keeps the rest. */
export function toFamilyMemberInput(member: FamilyMember): FamilyMemberInput {
  return {
    name: member.name,
    relationship: member.relationship,
    customRelationship: member.customRelationship,
    dateOfBirth: member.dateOfBirth,
    gender: member.gender,
    heightCm: member.heightCm,
    weightKg: member.weightKg,
    bloodType: member.bloodType,
    avatarColor: member.avatarColor,
  };
}
