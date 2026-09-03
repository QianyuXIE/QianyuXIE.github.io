# Qianyu Room — Rebuild Guide

This document is the source of truth for rebuilding the Home experience. It
uses the supplied screen recording as a behavioural and art-direction
reference while keeping all geometry, textures, copy, photographs and code
original to Qianyu's site.

## 1. Product principle

The room is the navigation system. Visitors should feel that they are entering
a personal workspace, not looking at a decorative 3D background with generic
modals placed on top.

Every major object must therefore have all four parts:

1. A recognisable silhouette and a clear place in the composition.
2. Hover/focus feedback that does not disturb the material palette.
3. A dedicated camera pose and a reversible camera transition.
4. A small application or action that belongs to the physical object.

## 2. Visual direction

### Composition

- Use an open, off-white studio floor and a single off-white display wall.
- Do not build an enclosing room box or a visible ceiling.
- Keep the desk as the visual centre and preserve generous negative space.
- Put the floor lamp and guitar on the left, chair in the foreground, and
  record player on the right side of the desk.
- Keep the wall sparse: drawing board on the left, a short shelf and framed
  personal image in the middle, and three records on the right.
- Remove the freestanding research sign, large bookcase, plant, dresser and
  unrelated ornamental objects from the hero composition.

### Camera

- Desktop hero: perspective camera with a restrained 38–45 mm equivalent
  field of view, elevated three-quarter view, and minimal distortion.
- Orbiting is a secondary exploration action. Clamp it to a narrow, useful
  range so the composition cannot be broken.
- Each application receives an authored focus pose, not a generic zoom based
  only on the clicked mesh bounds.
- Closing an application returns to the exact previous overview pose.

### Palette and materials

- Background/wall: warm grey-white (`#e8e6df` to `#f1efe9`).
- Main objects: charcoal, warm black, soft aluminium and off-white.
- Wood appears only as a quiet accent on the shelf and desk legs.
- Accent colour is reserved for Qianyu's photographs and record labels.
- Use high roughness on walls and paper, medium roughness on painted metal,
  and controlled highlights on camera lenses, records and the MacBook.
- Avoid saturated teal, orange emissive materials and decorative colour noise.

### Lighting

- One large soft key light from upper-left/front establishes the main shadow.
- One weak neutral fill prevents black objects from losing their silhouette.
- A practical floor/desk lamp may add warm light in night mode.
- Contact shadows and ambient occlusion must ground every object.
- Bake static lighting/AO after modelling; keep only lights that need to react
  at runtime.

## 3. Scene and interaction map

| Object | Qianyu content | Interaction | Dedicated application |
| --- | --- | --- | --- |
| MacBook Air | CV, GitHub and projects | Camera moves to screen | Terminal/CV screen |
| Drawing board | Research notes | Camera moves to board | Drawable whiteboard |
| Camera | Photography | Camera moves to desk camera | Film gallery |
| Record player | Aimer / Wu Qingfeng | Record begins rotating | Record library + mini player |
| Framed wall image | About | Camera moves to frame | About card |
| Desk papers | Publications | Small desk focus | Research/publications card |
| Light switches | Day/night modes | Toggle in-world lighting | No modal |

## 4. Technical architecture

Keep GitHub Pages and Jekyll as the host. Do not migrate the site to Next.js
or add a runtime service. The current Three.js/Vite island remains isolated to
Home and can provide the required experience without changing CV, Moment,
About or post routes.

Source ownership:

- `room-3d/scripts/build_qianyu_room.py`: procedural Blender source scene.
- `room-3d/source/qianyu-room.blend`: editable generated Blender file.
- `assets/room3d/qianyu-room.glb`: production model.
- `room-3d/web/src/room-runtime.js`: renderer, camera and 3D interactions.
- `js/room-experience.js`: accessible 2D applications and shared state.
- `assets/css/room-experience.css`: application shell and responsive layout.

Scene naming rules:

