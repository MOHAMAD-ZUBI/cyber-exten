// Minimal test content script
console.log('CyberGuard: Test content script loaded on', window.location.href);

// Simple message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('CyberGuard: Test script received message:', message);
  
  if (message.type === 'GET_PAGE_INFO') {
    const response = {
      url: window.location.href,
      title: document.title,
      scripts: document.querySelectorAll('script').length
    };
    console.log('CyberGuard: Test script sending response:', response);
    sendResponse(response);
    return true;
  }
});

console.log('CyberGuard: Test script ready'); 