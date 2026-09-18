---
name: Clerk signup profile fields
description: Provider-specific constraint for separating Clerk account creation from UPARK profile provisioning.
---

Send only email address and password to this app's Replit-managed Clerk signup request. Keep first name, last name, and university in application state and persist them to the linked UPARK profile after Clerk verification.

**Why:** The Clerk SDK typings can expose name fields, but this managed tenant rejects them at runtime with `first_name is not a valid parameter for this request`.

**How to apply:** When editing signup, password reset, or account provisioning, keep provider authentication fields separate from application profile fields and preserve retryable profile provisioning after session activation.