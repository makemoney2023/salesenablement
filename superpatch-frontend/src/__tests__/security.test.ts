/**
 * Tests for security utilities (src/lib/security.ts)
 */
import { describe, it, expect } from 'vitest';
import { sanitizeRedirectPath, sanitizeSearchInput } from '@/lib/security';

describe('sanitizeRedirectPath', () => {
  it('allows valid relative paths', () => {
    expect(sanitizeRedirectPath('/')).toBe('/');
    expect(sanitizeRedirectPath('/dashboard')).toBe('/dashboard');
    expect(sanitizeRedirectPath('/settings/profile')).toBe('/settings/profile');
    expect(sanitizeRedirectPath('/campaign?tab=calls')).toBe('/campaign?tab=calls');
  });

  it('defaults to / for null/empty input', () => {
    expect(sanitizeRedirectPath(null)).toBe('/');
    expect(sanitizeRedirectPath('')).toBe('/');
  });

  it('blocks protocol-relative URLs', () => {
    expect(sanitizeRedirectPath('//evil.com')).toBe('/');
    expect(sanitizeRedirectPath('//evil.com/path')).toBe('/');
  });

  it('blocks paths with backslashes', () => {
    expect(sanitizeRedirectPath('/\\evil.com')).toBe('/');
    expect(sanitizeRedirectPath('/path\\to\\evil')).toBe('/');
  });

  it('blocks paths not starting with /', () => {
    expect(sanitizeRedirectPath('evil.com')).toBe('/');
    expect(sanitizeRedirectPath('javascript:alert(1)')).toBe('/');
    expect(sanitizeRedirectPath('data:text/html,<script>alert(1)</script>')).toBe('/');
    expect(sanitizeRedirectPath('http://evil.com')).toBe('/');
    expect(sanitizeRedirectPath('https://evil.com')).toBe('/');
  });

  it('allows paths with hash and query parameters', () => {
    expect(sanitizeRedirectPath('/page#section')).toBe('/page#section');
    expect(sanitizeRedirectPath('/page?key=value')).toBe('/page?key=value');
    expect(sanitizeRedirectPath('/page?key=value#section')).toBe('/page?key=value#section');
  });
});

describe('sanitizeSearchInput', () => {
  it('returns normal text unchanged', () => {
    expect(sanitizeSearchInput('chiropractic')).toBe('chiropractic');
    expect(sanitizeSearchInput('Dr. Smith')).toBe('Dr. Smith');
  });

  it('escapes SQL wildcards', () => {
    expect(sanitizeSearchInput('100%')).toBe('100\\%');
    expect(sanitizeSearchInput('test_value')).toBe('test\\_value');
  });

  it('removes PostgREST filter syntax characters', () => {
    expect(sanitizeSearchInput('name,address')).toBe('nameaddress');
    expect(sanitizeSearchInput('test(injection)')).toBe('testinjection');
  });

  it('escapes backslashes', () => {
    expect(sanitizeSearchInput('path\\to')).toBe('path\\\\to');
  });

  it('truncates to max length', () => {
    const longString = 'a'.repeat(300);
    expect(sanitizeSearchInput(longString).length).toBe(200);
  });

  it('accepts custom max length', () => {
    const longString = 'a'.repeat(100);
    expect(sanitizeSearchInput(longString, 50).length).toBe(50);
  });
});
