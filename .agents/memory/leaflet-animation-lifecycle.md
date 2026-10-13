---
name: Leaflet animation lifecycle
description: Preserve animations while making map teardown safe; review cleanup compatibility when upgrading Leaflet.
---

Map exit errors must be fixed through teardown cleanup, not by disabling animations or delaying navigation.

**Why:** Leaflet 1.9 leaves a zoom-completion timeout pending after map removal, and React Leaflet can remove panes before a child's passive-effect cleanup runs. Fast garage navigation exposed this timing issue even though ordinary transitions worked.

**How to apply:** Perform animation cleanup before the map panes disappear. When upgrading Leaflet or React Leaflet, review teardown compatibility and exercise an actual exit during an active animation; a check that waits until animation completion does not cover the failure.
