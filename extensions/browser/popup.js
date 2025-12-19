/**
 * Music Companion Browser Extension - Popup Script
 */

document.addEventListener('DOMContentLoaded', async () => {
  const statusEl = document.getElementById('status');
  const categoryEl = document.getElementById('category');
  const lastSyncEl = document.getElementById('lastSync');
  const toggleEl = document.getElementById('toggle');
  const syncNowBtn = document.getElementById('syncNow');
  const openAppBtn = document.getElementById('openApp');
  
  // Load initial status
  await updateStatus();
  
  // Toggle click handler
  toggleEl.addEventListener('click', async () => {
    const response = await chrome.runtime.sendMessage({ type: 'TOGGLE_ENABLED' });
    toggleEl.classList.toggle('active', response.enabled);
    await updateStatus();
  });
  
  // Sync now button
  syncNowBtn.addEventListener('click', async () => {
    syncNowBtn.textContent = 'Syncing...';
    syncNowBtn.disabled = true;
    
    const response = await chrome.runtime.sendMessage({ type: 'SEND_NOW' });
    
    if (response.success) {
      if (response.skipped) {
        syncNowBtn.textContent = 'Skipped (audio site)';
      } else {
        syncNowBtn.textContent = 'Synced!';
      }
    } else {
      syncNowBtn.textContent = 'Failed';
    }
    
    await updateStatus();
    
    setTimeout(() => {
      syncNowBtn.textContent = 'Sync Now';
      syncNowBtn.disabled = false;
    }, 2000);
  });
  
  // Open app button
  openAppBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_APP' });
    window.close();
  });
  
  async function updateStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
      
      // Update toggle
      toggleEl.classList.toggle('active', response.enabled);
      
      // Update status text
      statusEl.textContent = response.enabled ? 'Active' : 'Paused';
      statusEl.className = 'status-value ' + (response.enabled ? 'connected' : 'disconnected');
      
      // Update category
      if (response.lastCategory && response.lastCategory !== 'none') {
        categoryEl.innerHTML = `<span class="category-badge">${response.lastCategory}</span>`;
      } else {
        categoryEl.innerHTML = `<span class="category-badge">-</span>`;
      }
      
      // Update last sync
      if (response.lastSync) {
        const date = new Date(response.lastSync);
        const now = new Date();
        const diff = Math.floor((now - date) / 1000);
        
        if (diff < 60) {
          lastSyncEl.textContent = 'Just now';
        } else if (diff < 3600) {
          lastSyncEl.textContent = `${Math.floor(diff / 60)}m ago`;
        } else {
          lastSyncEl.textContent = date.toLocaleTimeString();
        }
      } else {
        lastSyncEl.textContent = 'Never';
      }
    } catch (error) {
      statusEl.textContent = 'Error';
      statusEl.className = 'status-value disconnected';
    }
  }
});
