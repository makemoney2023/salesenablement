/**
 * Maximum number of sample-request rows returned by the CSV export
 * branch of GET /api/samples. The CSV branch reads with no `.range()`
 * limit, so for a growing dataset Supabase will happily return every
 * row — turning into an OOM on the Vercel function (and a multi-minute
 * download for the client).
 *
 * 10,000 is enough to cover the foreseeable working dataset; if the
 * cap is hit, the request should be paginated through the JSON API
 * instead.
 */
export const SAMPLES_CSV_MAX_ROWS = 10_000;
