// Injected script that runs in page context to monitor JavaScript functions

(function() {
  'use strict';

  // Store original functions
  const originalEval = window.eval;
  const originalFunction = window.Function;
  const originalSetTimeout = window.setTimeout;
  const originalSetInterval = window.setInterval;

  // Helper function to send messages to content script
  function reportToContentScript(threat: any) {
    window.postMessage({
      type: 'CYBERGUARD_THREAT',
      threat: threat,
      source: 'injected'
    }, '*');
  }

  // Override eval to detect its usage
  (window as any).eval = function(...args: any[]) {
    reportToContentScript({
      type: 'eval() Usage in Page Context',
      description: 'Direct eval() call detected in page context',
      severity: 'high',
      details: {
        code: args[0]?.toString().substring(0, 200) + '...',
        timestamp: Date.now()
      }
    });
    return originalEval.apply(window, args);
  };

  // Override Function constructor
  (window as any).Function = function(...args: any[]) {
    reportToContentScript({
      type: 'Function Constructor in Page Context',
      description: 'Function constructor used in page context',
      severity: 'medium',
      details: {
        code: args[args.length - 1]?.toString().substring(0, 200) + '...',
        timestamp: Date.now()
      }
    });
    return new originalFunction(...args);
  };

  // Override setTimeout with string
  (window as any).setTimeout = function(callback: any, delay?: number, ...args: any[]) {
    if (typeof callback === 'string') {
      reportToContentScript({
        type: 'String setTimeout in Page Context',
        description: 'setTimeout called with string in page context',
        severity: 'medium',
        details: {
          code: callback.substring(0, 200) + '...',
          delay: delay,
          timestamp: Date.now()
        }
      });
    }
    return originalSetTimeout.call(window, callback, delay, ...args);
  };

  // Override setInterval with string
  (window as any).setInterval = function(callback: any, delay?: number, ...args: any[]) {
    if (typeof callback === 'string') {
      reportToContentScript({
        type: 'String setInterval in Page Context',
        description: 'setInterval called with string in page context',
        severity: 'medium',
        details: {
          code: callback.substring(0, 200) + '...',
          delay: delay,
          timestamp: Date.now()
        }
      });
    }
    return originalSetInterval.call(window, callback, delay, ...args);
  };

  // Monitor DOM manipulation methods
  const originalCreateElement = document.createElement;
  document.createElement = function(tagName: string, options?: ElementCreationOptions) {
    const element = originalCreateElement.call(document, tagName, options);
    
    if (tagName.toLowerCase() === 'script') {
      reportToContentScript({
        type: 'Dynamic Script Creation',
        description: 'Script element created dynamically',
        severity: 'low',
        details: {
          tagName: tagName,
          timestamp: Date.now()
        }
      });
    }
    
    return element;
  };

  // Monitor for inline event handlers
  const originalSetAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function(name: string, value: string) {
    if (name.toLowerCase().startsWith('on')) {
      reportToContentScript({
        type: 'Inline Event Handler',
        description: `Inline event handler ${name} set via setAttribute`,
        severity: 'medium',
        details: {
          attribute: name,
          value: value.substring(0, 200) + '...',
          timestamp: Date.now()
        }
      });
    }
    return originalSetAttribute.call(this, name, value);
  };

  // Listen for messages from content script
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    
    if (event.data.type === 'CYBERGUARD_THREAT' && event.data.source === 'injected') {
      // Forward threat to content script via custom event
      const threatEvent = new CustomEvent('cyberguard-threat', {
        detail: event.data.threat
      });
      document.dispatchEvent(threatEvent);
    }
  });

  console.log('CyberGuard: Injected script loaded and monitoring page context');
})(); 