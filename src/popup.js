/**
 * Popup script for Threads Country Flags extension
 */

// Update statistics
async function updateStats() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATS' });
    document.getElementById('memorySize').textContent = response.memorySize || 0;
    document.getElementById('pendingRequests').textContent = response.pendingRequests || 0;
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
    await chrome.runtime.sendMessage({ type: 'CLEAR_CACHE' });

    // Show success message
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

// Update stats every 2 seconds
setInterval(updateStats, 2000);
