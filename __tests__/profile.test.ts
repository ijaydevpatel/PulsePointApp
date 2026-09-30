import { RemoteProfile } from '../src/data/remoteServices';

const api = (over: Partial<Record<'get' | 'post', any>> = {}) => ({
  configured: true,
  get: jest.fn(async () => ({})),
  post: jest.fn(async (_p: string, body: any) => body),
  ...over,
}) as any;

describe('reading a profile', () => {
  it('reads "not recorded" out of the backend\'s zeroes and blanks', async () => {
    const r = await new RemoteProfile(api({
      get: jest.fn(async () => ({
        fullName: '', age: 0, gender: '', height: 0, weight: 0,
        bloodGroup: '', allergies: [], conditions: [], medications: [], bmi: 0,
      })),
    })).me();

    expect(r.status).toBe('OK');
    expect(r.data).toMatchObject({
      fullName: null, age: null, gender: null,
      heightCm: null, weightKg: null, bloodGroup: null, bmi: null,
    });
    expect(r.data!.allergies).toEqual([]);
  });

  it('keeps real values, and rounds age', async () => {
    const r = await new RemoteProfile(api({
      get: jest.fn(async () => ({
        fullName: '  Dhruvi  ', age: 23.4, gender: 'Female',
        height: 165, weight: 58, bloodGroup: ' o+ ',
        allergies: ['Penicillin'], conditions: ['Asthma'],
        medications: ['Salbutamol'], bmi: 21.3,
      })),
    })).me();

    expect(r.data).toMatchObject({
      fullName: 'Dhruvi', age: 23, gender: 'Female',
      heightCm: 165, weightKg: 58, bloodGroup: 'o+', bmi: 21.3,
    });
  });

  it('accepts the comma-joined lists older rows hold', async () => {
    const r = await new RemoteProfile(api({
      get: jest.fn(async () => ({ allergies: 'Penicillin, peanuts , ' })),
    })).me();

    expect(r.data!.allergies).toEqual(['Penicillin', 'peanuts']);
  });

  it('rejects impossible figures rather than displaying them', async () => {
    const r = await new RemoteProfile(api({
      get: jest.fn(async () => ({ age: 900, height: -5, weight: 5000 })),
    })).me();

    expect(r.data).toMatchObject({ age: null, heightCm: null, weightKg: null });
  });

  it('survives a response that is not a profile at all', async () => {
    const r = await new RemoteProfile(api({ get: jest.fn(async () => null) })).me();

    expect(r.status).toBe('OK');
    expect(r.data!.age).toBeNull();
    expect(r.data!.medications).toEqual([]);
  });
});

describe('saving a profile', () => {
  it('sends the field names the route actually reads', async () => {
    const post = jest.fn(async (_p: string, body: any) => body);

    await new RemoteProfile(api({ post })).save({
      fullName: 'Dhruvi', age: 23, gender: 'Female',
      heightCm: 165, weightKg: 58, bloodGroup: 'O+',
      allergies: ['Penicillin'], conditions: [], medications: [],
    });

    const [path, body] = post.mock.calls[0]!;
    expect(path).toBe('/api/profile');

    expect(body).toMatchObject({ height: 165, weight: 58 });
    expect(body).not.toHaveProperty('heightCm');
    expect(body).not.toHaveProperty('weightKg');
  });

  it('does not send a BMI it could get wrong', async () => {
    const post = jest.fn(async (_p: string, body: any) => body);

    await new RemoteProfile(api({ post })).save({
      fullName: null, age: null, gender: null, heightCm: 165, weightKg: 58,
      bloodGroup: null, allergies: [], conditions: [], medications: [],
    });

    expect(post.mock.calls[0]![1]).not.toHaveProperty('bmi');
  });

  it('turns nulls back into the blanks the backend expects', async () => {
    const post = jest.fn(async (_p: string, body: any) => body);

    await new RemoteProfile(api({ post })).save({
      fullName: null, age: null, gender: null, heightCm: null, weightKg: null,
      bloodGroup: null, allergies: [], conditions: [], medications: [],
    });

    expect(post.mock.calls[0]![1]).toMatchObject({
      fullName: '', age: 0, gender: '', height: 0, weight: 0, bloodGroup: '',
    });
  });

  it('reports a failure instead of pretending it saved', async () => {
    const r = await new RemoteProfile(api({
      post: jest.fn(async () => { throw new Error('Network request failed'); }),
    })).save({
      fullName: 'Dhruvi', age: 23, gender: null, heightCm: null, weightKg: null,
      bloodGroup: null, allergies: [], conditions: [], medications: [],
    });

    expect(r.status).not.toBe('OK');
    expect(r.notice).toBeTruthy();
  });
});
