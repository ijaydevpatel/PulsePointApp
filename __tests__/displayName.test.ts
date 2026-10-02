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
  it('uses first and last when both are present', () => {
    expect(resolveDisplayName({
      fullName: 'Jaydev Patel', firstName: 'Jaydev', lastName: 'Patel',
    })).toBe('Jaydev Patel');
  });

  it('uses the full name when first and last are not set', () => {
    expect(resolveDisplayName({ fullName: 'Jaydev Patel' })).toBe('Jaydev Patel');
  });

  it('joins first and last', () => {
    expect(resolveDisplayName({ firstName: 'Jaydev', lastName: 'Patel' }))
      .toBe('Jaydev Patel');
  });

  it('copes with only a first name', () => {
    expect(resolveDisplayName({ firstName: 'Jaydev', lastName: null }))
      .toBe('Jaydev');
  });

  it('never uses a username as a name', () => {
    // Clerk reports the username immediately and the real name later; using it
    // put "ijaydevpatel" on screen until firstName and lastName arrived.
    expect(resolveDisplayName({ username: 'ijaydevpatel' } as never)).toBeNull();
  });

  it('prefers first and last over a stale full name', () => {
    expect(resolveDisplayName({
      fullName: 'ijaydevpatel', firstName: 'Jaydev', lastName: 'Patel',
    })).toBe('Jaydev Patel');
  });

  it('treats blank and whitespace-only fields as absent', () => {
    expect(resolveDisplayName({ fullName: '   ', firstName: '', lastName: '  ' }))
      .toBeNull();
  });

  it('trims what it returns', () => {
    expect(resolveDisplayName({ fullName: '  Jaydev Patel  ' })).toBe('Jaydev Patel');
  });
});
