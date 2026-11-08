# CleanFrame 2.0

**Image Privacy & Provenance Studio** — a browser-based tool for inspecting common image metadata/provenance markers, comparing an original photo with an edited copy, and creating an optimized copy for ordinary image workflows.

## What's included

- Local image analysis: image dimensions, file size/type and last-modified time.
- Best-effort marker scan for EXIF, XMP, IPTC/Photoshop and C2PA/JUMBF-related strings.
- Heuristic scan for selected AI-related metadata text and software names.
- Two-file comparison: original camera photo vs edited export.
- User-selected workflow context (camera + AI editing, normal editing, AI-generated, mixed-origin, unsure).
- Downloadable JSON analysis report.
- Local image resize and JPEG/PNG/WebP export, aspect-ratio lock and quality control.
- Responsive interface and dark mode.

## Run locally

No build step or package installation is required. Open `index.html` in a modern browser, or run:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## GitHub Pages deployment

1. Upload the **contents** of this folder to the root of your GitHub repository (not a nested `cleanframe/cleanframe` directory).
2. Open **Settings → Pages**.
3. Choose **Deploy from a branch**, select branch `main` and folder `/ (root)`, then save.
4. After GitHub finishes deployment, open `https://YOUR-USERNAME.github.io/cleanframe/`.

## Privacy

Image files are read and processed locally in the browser. CleanFrame does not upload images to a CleanFrame server. The app does not use analytics or send image contents to a third party. Google Fonts are loaded from Google Fonts; to use the site without that network request, remove the font `<link>` elements from `index.html` and the browser will use the fallback font.

## Important technical limits

- The metadata scan is heuristic and inspects up to 4 MB from the beginning and up to 1 MB from the end of each file. A marker may be outside the scanned portions or stored in an unrecognised format.
- “Possible marker found” is not proof of a valid metadata record.
- This is **not** a full EXIF/IPTC/XMP parser, forensic examination, C2PA manifest validator, or cryptographic signature verifier.
- The app cannot reliably detect, verify or remove SynthID or other invisible pixel-embedded watermarks.
- The app cannot reproduce or predict Instagram's or another platform's AI-content classifier. A file scan cannot guarantee whether a post will receive an AI label.
- AI-related text or software-name matches are clues only, not proof that all image content is AI-generated.
- Image re-encoding and format conversion may remove or invalidate embedded Content Credentials and other provenance metadata. Keep the original file when provenance matters.
- Browser decoding and export support vary by image format. Animated images may be flattened to one frame during export.

## Intended use

CleanFrame is designed to help people understand file-level metadata and provenance signals, compare exports and make informed sharing decisions. It does not claim to conceal AI generation, defeat platform detection, or guarantee removal of an AI label. Follow the disclosure rules and prompts of the platform where you publish.

## License

MIT. See `LICENSE`.
