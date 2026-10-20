# BhuVista v3 — Google Maps × Bihar BhuNaksha prototype

A real full-stack JavaScript demo for exploring land parcels with satellite imagery. **It does not claim to be the official site or determine ownership.** The official cadastral image overlay requires the Bihar government service to be online, available to your network, and suitably georeferenced.

## Quick start (Node.js 20+)

```bash
cd bhunaksha-google-explorer
node --version
npm test
npm start
```

Open **http://localhost:3000**. On **Windows PowerShell**, if you see `npm.ps1 cannot be loaded because running scripts is disabled`, run `npm.cmd test` and `npm.cmd start` instead of `npm`. No Windows execution-policy change is required. The demonstration works without a Google API key using an alternate satellite basemap (Esri World Imagery) or street map (OpenStreetMap). Internet access is required to load map tiles and the Leaflet library.

### Enable actual Google Maps

Get a Maps JavaScript API key in Google Cloud Console, enable **Maps JavaScript API**, set up billing if requested, and restrict the key to your authorized browser origin such as `http://localhost:3000/*`. From your terminal:

**PowerShell:**

```powershell
$env:GOOGLE_MAPS_API_KEY="YOUR_GOOGLE_MAPS_API_KEY"
npm start
```

**macOS/Linux:**

```bash
GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY npm start
```

Now Google Maps powers the basemap (Satellite, Map, Hybrid). Client-side API keys are visible to browsers, so **HTTP referrer restrictions and quota controls are essential**; do not use a server-secret unrestricted credential as the Maps key.

## New in v3: practical map tools

- **Measure distance and area**: click **Measure distance / area** in the top-right map controls; select Distance or Area and click the satellite map to add measurement points. Use Undo, Clear, or Done. When measuring an area, the app also shows approximate perimeter. Measurements are rough geodesic/small-area estimates, **not survey-grade land records**; they never claim official plot area.
- **Copy map view link**: click **Copy link to this map view**. The URL remembers the basemap, center, zoom, and (if loaded) the seven official BhuNaksha village/sheet codes. Opening the link attempts to reload the official map and restore the camera. This requires the Bihar map service to work at the destination.
- **Reopen last viewed village**: after loading a village, return to it using the official panel shortcut. The selected location *codes only* are saved in this browser's local storage; no ownership records or imported files are stored.
- **Sharing limitations**: links to `localhost:3000` work only on the computer running the app. To share them publicly, deploy the app and then copy the link from its deployed domain. Imported GeoJSON cannot be included in a shareable link, so the app blocks sharing those views.

### GitHub workflow: two real, incremental updates

Starting with the **v2** repository, apply `BhuVista-01-measure.patch`, test, and commit the distance/area feature. Then apply `BhuVista-02-share.patch`, test, and commit the map-view sharing feature. Do not backdate commits; the actual timeline and separate feature commits are more useful than fabricated history.

In PowerShell, from the repository root:

```powershell
git status --short
git apply --check .\BhuVista-01-measure.patch
git apply .\BhuVista-01-measure.patch
npm.cmd test
git add public/app.js public/index.html public/styles.css public/measure.js tests/measure.test.js server.js
git commit -m "feat: add map distance and area measuring"

git apply --check .\BhuVista-02-share.patch
git apply .\BhuVista-02-share.patch
npm.cmd test
git add .gitignore README.md CHANGELOG.md package.json public/app.js public/index.html public/styles.css public/map-link.js server.js tests/map-link.test.js tests/server.test.js
git commit -m "feat: share and restore map views"

git push origin main
```

**Note:** Place both `.patch` files at your repository root before running these commands. If you edited v2 since uploading it, the patch may not apply cleanly. In that case review the differences, or use the complete v3 ZIP to compare changed files rather than overriding your own edits. Avoid staging the `.patch` files unless you want to keep them in the repo.

## What works today

- Satellite/roadmap/hybrid basemap and opacity slider.
- **Clickable sample parcels 1201–1230** and plot search.
- Neighbor plots highlighted by common polygon edge.
- Approximate plot area (computed from synthetic or imported GeoJSON; not official area).
- Local GeoJSON import with WGS84 lon/lat, plot number property detection. Files remain in the browser session, not uploaded to the server.
- Backend Bihar district → subdivision → circle → mauza → survey → instance → sheet selectors using the government's public `rest/Levels/ListsAfterLevel` endpoint.
- Backend government cadastral image layer request via `rest/MapInfo/getVVVVExtentGeoref` + transparent `WMS` `GetMap`, projected EPSG:32645 and approximate placement over Google imagery.
- Map click **attempts** government WMS `GetFeatureInfo` in JSON and plain-text formats to identify a **candidate** plot number. It may not be supported by the portal. The application **never invents** a plot number, identity, or ownership.
- NEW: In **Official Bihar layer**, once a village sheet is loaded, use **Look up a khesra map** to enter e.g. `1206`. This requests the `rest/PlotImage` image endpoint documented by NIC. If Bihar enables the service and it returns a recognized image, the app displays an **unaligned plot-map preview**. It does **not** highlight the plot on the satellite map or confirm ownership. Failure shows an explicit error. Bihar support has **not been verified** by an independent live request. This experimental image lookup is distinct from a click-to-coordinate plot ID.
- Official portal button for checking maps and owner/land records at the source.

