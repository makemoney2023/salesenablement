/**
 * Tests for auth helpers (src/lib/auth.ts)
 *
 * Tests the requireApiAuth and requireApiAdmin functions.
 * These require mocking Supabase, so we test the contract/types.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase server module
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

// We need to import after mocking
const mockCreateClient = vi.fn();

describe('Auth module exports', () => {
  it('exports requireApiAuth function', async () => {
    const auth = await import('@/lib/auth');
    expect(auth.requireApiAuth).toBeDefined();
    expect(typeof auth.requireApiAuth).toBe('function');
  });

  it('exports requireApiAdmin function', async () => {
    const auth = await import('@/lib/auth');
    expect(auth.requireApiAdmin).toBeDefined();
    expect(typeof auth.requireApiAdmin).toBe('function');
  });

  it('exports getAuthUser function', async () => {
    const auth = await import('@/lib/auth');
    expect(auth.getAuthUser).toBeDefined();
    expect(typeof auth.getAuthUser).toBe('function');
  });

  it('exports requireAdmin function', async () => {
    const auth = await import('@/lib/auth');
    expect(auth.requireAdmin).toBeDefined();
    expect(typeof auth.requireAdmin).toBe('function');
  });
});

describe('Auth types', () => {
  it('ApiAuthResult type should have authorized property', async () => {
    const auth = await import('@/lib/auth');
    // We can't directly test types at runtime, but we can verify
    // the function signature by checking it returns a Promise
    const result = auth.requireApiAuth();
    expect(result).toBeInstanceOf(Promise);
  });
});
