/**
 * Content Script — Entry Point
 * Orchestrates face detection and blurring on web pages.
 * Uses IntersectionObserver for lazy loading and MutationObserver for dynamic content.
 * Cross-browser compatible: Chrome, Brave, Safari (macOS/iOS), Firefox.
 *
 * Loaded via manifest content_scripts along with model-engine.js and processor.js,
 * so all three share the same content script isolated world.
 */

(function () {
  'use strict';

  const rt = (typeof browser !== 'undefined' ? browser : chrome).runtime;

  let settings = null;
  let processor = null;
  let modelEngine = null;
  let mutationObserver = null;
  let intersectionObserver = null;
  let isActive = false;

  async function init() {
    settings = await getSettings();

    if (!settings.enabled) return;

    const domain = window.location.hostname;
    if (settings.excludedDomains?.includes(domain)) return;

    // model-engine.js and processor.js are loaded via manifest content_scripts
    // and are available in the same isolated world
    if (!window.BlurFemaleAI?.ModelEngine || !window.BlurFemaleAI?.MediaProcessor) {
      console.error('[BlurFemaleAI] Model engine or processor not loaded');
      return;
    }

    modelEngine = new window.BlurFemaleAI.ModelEngine();
    processor = new window.BlurFemaleAI.MediaProcessor(modelEngine);
    processor.updateSettings(settings);

    try {
      await modelEngine.initialize(settings.detectionEngine);
    } catch (err) {
      console.error('[BlurFemaleAI] Model initialization failed:', err);
      return;
    }

    isActive = true;
    setupIntersectionObserver();
    scanExistingElements();
    setupMutationObserver();
    setupMessageListener();
  }

  function getSettings() {
    return new Promise((resolve) => {
      rt.sendMessage({ type: 'GET_SETTINGS' }, (response) => {
        if (rt.lastError) {
          console.warn('[BlurFemaleAI] Could not get settings:', rt.lastError.message);
          resolve(getDefaultSettings());
          return;
        }
        resolve(response?.settings || getDefaultSettings());
      });
    });
  }

  function getDefaultSettings() {
    return {
      enabled: true,
      detectionEngine: 'hybrid',
      blurIntensity: 25,
      excludedDomains: [],
      processImages: true,
      processVideos: true,
      confidenceThreshold: 0.6,
    };
  }

  function setupIntersectionObserver() {
    intersectionObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target;
        intersectionObserver.unobserve(el);
        processElement(el);
      }
    }, {
      rootMargin: '200px',
      threshold: 0.1,
    });
  }

  function scanExistingElements() {
    if (!isActive) return;

    const images = document.querySelectorAll('img');
    const videos = document.querySelectorAll('video');

    images.forEach(img => observeElement(img));
    videos.forEach(video => observeElement(video));
  }

  function observeElement(el) {
    if (el.dataset.blurFemaleAiObserved) return;
    el.dataset.blurFemaleAiObserved = 'true';
    intersectionObserver.observe(el);
  }

  function processElement(el) {
    if (!isActive || !processor) return;

    if (el instanceof HTMLImageElement) {
      if (el.complete && el.naturalWidth > 0) {
        processor.processImage(el);
      } else {
        el.addEventListener('load', () => processor.processImage(el), { once: true });
      }
    } else if (el instanceof HTMLVideoElement) {
      processor.processVideo(el);
    }
  }

  function setupMutationObserver() {
    mutationObserver = new MutationObserver((mutations) => {
      if (!isActive) return;

      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;

          if (node instanceof HTMLImageElement) {
            observeElement(node);
          } else if (node instanceof HTMLVideoElement) {
            observeElement(node);
          } else {
            node.querySelectorAll?.('img')?.forEach(img => observeElement(img));
            node.querySelectorAll?.('video')?.forEach(video => observeElement(video));
          }
        }
      }
    });

    mutationObserver.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  function setupMessageListener() {
    rt.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.type) {
        case 'SETTINGS_UPDATED':
          handleSettingsUpdate(message.settings);
          break;

        case 'GET_CONTENT_STATS':
          sendResponse(processor?.getStats() || { processed: 0, detected: 0 });
          return true;

        case 'FORCE_RESCAN':
          if (processor) {
            processor.cleanup();
            scanExistingElements();
          }
          break;
      }
    });
  }

  function handleSettingsUpdate(newSettings) {
    settings = newSettings;
    const domain = window.location.hostname;

    if (!settings.enabled || settings.excludedDomains?.includes(domain)) {
      deactivate();
      return;
    }

    if (!isActive) {
      init();
      return;
    }

    processor.updateSettings(settings);
  }

  function deactivate() {
    isActive = false;
    intersectionObserver?.disconnect();
    mutationObserver?.disconnect();
    processor?.cleanup();
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
