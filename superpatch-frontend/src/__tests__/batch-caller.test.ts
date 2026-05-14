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
  WEBHOOK_URL: 'https://test.supabase.co/functions/v1/webhook-processor',
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

  it('rejects a second concurrent call for the same practitioner', async () => {
    // Slow fetch so the first call is still in flight when the second arrives.
    let resolveFirst: (value: unknown) => void = () => {};
    const slowResponse = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    global.fetch = vi.fn().mockReturnValue(
      slowResponse.then(() => ({
        json: () => Promise.resolve({ status: 'success', call_id: 'call-mutex' }),
      }))
    );

    const { getBatchCaller } = await import('@/lib/batch-caller');
    const caller = getBatchCaller();
    const practitioner = {
      id: 'mutex-test',
      name: 'Dr. Mutex',
      practitioner_type: 'chiropractor',
      address: '123 Main St',
      city: 'Toronto',
      province: 'ON',
      phone: '4165551234',
    };

    const firstCall = caller.makeCall(practitioner);
    const secondCall = caller.makeCall(practitioner);

    // The second call must reject IMMEDIATELY without invoking fetch a
    // second time. fetch should still only have one call until we resolve
    // the first.
    const secondResult = await secondCall;
    expect(secondResult.success).toBe(false);
    expect(secondResult.error).toBe(
      'Call already in progress for this practitioner'
    );
    expect((global.fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(1);

    // Allow the first call to complete.
    resolveFirst(null);
    const firstResult = await firstCall;
    expect(firstResult.success).toBe(true);

    // After the first call completes, a third call for the same id should
    // succeed (mutex is released in finally).
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: 'success', call_id: 'call-mutex-2' }),
    });
    const thirdResult = await caller.makeCall(practitioner);
    expect(thirdResult.success).toBe(true);
    expect(thirdResult.call_id).toBe('call-mutex-2');
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
