# System Integration Review Findings

**Original date**: January 15, 2026  
**Last updated**: 2026-05-12 (production-fix plan landed — see `docs/superpowers/plans/2026-04-21-ai-call-center-production-fixes.md`)  
**Scope**: Bland.ai + UI + Supabase Integration

## Summary

The integration between Bland.ai, the Next.js UI, and Supabase is **well-connected and functional**. All pathway IDs, webhook URLs, and configuration values are consistent across the codebase.

> **2026-05-12 update — all 25 bugs found in the end-to-end review are resolved on branch `fix/ai-call-center-production-2026-04`.** Phase-by-phase entries with file/commit citations live in `superpatch-frontend/docs/CHANGELOG.md` (2026-05-11 and 2026-05-12). Key structural changes since this document was first written:
> - `/api/webhooks/bland` retired (now HTTP 410). Canonical webhook is the Edge Function `webhook-processor`.
> - `book-appointment` and `sync-cal-bookings` migrated to Cal.com v2 via the shared `_shared/cal.ts` client.
> - `practitioners.enrichment_status` normalized to `'enriched'` with a CHECK constraint.
> - Four pg_cron HTTP jobs repointed and their Bearer tokens sourced from `vault.decrypted_secrets`.
> - Sample-request notification trigger repaired (was referencing non-existent columns).
> - Bland.ai webhook variable coercion, practitioner-type canonicalization, and PostgREST `.or()` sanitization centralized.

---

## Architecture Verification

### Data Flow: Call Initiation → Webhook → Database → UI

```
[UI: Campaign Page]
     │
     ▼ (POST /api/bland/calls)
[API Route: bland/calls]
     │
     ▼ (Bland.ai API)
[Bland.ai]
     │
     ▼ (webhook callback)
[Edge Function: /functions/v1/webhook-processor]
     │  (legacy /api/webhooks/bland retired 2026-05-12 → HTTP 410)
     │
     ├──▶ [call_records table] ──▶ [Real-time subscription] ──▶ [UI Update]
     ├──▶ [practitioners table] (qualification data)
     └──▶ [sample_requests table] (if wants_sample=true)
```

### All Integration Points Verified:

| Component | Status | Notes |
|-----------|--------|-------|
| Pathway IDs | ✓ Consistent | All 6 match deployed_pathway_ids.json |
| Webhook URL | ✓ Consistent | All default to production URL |
| KB_ID | ✓ Consistent | b671527d-0c2d-4a21-9586-033dad3b0255 |
| Voice ID | ✓ Consistent | 78c8543e-e5fe-448e-8292-20a7b8c45247 |
| Real-time subscriptions | ✓ Working | Fallback polling at 10s intervals |
| Database upsert logic | ✓ Working | Handles both call_id and practitioner_id |
| Email fallback chain | ✓ NEW | call vars → metadata → stored → enrichment |
| Retry queue context | ✓ NEW | Full practitioner data + memory_id |
| Sample requests real-time | ✓ NEW | useRealtimeSampleRequests hook |
| Enrichment real-time | ✓ NEW | useRealtimePractitioners hook |
| Retry queue real-time | ✓ NEW | useRealtimeRetryQueue hook |
| Enrichment stale cleanup | ✓ NEW | 5-minute timeout reset |
| Enrichment duplicate prevention | ✓ NEW | Status check before starting |

---

## Findings

### No Critical Issues Found

The system is well-integrated with proper error handling and fallback mechanisms.

### Improvements Applied (January 2026)

The following issues were identified and resolved:

| Issue | Resolution |
|-------|------------|
| Email not using stored practitioner data | Added `getPractitionerEmail()` helper with fallback chain |
| Cal.com booking missing email/address | Now uses resolved values from stored data |
| Sample requests missing practitioner email | Uses `resolvedEmail` from fallback chain |
| Retry queue missing full context | Added address, rating, review_count, website to payload |
| Retry queue missing memory_id | Added `BLAND_MEMORY_ID` env var support |
| Inconsistent products_interested fallback | Standardized across all webhook usages |
| No real-time for sample requests | Added `useRealtimeSampleRequests` hook |
| No real-time for enrichment status | Added `useRealtimePractitioners` hook |
| No visibility into retry queue | Added `useRealtimeRetryQueue` hook + Retries tab |
| Enrichment stuck in "in_progress" | Added 5-minute stale status cleanup |
| No retry for failed enrichments | Added `includeRetries` flag to edge function |
| Duplicate enrichment calls | Added status check before starting + `force` flag |

### Minor Observations (Not Blocking)

1. **Pathway IDs duplicated in 3 places**
   - `batch-caller.ts` (line 18-32)
   - `campaign/page.tsx` (line 997-1004)
   - `campaign/page.tsx` (line 1102-1109)
   - *Recommendation*: Consider centralizing in a shared config file

2. **Phone lookup limit of 100** (webhook line 77)
   - Could miss practitioners if database has >100 records without exact phone match
   - *Impact*: Low - exact match works first

3. **KB_ID and Voice_ID hardcoded**
   - Could be environment variables for easier configuration
   - *Impact*: None - values are stable

4. **Type assertions in webhook** (`as any`)
   - Used for tables not in generated Supabase types
   - *Impact*: None - working correctly

---

## Configuration Checklist

### Required Environment Variables

```env
# Bland.ai
BLAND_API_KEY=sk_...                    # Server-side only
NEXT_PUBLIC_BLAND_MEMORY_ID=mem_...     # Cross-call memory
NEXT_PUBLIC_BLAND_WEBHOOK_URL=...       # Webhook URL (optional, has default)

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...        # Server-side only

# Cal.com (optional)
CAL_API_KEY=...
CAL_EVENT_TYPE_ID=...
```

