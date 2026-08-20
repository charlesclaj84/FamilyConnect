# PATCH 01 — Sidebar Golden-Master Fidelity

This patch fixes only the two regions called out in the red-box comparison. Extract this ZIP over the existing `GENORRA_BO_GOLDEN_VECTOR_IMPLEMENTATION` folder and allow overwrite.

## Fixed
1. **Top logo/header geometry**
   - Restores the Golden Master's full burgundy sidebar width below the header.
   - Limits the inward cream cut/swoop to the upper logo area instead of carrying a narrow sidebar down the page.
   - Rescales/repositions the approved multicolor GENORRA mark and white wordmark to match the Golden Master more closely.
   - Corrects the main cream cutout so it returns to the full sidebar width by the first navigation row instead of narrowing the entire column.

2. **Bottom decorative wave**
   - Restores the large olive hill that intentionally extends well beyond the sidebar into the lower main canvas.
   - Restores the orange and gold accent curves at Golden-Master scale.
   - React CSS now allows the desktop sidebar SVG to overflow horizontally so the vector hill is not clipped.
   - Dashboard/Shell SVGs include a root-level SVG overlay so the cream main canvas cannot cover the extended hill.

## Primary overwrite files
- `03_VECTOR_ASSETS/components/Sidebar.svg`
- `03_VECTOR_ASSETS/Dashboard_Golden_Master_VECTOR.svg`
- `03_VECTOR_ASSETS/BO_Shell_Template.svg`
- `06_REACT/styles/genorra-bo.css`
- `05_DESIGN_SYSTEM/curve-paths.json`
- `08_QA/VISUAL_ACCEPTANCE.md`

Preview files are also replaced so the corrected output can be checked before implementation.
