---
name: Google Maps navigation policy
description: Why navigation is external and legacy travel-time database values must be preserved.
---

Garage and lot navigation belongs in Google Maps, using the parking location's stored coordinates. Do not restore internal route drawing or walking/driving estimates without an explicit new request.

**Why:** The user wants Google Maps to handle directions and expressly removed U Park's internal routes and travel-time displays.

**How to apply:** Keep navigation links in the existing UI. Pass a known origin when available; otherwise let Google Maps resolve the current location. Preserve existing database data, including legacy travel-time columns, rather than dropping them solely because the API and UI no longer use them.
