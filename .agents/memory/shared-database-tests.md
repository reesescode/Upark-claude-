---
name: Shared database tests
description: Avoid cross-suite races when asserting campus-wide parking aggregates.
---

Run database-backed parking suites without file parallelism when tests assert campus-wide totals.

**Why:** Vitest isolates JavaScript modules, not the shared development PostgreSQL database. Another suite's temporary garage inserts or cleanup can change totals between a list request and a summary request, causing a false failure.

**How to apply:** Use `--no-file-parallelism` for combined database-backed verification, or restrict aggregate assertions to isolated fixtures. Always clean up only records created by the test.
