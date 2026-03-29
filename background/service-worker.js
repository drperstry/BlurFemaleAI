/**
 * Background Service Worker
 * Manages extension state, domain exclusions, and messaging between popup and content scripts.
 */

const DEFAULT_SETTINGS = {
  enabled: true,
  detectionEngine: 'hybrid', // 'faceapi' | 'tensorflow' | 'hybrid'
  blurIntensity: 25,
  excludedDomains: [],
  processImages: true,
  processVideos: true,
  confidenceThreshold: 0.6,
};

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get('settings');
  if (!existing.settings) {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
  const { settings } = await chrome.storage.local.get('settings');
  sendResponse({ settings: settings || DEFAULT_SETTINGS });
}

async function handleUpdateSettings(newSettings, sendResponse) {
  const { settings } = await chrome.storage.local.get('settings');
  const merged = { ...settings, ...newSettings };
  await chrome.storage.local.set({ settings: merged });
  sendResponse({ settings: merged });
  notifyAllTabs({ type: 'SETTINGS_UPDATED', settings: merged });
}

async function handleGetDomainStatus(domain, sendResponse) {
  const { settings } = await chrome.storage.local.get('settings');
  const excluded = (settings?.excludedDomains || []).includes(domain);
  sendResponse({ excluded, enabled: settings?.enabled ?? true });
}

async function handleToggleDomain(domain, sendResponse) {
  const { settings } = await chrome.storage.local.get('settings');
  const domains = settings.excludedDomains || [];
  const index = domains.indexOf(domain);

  if (index === -1) {
    domains.push(domain);
  } else {
    domains.splice(index, 1);
  }

  settings.excludedDomains = domains;
  await chrome.storage.local.set({ settings });
  sendResponse({ excluded: index === -1, domains });
  notifyAllTabs({ type: 'SETTINGS_UPDATED', settings });
}

async function handleGetStats(tabId, sendResponse) {
  if (!tabId) {
    sendResponse({ error: 'No tab ID' });
    return;
  }
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: 'GET_CONTENT_STATS' });
    sendResponse(response);
  } catch {
    sendResponse({ processed: 0, detected: 0 });
  }
}

async function notifyAllTabs(message) {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    try {
      await chrome.tabs.sendMessage(tab.id, message);
    } catch {
      // Tab may not have content script injected
    }
  }
}
