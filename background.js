// Background script for CyberGuard Extension

class ThreatDetector {
  constructor() {
    this.threats = new Map();
    this.maxThreats = 1000;
    
    this.init();
  }

  init() {
    // Listen for messages from content scripts
    chrome.runtime.onMessage.addListener(
      (request, sender, sendResponse) => {
        this.handleMessage(request, sender, sendResponse);
        return true; // Keep message channel open for async response
      }
    );

    // Update badge on tab changes
    chrome.tabs.onActivated.addListener((activeInfo) => {
      this.updateBadge(activeInfo.tabId);
    });

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url) {
        this.updateBadge(tabId);
      }
    });
  }

  handleMessage(request, sender, sendResponse) {
    try {
      switch (request.type) {
        case 'THREAT_DETECTED':
          this.addThreat(request.threat, sender.tab?.id);
          sendResponse({ success: true });
          break;
        
        case 'GET_THREATS':
          const threats = this.getThreats(request.tabId);
          sendResponse({ threats });
          break;
        
        case 'CLEAR_THREATS':
          this.clearThreats(request.tabId);
          sendResponse({ success: true });
          break;
        
        default:
          sendResponse({ error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('CyberGuard: Error handling message:', error);
      sendResponse({ error: error.message });
    }
  }

  addThreat(threat, tabId) {
    if (!tabId) return;

    const threatId = this.generateThreatId();
    const enhancedThreat = {
      id: threatId,
      ...threat,
      tabId,
      timestamp: Date.now()
    };

    // Get or create threats array for this tab
    let tabThreats = this.threats.get(tabId) || [];
    tabThreats.push(enhancedThreat);

    // Limit number of threats per tab
    if (tabThreats.length > this.maxThreats) {
      tabThreats = tabThreats.slice(-this.maxThreats);
    }

    this.threats.set(tabId, tabThreats);
    
    // Update badge for this tab
    this.updateBadge(tabId);
    
    // Show notification for high-severity threats
    if (threat.severity === 'high' || threat.severity === 'critical') {
      this.showNotification(enhancedThreat);
    }

    // Store in chrome.storage for persistence
    this.saveThreats();
  }

  getThreats(tabId) {
    return this.threats.get(tabId) || [];
  }

  clearThreats(tabId) {
    this.threats.delete(tabId);
    this.updateBadge(tabId);
    this.saveThreats();
  }

  updateBadge(tabId) {
    const threats = this.getThreats(tabId);
    const highSeverityThreats = threats.filter(
      t => t.severity === 'high' || t.severity === 'critical'
    );

    let badgeText = '';
    let badgeColor = '#4CAF50'; // Green for safe

    if (highSeverityThreats.length > 0) {
      badgeText = highSeverityThreats.length.toString();
      badgeColor = '#F44336'; // Red for danger
    } else if (threats.length > 0) {
      badgeText = threats.length.toString();
      badgeColor = '#FF9800'; // Orange for warnings
    }

    try {
      chrome.action.setBadgeText({
        text: badgeText,
        tabId: tabId
      });

      chrome.action.setBadgeBackgroundColor({
        color: badgeColor,
        tabId: tabId
      });
    } catch (error) {
      console.log('Badge update failed:', error);
    }
  }

  showNotification(threat) {
    if (chrome.notifications && chrome.notifications.create) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'CyberGuard Alert',
        message: `${threat.type}: ${threat.description}`,
        priority: threat.severity === 'critical' ? 2 : 1
      }).catch(error => {
        console.log('Notification failed:', error);
      });
    }
  }

  generateThreatId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  async saveThreats() {
    try {
      const threatsObject = {};
      this.threats.forEach((threats, tabId) => {
        threatsObject[tabId] = threats;
      });
      
      await chrome.storage.local.set({ threats: threatsObject });
    } catch (error) {
      console.error('Failed to save threats:', error);
    }
  }

  async loadThreats() {
    try {
      const result = await chrome.storage.local.get(['threats']);
      if (result.threats) {
        Object.entries(result.threats).forEach(([tabId, threats]) => {
          this.threats.set(parseInt(tabId), threats);
        });
      }
    } catch (error) {
      console.error('Failed to load threats:', error);
    }
  }
}

// Initialize the threat detector
const threatDetector = new ThreatDetector();

// Load saved threats on startup
threatDetector.loadThreats();

// Setup notification click handler
if (chrome.notifications) {
  chrome.runtime.onInstalled.addListener(() => {
    chrome.notifications.onClicked.addListener(() => {
      chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
    });
  });
} 