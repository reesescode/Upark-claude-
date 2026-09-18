---
name: Playwright on Replit Nix
description: Requirements for running repository Playwright tests from validation shell commands.
---

Repository Playwright tests require both the matching Chromium download and the browser's Nix shared-library runtime.

**Why:** Installing the Playwright package alone left no browser executable; after downloading Chromium, launch still failed on missing GLib and GBM libraries.

**How to apply:** When Playwright is upgraded or newly installed, download its Chromium runtime and keep the browser libraries declared in the Replit Nix package list so named validations can launch it.