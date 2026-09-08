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

Desk with U legs and end grain; black laptop with keyboard/trackpad/ports; camera with knurled lens and controls; film canister; portrait paper and pen; articulated desk lamp; open shade floor lamp; electric guitar with pickups/strings/tuners/stand; thin curved chair shell and wheeled base; turntable with grooves/tonearm/counterweight/hinged cover; padded headphones; roller sheet with curled corner; floating shelf/books; poster frame; three records; wall switch.

## Limits

The video does not expose original source geometry, UV maps, exact typefaces, every album image, chair/guitar interactions, or complete playback behavior. Those details are reconstructed estimates. Music requires user-owned or licensed audio before playback can be implemented; selection and turntable mechanics work without audio. Do not claim pixel-perfect equivalence or successful browser testing based on builds alone.

## Validation

2026-09-08: room dialogs use 16px body copy on desktop and mobile, 12–14px secondary labels, and 44px close buttons. Whiteboard tools wrap on narrow screens. A single landscape Me8 photograph retains its native aspect ratio. The opaque studio wall is omitted rather than made into an invisible shadow caster; floor shadows and mounted objects remain. Vite, Liquid/DOM regression tests and GLB assertions pass (one photo, no wall, all interaction targets). Blender preview inspected; browser discovery returned no available instances, so viewport-level visual QA remains unverified.

Blender preview versus 6s composition; detail views; GLB interaction metadata and material checks; Vite/Jekyll builds; browser checks when available; GitHub Pages and live version checks after publishing.

2026-09-07: rebuilt export contains 119,884 triangles, 81 meshes, 16 embedded images and all 10 interaction types. Size: 6,592,716 bytes. Vite build and Liquid/DOM behavior checks pass. `check-interfaces.cjs` covers terminal commands, input safety, photo filtering, whiteboard tools, selected-record persistence, Escape/close, switches and canceled transitions. This does not test WebGL rendering or pointer behavior in a real browser. The browser connection reports no available instances; local Jekyll is blocked by Windows application control loading Ruby `strscan.so`. GitHub Pages deployment is the full Jekyll build check.
