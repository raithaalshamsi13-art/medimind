import {
  ADDABLE_RELATIONSHIPS,
  ageOf,
  familyMemberInputSchema,
  initialsOf,
  nextAvatarColor,
  possessive,
  relationshipLabel,
  toFamilyMemberFormValues,
  type FamilyMember,
} from '@/domain/familyMember';

const MOTHER: FamilyMember = {
  id: 'f1',
  userId: 'u1',
  name: 'Fatima Al Ali',
  relationship: 'MOTHER',
  customRelationship: null,
  dateOfBirth: '1960-03-15',
  avatarColor: 'info',
  isSelf: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('familyMemberInputSchema', () => {
  const base = { name: ' Fatima ', relationship: 'MOTHER', customRelationship: '', dateOfBirth: '', avatarColor: 'info' };

  it('accepts a preset relationship and trims the name', () => {
    const parsed = familyMemberInputSchema.safeParse(base);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toEqual({
        name: 'Fatima',
        relationship: 'MOTHER',
        customRelationship: null,
        dateOfBirth: null,
        avatarColor: 'info',
      });
    }
  });

  it('requires wording for "Other" and drops it otherwise', () => {
    const missing = familyMemberInputSchema.safeParse({ ...base, relationship: 'OTHER' });
    expect(missing.success).toBe(false);
    if (!missing.success) expect(missing.error.issues[0]?.path).toEqual(['customRelationship']);

    const aunt = familyMemberInputSchema.safeParse({
      ...base,
      relationship: 'OTHER',
      customRelationship: 'Aunt',
    });
    expect(aunt.success && aunt.data.customRelationship).toBe('Aunt');

    const ignored = familyMemberInputSchema.safeParse({ ...base, customRelationship: 'ignored' });
    expect(ignored.success && ignored.data.customRelationship).toBeNull();
  });

  it('rejects a blank name, an unknown relationship, and a future date of birth', () => {
    expect(familyMemberInputSchema.safeParse({ ...base, name: '  ' }).success).toBe(false);
    expect(familyMemberInputSchema.safeParse({ ...base, relationship: 'COUSIN' }).success).toBe(false);
    expect(familyMemberInputSchema.safeParse({ ...base, dateOfBirth: '2999-01-01' }).success).toBe(false);
    expect(familyMemberInputSchema.safeParse({ ...base, dateOfBirth: '15/03/1960' }).success).toBe(false);
    expect(familyMemberInputSchema.safeParse({ ...base, dateOfBirth: '1960-03-15' }).success).toBe(true);
  });
});

describe('helpers', () => {
  it('never offers "Me" when adding someone else', () => {
    expect(ADDABLE_RELATIONSHIPS).not.toContain('ME');
    expect(ADDABLE_RELATIONSHIPS).toContain('OTHER');
  });

  it('labels relationships, using the custom wording for Other', () => {
    expect(relationshipLabel(MOTHER)).toBe('Mother');
    expect(relationshipLabel({ relationship: 'OTHER', customRelationship: 'Aunt' })).toBe('Aunt');
    expect(relationshipLabel({ relationship: 'OTHER', customRelationship: null })).toBe('Other');
  });

  it('computes age in whole years, or null without a date of birth', () => {
    const today = new Date(2026, 8, 13);
    expect(ageOf(MOTHER, today)).toBe(66);
    expect(ageOf({ dateOfBirth: '2026-09-14' }, today)).toBe(0);
    expect(ageOf({ dateOfBirth: null }, today)).toBeNull();
    expect(ageOf({ dateOfBirth: 'nonsense' }, today)).toBeNull();
  });

  it('builds initials and possessives', () => {
    expect(initialsOf('Fatima Al Ali')).toBe('FA');
    expect(initialsOf('omar')).toBe('O');
    expect(initialsOf('   ')).toBe('?');
    expect(possessive(MOTHER, 'medicines')).toBe('Fatima Al Ali’s medicines');
    expect(possessive({ name: 'James', isSelf: false }, 'schedule')).toBe('James’ schedule');
    expect(possessive({ name: 'Omar', isSelf: true }, 'medicines')).toBe('My medicines');
  });

  it('picks the least-used avatar colour for the next member', () => {
    expect(nextAvatarColor([])).toBe('primary');
    expect(nextAvatarColor([{ avatarColor: 'primary' }])).toBe('info');
    expect(
      nextAvatarColor([
        { avatarColor: 'primary' },
        { avatarColor: 'info' },
        { avatarColor: 'success' },
        { avatarColor: 'warning' },
        { avatarColor: 'danger' },
        { avatarColor: 'primary' },
      ]),
    ).toBe('info');
  });

  it('turns a stored member back into editable strings', () => {
    expect(toFamilyMemberFormValues(MOTHER)).toEqual({
      name: 'Fatima Al Ali',
      relationship: 'MOTHER',
      customRelationship: '',
      dateOfBirth: '1960-03-15',
      avatarColor: 'info',
    });
  });
});
