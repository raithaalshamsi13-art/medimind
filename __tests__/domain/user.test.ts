/**
 * Validation rules for the auth forms.
 *
 * These schemas are the single definition of "valid email" / "valid password"
 * shared by the login screen, the signup screen and the auth service, so they
 * are worth testing directly.
 */

import { firstNameOf, signInSchema, signUpSchema } from '@/domain/user';

describe('signUpSchema', () => {
  it('accepts a valid signup and normalises the email', () => {
    const result = signUpSchema.safeParse({
      displayName: '  Omar Al Shamsi  ',
      email: '  Omar@Example.COM ',
      password: 'medimind123',
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    // Emails are trimmed and lowercased so the same person cannot end up with
    // two accounts that differ only by capitalisation.
    expect(result.data.email).toBe('omar@example.com');
    expect(result.data.displayName).toBe('Omar Al Shamsi');
  });

  it('rejects a malformed email', () => {
    const result = signUpSchema.safeParse({
      displayName: 'Omar',
      email: 'not-an-email',
      password: 'medimind123',
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0].path[0]).toBe('email');
  });

  it('rejects a password shorter than 8 characters', () => {
    const result = signUpSchema.safeParse({
      displayName: 'Omar',
      email: 'omar@example.com',
      password: 'short',
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0].path[0]).toBe('password');
    expect(result.error.issues[0].message).toContain('8 characters');
  });

  it('rejects an empty name', () => {
    const result = signUpSchema.safeParse({
      displayName: '   ',
      email: 'omar@example.com',
      password: 'medimind123',
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0].path[0]).toBe('displayName');
  });
});

describe('signInSchema', () => {
  it('accepts any non-empty password', () => {
    // Deliberately does NOT apply the 8-character rule: that would lock out an
    // account created under an older rule.
    const result = signInSchema.safeParse({ email: 'omar@example.com', password: 'x' });
    expect(result.success).toBe(true);
  });

  it('rejects an empty password', () => {
    const result = signInSchema.safeParse({ email: 'omar@example.com', password: '' });
    expect(result.success).toBe(false);
  });
});

describe('firstNameOf', () => {
  const base = { id: '1', email: 'omar@example.com', createdAt: '2026-01-01T00:00:00.000Z' };

  it('uses the first word of the display name', () => {
    expect(firstNameOf({ ...base, displayName: 'Omar Al Shamsi' })).toBe('Omar');
  });

  it('falls back to the email prefix when there is no display name', () => {
    expect(firstNameOf({ ...base, displayName: null })).toBe('omar');
  });
});
