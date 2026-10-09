---
name: Parking availability trust
description: Trust boundary for deciding which parking reports may affect student-facing live estimates.
---

Only explicitly verified reports may affect live parking availability. A student identifier supplied by the client is not proof of identity, so unverified submissions can remain visible as reports but must not replace demo fallback counts.

**Why:** Calling locally supplied identifiers “verified” would create false confidence and could let anyone manipulate the campus-wide estimate.

**How to apply:** Any new authentication or reporting flow must set verification from server-owned identity evidence. Keep unverified records excluded from availability aggregation until that evidence exists.

Do not award rewards retroactively for legacy reports: their proximity was never verified. Clearing visible parking history must not reset reward totals, daily limits, or duplicate protection; account deletion still removes that user's rewards.

**Why:** Retroactive credit would treat missing verification as proof, and resetting reward eligibility when history is cleared would let users bypass the daily limit.

**How to apply:** Keep eligibility evidence separate from optional visible history. Device GPS is useful proximity evidence but is not spoof-proof; never describe browser location validation as guaranteed physical presence.