/**
 * Tests for batch-caller utilities (src/lib/batch-caller.ts)
 *
 * Tests phone formatting, pathway resolution, and BatchCaller lifecycle.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock campaign storage
vi.mock('@/lib/campaign-storage', () => ({
  createCallRecord: vi.fn((data: Record<string, unknown>) => ({
    practitioner_id: data.id,
    status: 'not_called',
    ...data,
  })),
  getCallRecord: vi.fn(() => null),
  updateCallStatus: vi.fn(),
  getCampaignQueueState: vi.fn(() => ({
    is_running: false,
    delay_between_calls_ms: 60000,
    current_call_id: null,
    current_practitioner_id: null,
  })),
  saveCampaignQueueState: vi.fn(),
  removeFromQueue: vi.fn(),
}));

// Mock config
vi.mock('@/lib/config/pathways', () => ({
  KB_ID: 'test-kb-id',
  VOICE_ID: 'test-voice-id',
  getPathwayId: vi.fn((type: string) => `pathway-for-${type.toLowerCase()}`),
}));

describe('BatchCaller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset global fetch mock
    global.fetch = vi.fn();
  });

  it('can be instantiated via getBatchCaller', async () => {
    const { getBatchCaller } = await import('@/lib/batch-caller');
    const caller = getBatchCaller();
    expect(caller).toBeDefined();
    expect(typeof caller.makeCall).toBe('function');
    expect(typeof caller.startCampaign).toBe('function');
    expect(typeof caller.pauseCampaign).toBe('function');
    expect(typeof caller.stopCampaign).toBe('function');
    expect(typeof caller.getState).toBe('function');
  });

  it('returns initial state correctly', async () => {
    const { getBatchCaller } = await import('@/lib/batch-caller');
    const caller = getBatchCaller();
    const state = caller.getState();
    expect(state).toHaveProperty('isRunning');
    expect(state).toHaveProperty('isPaused');
    expect(state).toHaveProperty('currentCallId');
    expect(state).toHaveProperty('delayBetweenCalls');
  });

  it('rejects calls with invalid phone numbers', async () => {
    const { getBatchCaller } = await import('@/lib/batch-caller');
    const caller = getBatchCaller();

    const result = await caller.makeCall({
      id: 'test-id',
      name: 'Dr. Test',
      practitioner_type: 'chiropractor',
      address: '123 Main St',
      city: 'Toronto',
      province: 'ON',
      phone: '123', // Too short
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid phone number');
  });

  it('rejects calls with null phone', async () => {
    const { getBatchCaller } = await import('@/lib/batch-caller');
    const caller = getBatchCaller();

    const result = await caller.makeCall({
      id: 'test-id',
      name: 'Dr. Test',
      practitioner_type: 'chiropractor',
      address: '123 Main St',
      city: 'Toronto',
      province: 'ON',
      phone: null,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid phone number');
  });

  it('makes a successful call with valid phone', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: 'success', call_id: 'call-123' }),
    });
    global.fetch = mockFetch;

    const { getBatchCaller } = await import('@/lib/batch-caller');
    const caller = getBatchCaller();

    const result = await caller.makeCall({
      id: 'test-id',
      name: 'Dr. Test',
      practitioner_type: 'chiropractor',
      address: '123 Main St',
      city: 'Toronto',
      province: 'ON',
      phone: '4165551234',
    });

    expect(result.success).toBe(true);
    expect(result.call_id).toBe('call-123');
    expect(mockFetch).toHaveBeenCalledWith('/api/bland/calls', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }));
  });

  it('handles API error responses', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: 'error', message: 'Rate limited' }),
    });

    const { getBatchCaller } = await import('@/lib/batch-caller');
    const caller = getBatchCaller();

    const result = await caller.makeCall({
      id: 'test-id',
      name: 'Dr. Test',
      practitioner_type: 'chiropractor',
      address: '123 Main St',
      city: 'Toronto',
      province: 'ON',
      phone: '4165551234',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Rate limited');
  });

  it('handles network errors gracefully', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const { getBatchCaller } = await import('@/lib/batch-caller');
    const caller = getBatchCaller();

    const result = await caller.makeCall({
      id: 'test-id',
      name: 'Dr. Test',
      practitioner_type: 'chiropractor',
      address: '123 Main St',
      city: 'Toronto',
      province: 'ON',
      phone: '4165551234',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Network error');
  });

  it('subscribes and unsubscribes from events', async () => {
    const { getBatchCaller } = await import('@/lib/batch-caller');
    const caller = getBatchCaller();

    const listener = vi.fn();
    const unsubscribe = caller.subscribe(listener);

    expect(typeof unsubscribe).toBe('function');

    // Stop campaign should emit event
    caller.stopCampaign();
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'campaign_stopped' })
    );

    // After unsubscribe, should not receive events
    unsubscribe();
    listener.mockClear();
    caller.stopCampaign();
    expect(listener).not.toHaveBeenCalled();
  });

  it('setDelayBetweenCalls updates the delay', async () => {
    const { getBatchCaller } = await import('@/lib/batch-caller');
    const caller = getBatchCaller();

    caller.setDelayBetweenCalls(30000);
    expect(caller.getState().delayBetweenCalls).toBe(30000);
  });
});