---

## Manual Test Checklist

### Test 1: Quick Call Flow (Known Practitioner)
- [ ] Navigate to Campaign page
- [ ] Enter a practitioner's phone number in Quick Call
- [ ] Click Search - verify practitioner found
- [ ] Click Call - verify call initiates
- [ ] Check pipeline - call should appear immediately as "in_progress"
- [ ] After call completes, verify webhook updates record with:
  - [ ] Status (completed/booked/voicemail/failed)
  - [ ] Transcript
  - [ ] Lead score
  - [ ] Extracted variables

### Test 2: Quick Call Flow (Unknown Number)
- [ ] Enter a phone number NOT in practitioner database
- [ ] Fill in practice name and contact details
- [ ] Click Call with Pathway
- [ ] Verify call record created with practitioner_id = NULL
- [ ] Check that record appears in pipeline as "Unknown Caller"

### Test 3: Sample Request Flow
- [ ] Make a call where AI extracts wants_sample=true
- [ ] Verify sample request appears in Samples tab
- [ ] Check fields: name, address, products_interested
- [ ] Test status update (mark as shipped, add tracking)
- [ ] Test CSV export

### Test 4: Real-time Updates
- [ ] Open pipeline in Browser A
- [ ] Initiate call from Browser B (or API)
- [ ] Verify call appears in Browser A without refresh
- [ ] Verify status updates in real-time when call completes

### Test 5: Webhook Endpoint Health
- [ ] `curl -X POST $SUPABASE_URL/functions/v1/webhook-processor` (with valid Bearer + sample payload) returns 200 and writes a `call_records` row.
- [ ] `curl -X POST $PROD/api/webhooks/bland` returns HTTP 410 with `{"deprecated": true}` (retired path — must not be live).

### Test 6: Lead Scoring
- [ ] Complete a call with positive sentiment
- [ ] Verify lead_score increases appropriately
- [ ] Check that qualification data (interest_level, decision_maker) affects score

### Test 7: DNC Detection
- [ ] If transcript contains "don't call me again"
- [ ] Verify practitioner is marked do_not_call=true
- [ ] Verify dnc_reason contains the detected phrase

### Test 8: Retry Scheduling
- [ ] Trigger a voicemail outcome
- [ ] Verify retry_count increments
- [ ] Verify next_retry_at is set within business hours

### Test 9: Retry Queue Tab
- [ ] Navigate to Retries tab
- [ ] Verify "Due Now", "Next Hour", "Next 24 Hours" stats display
- [ ] Check live connection badge shows "Live"
- [ ] Trigger a retry scheduling and verify it appears without refresh
- [ ] Verify retry queue items show practitioner details

### Test 10: Email Fallback Chain
- [ ] Make a call where email is NOT captured in conversation
- [ ] Verify Cal.com booking uses stored practitioner email
- [ ] Verify sample request uses stored practitioner email
- [ ] Test with enriched practitioner (should use enrichment.data.emails)

### Test 11: Real-Time Sample Requests
- [ ] Open Samples tab
- [ ] Verify "Live" badge appears when connected
- [ ] Trigger a sample request from a call
- [ ] Verify it appears in Samples tab without refresh
- [ ] Update sample status and verify change appears in other browser

### Test 12: Enrichment Improvements
- [ ] Trigger enrichment for a practitioner
- [ ] Verify status changes to "in_progress"
- [ ] If scraping takes >5 minutes, verify status resets to "pending"
- [ ] Try enriching an already-enriched practitioner (should skip)
- [ ] Try with force=true (should re-enrich)

---

## Files Reviewed

| File | Lines | Purpose |
|------|-------|---------|
| `/api/webhooks/bland/route.ts` | ~20 | Retired stub — returns HTTP 410. Canonical handler is `/supabase/functions/webhook-processor`. |
| `/supabase/functions/webhook-processor/index.ts` | ~1300 | Canonical Bland.ai webhook handler (Edge Function). |
| `/lib/batch-caller.ts` | 528 | Batch call queue management |
| `/lib/db/call-records.ts` | 500 | Database operations |
| `/lib/db/types.ts` | 363 | TypeScript types |
| `/hooks/useSupabaseCallRecords.ts` | 341 | Real-time call records hook |
| `/hooks/useRealtimeSampleRequests.ts` | ~200 | Real-time sample requests hook (NEW) |
| `/hooks/useRealtimePractitioners.ts` | ~250 | Real-time enrichment status hook (NEW) |
| `/hooks/useRealtimeRetryQueue.ts` | ~250 | Real-time retry queue hook (NEW) |
| `/api/campaign/calls/route.ts` | 213 | Campaign API |
| `/api/bland/calls/route.ts` | 48 | Bland.ai proxy |
| `/api/search/enrich/route.ts` | ~370 | Enrichment API (updated) |
| `/api/search/import/route.ts` | ~300 | Import API (updated) |
| `/app/campaign/page.tsx` | ~3100 | Campaign UI (updated) |
| `/supabase/functions/process-retry-queue` | ~400 | Retry queue edge function (updated) |
| `/supabase/functions/enrich-practitioners` | ~450 | Enrichment edge function (updated) |

---

## Conclusion

**The system is production-ready and has been improved.** All integrations are properly connected with consistent configuration. The January 2026 improvements addressed:

- **Data consistency**: Email and address resolution now uses stored practitioner data as fallback
- **Retry reliability**: Full practitioner context sent to Bland.ai for retry calls
- **Real-time visibility**: Three new hooks provide live updates for samples, enrichment, and retries
- **Enrichment robustness**: Stale status cleanup, retry mechanism, and duplicate prevention

The minor observations noted are code organization suggestions, not functional issues.
