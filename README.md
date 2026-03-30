# BlurFemaleAI — Cross-Browser Extension

AI-powered browser extension that detects and blurs female faces in images and videos using TensorFlow.js and face-api.js.

**Supported Browsers:**
- Chrome (desktop)
- Brave (desktop & mobile)
- Safari (macOS, iOS, iPadOS)
- Firefox (desktop & Android)

## Features

- **AI Face Detection** — detects female faces using gender classification
- **Multiple Engines** — switch between Face-API.js, TensorFlow.js (BlazeFace), or Hybrid mode
- **Image & Video Support** — blurs faces in both static images and video streams
- **Lazy Loading** — `IntersectionObserver` ensures only visible media is processed
- **Dynamic Content** — `MutationObserver` handles SPAs, infinite scroll, and lazy-loaded images
- **Performance Optimized** — concurrency limiter (3 tasks max), 60s result caching, efficient canvas rendering
- **Domain Exclusion** — exclude specific domains via popup UI (persisted in extension storage)
- **Per-Site Toggle** — enable/disable on any site with one click
- **Modern Popup UI** — dark theme, touch-friendly, adjustable blur intensity & confidence threshold
- **Cross-Browser** — single codebase with a compatibility polyfill, browser-specific manifests, and build script
- **Chrome Web Store CI/CD** — auto-publish via GitHub Actions

## Folder Structure

```
BlurFemaleAI/
├── manifest.json                          # Chrome/Brave manifest (MV3)
├── .gitignore
├── background/
│   └── service-worker.js                  # Background service worker
├── content/
│   ├── content.js                         # Main content script (orchestrator)
│   ├── content.css                        # Blur overlay styles
│   ├── model-engine.js                    # AI model abstraction layer
│   └── processor.js                       # Media processing & blur renderer
├── popup/
│   ├── popup.html                         # Popup UI
│   ├── popup.css                          # Dark theme (mobile-friendly)
│   └── popup.js                           # Popup logic & settings
├── lib/
│   ├── browser-polyfill.js                # Cross-browser API compatibility layer
│   ├── face-api.min.js                    # (download — see setup)
│   ├── tf.min.js                          # (download — see setup)
│   └── blazeface.min.js                   # (download — see setup)
├── models/                                # Face-API.js model weights (see setup)
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── platform/
│   ├── firefox/
│   │   └── manifest.json                  # Firefox MV2 manifest (desktop & Android)
│   └── safari/
│       ├── Info.plist                      # Safari extension metadata
│       └── SAFARI_SETUP.md                # Full Safari/iOS build instructions
├── scripts/
│   └── build.sh                           # Build script (chrome|firefox|safari|all)
└── .github/
    └── workflows/
        └── chrome-store-publish.yml
```

## Setup Instructions

### 1. Download Required Libraries

Place these files in the `lib/` directory:

```bash
# face-api.js
curl -L -o lib/face-api.min.js \
  https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js

# TensorFlow.js
curl -L -o lib/tf.min.js \
  https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.17.0/dist/tf.min.js

# BlazeFace
curl -L -o lib/blazeface.min.js \
  https://cdn.jsdelivr.net/npm/@tensorflow-models/blazeface@0.0.7/dist/blazeface.min.js
```

### 2. Download Face-API.js Models

```bash
# Tiny Face Detector
curl -L -o models/tiny_face_detector_model-weights_manifest.json \
  https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/tiny_face_detector_model-weights_manifest.json
curl -L -o models/tiny_face_detector_model-shard1 \
  https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/tiny_face_detector_model-shard1

# Age Gender Net
curl -L -o models/age_gender_model-weights_manifest.json \
  https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/age_gender_model-weights_manifest.json
curl -L -o models/age_gender_model-shard1 \
  https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/age_gender_model-shard1
```

### 3. Add Extension Icons

Place PNG icons at `icons/icon16.png`, `icons/icon48.png`, and `icons/icon128.png`.