### Your screenshot's village

Under **Official Bihar layer**, select `07 ARARIA → 01 Araria subdivision → 01 Araria circle → 0058 Azamnagar → SS Special Survey → 00 First Map → 00 Sheet 00` *if the currently published dropdowns match*. The screenshot's plot number **1206** is not enough on its own to identify coordinates or ownership. The sample demo also has a **fictional** plot 1206 that is NOT your real plot 1206.

### GeoJSON data example

```json
{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"plotNo":"1206","village":"Azamnagar"},"geometry":{"type":"Polygon","coordinates":[[[85.1,25.5],[85.101,25.5],[85.101,25.501],[85.1,25.501],[85.1,25.5]]]}}]}
```

The numbers above are **illustrative only** and are not surveyed Azamnagar coordinates. To use real boundaries, get a **licensed/authorized cadastral vector dataset** (GeoJSON or a shapefile converted to GeoJSON, WGS84 EPSG:4326) from the responsible mapping or land records authority. Example conversion with GDAL:

```bash
ogr2ogr -f GeoJSON -t_srs EPSG:4326 plots.geojson official_plots.shp
```

The import currently accepts **GeoJSON** directly, not `.shp` or zipped shapefiles. Plot field aliases supported: `plotNo`, `plot_no`, `KHESRA`, `khesra`, `khasra`, `PLOT_NO`.

## Key architecture

```
Browser (Google Maps JS or alternate basemap)
  ├── sample/imported polygon GeoJSON → click, identify and highlight neighbors
  └── public map controls → Node server
        ├── /api/levels → official BhuNaksha location lists
        ├── /api/sheet  → official BhuNaksha georeferenced map extent
        ├── /api/wms    → official WMS cadastral PNG (transparent)
        ├── /api/identify → optional WMS GetFeatureInfo, if supported
        └── /api/plot-image → experimental NIC PlotImage request by khesra number
```

### Accuracy and permission limitations

1. **A raster image is not a vector parcel index.** WMS `GetFeatureInfo` might not be queryable by the public service. The newly integrated **PlotImage** endpoint is documented in NIC's BhuNaksha 3.0 user guide but has not been proven available on Bihar's active server; it accepts a **known plot number** to request a preview, not a clicked coordinate. Without actual polygon geometry or an authorized parcel-query API, a map click cannot reliably produce the correct khesra, neighbors, or owner.
2. **Georeferencing matters.** The code assumes the official WMS sheet extent is EPSG:32645 (UTM zone 45N) for Bihar and transforms its bounding box to WGS84. It uses a `GroundOverlay`/`ImageOverlay` bounding rectangle, a visual approximation rather than rigorously warping every pixel. Georeferencing errors or un-georeferenced old maps can cause substantial offsets. Verify against surveyed reference points; do not use for disputes or legal boundaries.
3. **Ownership must be verified via official revenue records.** It is intentionally not scraped, cached, or guessed. The app links to the Bihar BhuNaksha portal rather than fabricating a supported deep link.
4. **Permissions and rates:** The public WMS mechanism is described by independent code; the government has not granted this prototype permission to redistribute cadastral imagery. For public/commercial deployments obtain necessary permissions, confirm endpoint contracts, and use reasonable caching/rate limits. Never bypass login, CAPTCHA, or access controls.
5. **Remote dependency:** Government APIs can change, block cross-origin proxies or rate-limit requests. This code does not include an official test fixture of the response formats. The live government integration is an **unverified adapter** that must be tested against the active portal; the local demo and automated geometry tests can run offline.
6. **No live verification here:** The developer's build environment did not have direct access to the official Bihar API. Automated tests use mocked official responses; **11 passing tests do not establish live government compatibility**. After downloading, try one legitimate known plot in your chosen mauza. If an error appears, capture the official portal's Network request name/URL and redacted response, avoiding cookies/tokens.
7. **Additional engineering before production:** authentication for administrative uploads, audit logs, licensing verification, per-user rate limiting, resilient caches, proper cartographic reprojection, geometry validity checks, per-sheet projection metadata, accessible mobile UI, and a sanctioned plot/ownership query service.

## Tests

```bash
npm test
curl http://localhost:3000/api/health
curl 'http://localhost:3000/api/config'
# Live government connectivity, when allowed and online:
curl 'http://localhost:3000/api/levels?level=0'
```

## Sources

- Bihar official viewer: https://bhunaksha.bihar.gov.in/10/indexmain.jsp
- NIC project details: https://www.nic.gov.in/project/bhunaksha/
- NIC BhuNaksha 3.0 user guide, section 29.1.1 PlotImage Service: https://www.bhunaksha.nic.in/bhunaksha/Bhunaksha3.0UserGuide/Bhunaksha3.0UserGuide.pdf
- Independent investigation of public BhuNaksha WMS interface (not an official API contract): https://github.com/Not-Dhanraj/bhunaksha-naksha
