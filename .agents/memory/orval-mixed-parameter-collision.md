---
name: Orval mixed parameter collision
description: Generator naming conflict seen when an operation combines a path parameter with query parameters.
---

In this workspace's Orval setup, an operation with a path parameter and multiple query parameters can generate the same exported name for the Zod path schema and the TypeScript query type. Use a referenced, entity-shaped request body for complex inputs when the HTTP semantics allow it.

**Why:** The generated barrels re-export both symbols, causing a TypeScript duplicate-export failure even though Orval itself reports successful generation.

**How to apply:** If codegen fails with a duplicate `<Operation>Params` export on a mixed-parameter endpoint, move the non-path inputs into a referenced component body rather than editing generated files.