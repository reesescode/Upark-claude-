---
name: Leaflet DivIcon accessibility
description: How to keep custom Leaflet div markers named in the accessibility tree.
---

React Leaflet's `Marker` `alt` prop does not become an accessible name when the marker uses `L.divIcon`; Leaflet renders a focusable `div` rather than an image. Set an explicit `aria-label` on the marker element from its `add` event, after the DOM element exists.

**Why:** A title remained visible and the marker had `role="button"`, but role-based accessibility queries still found no named control. A ref callback also ran before `getElement()` was available.

**How to apply:** Whenever a map marker uses `L.divIcon`, assign its complete accessible name in the marker's `add` handler and verify it with a role-and-name assertion.