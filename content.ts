// Content script for CyberGuard Extension - monitors JavaScript behavior

interface Threat {
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: Record<string, any>;
  url?: string;
  userAgent?: string;
  timestamp?: number;
}

interface SuspiciousPattern {
  pattern: RegExp;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// Extend the Window interface to include our monitorexport {};declare global {  interface Window {    cyberGuardMonitor: JavaScriptMonitor;  }}

class JavaScriptMonitor {
  private detectors = new Map<string, any>();
  private originalFunctions = new Map<string, any>();
  private observedScripts = new Set<HTMLScriptElement>();
  private clipboardAccessCount = 0;
  private keyloggerIndicators = 0;
  private cryptoMinerIndicators = 0;
  
  constructor() {
    this.init();
  }

  private init(): void {
    try {
      this.injectDetectionScript();
      this.setupFunctionOverrides();
      this.monitorScriptTags();
      this.detectClipboardHijacking();
      this.detectKeyloggers();
      this.detectCryptoMiners();
      this.monitorDOMChanges();
    } catch (error) {
      console.error('CyberGuard: Failed to initialize monitoring:', error);
    }
  }

  private injectDetectionScript(): void {
    // Inject script into page context to monitor eval and Function calls
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('injected.js');
    script.onload = () => {
      script.remove();
    };
    (document.head || document.documentElement).appendChild(script);
  }

  private setupFunctionOverrides(): void {
    // Override dangerous functions to detect their usage
    this.overrideEval();
    this.overrideFunctionConstructor();
    this.overrideSetTimeout();
    this.overrideSetInterval();
  }

  private overrideEval(): void {
    const originalEval = window.eval;
    const monitor = this;
    
    (window as any).eval = function(...args: any[]) {
      monitor.reportThreat({
        type: 'Suspicious Script Execution',
        description: 'eval() function called - potential code injection',
        severity: 'high',
        details: {
          code: args[0]?.toString().substring(0, 200) + '...',
          location: monitor.getScriptLocation()
        }
      });
      return originalEval.apply(window, args);
    };
  }

  private overrideFunctionConstructor(): void {
    const originalFunction = window.Function;
    const monitor = this;
    
    (window as any).Function = function(...args: any[]) {
      if (monitor) {
        monitor.reportThreat({
          type: 'Dynamic Code Generation',
          description: 'Function constructor used - potential code injection',
          severity: 'medium',
          details: {
            code: args[args.length - 1]?.toString().substring(0, 200) + '...',
            location: monitor.getScriptLocation()
          }
        });
      }
      return new originalFunction(...args);
    };
  }

  private overrideSetTimeout(): void {
    const originalSetTimeout = window.setTimeout;
    const monitor = this;
    
    (window as any).setTimeout = function(callback: any, delay?: number, ...args: any[]) {
      if (typeof callback === 'string') {
        monitor.reportThreat({
          type: 'String-based setTimeout',
          description: 'setTimeout called with string argument - potential code injection',
          severity: 'medium',
          details: {
            code: callback.substring(0, 200) + '...',
            delay: delay
          }
        });
      }
      return originalSetTimeout.call(window, callback, delay, ...args);
    };
  }

  private overrideSetInterval(): void {
    const originalSetInterval = window.setInterval;
    const monitor = this;
    
    (window as any).setInterval = function(callback: any, delay?: number, ...args: any[]) {
      if (typeof callback === 'string') {
        monitor.reportThreat({
          type: 'String-based setInterval',
          description: 'setInterval called with string argument - potential code injection',
          severity: 'medium',
          details: {
            code: callback.substring(0, 200) + '...',
            delay: delay
          }
        });
      }
      return originalSetInterval.call(window, callback, delay, ...args);
    };
  }

  private monitorScriptTags(): void {
    // Monitor for suspicious inline scripts
    const scripts = document.querySelectorAll('script');
    scripts.forEach(script => this.analyzeScript(script as HTMLScriptElement));
  }

