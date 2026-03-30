#!/usr/bin/env bash
set -euo pipefail

#
# Build script for BlurFemaleAI — generates browser-specific extension packages.
# Usage: ./scripts/build.sh [chrome|firefox|safari|all]
#

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$ROOT_DIR/build"

# Shared files included in all builds
SHARED_FILES=(
  "lib/"
  "models/"
  "icons/"
  "content/"
  "popup/"
  "background/"
)

clean() {
  rm -rf "$BUILD_DIR"
  mkdir -p "$BUILD_DIR"
}

copy_shared() {
  local dest="$1"
  mkdir -p "$dest"
  for item in "${SHARED_FILES[@]}"; do
    if [ -d "$ROOT_DIR/$item" ]; then
      cp -r "$ROOT_DIR/$item" "$dest/$item"
    elif [ -f "$ROOT_DIR/$item" ]; then
      cp "$ROOT_DIR/$item" "$dest/$item"
    fi
  done
}

build_chrome() {
  echo "Building Chrome/Brave extension..."
  local dest="$BUILD_DIR/chrome"
  copy_shared "$dest"
  cp "$ROOT_DIR/manifest.json" "$dest/manifest.json"

  # Create zip
  (cd "$dest" && zip -r "$BUILD_DIR/blurfemaleai-chrome.zip" . -q)
  echo "  -> build/blurfemaleai-chrome.zip"
}

build_firefox() {
  echo "Building Firefox extension..."
  local dest="$BUILD_DIR/firefox"
  copy_shared "$dest"
  cp "$ROOT_DIR/platform/firefox/manifest.json" "$dest/manifest.json"

  # Create zip (Firefox uses .xpi)
  (cd "$dest" && zip -r "$BUILD_DIR/blurfemaleai-firefox.xpi" . -q)
  echo "  -> build/blurfemaleai-firefox.xpi"
}

build_safari() {
  echo "Building Safari extension source..."
  local dest="$BUILD_DIR/safari-src"
  copy_shared "$dest"
  cp "$ROOT_DIR/manifest.json" "$dest/manifest.json"
  cp -r "$ROOT_DIR/platform/safari/" "$dest/platform-safari/"

  echo ""
  echo "  Safari source prepared at: build/safari-src/"
  echo "  To create the Xcode project, run:"
  echo ""
  echo "    xcrun safari-web-extension-converter build/safari-src/ \\"
  echo "      --project-location build/safari-xcode \\"
  echo "      --app-name BlurFemaleAI \\"
  echo "      --bundle-identifier com.blurfemaleai.extension \\"
  echo "      --swift"
  echo ""
  echo "  Add --ios-only for iOS-only, --macos-only for macOS-only."
  echo "  See platform/safari/SAFARI_SETUP.md for full instructions."
}

case "${1:-all}" in
  chrome)
    clean
    build_chrome
    ;;
  firefox)
    clean
    build_firefox
    ;;
  safari)
    clean
    build_safari
    ;;
  all)
    clean
    build_chrome
    build_firefox
    build_safari
    echo ""
    echo "All builds complete."
    ;;
  *)
    echo "Usage: $0 [chrome|firefox|safari|all]"
    exit 1
    ;;
esac
