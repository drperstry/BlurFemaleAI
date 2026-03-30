/**
 * Background Service Worker
 * Manages extension state, domain exclusions, and messaging between popup and content scripts.
 * Cross-browser compatible: Chrome, Brave, Safari (macOS/iOS), Firefox.
 */

importScripts('../lib/browser-polyfill.js');

const DEFAULT_SETTINGS = {
  enabled: true,
  detectionEngine: 'hybrid', // 'faceapi' | 'tensorflow' | 'hybrid'
  blurIntensity: 25,
  excludedDomains: [],
  processImages: true,
  processVideos: true,
  confidenceThreshold: 0.6,
};

browserAPI.runtime.onInstalled.addListener(async () => {
  try {
    const existing = await browserAPI.storage.local.get('settings');
    if (!existing.settings) {
      await browserAPI.storage.local.set({ settings: DEFAULT_SETTINGS });
    }
  } catch (err) {
    console.error('[BlurFemaleAI] Failed to initialize settings:', err);
  }
});

browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'GET_SETTINGS':
      handleGetSettings(sendResponse);
      return true;

    case 'UPDATE_SETTINGS':
      handleUpdateSettings(message.settings, sendResponse);
      return true;

    case 'GET_DOMAIN_STATUS':
      handleGetDomainStatus(message.domain, sendResponse);
      return true;

    case 'TOGGLE_DOMAIN':
      handleToggleDomain(message.domain, sendResponse);
      return true;

    case 'GET_STATS':
      handleGetStats(sender.tab?.id, sendResponse);
      return true;
  }
  return false;
});

async function handleGetSettings(sendResponse) {
  try {
    const { settings } = await browserAPI.storage.local.get('settings');
    sendResponse({ settings: settings || DEFAULT_SETTINGS });
  } catch {
    sendResponse({ settings: DEFAULT_SETTINGS });
  }
}

async function handleUpdateSettings(newSettings, sendResponse) {
  try {
    const { settings } = await browserAPI.storage.local.get('settings');
    const merged = { ...settings, ...newSettings };
    await browserAPI.storage.local.set({ settings: merged });
    sendResponse({ settings: merged });
    notifyAllTabs({ type: 'SETTINGS_UPDATED', settings: merged });
  } catch (err) {
    console.error('[BlurFemaleAI] Failed to update settings:', err);
    sendResponse({ error: err.message });
  }
}

async function handleGetDomainStatus(domain, sendResponse) {
  try {
    const { settings } = await browserAPI.storage.local.get('settings');
    const excluded = (settings?.excludedDomains || []).includes(domain);
    sendResponse({ excluded, enabled: settings?.enabled ?? true });
  } catch {
    sendResponse({ excluded: false, enabled: true });
  }
}

async function handleToggleDomain(domain, sendResponse) {
  try {
    const { settings } = await browserAPI.storage.local.get('settings');
    const domains = settings.excludedDomains || [];
    const index = domains.indexOf(domain);

    if (index === -1) {
      domains.push(domain);
    } else {
      domains.splice(index, 1);
    }

    settings.excludedDomains = domains;
    await browserAPI.storage.local.set({ settings });
    sendResponse({ excluded: index === -1, domains });
    notifyAllTabs({ type: 'SETTINGS_UPDATED', settings });
  } catch (err) {
    console.error('[BlurFemaleAI] Failed to toggle domain:', err);
    sendResponse({ error: err.message });
  }
}

async function handleGetStats(tabId, sendResponse) {
  if (!tabId) {
    sendResponse({ error: 'No tab ID' });
    return;
  }
  try {
    const response = await browserAPI.tabs.sendMessage(tabId, { type: 'GET_CONTENT_STATS' });
    sendResponse(response || { processed: 0, detected: 0 });
  } catch {
    sendResponse({ processed: 0, detected: 0 });
  }
}

async function notifyAllTabs(message) {
  try {
    const tabs = await browserAPI.tabs.query({});
    for (const tab of tabs) {
      try {
        await browserAPI.tabs.sendMessage(tab.id, message);
      } catch {
        // Tab may not have content script injected
      }
    }
  } catch {
    // Query may fail in restricted contexts
  }
}
