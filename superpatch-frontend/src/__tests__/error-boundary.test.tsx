/**
 * Tests for ErrorBoundary component (src/components/error-boundary.tsx)
 *
 * Verifies error catching, fallback UI, and reset behavior.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from '@/components/error-boundary';

// A component that throws on demand
function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error from child');
  }
  return <div data-testid="child">Child content</div>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // Suppress console.error from React's error boundary logging
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('renders fallback UI when a child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.queryByTestId('child')).not.toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('shows the error message in the fallback', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Test error from child')).toBeInTheDocument();
  });

  it('allows retry via the "Try Again" button', () => {
    // Start with a throw, then after reset we won't throw
    let shouldThrow = true;

    function DynamicChild() {
      if (shouldThrow) throw new Error('Temporary error');
      return <div data-testid="recovered">Recovered!</div>;
    }

    render(
      <ErrorBoundary>
        <DynamicChild />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // Fix the error and click retry
    shouldThrow = false;
    fireEvent.click(screen.getByText('Try Again'));

    expect(screen.getByTestId('recovered')).toBeInTheDocument();
    expect(screen.getByText('Recovered!')).toBeInTheDocument();
  });

  it('logs error to console via componentDidCatch', () => {
    const consoleSpy = vi.spyOn(console, 'error');

    render(
      <ErrorBoundary section="TestSection">
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    // componentDidCatch logs the error
    expect(consoleSpy).toHaveBeenCalled();
    const calls = consoleSpy.mock.calls;
    const errorCall = calls.find((call) =>
      typeof call[0] === 'string' && call[0].includes('[ErrorBoundary: TestSection]')
    );
    expect(errorCall).toBeDefined();
  });

  it('renders custom fallback when provided', () => {
    const customFallback = <div data-testid="custom-fallback">Custom error UI</div>;

    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
    expect(screen.getByText('Custom error UI')).toBeInTheDocument();
  });
});
