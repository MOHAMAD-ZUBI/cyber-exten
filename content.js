// Content script for CyberGuard Extension - monitors JavaScript behavior

console.log('CyberGuard: Content script loaded on', window.location.href);

class JavaScriptMonitor {
  constructor() {
    this.detectors = new Map();
    this.originalFunctions = new Map();
    this.observedScripts = new Set();
    this.clipboardAccessCount = 0;
    this.keyloggerIndicators = 0;
    this.cryptoMinerIndicators = 0;
    
    this.init();
  }

  init() {
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

  injectDetectionScript() {
    // Inject script into page context to monitor eval and Function calls
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('injected.js');
    script.onload = () => {
      script.remove();
    };
    (document.head || document.documentElement).appendChild(script);

    // Listen for events from injected script
    window.addEventListener('cyberguard-detection', (event) => {
      const data = event.detail;
      
      if (data.type === 'CYBERGUARD_EVAL_DETECTED') {
        this.reportThreat({
          type: 'eval() Usage in Page Context',
          description: 'eval() function called in page context',
          severity: 'high',
          details: {
            code: data.code,
            timestamp: data.timestamp
          }
        });
      } else if (data.type === 'CYBERGUARD_FUNCTION_DETECTED') {
        this.reportThreat({
          type: 'Function Constructor in Page Context',
          description: 'Function constructor used in page context',
          severity: 'medium',
          details: {
            code: data.code,
            args: data.args,
            timestamp: data.timestamp
          }
        });
      } else if (data.type === 'CYBERGUARD_CONSOLE_SUSPICIOUS') {
        this.reportThreat({
          type: 'Suspicious Console Output',
          description: 'Console output contains sensitive keywords',
          severity: 'medium',
          details: {
            message: data.message,
            timestamp: data.timestamp
          }
        });
      } else if (data.type === 'CYBERGUARD_WEBRTC_DETECTED') {
        this.reportThreat({
          type: 'WebRTC Usage',
          description: 'WebRTC connection initiated - potential IP tracking',
          severity: 'low',
          details: {
            configuration: data.configuration,
            timestamp: data.timestamp
          }
        });
      } else if (data.type === 'CYBERGUARD_GEOLOCATION_DETECTED') {
        this.reportThreat({
          type: 'Geolocation Access',
          description: 'Script is accessing geolocation',
          severity: 'medium',
          details: {
            timestamp: data.timestamp
          }
        });
      } else if (data.type === 'CYBERGUARD_SUSPICIOUS_FETCH') {
        this.reportThreat({
          type: 'Suspicious Network Request',
          description: 'Request to crypto/mining related URL',
          severity: 'high',
          details: {
            url: data.url,
            timestamp: data.timestamp
          }
        });
      } else if (data.type === 'CYBERGUARD_CANVAS_DETECTED') {
        this.reportThreat({
          type: 'Canvas Fingerprinting',
          description: 'Canvas context access - potential fingerprinting',
          severity: 'low',
          details: {
            contextType: data.contextType,
            timestamp: data.timestamp
          }
        });
      }
    });
  }

  setupFunctionOverrides() {
    // Override dangerous functions to detect their usage
    this.overrideEval();
    this.overrideFunctionConstructor();
    this.overrideSetTimeout();
    this.overrideSetInterval();
  }

  overrideEval() {
    const originalEval = window.eval;
    const monitor = this;
    
    window.eval = function(...args) {
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

  overrideFunctionConstructor() {
    const originalFunction = window.Function;
    const monitor = this;
    
    window.Function = function(...args) {
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

  overrideSetTimeout() {
    const originalSetTimeout = window.setTimeout;
    const monitor = this;
    
    window.setTimeout = function(callback, delay, ...args) {
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

  overrideSetInterval() {
    const originalSetInterval = window.setInterval;
    const monitor = this;
    
    window.setInterval = function(callback, delay, ...args) {
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

  monitorScriptTags() {
    // Monitor for suspicious inline scripts
    const scripts = document.querySelectorAll('script');
    scripts.forEach(script => this.analyzeScript(script));
  }

  analyzeScript(script) {
    if (this.observedScripts.has(script)) return;
    this.observedScripts.add(script);

    const content = script.innerHTML || script.textContent;
    if (!content) return;

    // Check for suspicious patterns
    const suspiciousPatterns = [
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

  detectKeyloggers() {
    let keyEventCount = 0;
    const keyEventTypes = ['keydown', 'keyup', 'keypress'];
    
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
    document.addEventListener('input', (event) => {
      const target = event.target;
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

  detectClipboardHijacking() {
    // Monitor clipboard API usage
    const originalWriteText = navigator.clipboard?.writeText;
    const originalReadText = navigator.clipboard?.readText;
    const monitor = this;

    if (originalWriteText && navigator.clipboard) {
      navigator.clipboard.writeText = function(text) {
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
      document.addEventListener(eventType, (event) => {
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

  detectCryptoMiners() {
    const monitor = this;
    
    // Monitor for WebAssembly usage (often used by crypto miners)
    const originalWebAssembly = window.WebAssembly;
    if (originalWebAssembly) {
      const originalInstantiate = originalWebAssembly.instantiate;
      window.WebAssembly.instantiate = function(bytes, importObject) {
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
      window.Worker = function(scriptURL, options) {
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

  monitorCPUUsage() {
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

  monitorDOMChanges() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node;
              if (element.tagName === 'SCRIPT') {
                this.analyzeScript(element);
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

  getScriptLocation() {
    const stack = new Error().stack;
    const lines = stack?.split('\n') || [];
    return lines.slice(1, 3).join('\n');
  }

  reportThreat(threat) {
    chrome.runtime.sendMessage({
      type: 'THREAT_DETECTED',
      threat: {
        ...threat,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: Date.now()
      }
    }).catch((error) => {
      console.error('CyberGuard: Failed to report threat:', error);
    });
  }
}

// Initialize the monitor
window.cyberGuardMonitor = new JavaScriptMonitor();

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('CyberGuard: Received message:', message);
  
  if (message.type === 'GET_PAGE_INFO') {
    const response = {
      url: window.location.href,
      title: document.title,
      scripts: document.querySelectorAll('script').length
    };
    console.log('CyberGuard: Sending response:', response);
    sendResponse(response);
    return true;
  }
});

console.log('CyberGuard: Content script fully initialized'); 