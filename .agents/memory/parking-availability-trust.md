---
name: Parking availability trust
description: Trust boundary for deciding which parking reports may affect student-facing live estimates.
---

Only explicitly verified reports may affect live parking availability. A student identifier supplied by the client is not proof of identity, so unverified submissions can remain visible as reports but must not replace demo fallback counts.

**Why:** Calling locally supplied identifiers “verified” would create false confidence and could let anyone manipulate the campus-wide estimate.

**How to apply:** Any new authentication or reporting flow must set verification from server-owned identity evidence. Keep unverified records excluded from availability aggregation until that evidence exists.