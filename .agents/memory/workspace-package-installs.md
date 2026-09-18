---
name: Workspace package installs
description: How to add dependencies to one package when the package helper only targets the workspace root
---

The language-package helper runs `pnpm add` at the workspace root and rejects `--filter` as a package token, so it cannot target an individual package in this monorepo.

**Why:** Root installation fails pnpm’s workspace-root guard, while passing filter flags to the helper fails its package-token validation.

**How to apply:** Add the dependency declarations to the intended package manifest, then run one workspace `pnpm install` to synchronize the lockfile and links. Do not add the packages to the root merely to bypass the guard.