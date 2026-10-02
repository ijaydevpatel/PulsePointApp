import { resolveDisplayName } from '../src/domain/auth';

/*
 * The bug this covers: signing in showed "k787jaydev", the local part of
 * k787jaydev@gmail.com, and replaced it with the real name about two seconds
 * later once the provider reported firstName and lastName.
 */

describe('an email address is never used as a name', () => {
  it('returns null while the provider has reported no name yet', () => {
    expect(resolveDisplayName({})).toBeNull();
  });

  it('ignores an email local part even when that is all there is', () => {
    expect(resolveDisplayName({ fullName: null, firstName: null, lastName: null }))
      .toBeNull();
  });
});

describe('name resolution order', () => {
  it('prefers the full name the provider holds', () => {
    expect(resolveDisplayName({
      fullName: 'Jaydev Patel', firstName: 'Jaydev', lastName: 'Patel',
    })).toBe('Jaydev Patel');
  });

  it('joins first and last when there is no full name', () => {
    expect(resolveDisplayName({ firstName: 'Jaydev', lastName: 'Patel' }))
      .toBe('Jaydev Patel');
  });

  it('copes with only a first name', () => {
    expect(resolveDisplayName({ firstName: 'Jaydev', lastName: null }))
      .toBe('Jaydev');
  });

  it('falls back to a username before giving up', () => {
    expect(resolveDisplayName({ username: 'jaydev' })).toBe('jaydev');
  });

  it('treats blank and whitespace-only fields as absent', () => {
    expect(resolveDisplayName({ fullName: '   ', firstName: '', lastName: '  ' }))
      .toBeNull();
  });

  it('trims what it returns', () => {
    expect(resolveDisplayName({ fullName: '  Jaydev Patel  ' })).toBe('Jaydev Patel');
  });
});
