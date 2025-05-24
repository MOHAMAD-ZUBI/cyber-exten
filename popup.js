// Popup script for CyberGuard Extension

class PopupController {
  constructor() {
    this.threatsContainer = document.getElementById('threats-container');
    this.protectionStatus = document.getElementById('protection-status');
    this.pageStatus = document.getElementById('page-status');
    this.scriptsCount = document.getElementById('scripts-count');
    this.clearButton = document.getElementById('clear-threats');
    this.currentTabId = null;

    this.init();
  }

  async init() {
    try {
      await this.getCurrentTab();
      await this.loadPageInfo();
      await this.loadThreats();
      this.setupEventListeners();
    } catch (error) {
      console.error('Failed to initialize popup:', error);
      this.showError('Failed to load extension data');
    }
  }

  async getCurrentTab() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          this.currentTabId = tabs[0].id;
        }
        resolve();
      });
    });
  }

  async loadPageInfo() {
    if (!this.currentTabId) return;

    try {
      // Get tab info directly first
      const tab = await chrome.tabs.get(this.currentTabId);
      const url = tab.url || '';
      
      console.log('Current tab URL:', url);

      // Check if this is a system page
      if (this.isSystemPage(url)) {
        this.scriptsCount.textContent = 'N/A';
        this.pageStatus.textContent = 'System Page';
        this.pageStatus.className = 'status-value';
        return;
      }

      // Check if this is a restricted domain
      if (this.isRestrictedDomain(url)) {
        this.scriptsCount.textContent = 'N/A';
        this.pageStatus.textContent = 'Restricted Site';
        this.pageStatus.className = 'status-value';
        return;
      }

      // Try to communicate with content script
      try {
        const response = await chrome.tabs.sendMessage(this.currentTabId, {
          type: 'GET_PAGE_INFO'
        });

        if (response && response.scripts !== undefined) {
          this.scriptsCount.textContent = response.scripts.toString();
          this.pageStatus.textContent = 'Active';
          this.pageStatus.className = 'status-value status-safe';
        } else {
          this.scriptsCount.textContent = '0';
          this.pageStatus.textContent = 'No Response';
          this.pageStatus.className = 'status-value';
        }
        
      } catch (messageError) {
        console.log('Content script not responding, trying to inject:', messageError.message);
        
        // Try multiple injection strategies
        const injectionSuccess = await this.tryContentScriptInjection();
        
        if (!injectionSuccess) {
          // Final fallback - manual script counting
          try {
            const scriptCountResult = await chrome.scripting.executeScript({
              target: { tabId: this.currentTabId },
              func: () => document.querySelectorAll('script').length
            });
            
            if (scriptCountResult && scriptCountResult[0] && scriptCountResult[0].result !== undefined) {
              this.scriptsCount.textContent = scriptCountResult[0].result.toString();
              this.pageStatus.textContent = 'Limited Monitoring';
              this.pageStatus.className = 'status-value status-warning';
            } else {
              this.handleMonitoringBlocked(url);
            }
          } catch (fallbackError) {
            console.log('Fallback script counting failed:', fallbackError.message);
            this.handleMonitoringBlocked(url);
          }
        }
      }
      
    } catch (error) {
      console.error('Failed to get page info:', error);
      this.scriptsCount.textContent = 'Unknown';
      this.pageStatus.textContent = 'Error';
      this.pageStatus.className = 'status-value';
    }
  }

  async tryContentScriptInjection() {
    try {
      // First try: Inject content script
      await chrome.scripting.executeScript({
        target: { tabId: this.currentTabId },
        files: ['content.js']
      });
      
      // Wait and test communication
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const response = await chrome.tabs.sendMessage(this.currentTabId, {
        type: 'GET_PAGE_INFO'
      });
      
      if (response && response.scripts !== undefined) {
        this.scriptsCount.textContent = response.scripts.toString();
        this.pageStatus.textContent = 'Injected';
        this.pageStatus.className = 'status-value status-safe';
        return true;
      }
      
      return false;
      
    } catch (injectError) {
      console.log('Content script injection failed:', injectError.message);
      
      // Second try: Inject minimal monitoring script
      try {
        await chrome.scripting.executeScript({
          target: { tabId: this.currentTabId },
          func: () => {
            // Minimal monitoring setup
            window.cyberGuardMinimal = {
              scriptCount: document.querySelectorAll('script').length,
              initialized: true
            };
            
            // Simple message listener
            chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
              if (message.type === 'GET_PAGE_INFO') {
                sendResponse({
                  scripts: window.cyberGuardMinimal.scriptCount,
                  url: window.location.href,
                  title: document.title,
                  minimal: true
                });
                return true;
              }
            });
          }
        });
        
        // Test minimal script
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const minimalResponse = await chrome.tabs.sendMessage(this.currentTabId, {
          type: 'GET_PAGE_INFO'
        });
        
        if (minimalResponse && minimalResponse.scripts !== undefined) {
          this.scriptsCount.textContent = minimalResponse.scripts.toString();
          this.pageStatus.textContent = 'Minimal Mode';
          this.pageStatus.className = 'status-value status-warning';
          return true;
        }
        
      } catch (minimalError) {
        console.log('Minimal injection also failed:', minimalError.message);
      }
      
      return false;
    }
  }

  handleMonitoringBlocked(url) {
    this.scriptsCount.textContent = 'Blocked';
    
    // Determine why monitoring is blocked
    if (url.includes('admin') || url.includes('dashboard') || url.includes('edit')) {
      this.pageStatus.textContent = 'Admin Panel Detected';
    } else if (url.includes('bank') || url.includes('secure') || url.includes('payment')) {
      this.pageStatus.textContent = 'Secure Site';
    } else {
      this.pageStatus.textContent = 'CSP Protected';
    }
    
    this.pageStatus.className = 'status-value';
    
    // Show explanation in threats container
    this.threatsContainer.innerHTML = `
      <div class="no-threats">
        <div class="icon">🔒</div>
        <div style="font-weight: bold;">Monitoring Blocked</div>
        <div style="font-size: 12px; margin-top: 8px; opacity: 0.8;">
          This website has security measures that prevent content script injection.
          This is common on admin panels, secure sites, and sites with strict CSP.
        </div>
        <div style="font-size: 11px; margin-top: 8px; opacity: 0.6;">
          URL: ${url.substring(0, 50)}...
        </div>
      </div>
    `;
  }

  isSystemPage(url) {
    if (!url) return true;
    
    const systemPrefixes = [
      'chrome://',
      'chrome-extension://',
      'edge://',
      'about:',
      'moz-extension://',
      'file://',
      'data:',
      'javascript:'
    ];
    
    return systemPrefixes.some(prefix => url.startsWith(prefix));
  }

  isRestrictedDomain(url) {
    if (!url) return false;
    
    // Common domains that often block content scripts
    const restrictedPatterns = [
      'chrome.google.com',
      'chromewebstore.google.com',
      'addons.mozilla.org',
      'microsoftedge.microsoft.com',
      // Banking and financial
      'bank',
      'paypal',
      'stripe',
      // Developer tools and admin
      'github.com/settings',
      'gitlab.com/admin',
      // Google services
      'accounts.google.com',
      'myaccount.google.com'
    ];
    
    return restrictedPatterns.some(pattern => url.includes(pattern));
  }

  async loadThreats() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_THREATS',
        tabId: this.currentTabId
      });

      const threats = response.threats || [];
      this.displayThreats(threats);
      this.updatePageStatus(threats);
    } catch (error) {
      console.error('Failed to load threats:', error);
      // Don't show error if threats container already has monitoring blocked message
      if (!this.threatsContainer.innerHTML.includes('Monitoring Blocked')) {
      this.showError('Failed to load threat data');
      }
    }
  }

  displayThreats(threats) {
    // Don't overwrite monitoring blocked message
    if (this.threatsContainer.innerHTML.includes('Monitoring Blocked')) {
      return;
    }

    this.threatsContainer.innerHTML = '';

    if (threats.length === 0) {
      this.threatsContainer.innerHTML = `
        <div class="no-threats">
          <div class="icon">✅</div>
          <div>No threats detected</div>
          <div style="font-size: 12px; margin-top: 8px; opacity: 0.7;">
            This page appears to be safe
          </div>
        </div>
      `;
      return;
    }

    // Sort threats by severity and timestamp
    const sortedThreats = threats.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      if (severityDiff !== 0) return severityDiff;
      return (b.timestamp || 0) - (a.timestamp || 0);
    });

    sortedThreats.forEach(threat => {
      const threatElement = this.createThreatElement(threat);
      this.threatsContainer.appendChild(threatElement);
    });
  }

  createThreatElement(threat) {
    const element = document.createElement('div');
    element.className = `threat-item ${threat.severity}`;

    const timeStr = threat.timestamp ? 
      new Date(threat.timestamp).toLocaleTimeString() : 
      'Unknown time';

    element.innerHTML = `
      <div class="threat-type">${this.escapeHtml(threat.type)}</div>
      <div class="threat-description">${this.escapeHtml(threat.description)}</div>
      ${this.createThreatDetails(threat.details)}
      <div class="threat-meta">
        <span class="severity">${threat.severity.toUpperCase()}</span>
        <span class="time">${timeStr}</span>
      </div>
    `;

    return element;
  }

  createThreatDetails(details) {
    if (!details || Object.keys(details).length === 0) {
      return '';
    }

    const detailsHtml = Object.entries(details)
      .filter(([key, value]) => value !== undefined && value !== null)
      .map(([key, value]) => {
        let displayValue = String(value);
        if (displayValue.length > 100) {
          displayValue = displayValue.substring(0, 100) + '...';
        }
        return `<div><strong>${this.escapeHtml(key)}:</strong> ${this.escapeHtml(displayValue)}</div>`;
      })
      .join('');

    return `<div class="threat-details">${detailsHtml}</div>`;
  }

  updatePageStatus(threats) {
    // Don't override status if monitoring is blocked
    if (this.pageStatus.textContent.includes('Blocked') || 
        this.pageStatus.textContent.includes('Admin') ||
        this.pageStatus.textContent.includes('CSP') ||
        this.pageStatus.textContent.includes('Secure')) {
      return;
    }

    if (threats.length === 0) {
      this.pageStatus.textContent = 'Safe';
      this.pageStatus.className = 'status-value status-safe';
      return;
    }

    const hasHighSeverity = threats.some(t => t.severity === 'critical' || t.severity === 'high');
    const hasMediumSeverity = threats.some(t => t.severity === 'medium');

    if (hasHighSeverity) {
      this.pageStatus.textContent = 'Dangerous';
      this.pageStatus.className = 'status-value status-danger';
    } else if (hasMediumSeverity) {
      this.pageStatus.textContent = 'Suspicious';
      this.pageStatus.className = 'status-value status-warning';
    } else {
      this.pageStatus.textContent = 'Minor Issues';
      this.pageStatus.className = 'status-value status-warning';
    }
  }

  setupEventListeners() {
    this.clearButton.addEventListener('click', async () => {
      try {
        await chrome.runtime.sendMessage({
          type: 'CLEAR_THREATS',
          tabId: this.currentTabId
        });
        
        await this.loadThreats();
      } catch (error) {
        console.error('Failed to clear threats:', error);
      }
    });

    // Refresh data every 5 seconds
    setInterval(() => {
      this.loadThreats();
    }, 5000);
  }

  showError(message) {
    this.threatsContainer.innerHTML = `
      <div class="no-threats">
        <div class="icon">❌</div>
        <div>${this.escapeHtml(message)}</div>
      </div>
    `;
  }

  escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
}); 