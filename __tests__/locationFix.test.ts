import { zoneFix } from '../src/data/locationFix';

describe('time-zone location fix', () => {
  const realIntl = Intl.DateTimeFormat;

  const pretendZone = (timeZone: string | undefined) => {
    // @ts-expect-error - deliberately replacing the global for the test.
    Intl.DateTimeFormat = () => ({ resolvedOptions: () => ({ timeZone }) });
  };

  afterEach(() => { Intl.DateTimeFormat = realIntl; });

  it('resolves a named zone to its city', () => {
    pretendZone('Asia/Kolkata');
    const fix = zoneFix()!;
    expect(fix.source).toBe('timezone');
    expect(fix.place).toBe('Kolkata');
    expect(fix.lat).toBeCloseTo(22.57, 1);
    expect(fix.lon).toBeCloseTo(88.36, 1);
  });

  it('accepts the legacy alias for the same place', () => {
    pretendZone('Asia/Calcutta');
    expect(zoneFix()!.place).toBe('Kolkata');
  });

  it('falls back to the region for an unlisted zone', () => {
    pretendZone('Asia/Thimphu');
    const fix = zoneFix()!;
    expect(fix.source).toBe('timezone');
    expect(fix.place).toBe('Asia');
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
