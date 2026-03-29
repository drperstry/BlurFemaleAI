# BlurFemaleAI — Chrome Extension

AI-powered Chrome extension (Manifest V3) that detects and blurs female faces in images and videos using TensorFlow.js and face-api.js.

## Features

- **AI Face Detection**: Detects female faces using gender classification
- **Multiple Engines**: Switch between Face-API.js, TensorFlow.js (BlazeFace), or Hybrid mode
- **Image & Video Support**: Blurs faces in both static images and video streams
- **Lazy Loading**: Uses `IntersectionObserver` — only processes visible media
- **Dynamic Content**: `MutationObserver` handles SPAs and infinite scroll
- **Performance Optimized**: Concurrency limiter, result caching, efficient canvas rendering
- **Domain Exclusion**: Exclude specific domains via popup UI (stored in `chrome.storage`)
- **Per-Site Toggle**: Enable/disable on any site with one click
- **Modern Popup UI**: Dark theme, adjustable blur intensity & confidence threshold
- **Chrome Web Store CI/CD**: Auto-publish via GitHub Actions

## Folder Structure

```
BlurFemaleAI/
├── manifest.json              # Extension manifest (MV3)
├── background/
│   └── service-worker.js      # Background service worker
├── content/
│   ├── content.js             # Main content script (orchestrator)
│   ├── content.css            # Blur overlay styles
│   ├── model-engine.js        # AI model abstraction layer
│   └── processor.js           # Media processing & blur renderer
├── popup/
│   ├── popup.html             # Popup UI
│   ├── popup.css              # Dark theme styles
│   └── popup.js               # Popup logic & settings management
├── lib/                       # Third-party libraries (see setup)
│   ├── face-api.min.js
│   ├── tf.min.js
│   └── blazeface.min.js
├── models/                    # Face-API.js model weights (see setup)
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── .github/
    └── workflows/
        └── chrome-store-publish.yml
```

## Setup Instructions

### 1. Download Required Libraries

Download and place these files in the `lib/` directory:

**face-api.js** (v0.22.2+):
```bash
curl -L -o lib/face-api.min.js https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js
```

**TensorFlow.js** (v4.x):
```bash
curl -L -o lib/tf.min.js https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.17.0/dist/tf.min.js
```

**BlazeFace**:
```bash
curl -L -o lib/blazeface.min.js https://cdn.jsdelivr.net/npm/@tensorflow-models/blazeface@0.1.0/dist/blazeface.min.js
```

### 2. Download Face-API.js Models

Download the model weights into the `models/` directory:

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

### 4. Load in Chrome

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `BlurFemaleAI` folder

## Detection Engines

| Engine | Speed | Gender Classification | Best For |
|---|---|---|---|
| **Face API** | Medium | Yes (built-in) | Accuracy-focused |
| **TensorFlow** | Fast | No (blurs all faces) | Performance-focused |
| **Hybrid** | Medium | Yes (TF detect + Face-API classify) | Best balance |

## Chrome Web Store Publishing

The included GitHub Actions workflow (`.github/workflows/chrome-store-publish.yml`) auto-publishes on pushes to `main`.

### Required Secrets

Set these in your GitHub repository settings:

| Secret | Description |
|---|---|
| `EXTENSION_ID` | Chrome Web Store extension ID |
| `CWS_CLIENT_ID` | OAuth2 client ID |
| `CWS_CLIENT_SECRET` | OAuth2 client secret |
| `CWS_REFRESH_TOKEN` | OAuth2 refresh token |

## License

MIT
