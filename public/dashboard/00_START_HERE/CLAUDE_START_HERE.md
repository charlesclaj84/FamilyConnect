# START HERE — GENORRA Back Office Golden Master Implementation

This package implements the **official Dashboard Golden Master** at `01_REFERENCE/Dashboard_Golden_Master_OFFICIAL.png`.

## Non-negotiable visual rule
Do **not** reinterpret or simplify the Golden Master. Use the supplied vector assets directly.

Especially do not:
- redraw or simplify the multicolor GENORRA mark;
- replace the traced Family Tree artwork with a generic tree icon;
- flatten the event/photo composition into rectangles;
- introduce a second swoop between the family photo and event hero;
- remove the layered burgundy/gold/olive sidebar curves;
- replace the bespoke event/card hierarchy with generic dashboard cards;
- recolor every accent to burgundy;
- replace the serif/sans hierarchy with one font.

## Vectorization scope
All **UI, curves, iconography, brand marks, tree illustration, cards, buttons, borders and decorative shapes are SVG/vector**. The people/family photographs remain photographic JPG media clipped by SVG masks. Converting photography into thousands of vector polygons would reduce fidelity and is intentionally not part of the implementation.

## Claude implementation order
1. Open `01_REFERENCE/Dashboard_Golden_Master_OFFICIAL.png`.
2. Open `03_VECTOR_ASSETS/Dashboard_Golden_Master_VECTOR.svg` and compare side-by-side.
3. Import `05_DESIGN_SYSTEM/design-tokens.json` and `tokens.css`.
4. Implement shell + sidebar from `components/Sidebar.svg`.
5. Implement `Welcome_EventHero.svg` as a real component using the exact curve paths in `curve-paths.json`.
6. Implement each card from its corresponding SVG.
7. Use `FamilyTree_Golden_ExactPixelVector.svg` directly for visual fidelity; **do not redraw the tree**. The semantic direct trace is included only as an editable fallback.
8. Extend the visual language to remaining Back Office pages using `07_PAGE_PATTERNS/`.
9. Complete `08_QA/VISUAL_ACCEPTANCE.md` before calling the work finished.
