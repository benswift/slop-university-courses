# Slop University course catalogue

## Image generation style

Prompt suffix: Flat gold and black ink shapes on warm cream paper, visible print
grain, subtle misregistration, screen-print texture, bold simplified geometry,
mid-century editorial illustration style. No text, no lettering, no
photorealism.

Reference images: `../slop-university/references/slop-style/` --- a sibling
checkout. This repo carries the brand palette (via `astro-theme-slop`) but none
of the imagery doctrine.

Style guide: `../slop-university/skills/_shared/visual-style.md`, with the
generation mechanics in `image-workflow.md` beside it. Read both before
generating. The prompt is a fixed formula opening
`Two-ink risograph illustration of <scene>` --- only the scene varies, and the
suffix above is the rest of it. Pass 3--5 scene-matched `--input-image` refs.
Page heroes are 2K, 16:9, stored as `.avif` under `src/assets/heroes/`.
