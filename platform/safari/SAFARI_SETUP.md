# Safari Web Extension Setup (macOS & iOS)

## Prerequisites

- macOS 13+ with Xcode 15+
- Apple Developer account (for distribution)
- Safari 17+ on macOS, Safari 17+ on iOS 17+

## Convert to Safari Web Extension

Apple provides `safari-web-extension-converter` to wrap a WebExtension into a native app bundle
that works on both macOS and iOS (iPhone/iPad).

### Step 1: Run the converter

```bash
# From the project root directory
xcrun safari-web-extension-converter . \
  --project-location ./safari-xcode \
  --app-name "BlurFemaleAI" \
  --bundle-identifier com.blurfemaleai.extension \
  --swift \
  --ios-only     # Remove this flag to build for both macOS and iOS
```

Options:
- `--macos-only` — macOS Safari only
- `--ios-only` — iOS Safari only
- Omit both — universal (macOS + iOS)

### Step 2: Open in Xcode

```bash
open safari-xcode/BlurFemaleAI.xcodeproj
```

### Step 3: Configure signing

1. Select the project in Xcode
2. Under **Signing & Capabilities**, select your team
3. Set unique bundle identifiers for:
   - The app: `com.yourteam.BlurFemaleAI`
   - The extension: `com.yourteam.BlurFemaleAI.Extension`

### Step 4: Build & Run

- **macOS**: Select "My Mac" as the target, build and run
- **iOS**: Select your connected device or simulator, build and run

### Step 5: Enable in Safari

**macOS:**
1. Open Safari → Settings → Extensions
2. Enable "BlurFemaleAI"

**iOS:**
1. Open Settings → Safari → Extensions
2. Enable "BlurFemaleAI"
3. Set permissions to "Allow" for all websites (or specific ones)

## iOS-Specific Notes

- Safari on iOS 17+ supports Manifest V3 web extensions
- The extension popup appears as a toolbar item
- `IntersectionObserver` and `MutationObserver` are fully supported
- TensorFlow.js uses WebGL on iOS Safari; falls back to CPU if unavailable
- Maximum extension storage is more limited on iOS — the 5MB `chrome.storage.local` limit applies
- Video processing may be slower on older iOS devices due to GPU constraints

## Distribution

### TestFlight (beta testing)
1. Archive the app in Xcode
2. Upload to App Store Connect
3. Distribute via TestFlight

### App Store
1. Archive in Xcode
2. Upload to App Store Connect
3. Submit for review (extensions are reviewed as part of the host app)
