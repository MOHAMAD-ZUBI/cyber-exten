// Background service worker for CyberGuard Extension

interface Threat {
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: Record<string, any>;
  url?: string;
  userAgent?: string;
  timestamp?: number;
  id?: string;
}

interface ThreatMessage {
  type: 'THREAT_DETECTED';
  threat: Threat;
}

interface GetThreatsMessage {
  type: 'GET_THREATS';
  tabId?: number;
}

interface ClearThreatsMessage {
  type: 'CLEAR_THREATS';
  tabId?: number;
}

type ExtensionMessage = ThreatMessage | GetThreatsMessage | ClearThreatsMessage;

class ThreatDetector {
  private threats = new Map<number, Threat[]>();
  private tabThreats = new Map<number, Threat[]>();

  constructor() {
    this.initializeListeners();
  }

  private initializeListeners(): void {
    // Listen for messages from content scripts
    chrome.runtime.onMessage.addListener((
      message: ExtensionMessage,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response: any) => void
    ) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep the message channel open for async response
    });

    // Listen for tab updates
    chrome.tabs.onUpdated.addListener((
      tabId: number,
      changeInfo: chrome.tabs.TabChangeInfo,
      tab: chrome.tabs.Tab
    ) => {
      if (changeInfo.status === 'loading') {
        this.clearTabThreats(tabId);
      }
    });

    // Clean up when tabs are closed
    chrome.tabs.onRemoved.addListener((tabId: number) => {
      this.clearTabThreats(tabId);
    });
  }

  private handleMessage(
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: any) => void
  ): void {
    const tabId = sender.tab?.id;
    
    switch (message.type) {
      case 'THREAT_DETECTED':
        if (tabId) {
          this.recordThreat(tabId, message.threat);
          this.notifyUser(tabId, message.threat);
        }
        sendResponse({ status: 'recorded' });
        break;
        
      case 'GET_THREATS':
        sendResponse({ 
          threats: this.getTabThreats(tabId || message.tabId || 0),
          totalThreats: this.getTotalThreats()
        });
        break;
        
      case 'CLEAR_THREATS':
        this.clearTabThreats(tabId || message.tabId || 0);
        sendResponse({ status: 'cleared' });
        break;
        
      default:
        sendResponse({ error: 'Unknown message type' });
    }
  }

  private recordThreat(tabId: number, threat: Threat): void {
    if (!this.tabThreats.has(tabId)) {
      this.tabThreats.set(tabId, []);
    }
    
    const threats = this.tabThreats.get(tabId)!;
    const threatWithTimestamp: Threat = {
      ...threat,
      timestamp: Date.now(),
      id: this.generateThreatId()
    };
    
    threats.push(threatWithTimestamp);
    
    // Update badge
    this.updateBadge(tabId);
    
    // Store in persistent storage
    this.storeThreat(threatWithTimestamp);
  }

  private notifyUser(tabId: number, threat: Threat): void {
    // Update the extension icon badge
    const count = this.getTabThreats(tabId).length;
    
    chrome.action.setBadgeText({
      text: count > 0 ? count.toString() : '',
      tabId: tabId
    });
    
    chrome.action.setBadgeBackgroundColor({
      color: this.getBadgeColor(threat.severity),
      tabId: tabId
    });

    // Show notification for high-severity threats
    if (threat.severity === 'high' || threat.severity === 'critical') {
      if (chrome.notifications) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon-48.png',
          title: 'CyberGuard Alert',
          message: `${threat.type} detected: ${threat.description}`
        });
      }
    }
  }

  private getBadgeColor(severity: Threat['severity']): string {
    switch (severity) {
      case 'critical': return '#FF0000';
      case 'high': return '#FF4500';
      case 'medium': return '#FFA500';
      case 'low': return '#FFFF00';
      default: return '#808080';
    }
  }

  private updateBadge(tabId: number): void {
    const threats = this.getTabThreats(tabId);
    const count = threats.length;
    
    chrome.action.setBadgeText({
      text: count > 0 ? count.toString() : '',
      tabId: tabId
    });
    
    // Set color based on highest severity
    const highestSeverity = this.getHighestSeverity(threats);
    chrome.action.setBadgeBackgroundColor({
      color: this.getBadgeColor(highestSeverity),
      tabId: tabId
    });
  }

  private getHighestSeverity(threats: Threat[]): Threat['severity'] {
    const severityOrder: Threat['severity'][] = ['low', 'medium', 'high', 'critical'];
    let highest: Threat['severity'] = 'low';
    
    threats.forEach(threat => {
      const currentIndex = severityOrder.indexOf(threat.severity);
      const highestIndex = severityOrder.indexOf(highest);
      
      if (currentIndex > highestIndex) {
        highest = threat.severity;
      }
    });
    
    return highest;
  }

  private getTabThreats(tabId: number): Threat[] {
    return this.tabThreats.get(tabId) || [];
  }

  private getTotalThreats(): number {
    let total = 0;
    this.tabThreats.forEach(threats => {
      total += threats.length;
    });
    return total;
  }

  private clearTabThreats(tabId: number): void {
    this.tabThreats.delete(tabId);
    chrome.action.setBadgeText({ text: '', tabId: tabId });
  }

  private generateThreatId(): string {
    return `threat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async storeThreat(threat: Threat): Promise<void> {
    try {
      const { storedThreats = [] } = await chrome.storage.local.get(['storedThreats']);
      storedThreats.push(threat);
      
      // Keep only last 1000 threats
      if (storedThreats.length > 1000) {
        storedThreats.splice(0, storedThreats.length - 1000);
      }
      
      await chrome.storage.local.set({ storedThreats });
    } catch (error) {
      console.error('Failed to store threat:', error);
    }
  }
}

// Initialize the threat detector
const threatDetector = new ThreatDetector();

// Add notification permission if available
if (chrome.notifications) {
  chrome.runtime.onInstalled.addListener(() => {
    chrome.notifications.onClicked.addListener(() => {
      chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
    });
  });
} 