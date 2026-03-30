/**
 * Popup Script
 * Manages the extension popup UI, settings synchronization, and domain exclusion controls.
 * Cross-browser compatible: Chrome, Brave, Safari (macOS/iOS), Firefox.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Cross-browser API reference
  const api = (typeof browserAPI !== 'undefined') ? browserAPI : null;
  const rawApi = (typeof browser !== 'undefined') ? browser : chrome;

  const elements = {
    enableToggle: document.getElementById('enableToggle'),
    processImages: document.getElementById('processImages'),
    processVideos: document.getElementById('processVideos'),
    blurIntensity: document.getElementById('blurIntensity'),
    blurValue: document.getElementById('blurValue'),
    confidenceThreshold: document.getElementById('confidenceThreshold'),
    confidenceValue: document.getElementById('confidenceValue'),
    currentDomain: document.getElementById('currentDomain'),
    toggleDomain: document.getElementById('toggleDomain'),
    domainList: document.getElementById('domainList'),
    statProcessed: document.getElementById('statProcessed'),
    statDetected: document.getElementById('statDetected'),
    rescanBtn: document.getElementById('rescanBtn'),
    engineBtns: document.querySelectorAll('.engine-btn'),
  };

  let settings = {};
  let currentDomain = '';

  // Load settings
  const response = await sendMessage({ type: 'GET_SETTINGS' });
  settings = response?.settings || {};
  applySettingsToUI(settings);

  // Get current tab domain
  const tabs = await queryTabs({ active: true, currentWindow: true });
  const tab = tabs?.[0];
  if (tab?.url) {
    try {
      currentDomain = new URL(tab.url).hostname;
      elements.currentDomain.textContent = currentDomain;
      updateDomainButton();
    } catch {
      elements.currentDomain.textContent = 'N/A';
    }
  }

  // Load stats
  loadStats(tab?.id);

  // Event Listeners
  elements.enableToggle.addEventListener('change', () => {
    updateSetting('enabled', elements.enableToggle.checked);
  });

  elements.processImages.addEventListener('change', () => {
    updateSetting('processImages', elements.processImages.checked);
  });

  elements.processVideos.addEventListener('change', () => {
    updateSetting('processVideos', elements.processVideos.checked);
  });

  elements.blurIntensity.addEventListener('input', () => {
    elements.blurValue.textContent = elements.blurIntensity.value + 'px';
  });

  elements.blurIntensity.addEventListener('change', () => {
    updateSetting('blurIntensity', parseInt(elements.blurIntensity.value, 10));
  });

  elements.confidenceThreshold.addEventListener('input', () => {
    elements.confidenceValue.textContent = elements.confidenceThreshold.value + '%';
  });

  elements.confidenceThreshold.addEventListener('change', () => {
    updateSetting('confidenceThreshold', parseInt(elements.confidenceThreshold.value, 10) / 100);
  });

  elements.engineBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      elements.engineBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateSetting('detectionEngine', btn.dataset.engine);
    });
  });

  elements.toggleDomain.addEventListener('click', async () => {
    if (!currentDomain) return;
    await sendMessage({ type: 'TOGGLE_DOMAIN', domain: currentDomain });
    const resp = await sendMessage({ type: 'GET_SETTINGS' });
    settings = resp?.settings || settings;
    updateDomainButton();
    renderDomainList();
  });

  elements.rescanBtn.addEventListener('click', async () => {
    if (tab?.id) {
      await sendTabMessage(tab.id, { type: 'FORCE_RESCAN' });
      setTimeout(() => loadStats(tab.id), 1000);
    }
  });

  function applySettingsToUI(s) {
    elements.enableToggle.checked = s.enabled !== false;
    elements.processImages.checked = s.processImages !== false;
    elements.processVideos.checked = s.processVideos !== false;
    elements.blurIntensity.value = s.blurIntensity || 25;
    elements.blurValue.textContent = (s.blurIntensity || 25) + 'px';

    const confidence = Math.round((s.confidenceThreshold || 0.6) * 100);
    elements.confidenceThreshold.value = confidence;
    elements.confidenceValue.textContent = confidence + '%';

    elements.engineBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.engine === (s.detectionEngine || 'hybrid'));
    });

    renderDomainList();
  }

  async function updateSetting(key, value) {
    settings[key] = value;
    await sendMessage({ type: 'UPDATE_SETTINGS', settings: { [key]: value } });
  }

  function updateDomainButton() {
    const excluded = (settings.excludedDomains || []).includes(currentDomain);
    elements.toggleDomain.textContent = excluded ? 'Include' : 'Exclude';
    elements.toggleDomain.classList.toggle('excluded', excluded);
  }

  function renderDomainList() {
    const domains = settings.excludedDomains || [];
    if (domains.length === 0) {
      elements.domainList.innerHTML = '<p class="empty-state">No excluded domains</p>';
      return;
    }

    elements.domainList.innerHTML = domains.map(d => `
      <div class="domain-item">
        <span class="domain-name">${escapeHtml(d)}</span>
        <button class="remove-btn" data-domain="${escapeHtml(d)}" title="Remove">&times;</button>
      </div>
    `).join('');

    elements.domainList.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        await sendMessage({ type: 'TOGGLE_DOMAIN', domain: btn.dataset.domain });
        const resp = await sendMessage({ type: 'GET_SETTINGS' });
        settings = resp?.settings || settings;
        updateDomainButton();
        renderDomainList();
      });
    });
  }

  async function loadStats(tabId) {
    if (!tabId) return;
    try {
      const stats = await sendTabMessage(tabId, { type: 'GET_CONTENT_STATS' });
      elements.statProcessed.textContent = stats?.processed || 0;
      elements.statDetected.textContent = stats?.detected || 0;
    } catch {
      elements.statProcessed.textContent = '0';
      elements.statDetected.textContent = '0';
    }
  }

  /**
   * Cross-browser runtime.sendMessage
   */
  function sendMessage(msg) {
    if (api) return api.runtime.sendMessage(msg);
    return new Promise((resolve) => {
      rawApi.runtime.sendMessage(msg, (response) => {
        resolve(response);
      });
    });
  }

  /**
   * Cross-browser tabs.query
   */
  function queryTabs(query) {
    if (api) return api.tabs.query(query);
    return new Promise((resolve) => {
      rawApi.tabs.query(query, resolve);
    });
  }

  /**
   * Cross-browser tabs.sendMessage
   */
  function sendTabMessage(tabId, msg) {
    if (api) return api.tabs.sendMessage(tabId, msg);
    return new Promise((resolve) => {
      rawApi.tabs.sendMessage(tabId, msg, (response) => {
        resolve(response);
      });
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
});
