# Packaging Studio

A web app (PWA) for building coordinated product mockups (the 10 standard types plus any
extra products) from one reference image, and laying them out on a company's A4 letterpad.
The letterpad works like a blank Word page: products, text boxes and images go anywhere,
can be moved, resized, restacked and duplicated, text (including Gujarati) is typed straight
onto the page, and a project can have several pages. It works on phone, tablet and computer, can be
installed from the browser, and works offline. Everything is stored on the device.

## What stays independently changeable

| Part | Where it lives | Changing it affects |
|---|---|---|
| Reference image → theme | `project.theme` (10 colour tokens) | colours of all products |
| Packaging model | `project.packaging[]`, chosen per product | only the packaging |
| Label / artwork | `project.labels[]`, chosen per product | only the label |
| Colour | product → token index + manual adjustment | only that product's colour |
| Text | `product.text` | only the text |
| Letterpad | `project.letterpadTemplates[]` + guide area | only the background; pages are kept |
| Page content | `letterpad.pages[].elements[]` (product / text / image, page coordinates) | only that element |

Images, dielines and letterpads are stored once in an asset store (IndexedDB) and referenced
by id, so versions and project files never duplicate them.

## Code layout

```
index.html, app.css       shell and styles
js/util.js, color.js      helpers, HSL colour maths
js/theme.js               reference image → 10 tokens; hand edits kept as offsets
js/model.js               data model, pure operations, undo, normalisation of loaded files
js/store.js               IndexedDB: projects + asset store
js/render.js              packaging → recolour → label pipeline
js/letterpad.js           A4 page background, text layout, page export
js/editor.js              letterpad page editor (select, drag, resize, type, pages, undo/redo)
js/files.js               download/share, project files, Phase 1 (pkg.html) migration
js/checks.js              in-app architecture checks (Checks tab)
js/app.js                 UI
sw.js, manifest.webmanifest  offline + install (scope: this folder only)
```

No build step: the folder is served as static files.

## Tests

```
node --test packaging-studio/tests/*.test.mjs        # pure modules
npx http-server -p 8123 .                            # from the repo root, then:
NODE_PATH=$(npm root -g) node packaging-studio/tests/e2e.cjs http://127.0.0.1:8123 [letterpad.png] [out-dir]
```

After changing any app file, bump `VERSION` in `sw.js` so installed copies update.

## Limits (by design)

- Mockups are not print or manufacturing files. Print artwork is finished in Illustrator on
  the manufacturer's dieline, in CMYK. The app collects the spec and dieline for that handoff.
- Labels sit flat; wrapping onto curved bottles needs Photoshop smart objects or Blender.
- No 3D yet (GLB/GLTF is a future module). No brush mask yet (colour + grey protection only).
- Letterpads are uploaded as images; export a PDF letterpad to PNG at 300 dpi first.
