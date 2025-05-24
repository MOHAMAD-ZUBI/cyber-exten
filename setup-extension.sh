#!/bin/bash

# CyberGuard Extension Setup Script

echo "🛡️ Setting up CyberGuard Extension..."

# Create JavaScript files from TypeScript (temporary workaround)
echo "📄 Converting TypeScript files to JavaScript..."

cp background.ts background.js
cp content.ts content.js
cp popup.ts popup.js
cp injected.ts injected.js

# Create basic placeholder icons
echo "🎨 Creating placeholder icons..."

# Create simple SVG icons (you can replace these with actual icons)
cat > icons/icon-16.svg << 'EOF'
<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
  <rect width="16" height="16" fill="#4A90E2"/>
  <text x="8" y="12" text-anchor="middle" fill="white" font-size="12" font-family="Arial">🛡</text>
</svg>
EOF

cat > icons/icon-32.svg << 'EOF'
<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
  <rect width="32" height="32" fill="#4A90E2"/>
  <text x="16" y="22" text-anchor="middle" fill="white" font-size="20" font-family="Arial">🛡</text>
</svg>
EOF

cat > icons/icon-48.svg << 'EOF'
<svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" fill="#4A90E2"/>
  <text x="24" y="32" text-anchor="middle" fill="white" font-size="28" font-family="Arial">🛡</text>
</svg>
EOF

cat > icons/icon-128.svg << 'EOF'
<svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
  <rect width="128" height="128" fill="#4A90E2"/>
  <text x="64" y="85" text-anchor="middle" fill="white" font-size="72" font-family="Arial">🛡</text>
</svg>
EOF

# Note: For actual usage, convert SVGs to PNG files
echo "⚠️  Note: Convert SVG icons to PNG files for production use"

echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Fix TypeScript compilation errors in the .ts files"
echo "2. Convert SVG icons to PNG format"
echo "3. Open Chrome and go to chrome://extensions/"
echo "4. Enable 'Developer mode'"
echo "5. Click 'Load unpacked' and select this directory"
echo ""
echo "🔍 The extension will monitor JavaScript behavior and show threats in the popup." 