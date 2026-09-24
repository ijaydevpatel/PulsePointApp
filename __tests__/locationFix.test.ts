/**
 * The time-zone tier exists because the two tiers above it are both allowed
 * to fail — GPS indoors, IP services rate-limiting. Its whole job is to
 * always produce something, so that is what these assert.
 */
import { zoneFix } from '../src/data/locationFix';

describe('time-zone location fix', () => {
  const realIntl = Intl.DateTimeFormat;

  const pretendZone = (timeZone: string | undefined) => {
    // @ts-expect-error — deliberately replacing the global for the test.
    Intl.DateTimeFormat = () => ({ resolvedOptions: () => ({ timeZone }) });
  };

  afterEach(() => { Intl.DateTimeFormat = realIntl; });

  it('resolves a named zone to its city', () => {
    pretendZone('Asia/Kolkata');
    const fix = zoneFix()!;
    expect(fix.source).toBe('timezone');
    expect(fix.label).toBe('Kolkata');
    expect(fix.lat).toBeCloseTo(22.57, 1);
    expect(fix.lon).toBeCloseTo(88.36, 1);
  });

  it('accepts the legacy alias for the same place', () => {
    // Older Androids still report Asia/Calcutta.
    pretendZone('Asia/Calcutta');
    expect(zoneFix()!.label).toBe('Kolkata');
  });

  it('falls back to the region for an unlisted zone', () => {
    // The table cannot list every zone, and landing on the right continent
    // beats returning nothing.
    pretendZone('Asia/Thimphu');
    const fix = zoneFix()!;
    expect(fix.source).toBe('timezone');
    expect(fix.label).toBe('Asia');
  });

  it('produces valid coordinates for every zone it knows', () => {
    for (const zone of [
      'Asia/Kolkata', 'Europe/London', 'America/New_York',
      'Pacific/Auckland', 'Africa/Lagos', 'Australia/Sydney',
    ]) {
      pretendZone(zone);
      const fix = zoneFix()!;
      expect(`${zone}: ${fix.lat >= -90 && fix.lat <= 90}`).toBe(`${zone}: true`);
      expect(`${zone}: ${fix.lon >= -180 && fix.lon <= 180}`).toBe(`${zone}: true`);
    }
  });

  it('returns null only when the runtime has no time zone at all', () => {
    pretendZone(undefined);
    expect(zoneFix()).toBeNull();
  });
});
