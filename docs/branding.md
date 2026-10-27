# ContriBolt visual identity

The mark joins an issue/branch graph to a compact bolt. The palette uses deep ink, mint and one lime accent. The assets use vector paths and system fonts, no JavaScript, remote fonts, trackers or raster backgrounds. Fixed contrasting surfaces keep the logo, diagrams and terminal legible in light and dark themes.

| Token | Color | Use |
| --- | --- | --- |
| Ink | `#102B35` | Wordmark, terminal, social canvas |
| Panel | `#173A43` | Quiet emphasis on dark backgrounds |
| Mint | `#5CE0AB` | Mark and successful recorded checks |
| Lime | `#D5F57A` | Bolt and publication-preview emphasis |
| Paper | `#F5FAF7` | Workflow canvas and light text |
| Muted ink | `#526876` | Secondary text on light backgrounds |

## Assets

| File | Dimensions | Purpose |
| --- | --- | --- |
| [logo.svg](assets/logo.svg) | 420 × 100 | README wordmark with MCP label |
| [mark.svg](assets/mark.svg) | 80 × 80 | Compact branch-and-bolt icon |
| [social-preview.png](assets/social-preview.png) | 1280 × 640 | GitHub social-preview upload |
| [social-preview.svg](assets/social-preview.svg) | 1280 × 640 | Editable vector social card |
| [workflow.svg](assets/workflow.svg) | 500 × 638 | Vertical workflow with responsibility labels |
| [demo.svg](assets/demo.svg) | 720 × 350 | Designed rendering of real controlled-fixture evidence |
| [demo-evidence.json](assets/demo-evidence.json) | JSON | Actual failing/passing native output and hashes |
| [demo-transcript.txt](assets/demo-transcript.txt) | Text | Captured test command/output, with path/color normalization |

The demo is not a product screenshot or a live contribution. Its fixture status is visible in the graphic and its accessible description. The README repeats the workflow and example in text so readers do not depend on small diagram labels.

## Regenerate

From a source checkout with development dependencies, Python and the fixture's `sh`/`python3` tools available:

```sh
npm run build
python3 scripts/capture-demo.py
python3 scripts/brand-assets.py --png
npm run docs:check
```

SVG generation uses Python's standard library. PNG rendering optionally uses ImageMagick with its librsvg renderer; it is a maintainer asset tool, not a runtime dependency. The social PNG should stay under 1 MB. [GitHub recommends 1280 × 640](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/customizing-your-repositorys-social-media-preview).

## GitHub and npm image delivery

The README uses version-pinned public npm CDN URLs: `https://cdn.jsdelivr.net/npm/contribolt-mcp@0.1.1/docs/assets/…`. Images are bundled with that release and work independently of GitHub authentication. The publication workflow verifies their HTTP responses and SHA-256 content against the source assets.

When preparing a later release, update the README image version with the package version. The local review previews use bundled files; the actual GitHub/npm pages use their own image delivery and Markdown rendering.

GitHub/npm use their own Markdown styling. The README uses native headings, links, tables and code blocks rather than site-specific CSS. The preview's light/dark styles are for review only and are not shipped as npm page styling.

## Social-preview upload

To update the image, open the repository → **Settings → General → Social preview → Edit → Upload an image**, select `docs/assets/social-preview.png`, and save.
