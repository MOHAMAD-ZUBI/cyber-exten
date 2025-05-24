# CyberGuard Browser Extension

A comprehensive browser extension that monitors JavaScript execution and detects malicious behavior on web pages.

## Features

- **Real-time JavaScript Monitoring**: Detects suspicious script execution patterns
- **Keylogger Detection**: Identifies excessive keyboard event monitoring
- **Clipboard Hijacking Protection**: Monitors unauthorized clipboard access
- **Crypto Mining Detection**: Detects WebAssembly usage and Web Workers that might indicate mining
- **Dangerous Function Detection**: Monitors usage of `eval()`, `Function()`, and string-based timeouts
- **Visual Threat Display**: Beautiful popup interface showing detected threats with severity levels

## Threat Detection Capabilities

### High Severity Threats
- `eval()` function usage - potential code injection
- Clipboard read access - data theft attempts
- WebAssembly instantiation - potential crypto mining
- Password field monitoring - keylogging attempts

### Medium Severity Threats
- Function constructor usage - dynamic code generation
- Clipboard write access - clipboard hijacking
- String-based setTimeout/setInterval - code injection
- Web Worker creation - potential background mining
- Inline event handlers - DOM manipulation

### Low Severity Threats
- Base64 encoding/decoding - obfuscation attempts
- innerHTML assignments - DOM manipulation
- Dynamic script creation - runtime modifications

## Installation

### For Development

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Build the Extension** (when TypeScript is fixed)
   ```bash
   npm run build:extension
   ```

3. **Load in Browser**
   - Open Chrome/Edge and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select this directory

### Manual Setup (Current)

Since we have TypeScript compilation issues, you can manually rename the `.ts` files to `.js` files for testing:

```bash
# Rename TypeScript files to JavaScript (temporary solution)
cp background.ts background.js
cp content.ts content.js  
cp popup.ts popup.js
cp injected.ts injected.js
```

## File Structure

```
cyber-exten/
├── manifest.json          # Extension manifest
├── background.ts          # Background service worker
├── content.ts            # Content script (monitors pages)
├── injected.ts           # Page context script
├── popup.html            # Extension popup UI
├── popup.ts              # Popup logic
├── icons/                # Extension icons
└── tsconfig.extension.json # TypeScript config
```

## How It Works

1. **Content Script** (`content.ts`): Runs on every webpage and monitors JavaScript behavior
2. **Injected Script** (`injected.ts`): Runs in page context to monitor native function calls
3. **Background Script** (`background.ts`): Manages threat data and handles extension logic
4. **Popup Interface** (`popup.html` + `popup.ts`): Displays detected threats to users

## Security Features

- **Function Override Protection**: Monitors dangerous JavaScript functions
- **DOM Monitoring**: Tracks dynamic script injection and modifications
- **Event Listener Analysis**: Detects excessive keyboard/mouse monitoring
- **CPU Usage Monitoring**: Identifies potential crypto mining activity
- **Real-time Threat Classification**: Categorizes threats by severity level

## Browser Compatibility

- ✅ Chrome (Manifest V3)
- ✅ Microsoft Edge (Manifest V3)
- ✅ Firefox (with minor modifications)

## Privacy

- All monitoring happens locally in the browser
- No data is sent to external servers
- Threat data is stored locally and can be cleared anytime

## Development

To work on the extension:

1. Make changes to TypeScript files
2. Run `npm run dev:extension` for watch mode
3. Reload the extension in browser development tools

## Known Issues

- TypeScript compilation needs fixing for some function overrides
- Icon files need to be created for the extension
- Firefox compatibility requires manifest adjustments

## Contributing

This extension was built as a security monitoring tool. Feel free to extend its capabilities by adding new threat detection patterns or improving the user interface.

## License

Open source - use and modify as needed for security research and protection. 