  private analyzeScript(script: HTMLScriptElement): void {
    if (this.observedScripts.has(script)) return;
    this.observedScripts.add(script);

    const content = script.innerHTML || script.textContent;
    if (!content) return;

    // Check for suspicious patterns
    const suspiciousPatterns: SuspiciousPattern[] = [
      { pattern: /eval\s*\(/gi, type: 'eval Usage', severity: 'high' },
      { pattern: /Function\s*\(/gi, type: 'Function Constructor', severity: 'medium' },
      { pattern: /document\.write\s*\(/gi, type: 'document.write Usage', severity: 'medium' },
      { pattern: /innerHTML\s*=\s*['"]/gi, type: 'innerHTML Assignment', severity: 'low' },
      { pattern: /crypto|bitcoin|ethereum|mining/gi, type: 'Crypto Keywords', severity: 'medium' },
      { pattern: /WebAssembly|wasm/gi, type: 'WebAssembly Usage', severity: 'medium' },
      { pattern: /atob\s*\(|btoa\s*\(/gi, type: 'Base64 Encoding/Decoding', severity: 'low' }
    ];

    suspiciousPatterns.forEach(({ pattern, type, severity }) => {
      if (pattern.test(content)) {
        this.reportThreat({
          type: `Suspicious Inline Script: ${type}`,
          description: `Script contains ${type.toLowerCase()}`,
          severity: severity,
          details: {
            scriptSrc: script.src || 'inline',
            preview: content.substring(0, 200) + '...'
          }
        });
      }
    });
  }

  private detectKeyloggers(): void {
    let keyEventCount = 0;
    const keyEventTypes: string[] = ['keydown', 'keyup', 'keypress'];
    
    keyEventTypes.forEach(eventType => {
      document.addEventListener(eventType, () => {
        keyEventCount++;
        
        // If there are many key event listeners, it might be a keylogger
        if (keyEventCount > 50) {
          this.keyloggerIndicators++;
          
          if (this.keyloggerIndicators > 3) {
            this.reportThreat({
              type: 'Potential Keylogger',
              description: 'Excessive keyboard event monitoring detected',
              severity: 'high',
              details: {
                eventCount: keyEventCount,
                indicators: this.keyloggerIndicators
              }
            });
          }
        }
      }, true);
    });

    // Monitor for form input capturing
    document.addEventListener('input', (event: Event) => {
      const target = event.target as HTMLInputElement;
      if (target && target.type === 'password') {
        this.reportThreat({
          type: 'Password Field Monitoring',
          description: 'Script is monitoring password input fields',
          severity: 'high',
          details: {
            fieldName: target.name || target.id || 'unknown'
          }
        });
      }
    }, true);
  }

  private detectClipboardHijacking(): void {
    // Monitor clipboard API usage
    const originalWriteText = navigator.clipboard?.writeText;
    const originalReadText = navigator.clipboard?.readText;
    const monitor = this;

    if (originalWriteText && navigator.clipboard) {
      navigator.clipboard.writeText = function(text: string) {
        monitor.clipboardAccessCount++;
        monitor.reportThreat({
          type: 'Clipboard Write Access',
          description: 'Script is writing to clipboard',
          severity: 'medium',
          details: {
            accessCount: monitor.clipboardAccessCount,
            content: text?.substring(0, 100) + '...'
          }
        });
        return originalWriteText.call(navigator.clipboard, text);
      };
    }

    if (originalReadText && navigator.clipboard) {
      navigator.clipboard.readText = function() {
        monitor.clipboardAccessCount++;
        monitor.reportThreat({
          type: 'Clipboard Read Access',
          description: 'Script is reading clipboard content',
          severity: 'high',
          details: {
            accessCount: monitor.clipboardAccessCount
          }
        });
        return originalReadText.call(navigator.clipboard);
      };
    }

    // Monitor for legacy clipboard events
    ['copy', 'cut', 'paste'].forEach(eventType => {
      document.addEventListener(eventType, (event: Event) => {
        if (event.isTrusted === false) {
          this.reportThreat({
            type: 'Programmatic Clipboard Event',
            description: `Programmatic ${eventType} event detected`,
            severity: 'medium',
            details: {
              eventType: eventType
            }
          });
        }
      });
    });
  }

  private detectCryptoMiners(): void {
    const monitor = this;
    
    // Monitor for WebAssembly usage (often used by crypto miners)
    const originalWebAssembly = window.WebAssembly;
    if (originalWebAssembly) {
      const originalInstantiate = originalWebAssembly.instantiate;
      (window.WebAssembly as any).instantiate = function(bytes: BufferSource | WebAssembly.Module, importObject?: any) {
        monitor.cryptoMinerIndicators++;
        monitor.reportThreat({
          type: 'WebAssembly Instantiation',
          description: 'WebAssembly module loaded - potential crypto mining',
          severity: 'high',
          details: {
            indicators: monitor.cryptoMinerIndicators
          }
        });
        return originalInstantiate.call(originalWebAssembly, bytes, importObject);
      };
    }

    // Monitor for Web Workers (often used for mining)
    const originalWorker = window.Worker;
    if (originalWorker) {
      (window as any).Worker = function(this: any, scriptURL: string | URL, options?: WorkerOptions) {
        if (monitor) {
          monitor.cryptoMinerIndicators++;
          monitor.reportThreat({
            type: 'Web Worker Creation',
            description: 'Web Worker created - potential background mining',
            severity: 'medium',
            details: {
              scriptUrl: scriptURL.toString(),
              indicators: monitor.cryptoMinerIndicators
            }
          });
        }
        return new originalWorker(scriptURL, options);
      };
    }

    // Monitor CPU usage patterns
    this.monitorCPUUsage();
  }

  private monitorCPUUsage(): void {
    let highCPUCounter = 0;
    
    setInterval(() => {
      const start = performance.now();
      // Simple CPU test
      for (let i = 0; i < 10000; i++) {
        Math.random();
      }
      const duration = performance.now() - start;
      
      if (duration > 10) { // If simple operations take too long
        highCPUCounter++;
        
        if (highCPUCounter > 5) {
          this.reportThreat({
            type: 'High CPU Usage',
            description: 'Detected sustained high CPU usage - potential crypto mining',
            severity: 'medium',
            details: {
              duration: duration,
              counter: highCPUCounter
            }
          });
          highCPUCounter = 0; // Reset to avoid spam
        }
      } else {
        highCPUCounter = Math.max(0, highCPUCounter - 1);
      }
    }, 5000);
  }

  private monitorDOMChanges(): void {
    const observer = new MutationObserver((mutations: MutationRecord[]) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              if (element.tagName === 'SCRIPT') {
                this.analyzeScript(element as HTMLScriptElement);
              }
            }
          });
        }
      });
    });

    observer.observe(document, {
      childList: true,
      subtree: true
    });
  }

  private getScriptLocation(): string {
    const stack = new Error().stack;
    const lines = stack?.split('\n') || [];
    return lines.slice(1, 3).join('\n');
  }

  public reportThreat(threat: Threat): void {
    chrome.runtime.sendMessage({
      type: 'THREAT_DETECTED',
      threat: {
        ...threat,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: Date.now()
      }
    }).catch((error: any) => {
      console.error('CyberGuard: Failed to report threat:', error);
    });
  }
}

// Initialize the monitor
window.cyberGuardMonitor = new JavaScriptMonitor();

// Listen for messages from popup
chrome.runtime.onMessage.addListener((
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void
) => {
  if (message.type === 'GET_PAGE_INFO') {
    sendResponse({
      url: window.location.href,
      title: document.title,
      scripts: document.querySelectorAll('script').length
    });
  }
}); 