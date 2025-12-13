/**
 * Popup script for Threads Country Flags extension
 */

const STORAGE_PREFIX = 'country_';

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

async function getStorageStats() {
  try {
    const allItems = await chrome.storage.local.get(null);
    const countryKeys = Object.keys(allItems).filter(key => key.startsWith(STORAGE_PREFIX));

    // Calculate approximate storage size
    const storageString = JSON.stringify(allItems);
    const storageBytes = new Blob([storageString]).size;

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

  button.disabled = true;
  button.textContent = 'Clearing...';

  try {
    // Clear background cache
    await chrome.runtime.sendMessage({ type: 'CLEAR_CACHE' });

    // Show success message
    successMessage.textContent = 'Cache cleared successfully!';
    successMessage.style.display = 'block';

    // Update stats
    await updateStats();

    // Reset button
    button.disabled = false;
    button.textContent = 'Clear Cache';

    // Hide success message after 2 seconds
    setTimeout(() => {
      successMessage.style.display = 'none';
    }, 2000);
  } catch (error) {
    console.error('Error clearing cache:', error);
    button.disabled = false;
    button.textContent = 'Clear Cache';
    alert('Failed to clear cache');
  }
});

// Initialize
updateStats();

// Update stats when popup opens
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    updateStats();
  }
});
