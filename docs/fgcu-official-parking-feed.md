# FGCU official parking availability source

UPARK treats the availability widget published on FGCU Parking Services' [Garage Availability page](https://www.fgcu.edu/parkingservices/garage-availability) as its trusted direct source. The FGCU page embeds a Parking Logix multi-location widget whose JSON endpoint is fixed in the server-side adapter.

## Trust boundary

- Only the API server fetches and writes this feed.
- There is no public route for posting trusted availability. Browser parking reports remain unverified and cannot set a garage's direct-update timestamp.
- The server accepts only the hardcoded HTTPS feed URL, maps only Parking Garages 1–4 to known UPARK records, validates counts, and rejects values without the widget's observation time.
- Parking Garage B is not currently represented in UPARK and is intentionally ignored.

## Freshness and failure behavior

The server polls once per minute. A successful observation updates `available_spots`, `total_spots`, and `availability_updated_at` only when it is at least as new as the saved observation. The widget's Eastern Time timestamp is converted to UTC before storage.

A timeout, non-JSON response, malformed value, unknown location, or upstream error does not change the saved value or timestamp. The public parking API therefore marks the last trusted value stale after 30 minutes. After two hours it stops treating that value as live and returns the location in the demo/verified-report fallback state. If every location is on demo data, the campus summary has no `lastUpdatedAt` value rather than displaying the current server time.

## Upstream response

The FGCU widget uses a `widgetData` array. Each accepted record must provide:

- `locationName`
- `freeSpaces`
- `totalSpaces`
- `dateTime`

This contract is covered by the server adapter tests. If FGCU changes the widget provider or response shape, update the adapter and this document together.