/**
 * Tests for useQuickStats — the sidebar hook that drives the green "Call
 * Center" pulse indicator. The hook reads call records from localStorage,
 * counts in_progress / queued / booked entries for today, and must
 * proactively reconcile stale in_progress records on each poll tick so
 * the indicator does not stay lit after an abrupt hang-up.
 *
 * Regression context: before the fix, reconciliation ran only on the
 * /campaign route. Users on any other route saw the pulse stay lit for
 * up to 24h after an abrupt hang-up, because nothing on their current
 * route was flipping the localStorage record back to `failed`/`completed`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const mockStorage: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => mockStorage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    mockStorage[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete mockStorage[key];
  }),
  clear: vi.fn(() => {
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  }),
};

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

const reconcileSpy = vi.fn().mockResolvedValue({ reconciled: 0, ids: [] });

vi.mock('@/lib/campaign-storage', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/campaign-storage')
  >('@/lib/campaign-storage');
  return {
    ...actual,
    reconcileStaleInProgressRecords: (...args: unknown[]) =>
      reconcileSpy(...args),
  };
});

describe('useQuickStats — global indicator reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    reconcileSpy.mockResolvedValue({ reconciled: 0, ids: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls reconcileStaleInProgressRecords on first render', async () => {
    const { useQuickStats } = await import('@/hooks/useQuickStats');
    renderHook(() => useQuickStats());
    await waitFor(() => {
      expect(reconcileSpy).toHaveBeenCalled();
    });
  });

  it('reports activeCalls=0 when localStorage is empty', async () => {
    const { useQuickStats } = await import('@/hooks/useQuickStats');
    const { result } = renderHook(() => useQuickStats());
    await waitFor(() => {
      expect(result.current.activeCalls).toBe(0);
    });
  });

  it('counts today in_progress records as active', async () => {
    mockStorage['superpatch_campaign_calls'] = JSON.stringify({
      'prac-1': {
        practitioner_id: 'prac-1',
        practitioner_name: 'Dr. Test',
        practitioner_type: 'chiropractor',
        phone: '4165551234',
        address: '',
        city: '',
        province: '',
        status: 'in_progress',
        appointment_booked: false,
        calendar_invite_sent: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    });
    const { useQuickStats } = await import('@/hooks/useQuickStats');
    const { result } = renderHook(() => useQuickStats());
    await waitFor(() => {
      expect(result.current.activeCalls).toBe(1);
    });
  });

  it('re-counts active calls after reconciler clears a stale record', async () => {
    const today = new Date().toISOString();
    mockStorage['superpatch_campaign_calls'] = JSON.stringify({
      'prac-stuck': {
        practitioner_id: 'prac-stuck',
        practitioner_name: 'Dr. Stuck',
        practitioner_type: 'chiropractor',
        phone: '4165550000',
        address: '',
        city: '',
        province: '',
        status: 'in_progress',
        appointment_booked: false,
        calendar_invite_sent: false,
        created_at: today,
        updated_at: today,
      },
    });

    reconcileSpy.mockImplementation(async () => {
      const records = JSON.parse(
        mockStorage['superpatch_campaign_calls'] || '{}',
      );
      records['prac-stuck'].status = 'failed';
      mockStorage['superpatch_campaign_calls'] = JSON.stringify(records);
      return { reconciled: 1, ids: ['prac-stuck'] };
    });

    const { useQuickStats } = await import('@/hooks/useQuickStats');
    const { result } = renderHook(() => useQuickStats());
    await waitFor(() => {
      expect(reconcileSpy).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(result.current.activeCalls).toBe(0);
    });
  });
});
