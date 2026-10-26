import { describe, expect, it } from 'vitest';
import { resolveApiUrl } from './aiClient';

describe('Campaign Copilot backend URL safety', () => {
  it('does not call localhost from public production builds', () => {
    expect(resolveApiUrl(undefined, false)).toBeNull();
    expect(resolveApiUrl('', false)).toBeNull();
    expect(resolveApiUrl('   ', false)).toBeNull();
  });

  it('preserves localhost only for local development', () => {
    expect(resolveApiUrl(undefined, true)).toBe('http://localhost:3001');
  });

  it('respects and normalises an explicitly configured backend', () => {
    expect(resolveApiUrl(' https://example.test/api/ ', false)).toBe('https://example.test/api');
  });
});
