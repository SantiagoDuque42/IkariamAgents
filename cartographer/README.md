# Cartographer

Map extracts for an area and a filter. Output: `cartographer.map.v1`.

## Source 1: the game (bookmarklet, v0.1)

1. Reads the world-map data for a bounding box in one request: `action=WorldMap&function=getJSONArea&x_min…`.
2. Opens up to N islands, nearest first, 1.8–3.2 s apart, with `view=island&backgroundView=island`. From each it reads:
   - island good
   - sawmill and mine levels
   - wonder
   - free spots
   - towns, with player, alliance, level and state
3. Applies the good filter, which needs the island view.

**Unverified until the first real run:**
- the world-map response shape (each row is kept as `areaRaw` so its fields can be mapped)
- the island-view shape (`parseIsland` in `shared/ikariam.js`)

Anything unrecognised is written to `diag` as structure only.

## Source 2: ikadatos.com (planned)

- Server: `atlas` (map page `mapa.php?servidor=atlas`). It gives players, alliances and rankings over time.
- The site refuses automated fetches from Claude's tools (client error on 24 Nov 2026).
- Planned adapter: a second bookmarklet run on the ikadatos page itself. It reads the page's own data in your browser, the same pattern as the game tools, and writes `cartographer.map.v1` with `scope.source = "ikadatos"`.
- Merge rule: game data wins for island facts; ikadatos wins for rankings and history. Each record keeps `source` and `asOf`.
