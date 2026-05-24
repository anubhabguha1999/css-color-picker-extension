# ChromaLux — CSS Color Picker

A premium Chrome extension for picking, analyzing, and converting colors on any webpage.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-green)
![Vanilla JS](https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?logo=javascript&logoColor=black)

---

## Features

- **Live Eyedropper** — pick any color directly from a webpage using the EyeDropper API
- **Multi-format conversion** — view your color as HEX, RGB, HSL, and OKLCH simultaneously, all one-click copyable
- **Shades & Tints** — instantly generate a 7-swatch palette of shades and tints
- **Color Harmonies** — complementary, analogous, triadic, and split-complementary schemes
- **WCAG Contrast Analyzer** — check AA/AAA accessibility compliance against dark, light, or custom backgrounds, with a live text preview
- **Color History** — stores your last 20 picked colors with persistent storage
- **Dark / Light theme** — toggleable with automatic system preference detection

---

## Installation

No build step is required. Load the extension directly in Chrome:

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** and select this project folder
4. ChromaLux will appear in your Chrome toolbar

---

## Usage

| Tab | What it does |
|---|---|
| **Picker** | Launch the eyedropper, then copy your color in any format |
| **Palette** | View shades/tints and harmony swatches for the active color |
| **Contrast** | Test WCAG AA/AAA contrast ratios against a chosen background |
| **History** | Browse and restore previously picked colors |

When picking a color from a webpage, a toast notification appears in-page with a quick copy button.

---

## Project Structure

```
css-color-picker-extension/
├── manifest.json       # Chrome Manifest V3 config
├── popup.html          # Extension popup UI (4-tab layout)
├── popup.js            # All app logic — color math, storage, events
├── popup.css           # Dual-theme styles with glassmorphism effects
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── scripts/
    └── generate_icons.py   # Resize a source image to icon sizes
```

---

## Regenerating Icons

If you replace the source icon, regenerate the sized assets with:

```bash
python3 scripts/generate_icons.py
```

Requires [Pillow](https://pillow.readthedocs.io/) — the script will auto-install it if missing. The source image should be at least 1024×1024px.

---

## Permissions

| Permission | Reason |
|---|---|
| `storage` | Persist color history and theme preference |
| `activeTab` | Access the current page for the eyedropper |
| `scripting` | Inject the in-page toast notification |

---

## Color Formats

- **HEX** — `#rrggbb`
- **RGB** — `rgb(r, g, b)`
- **HSL** — `hsl(h, s%, l%)`
- **OKLCH** — perceptually uniform, based on Björn Ottosson's OKLab color space

---

## License

MIT
