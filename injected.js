// Injected script that runs in page context to monitor native function calls

(function() {
  // Save references to original functions
  const originalEval = window.eval;
  const originalFunction = window.Function;
  
  // Override eval function
  window.eval = function(code) {
    // Send message to content script
    window.postMessage({
      type: 'CYBERGUARD_EVAL_DETECTED',
      code: code.toString().substring(0, 200) + (code.length > 200 ? '...' : ''),
      timestamp: Date.now()
    }, '*');
    
    return originalEval.call(window, code);
  };
  
  // Override Function constructor
  window.Function = function(...args) {
    const code = args[args.length - 1];
    
    window.postMessage({
      type: 'CYBERGUARD_FUNCTION_DETECTED',
      code: code?.toString().substring(0, 200) + (code?.length > 200 ? '...' : ''),
      args: args.slice(0, -1),
      timestamp: Date.now()
    }, '*');
    
    return new originalFunction(...args);
  };
  
  // Monitor for suspicious console usage
  const originalConsoleLog = console.log;
  console.log = function(...args) {
    const message = args.join(' ');
    
    // Check for suspicious console patterns
    if (message.includes('password') || 
        message.includes('token') || 
        message.includes('auth') ||
        message.includes('secret')) {
      window.postMessage({
        type: 'CYBERGUARD_CONSOLE_SUSPICIOUS',
        message: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
        timestamp: Date.now()
      }, '*');
    }
    
    return originalConsoleLog.apply(console, args);
  };
  
  // Monitor for WebRTC usage (can be used for IP tracking)
  const originalRTCPeerConnection = window.RTCPeerConnection;
  if (originalRTCPeerConnection) {
    window.RTCPeerConnection = function(configuration) {
      window.postMessage({
        type: 'CYBERGUARD_WEBRTC_DETECTED',
        configuration: JSON.stringify(configuration).substring(0, 200),
        timestamp: Date.now()
      }, '*');
      
      return new originalRTCPeerConnection(configuration);
    };
  }
  
  // Monitor for Geolocation API usage
  if (navigator.geolocation) {
    const originalGetCurrentPosition = navigator.geolocation.getCurrentPosition;
    navigator.geolocation.getCurrentPosition = function(success, error, options) {
      window.postMessage({
        type: 'CYBERGUARD_GEOLOCATION_DETECTED',
        timestamp: Date.now()
      }, '*');
      
      return originalGetCurrentPosition.call(navigator.geolocation, success, error, options);
    };
  }
  
  // Monitor for unusual network requests
  const originalFetch = window.fetch;
  window.fetch = function(input, init) {
    const url = typeof input === 'string' ? input : input.url;
    
    // Check for suspicious URLs
    if (url.includes('bitcoin') || 
        url.includes('crypto') || 
        url.includes('mining') ||
        url.includes('wallet')) {
      window.postMessage({
        type: 'CYBERGUARD_SUSPICIOUS_FETCH',
        url: url.substring(0, 200),
        timestamp: Date.now()
      }, '*');
    }
    
    return originalFetch.call(window, input, init);
  };
  
  // Monitor for canvas fingerprinting
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(contextType, contextAttributes) {
    if (contextType === '2d' || contextType === 'webgl') {
      window.postMessage({
        type: 'CYBERGUARD_CANVAS_DETECTED',
        contextType: contextType,
        timestamp: Date.now()
      }, '*');
    }
    
    return originalGetContext.call(this, contextType, contextAttributes);
  };
  
  // Listen for postMessage events from our overrides
  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    
    const data = event.data;
    if (!data.type || !data.type.startsWith('CYBERGUARD_')) return;
    
    // Send to content script
    const detail = { detail: data };
    window.dispatchEvent(new CustomEvent('cyberguard-detection', detail));
  });
})(); 