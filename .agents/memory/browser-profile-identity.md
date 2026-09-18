---
name: Browser profile identity
description: How legacy browser-stored UPARK identities relate to managed authentication.
---

Do not treat the old browser-stored student ID as account ownership or automatically attach its profile data to a managed-auth user.

**Why:** The previous UPARK “login” accepted any name and student ID from local storage, so it provides no proof that the current person owns an existing legacy profile.

**How to apply:** Preserve legacy database rows, but scope current profile access to the authenticated provider subject. Any future claim flow must require independent verification before linking or moving legacy records.