- Interactive meshes use `app_<name>_hit` or an explicit `interaction` extra.
- Camera anchors use `focus_<name>_camera` and `focus_<name>_target`.
- Animated parts are kept as independent meshes, for example
  `music_record_disc` and `music_tonearm`.
- Static meshes may be batched only after all interactive/animated meshes have
  been excluded.

## 5. Performance budget

- Production GLB: target under 3 MB; hard limit 5 MB.
- Initial JavaScript bootstrap: under 5 KB compressed.
- Deferred Three.js runtime: load after first paint.
- Desktop render DPR: maximum 1.5; drag DPR: maximum 1.0.
- Mobile render DPR: maximum 1.25.
- Static scene uses demand rendering; continuous frames are permitted only
  during camera motion, record rotation or a brief interaction animation.
- Primary raycast targets: fewer than 20.
- Prefer one 2048 px baked atlas or two 1024 px atlases over many small maps.

## 6. Implementation phases and gates

### Phase 0 — Reference and audit

- Extract key frames and describe the visual system.
- Inventory existing geometry, code and public routes.
- Record this guide in the repository.

Gate: every future change can be evaluated against explicit composition,
interaction and performance rules.

### Phase 1 — Blockout

- Replace the current scattered room with the new wall/desk composition.
- Establish overview camera, orbit limits and responsive framing.
- Use simple materials but correct proportions and silhouettes.

Gate: a monochrome render must already read as a deliberate workspace at
1440, 1024, 768 and 390 px widths.

### Phase 2 — Modelling and materials

- Refine desk, chair, MacBook Air, camera, record player, lamps, guitar,
  drawing board, shelf, books, frame and records.
- Add small details only when they improve silhouette or communicate use.
- Assign final PBR materials and Qianyu-owned images.

Gate: each core prop remains recognisable in a close camera pose and the room
does not become visually busy at overview scale.

### Phase 3 — UV and baking

- Apply transforms, verify normals and create non-overlapping UV2 layouts.
- Bake ambient occlusion and static lighting in Blender.
- Pack textures, export GLB and verify colour-space settings in Three.js.

Gate: baked and Blender preview lighting agree, objects have contact shadows,
and the exported asset stays within the size budget.

### Phase 4 — Applications and camera choreography

- Replace generic bounds-based zoom with authored camera anchors.
- Implement working whiteboard, photography gallery, terminal/CV view and
  record library/mini player.
- Restore the overview camera on close and allow Escape at every level.

Gate: every visible primary object has an obvious, reversible response using
mouse, touch and keyboard.

### Phase 5 — Polish and release

- Tune hover, easing, loading state, mobile layout and reduced-motion mode.
- Run Vite build, Jekyll/GitHub Pages build, route regression and asset checks.
- Commit and deploy each independently verified milestone.

Gate: no horizontal overflow, no idle GPU loop, no broken non-Home page and a
successful GitHub Pages deployment.

## 7. Review checklist

Before accepting any iteration, ask:

- Does the desk remain the focal point?
- Is there enough empty space around the composition?
- Are the palette and light coherent across every prop?
- Is this object useful, or is it merely adding clutter?
- Does clicking it feel like interacting with the room itself?
- Can the action be closed and reversed predictably?
- Does it still work smoothly on a mid-range phone?

## 8. Execution record

- [x] Phase 0: recording audit, visual system and object map documented.
- [x] Phase 1: open studio blockout, restrained orbit and white-world framing.
- [x] Phase 2: MacBook Air, camera, turntable, chair, lamps, guitar, wall
  display and Qianyu-owned photography modelled in Blender.
- [x] Phase 3: UV preparation, static AO baking and GLB export below the
  3 MB target.
- [x] Phase 4: authored focus cameras, reversible close behaviour, drawable
  whiteboard, film gallery, CV terminal, music window and record animation.
- [x] Phase 5: responsive camera distance, drag-quality throttling, demand
  rendering, reduced-motion support, keyboard controls and in-world light
  switch.

Release verification must include the Vite production build, GitHub Pages
build, public route checks, GLB size check and a final visual pass at 1440,
1024, 768 and 390 px widths.
