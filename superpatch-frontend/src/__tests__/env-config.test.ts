/**
 * Tests for environment variable validation (src/lib/config/env.ts)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { requireEnvVar, getEnvVar, validateServerEnv } from '@/lib/config/env';

describe('env config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('requireEnvVar', () => {
    it('returns the value when env var is set', () => {
      process.env.TEST_VAR = 'my-value';
      expect(requireEnvVar('TEST_VAR')).toBe('my-value');
    });

    it('throws when env var is not set', () => {
      delete process.env.MISSING_VAR;
      expect(() => requireEnvVar('MISSING_VAR')).toThrow('Missing required environment variable: MISSING_VAR');
    });

    it('throws when env var is empty string', () => {
      process.env.EMPTY_VAR = '';
      expect(() => requireEnvVar('EMPTY_VAR')).toThrow('Missing required environment variable: EMPTY_VAR');
    });

    it('throws when env var is whitespace only', () => {
      process.env.SPACE_VAR = '   ';
      expect(() => requireEnvVar('SPACE_VAR')).toThrow('Missing required environment variable: SPACE_VAR');
    });
  });

  describe('getEnvVar', () => {
    it('returns the value when env var is set', () => {
      process.env.TEST_VAR = 'my-value';
      expect(getEnvVar('TEST_VAR')).toBe('my-value');
    });

    it('returns null when env var is not set', () => {
      delete process.env.MISSING_VAR;
      expect(getEnvVar('MISSING_VAR')).toBeNull();
    });

    it('returns null when env var is empty string', () => {
      process.env.EMPTY_VAR = '';
      expect(getEnvVar('EMPTY_VAR')).toBeNull();
    });

    it('returns null when env var is whitespace only', () => {
      process.env.SPACE_VAR = '   ';
      expect(getEnvVar('SPACE_VAR')).toBeNull();
    });
  });

  describe('validateServerEnv', () => {
    it('reports missing required vars', () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      delete process.env.BLAND_API_KEY;
      
      const { missing } = validateServerEnv();
      expect(missing.length).toBeGreaterThan(0);
      expect(missing.some(m => m.includes('NEXT_PUBLIC_SUPABASE_URL'))).toBe(true);
      expect(missing.some(m => m.includes('BLAND_API_KEY'))).toBe(true);
    });

    it('returns empty missing array when all required vars are set', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
      process.env.BLAND_API_KEY = 'test-bland-key';
      
      const { missing } = validateServerEnv();
      expect(missing).toHaveLength(0);
    });

    it('reports optional vars as warnings', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
      process.env.BLAND_API_KEY = 'test-bland-key';
      delete process.env.GOOGLE_MAPS_API_KEY;
      delete process.env.FIRECRAWL_API_KEY;
      delete process.env.CAL_API_KEY;
      
      const { warnings } = validateServerEnv();
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings.some(w => w.includes('GOOGLE_MAPS_API_KEY'))).toBe(true);
    });
  });
});
