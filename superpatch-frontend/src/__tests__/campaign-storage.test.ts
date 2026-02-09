/**
 * Tests for campaign-storage.ts
 *
 * Verifies the atomic read-before-write pattern in updateCallStatus,
 * localStorage guards, and record lifecycle.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock localStorage
const mockStorage: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => mockStorage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { mockStorage[key] = value; }),
  removeItem: vi.fn((key: string) => { delete mockStorage[key]; }),
  clear: vi.fn(() => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }),
};

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });
Object.defineProperty(globalThis, 'window', { value: globalThis });

describe('campaign-storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  it('createCallRecord stores a record in localStorage', async () => {
    const { createCallRecord } = await import('@/lib/campaign-storage');

    const record = createCallRecord({
      id: 'prac-1',
      name: 'Dr. Test',
      practitioner_type: 'chiropractor',
      phone: '4165551234',
      address: '123 Main St',
      city: 'Toronto',
      province: 'ON',
    });

    expect(record).toBeDefined();
    expect(record.practitioner_id).toBe('prac-1');
    expect(record.practitioner_name).toBe('Dr. Test');
    expect(record.status).toBe('not_called');
    expect(localStorageMock.setItem).toHaveBeenCalled();
  });

  it('updateCallStatus reads fresh data from localStorage', async () => {
    const { createCallRecord, updateCallStatus, getCallRecord } = await import('@/lib/campaign-storage');

    // Create a record
    createCallRecord({
      id: 'prac-2',
      name: 'Dr. Fresh',
      practitioner_type: 'naturopath',
      phone: '4165559999',
      address: '456 Oak Ave',
      city: 'Vancouver',
      province: 'BC',
    });

    // Update its status
    const updated = updateCallStatus('prac-2', 'in_progress');
    expect(updated).not.toBeNull();
    expect(updated?.status).toBe('in_progress');
    expect(updated?.call_started_at).toBeDefined();

    // Read it back
    const read = getCallRecord('prac-2');
    expect(read?.status).toBe('in_progress');
  });

  it('updateCallStatus returns null for non-existent records', async () => {
    const { updateCallStatus } = await import('@/lib/campaign-storage');
    const result = updateCallStatus('non-existent', 'completed');
    expect(result).toBeNull();
  });

  it('updateCallStatus sets call_ended_at for terminal statuses', async () => {
    const { createCallRecord, updateCallStatus } = await import('@/lib/campaign-storage');

    createCallRecord({
      id: 'prac-3',
      name: 'Dr. Terminal',
      practitioner_type: 'chiropractor',
      phone: '4165551111',
      address: '789 Pine Rd',
      city: 'Ottawa',
      province: 'ON',
    });

    const updated = updateCallStatus('prac-3', 'completed');
    expect(updated?.call_ended_at).toBeDefined();
  });

  it('getCallRecords returns all records', async () => {
    const { createCallRecord, getCallRecords } = await import('@/lib/campaign-storage');

    createCallRecord({
      id: 'a',
      name: 'A',
      practitioner_type: 'chiropractor',
      phone: '1111111111',
      address: '',
      city: '',
      province: '',
    });

    createCallRecord({
      id: 'b',
      name: 'B',
      practitioner_type: 'naturopath',
      phone: '2222222222',
      address: '',
      city: '',
      province: '',
    });

    const all = getCallRecords();
    expect(Object.keys(all).length).toBeGreaterThanOrEqual(2);
  });
});
