---
name: Parking Logix HTTP client
description: Runtime-specific transport behavior for the FGCU Parking Logix availability feed.
---

Use Node's HTTPS client rather than the built-in `fetch` implementation when polling the FGCU Parking Logix widget endpoint.

**Why:** In the Replit API runtime, repeated `fetch` requests to this endpoint timed out after 8–20 seconds while `node:https` and curl returned the same JSON in under a second. This was transport-specific, not an upstream outage.

**How to apply:** Keep explicit request timeouts and response-size limits. If the feed host changes, test the deployed server transport before replacing the HTTPS adapter with `fetch`.