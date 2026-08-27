/**
 * Popup script for Threads Country Flags extension
 */

const STORAGE_PREFIX = 'country_';

// Apply i18n to all elements with data-i18n attribute
document.documentElement.lang = chrome.i18n.getUILanguage();
document.querySelectorAll('[data-i18n]').forEach(el => {
  el.textContent = chrome.i18n.getMessage(el.dataset.i18n);
});

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

/**
 * Read every persisted country entry
 * @returns {Promise<Object>} Map of storage key → stored value
 */
async function getCountryItems() {
  const allItems = await chrome.storage.local.get(null);
  return Object.fromEntries(
    Object.entries(allItems).filter(([key]) => key.startsWith(STORAGE_PREFIX))
  );
}

async function clearAllCaches() {
  const countryKeys = Object.keys(await getCountryItems());
  await chrome.storage.local.remove(countryKeys);
}

async function getStorageStats() {
  try {
    const countryItems = await getCountryItems();
    const countryKeys = Object.keys(countryItems);

    // Calculate storage size for country entries only
    const storageBytes = new Blob([JSON.stringify(countryItems)]).size;

    return {
      storageSize: countryKeys.length,
      storageBytes: storageBytes
    };
  } catch (error) {
    console.error('Error getting storage stats:', error);
    return { storageSize: 0, storageBytes: 0 };
  }
}

async function updateStats() {
  try {
    const storageStats = await getStorageStats();

    document.getElementById('storageSize').textContent = storageStats.storageSize;
    document.getElementById('storageBytes').textContent = formatBytes(storageStats.storageBytes);
  } catch (error) {
    console.error('Error fetching stats:', error);
  }
}

// Clear cache button handler
document.getElementById('clearCache').addEventListener('click', async () => {
  const button = document.getElementById('clearCache');
  const successMessage = document.getElementById('successMessage');
  const errorMessage = document.getElementById('errorMessage');

  button.disabled = true;
  button.textContent = chrome.i18n.getMessage('buttonClearing');

  try {
    await clearAllCaches();
    successMessage.style.display = 'block';
    await updateStats();
    setTimeout(() => { successMessage.style.display = 'none'; }, 2000);
  } catch (error) {
    console.error('Error clearing cache:', error);
    errorMessage.style.display = 'block';
    setTimeout(() => { errorMessage.style.display = 'none'; }, 2000);
  } finally {
    button.disabled = false;
    button.textContent = chrome.i18n.getMessage('buttonClearCache');
  }
});

const manifest = chrome.runtime.getManifest();
document.getElementById('versionText').textContent = `Version ${manifest.version}`;

// Initialize
updateStats();

