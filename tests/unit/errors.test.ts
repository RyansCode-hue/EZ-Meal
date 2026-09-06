import { describeError } from '@/lib/errors';

describe('describeError', () => {
  it('maps auth and database codes to plain sentences', () => {
    expect(describeError({ code: 'invalid_credentials', message: 'x' })).toBe('Wrong email or password.');
    expect(describeError({ code: 'signup_disabled', message: 'x' })).toMatch(/Sign-ups are closed/);
    expect(describeError({ code: '23505', message: 'x' })).toBe('You are already in a household.');
  });
  it('recognizes being offline', () => {
    expect(describeError(new TypeError('Network request failed'))).toMatch(/offline/);
    expect(describeError(new TypeError('Failed to fetch'))).toMatch(/offline/);
  });
  it('passes other messages through', () => {
    expect(describeError(new Error('Nope'))).toBe('Nope');
    expect(describeError(undefined)).toBe('Something went wrong.');
  });
});
