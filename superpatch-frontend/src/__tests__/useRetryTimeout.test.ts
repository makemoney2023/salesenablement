/**
 * Tests for useRetryTimeouts hook (src/hooks/useRetryTimeout.ts)
 *
 * Verifies timeout scheduling, cleanup on unmount, and edge cases.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRetryTimeouts } from '@/hooks/useRetryTimeout';

describe('useRetryTimeouts', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a stable scheduleRetry function', () => {
    const { result, rerender } = renderHook(() => useRetryTimeouts());
    const firstRef = result.current;
    rerender();
    expect(result.current).toBe(firstRef);
  });

  it('executes the callback after the specified delay', () => {
    const { result } = renderHook(() => useRetryTimeouts());
    const callback = vi.fn();

    act(() => {
      result.current(callback, 1000);
    });

    expect(callback).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(callback).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(callback).toHaveBeenCalledOnce();
  });

  it('cancels pending timeouts on unmount', () => {
    const { result, unmount } = renderHook(() => useRetryTimeouts());
    const callback = vi.fn();

    act(() => {
      result.current(callback, 5000);
    });

    unmount();

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it('handles multiple concurrent timeouts', () => {
    const { result } = renderHook(() => useRetryTimeouts());
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const cb3 = vi.fn();

    act(() => {
      result.current(cb1, 1000);
      result.current(cb2, 2000);
      result.current(cb3, 3000);
    });

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(cb1).toHaveBeenCalledOnce();
    expect(cb2).not.toHaveBeenCalled();
    expect(cb3).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(cb2).toHaveBeenCalledOnce();
    expect(cb3).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(cb3).toHaveBeenCalledOnce();
  });

  it('cleans up only pending timeouts on unmount (already-fired ones are fine)', () => {
    const { result, unmount } = renderHook(() => useRetryTimeouts());
    const fired = vi.fn();
    const pending = vi.fn();

    act(() => {
      result.current(fired, 100);
      result.current(pending, 5000);
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(fired).toHaveBeenCalledOnce();

    unmount();

    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(pending).not.toHaveBeenCalled();
  });

  it('returns the timeout ID for external management', () => {
    const { result } = renderHook(() => useRetryTimeouts());

    let id: ReturnType<typeof setTimeout> | undefined;
    act(() => {
      id = result.current(() => {}, 1000);
    });

    expect(id).toBeDefined();
  });
});
