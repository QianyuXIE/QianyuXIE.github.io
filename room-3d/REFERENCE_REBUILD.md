# Video-led room reconstruction

Reference: user-supplied ScreenRecording_09-03-2026 14-41-27_1.mp4 (512 × 1108, 30 fps).
The embedded website occupies approximately 484 × 400 pixels. Identity, photographs and CV remain Qianyu's.

## Observed states and acceptance criteria

| Time | Observed design | Implementation target |
| --- | --- | --- |
| 6s | White studio, strong diagonal shadows, desk on timber U frames | Left-front camera, compact desktop objects, no baseboard |
| 6–12s | White roller sheet, books on oak shelf, dark poster frame, three wall records | Thin edges, layered books, visible wall offsets and shadows |
| 16–21s | Black whiteboard window, five color dots, portrait white canvas | Draw, erase, clear; apply drawing back onto the 3D sheet |
| 28–33s | Black/gold film window, album tabs, horizontal filmstrip | Working filters, scrolling and frame selection, image loading states |
| 38s | Paper opens an external destination | Paper links to CV; keep laptop separate as terminal |
| 43s | Terminal fills laptop view, input and help commands | Real help/about/projects/education/socials/echo/history/clear commands |
| 48–53s | Record library; selected record updates the turntable and mini player | Working selection, label update, mechanical rotation; no invented audio |
| 58–68s | Return to overview, lamp/day-night switches | Restorable camera, operable switches, persistent selected record |

## Model inventory — all geometry rebuilt

Desk with U legs and end grain; silver 13-inch MacBook Air-inspired laptop with keyboard/trackpad/MagSafe/USB-C/audio ports and camera notch; camera with knurled lens and controls; film canister; portrait paper and pen; articulated desk lamp; open shade floor lamp; electric guitar with pickups/strings/tuners/stand; thin curved chair shell and wheeled base; turntable with grooves/tonearm/counterweight/hinged cover; padded headphones; roller sheet with curled corner; floating shelf/books; Chungking Express poster frame; three records; wall switch.

## Interaction discipline (2026-09-09)

`interaction-targets.json` is shared by Blender and the runtime. Exactly seven primary
surfaces are clickable: screen → terminal, sheet → whiteboard, camera body → photos,
turntable body → vinyl, desktop paper → CV, poster image → cinema, wall rocker → lights.
Parts are not independently inferred as links. Keys, touchpad, headphone band, record
grooves, wall records, book spines, chair and guitar are decorative. Keyboard and HTML
shortcuts remain available for accessibility. This intentionally differs from interactions
not clearly evidenced in the recording, per the request to reduce duplicated entry points.

The official Janus Films poster is preserved uncropped at 810 × 1200; see
`assets/room3d/ATTRIBUTION.md`. It is copyrighted artwork, not an open-source asset.
Fixed metallic albedo baking: diffuse-only bakes had attenuated metal colours, so
metalness is now temporarily zero while baking colour and restored for export.
Non-terminal panels now retain the focused room behind a translucent dark surface.

### Proposed extensions — not implemented

1. Cinema: a deliberate "night screening" preset that sets warm lights without auto-playing sound.
2. Camera: export a snapshot of the current room as a dated postcard, triggered only by the visitor.
3. Whiteboard: one small interactive multimodal-research demo, with an accessible text explanation.

Prioritize matching the supplied video before adding any new props. Exact source meshes,
original textures and unseen interactions remain unavailable; full 1:1 equivalence is not verified.

## Limits

The video does not expose original source geometry, UV maps, exact typefaces, every album image, chair/guitar interactions, or complete playback behavior. Those details are reconstructed estimates. Music requires user-owned or licensed audio before playback can be implemented; selection and turntable mechanics work without audio. Do not claim pixel-perfect equivalence or successful browser testing based on builds alone.

## Validation

