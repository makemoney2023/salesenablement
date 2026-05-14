/**
 * Tests pinning the HTTP-status contract on DELETE handlers.
 *
 * Previously /api/campaign/calls and /api/campaign/notes returned HTTP 200
 * with `{ status: "error" }` when the underlying delete failed. The client
 * inspects `response.ok` which is `true` for 200 — so a failed DELETE was
 * indistinguishable from a successful one and toast.success() fired anyway.
 *
 * These tests assert that:
 *   - successful delete returns 2xx
 *   - failed delete returns 5xx
 *
 * They run the handler with a mocked auth + DB layer.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth', () => ({
  requireApiAuth: vi.fn(async () => ({ authorized: true, response: null })),
}));

const deleteCallRecordMock = vi.fn();
const clearAllRecordsMock = vi.fn();
const deleteNoteMock = vi.fn();

vi.mock('@/lib/db/call-records', () => ({
  getAllCallRecords: vi.fn(),
  getCallRecord: vi.fn(),
  getCallRecordByCallId: vi.fn(),
  upsertCallRecord: vi.fn(),
  updateCallRecord: vi.fn(),
  deleteCallRecord: (...args: unknown[]) => deleteCallRecordMock(...args),
  clearAllRecords: (...args: unknown[]) => clearAllRecordsMock(...args),
  getRecordsByStatus: vi.fn(),
  getCampaignStats: vi.fn(),
}));

vi.mock('@/lib/db/call-notes', () => ({
  getNotesForCall: vi.fn(),
  addNote: vi.fn(),
  updateNote: vi.fn(),
  deleteNote: (...args: unknown[]) => deleteNoteMock(...args),
  getRecentNotes: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DELETE /api/campaign/calls', () => {
  it('returns 200 when delete succeeds', async () => {
    deleteCallRecordMock.mockResolvedValueOnce(true);
    const { DELETE } = await import('@/app/api/campaign/calls/route');
    const req = new NextRequest(
      'http://localhost/api/campaign/calls?practitioner_id=abc',
      { method: 'DELETE' }
    );
    const res = await DELETE(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('success');
  });

  it('returns 500 when delete fails (not 200 with status: error)', async () => {
    deleteCallRecordMock.mockResolvedValueOnce(false);
    const { DELETE } = await import('@/app/api/campaign/calls/route');
    const req = new NextRequest(
      'http://localhost/api/campaign/calls?practitioner_id=abc',
      { method: 'DELETE' }
    );
    const res = await DELETE(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.status).toBe('error');
  });

  it('clearAll succeeds returns 200', async () => {
    clearAllRecordsMock.mockResolvedValueOnce(undefined);
    const { DELETE } = await import('@/app/api/campaign/calls/route');
    const req = new NextRequest('http://localhost/api/campaign/calls', {
      method: 'DELETE',
    });
    const res = await DELETE(req);
    expect(res.status).toBe(200);
  });
});

describe('DELETE /api/campaign/notes', () => {
  it('returns 200 when delete succeeds', async () => {
    deleteNoteMock.mockResolvedValueOnce(true);
    const { DELETE } = await import('@/app/api/campaign/notes/route');
    const req = new NextRequest(
      'http://localhost/api/campaign/notes?id=note-1',
      { method: 'DELETE' }
    );
    const res = await DELETE(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('success');
  });

  it('returns 500 when delete fails (not 200 with status: error)', async () => {
    deleteNoteMock.mockResolvedValueOnce(false);
    const { DELETE } = await import('@/app/api/campaign/notes/route');
    const req = new NextRequest(
      'http://localhost/api/campaign/notes?id=note-1',
      { method: 'DELETE' }
    );
    const res = await DELETE(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.status).toBe('error');
  });

  it('returns 400 when id query param is missing', async () => {
    const { DELETE } = await import('@/app/api/campaign/notes/route');
    const req = new NextRequest('http://localhost/api/campaign/notes', {
      method: 'DELETE',
    });
    const res = await DELETE(req);
    expect(res.status).toBe(400);
  });
});