---

## Browser-Specific Setup

### Chrome / Brave (Desktop)

1. Open `chrome://extensions/` (or `brave://extensions/`)
2. Enable **Developer mode**
3. Click **Load unpacked** → select the `BlurFemaleAI` root folder
4. The extension uses `manifest.json` (Manifest V3) directly

### Brave (Mobile — Android)

Brave for Android supports Chrome extensions natively:

1. Transfer the extension folder to Android
2. Open `brave://extensions/`
3. Enable Developer mode
4. Load unpacked

### Firefox (Desktop & Android)

Firefox uses Manifest V2 with the `browser.*` API.

```bash
# Build the Firefox package
./scripts/build.sh firefox
```

**Desktop:**
1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select `build/blurfemaleai-firefox.xpi`

**Android (Firefox Nightly):**
1. Set up a [custom add-on collection](https://blog.mozilla.org/addons/2020/09/29/expanded-extension-support-in-firefox-for-android-nightly/)
2. Upload the `.xpi` to your collection on [addons.mozilla.org](https://addons.mozilla.org)
3. Install from your collection in Firefox Nightly for Android

### Safari (macOS)

Safari uses Apple's `safari-web-extension-converter` to wrap the extension into a native app:

```bash
# Build Safari source
./scripts/build.sh safari

# Convert to Xcode project
xcrun safari-web-extension-converter build/safari-src/ \
  --project-location build/safari-xcode \
  --app-name BlurFemaleAI \
  --bundle-identifier com.blurfemaleai.extension \
  --swift --macos-only
```

Then open `build/safari-xcode/BlurFemaleAI.xcodeproj`, sign, and build.

### Safari (iOS / iPadOS)

```bash
./scripts/build.sh safari

xcrun safari-web-extension-converter build/safari-src/ \
  --project-location build/safari-xcode \
  --app-name BlurFemaleAI \
  --bundle-identifier com.blurfemaleai.extension \
  --swift --ios-only
```

Build in Xcode targeting your iOS device. See `platform/safari/SAFARI_SETUP.md` for full details.

---

## Build All Platforms

```bash
./scripts/build.sh all
```

Produces:
- `build/blurfemaleai-chrome.zip` — Chrome/Brave
- `build/blurfemaleai-firefox.xpi` — Firefox
- `build/safari-src/` — source for Safari conversion

## Detection Engines

| Engine | Speed | Gender Classification | Best For |
|---|---|---|---|
| **Face API** | Medium | Yes (built-in) | Accuracy-focused |
| **TensorFlow** | Fast | No (blurs all faces) | Performance-focused |
| **Hybrid** | Medium | Yes (TF detect + Face-API classify) | Best balance |

## Browser Compatibility Notes

| Feature | Chrome | Brave | Safari macOS | Safari iOS | Firefox | Firefox Android |
|---|---|---|---|---|---|---|
| Manifest V3 | Yes | Yes | Yes (17+) | Yes (17+) | No (uses MV2) | No (uses MV2) |
| WebGL (TF.js) | Yes | Yes | Yes | Yes | Yes | Yes |
| IntersectionObserver | Yes | Yes | Yes | Yes | Yes | Yes |
| MutationObserver | Yes | Yes | Yes | Yes | Yes | Yes |
| Video blur | Yes | Yes | Yes | Limited* | Yes | Yes |

*iOS Safari restricts autoplay and some video element access.

## Chrome Web Store Publishing

The included GitHub Actions workflow auto-publishes on pushes to `main`.

### Required Secrets

| Secret | Description |
|---|---|
| `EXTENSION_ID` | Chrome Web Store extension ID |
| `CWS_CLIENT_ID` | OAuth2 client ID |
| `CWS_CLIENT_SECRET` | OAuth2 client secret |
| `CWS_REFRESH_TOKEN` | OAuth2 refresh token |

## License

MIT
