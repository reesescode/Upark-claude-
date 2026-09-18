---
name: Production profile ID rollout
description: Safe staged rollout for adding profile IDs without truncating existing production users.
---

Keep the new sequence-backed profile ID nullable for its first production publish. After production has assigned IDs to every existing row, confirm there are no nulls before restoring the not-null schema constraint.

**Why:** Adding the serial ID as not-null while production already contained profiles caused Publish to generate `TRUNCATE user_profiles CASCADE`, which would delete linked user data and made the build fail.

**How to apply:** Before tightening the constraint, query production for null IDs. Make the not-null source-schema change only after the first safe publish has completed and all existing rows are populated.