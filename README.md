# Comic Panels

Illustrated privacy ideas, inspired by real experiences.

<p>
<a href="https://ben-tan.com/guides/comic-panels/"><img src="docs/images/buttons/comic-panels.svg" height="50" alt="Open the gallery"></a>&nbsp; 
<a href="https://ko-fi.com/itsbent"><picture><source media="(prefers-reduced-motion: reduce)" srcset="docs/images/buttons/kofi-static.svg"><img src="docs/images/buttons/kofi.svg" height="50" alt="Throw money at me"></picture></a>&nbsp; 
</p>

[![comic-panels illustrated repository banner.](docs/images/banner.png)](docs/images/banner.png)

*[Open at ben-tan.com](https://ben-tan.com/guides/comic-panels/).*

## What it does

Browse 18 comics about privacy work, policy language, and the gap between a promise and its implementation. Open a panel to read its story or download the image.

Ben Tan supplied concepts, sketches or outlines, and editorial selection, with ChatGPT image-generation assistance. The displayed credit is Ben Tan.

## Run locally

Use Node.js 22 or newer. The source checks have no npm dependencies:

```sh
npm run check
npm test
```

**The full gallery build also needs shared website files and the approved signed PNGs and lossless WebP display files, which are not distributed with this source checkout.** The [public gallery](https://ben-tan.com/guides/comic-panels/) is available without those inputs.

When those inputs are available:

```sh
npm run build -- --portfolio-root /path/to/shared-website --assets-root /path/to/approved-images --out .local/gallery
npm run preview -- .local/gallery 8926
```

`--portfolio-root` expects a directory containing `site/` with the shared collection page and resources. `--assets-root` supplies the 18 signed PNGs pinned in `art/manifest.json` and the 18 lossless WebP files pinned in `art/derivatives.json`.

The gallery build also needs the gallery-only files under previews/, pinned by art/gallery-previews.json. Their original-image hashes, whole-canvas resize and dimensions are recorded in the website gallery-preview manifest. Full-size reader and download files remain unchanged.

## Build and check

Source verification checks panel IDs, source hashes, and data mappings. The reader test checks image loading and cleanup. Builds require a fresh output directory, validate PNG hashes and dimensions plus WebP hashes, and copy the images unchanged. The preview serves only `OUTPUT/public/`.

## Limitations

The checkout alone does not recreate the hosted gallery. The image signature, download control, and historical production notes do not establish a reuse license. Unknown original generation settings remain unknown.

## License and credits

No collection-wide artwork or code reuse license is granted. Third-party fonts and dependencies retain their notices. Preserve Ben Tan's credit and the applicable source-specific rights; availability in the gallery does not grant redistribution rights.

---

Made by [Ben Tan](https://ben-tan.com). [Report a security issue](SECURITY.md).
