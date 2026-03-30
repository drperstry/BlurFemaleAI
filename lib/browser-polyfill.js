/**
 * Cross-Browser API Compatibility Layer
 * Normalizes the WebExtension API across Chrome, Brave, Safari, and Firefox.
 * Provides a unified `browserAPI` object that works everywhere.
 */

(function (global) {
  'use strict';

  const api = typeof browser !== 'undefined' ? browser : chrome;

  /**
   * Wraps callback-based chrome.* APIs into Promise-based ones.
   * Firefox/Safari `browser.*` already returns promises; Chrome does not.
   */
  function promisify(fn, context) {
    return function (...args) {
      return new Promise((resolve, reject) => {
        try {
          if (typeof browser !== 'undefined') {
            // Firefox/Safari: already Promise-based
            const result = fn.apply(context, args);
            if (result && typeof result.then === 'function') {
              result.then(resolve).catch(reject);
            } else {
              resolve(result);
            }
          } else {
            // Chrome/Brave: callback-based
            fn.apply(context, [...args, (result) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve(result);
              }
            }]);
          }
        } catch (err) {
          reject(err);
        }
      });
    };
  }

  const browserAPI = {
    /**
     * Runtime APIs
     */
    runtime: {
      getURL: (path) => api.runtime.getURL(path),

      sendMessage: (message) => {
        return new Promise((resolve) => {
          api.runtime.sendMessage(message, (response) => {
            if (api.runtime?.lastError) {
              // Silently resolve — receiver may not exist
              resolve(undefined);
            } else {
              resolve(response);
            }
          });
        });
      },

      onMessage: {
        addListener: (callback) => api.runtime.onMessage.addListener(callback),
        removeListener: (callback) => api.runtime.onMessage.removeListener(callback),
      },

      onInstalled: {
        addListener: (callback) => api.runtime.onInstalled.addListener(callback),
      },
    },

    /**
     * Storage APIs
     */
    storage: {
      local: {
        get: (keys) => {
          return new Promise((resolve, reject) => {
            api.storage.local.get(keys, (result) => {
              if (api.runtime?.lastError) {
                reject(new Error(api.runtime.lastError.message));
              } else {
                resolve(result);
              }
            });
          });
        },
        set: (items) => {
          return new Promise((resolve, reject) => {
            api.storage.local.set(items, () => {
              if (api.runtime?.lastError) {
                reject(new Error(api.runtime.lastError.message));
              } else {
                resolve();
              }
            });
          });
        },
      },
    },

    /**
     * Tabs APIs
     */
    tabs: {
      query: (queryInfo) => {
        return new Promise((resolve, reject) => {
          api.tabs.query(queryInfo, (tabs) => {
            if (api.runtime?.lastError) {
              reject(new Error(api.runtime.lastError.message));
            } else {
              resolve(tabs);
            }
          });
        });
      },

      sendMessage: (tabId, message) => {
        return new Promise((resolve) => {
          api.tabs.sendMessage(tabId, message, (response) => {
            if (api.runtime?.lastError) {
              resolve(undefined);
            } else {
              resolve(response);
            }
          });
        });
      },
    },

    /**
     * Detect current browser environment
     */
    getBrowser: () => {
      const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';

      if (/Firefox/.test(ua)) return 'firefox';
      if (/Safari/.test(ua) && !/Chrome/.test(ua)) return 'safari';
      if (/Brave/.test(ua) || (typeof navigator !== 'undefined' && navigator.brave)) return 'brave';
      if (/Edg\//.test(ua)) return 'edge';
      if (/Chrome/.test(ua)) return 'chrome';
      return 'unknown';
    },

    /**
     * Detect if running on mobile
     */
    isMobile: () => {
      if (typeof navigator === 'undefined') return false;
      return /Android|iPhone|iPad|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    },

    /**
     * Detect if running on iOS
     */
    isIOS: () => {
      if (typeof navigator === 'undefined') return false;
      return /iPhone|iPad|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    },

    /**
     * Raw API reference (for advanced use)
     */
    raw: api,
  };

  // Export for both module and global contexts
  if (typeof globalThis !== 'undefined') {
    globalThis.browserAPI = browserAPI;
  }
  global.browserAPI = browserAPI;

})(typeof self !== 'undefined' ? self : typeof window !== 'undefined' ? window : this);