2026-09-10: removed desktop headphones from the active Blender builder and inspected
the regenerated preview. Shelf now has one `books` hotspot (eight actions total).
Ten individually selectable Sodagreen songs supplement the existing Aimer/Wu Qingfeng
artist entries. Selecting changes the title, artist, external YouTube search destination
and mini-record title; no audio is downloaded, embedded or automatically played.
Playlist and six provisional literature recommendations live in `room.html` front matter.
Reading cards are explicitly labeled recommendations, not the owner's completed reading.
Vite, runtime controls tests and all-song/reading-card Liquid DOM tests pass; actual
browser layout and frame rate remain unverified.

Playlist discovery sources:
- https://music.apple.com/us/artist/sodagreen/345954909
- https://music.apple.com/tw/playlist/蘇打綠-非主打好歌/pl.e1eb657145134c5abc5213fc65e62324
- https://music.apple.com/tw/playlist/蘇打綠-情歌精選/pl.12e428a42b5447bf934a9db6e7aeac40

Reading reference examples:
- https://book.douban.com/subject/3270617/ (Shi Tiesheng)
- https://www.penguinrandomhouse.com/books/193881/to-the-lighthouse-by-virginia-woolf-introduction-by-susan-choi/
- https://www.penguinrandomhouse.com/books/23477/the-stranger-by-albert-camus-translated-by-matthew-ward-introduction-by-keith-gore/

2026-09-09: final GLB has 42 meshes, 121,608 triangles and exactly seven tagged click
surfaces (one per action). Size 7,418,976 bytes. Official poster is 197,254 bytes.
Reviewed the Blender preview after repairing dark metallic albedo. Vite build,
Liquid/six-dialog tests, GLB assertions and runtime seven-hotspot/OrbitControls/lamp
tests pass. Browser skill discovery still returns no available instances; real-browser
appearance and frame rate remain unverified. Root CV and other page routes are unchanged.

2026-09-08 (lighting/navigation): rechecked recording frames 06s/63s. Added a 16%-opacity glass backdrop and runtime shadow-only receiver, darker neutral fill and oblique key shadows. Floor lamp moved left 0.70 units, guitar 0.45 units; floor lamp shade/bulb emission and downward warm light follow the shared lamp switch. GLB meshes reduced from 79 to 57 by batching record grooves; geometry remains 119,872 triangles. Removed gesture-time framebuffer resizing, disabled costly transmission passes in favor of alpha/environment glass, cached static mesh transforms, and routed camera transitions through one render scheduler. Real OrbitControls in DOM tests verify left rotation/right pan, no gesture resize, idle-loop settling, lamp state and panel control locking. These are not GPU benchmarks or browser screenshots; actual frame rate and browser visual appearance remain unverified. Vite and the six-dialog regression suite pass.

2026-09-08: room dialogs use 16px body copy on desktop and mobile, 12–14px secondary labels, and 44px close buttons. Whiteboard tools wrap on narrow screens. A single landscape Me8 photograph retains its native aspect ratio. The opaque studio wall is omitted rather than made into an invisible shadow caster; floor shadows and mounted objects remain. Vite, Liquid/DOM regression tests and GLB assertions pass (one photo, no wall, all interaction targets). Blender preview inspected; browser discovery returned no available instances, so viewport-level visual QA remains unverified.

Blender preview versus 6s composition; detail views; GLB interaction metadata and material checks; Vite/Jekyll builds; browser checks when available; GitHub Pages and live version checks after publishing.

2026-09-07: rebuilt export contains 119,884 triangles, 81 meshes, 16 embedded images and all 10 interaction types. Size: 6,592,716 bytes. Vite build and Liquid/DOM behavior checks pass. `check-interfaces.cjs` covers terminal commands, input safety, photo filtering, whiteboard tools, selected-record persistence, Escape/close, switches and canceled transitions. This does not test WebGL rendering or pointer behavior in a real browser. The browser connection reports no available instances; local Jekyll is blocked by Windows application control loading Ruby `strscan.so`. GitHub Pages deployment is the full Jekyll build check.
