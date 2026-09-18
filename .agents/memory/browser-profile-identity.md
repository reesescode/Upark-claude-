---
name: Browser profile identity
description: Product decision for how UPARK identifies users before real authentication is introduced.
---

Use the current browser-stored student profile and treat its student ID as the database user ID for profile settings, favorites, support requests, and history.

**Why:** The user explicitly chose to keep the existing browser-based profile rather than add real authentication during the Profile functionality work. This identifier is convenient persistence scope, not verified identity.

**How to apply:** Keep profile-owned data isolated by student ID and clear active-user browser state on sign-out or account deletion. Do not describe this model as authentication or use it to verify parking reports.