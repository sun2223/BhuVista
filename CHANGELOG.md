# BhuVista — change log

This change log describes real feature milestones. GitHub shows the actual author and commit dates; no dates are artificially backfilled.

## v3 — Interactive map tools (2026-10-20)

- Measure approximate route distance on satellite maps.
- Draw a rough area and see its estimated area and perimeter.
- Undo and clear measurement points, with support for both Leaflet and Google Maps renderers.
- Copy a shareable map-view URL with camera, basemap and public village selection codes.
- Reopen the last successfully loaded official village selection on the same browser.
- Add geometry, link-validation and route tests. Total: 18 automated tests.

## v2 — Official khesra preview (earlier iteration)

- Attempt a plot-image preview for a known khesra using NIC's documented service.
- Improve optional WMS GetFeatureInfo response handling.
- Display clear error messages when government plot lookup is unavailable.

## v1 — Initial land explorer (earlier iteration)

- Satellite/roadmap basemap and opacity controls.
- Demo GeoJSON polygons, plot search and neighboring parcel highlighting.
- Import locally supplied GeoJSON parcel polygons.
- Load government cadastral image overlays based on Bihar's location selection fields.

## Planned (not yet implemented)

- Reliable real plot-ID lookup from a verified sanctioned vector/API source.
- Rigorous georeferencing and surveyed overlay validation.
- Correct accessibility and map UI review on mobile.
- Public production deployment and usage/rate limiting.
