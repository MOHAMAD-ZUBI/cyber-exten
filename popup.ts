// Popup script for CyberGuard Extension

interface Threat {
  id?: string;
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: Record<string, any>;
  url?: string;
  userAgent?: string;
  timestamp?: number;
}

interface PageInfo {
  url: string;
  title: string;
  scripts: number;
}

class PopupController {
  private threatsContainer: HTMLElement;
  private protectionStatus: HTMLElement;
  private pageStatus: HTMLElement;
  private scriptsCount: HTMLElement;
  private clearButton: HTMLElement;
  private currentTabId: number | null = null;

  constructor() {
    this.threatsContainer = document.getElementById('threats-container')!;
    this.protectionStatus = document.getElementById('protection-status')!;
    this.pageStatus = document.getElementById('page-status')!;
    this.scriptsCount = document.getElementById('scripts-count')!;
    this.clearButton = document.getElementById('clear-threats')!;

    this.init();
  }

  private async init(): Promise<void> {
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

  private async getCurrentTab(): Promise<void> {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          this.currentTabId = tabs[0].id!;
        }
        resolve();
      });
    });
  }

  private async loadPageInfo(): Promise<void> {
    if (!this.currentTabId) return;

    try {
      const response = await chrome.tabs.sendMessage(this.currentTabId, {
        type: 'GET_PAGE_INFO'
      }) as PageInfo;

      this.scriptsCount.textContent = response.scripts.toString();
      
      // Update page status based on URL
      if (response.url.startsWith('chrome://') || response.url.startsWith('chrome-extension://')) {
        this.pageStatus.textContent = 'System Page';
        this.pageStatus.className = 'status-value';
      }
    } catch (error) {
      console.error('Failed to get page info:', error);
      this.pageStatus.textContent = 'Unknown';
      this.pageStatus.className = 'status-value';
    }
  }

  private async loadThreats(): Promise<void> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_THREATS',
        tabId: this.currentTabId
      });

      const threats: Threat[] = response.threats || [];
      this.displayThreats(threats);
      this.updatePageStatus(threats);
    } catch (error) {
      console.error('Failed to load threats:', error);
      this.showError('Failed to load threat data');
    }
  }

  private displayThreats(threats: Threat[]): void {
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

  private createThreatElement(threat: Threat): HTMLElement {
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

  private createThreatDetails(details: Record<string, any>): string {
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

  private updatePageStatus(threats: Threat[]): void {
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

  private setupEventListeners(): void {
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

  private showError(message: string): void {
    this.threatsContainer.innerHTML = `
      <div class="no-threats">
        <div class="icon">❌</div>
        <div>${this.escapeHtml(message)}</div>
      </div>
    `;
  }

  private escapeHtml(unsafe: string): string {
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