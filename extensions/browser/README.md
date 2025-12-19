# Music Companion Browser Extension

Smart music suggestions based on your browsing activity.

## Features

- 🌐 **Domain Detection**: Categorizes websites (coding, social, reading, etc.)
- 🎵 **Smart Skipping**: Avoids interference with video/music sites
- 🔄 **Auto-Sync**: Automatically sends context updates
- 🎨 **Clean Popup**: Status display and manual controls

## Installation

### Chrome/Edge (Development Mode)

1. Open `chrome://extensions` (or `edge://extensions`)
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `extensions/browser` folder

### Firefox

Manifest v3 is not fully supported in Firefox yet. A Firefox version will be available soon.

## How It Works

The extension categorizes websites and suggests appropriate music:

| Category | Example Sites | Suggested Mood |
|----------|---------------|----------------|
| **Coding** | GitHub, StackOverflow, MDN | Focused |
| **Reading** | Medium, Dev.to, Reddit | Calm |
| **Social** | Twitter, Instagram, LinkedIn | Upbeat |
| **Video** | YouTube, Netflix, Twitch | *Skipped* |
| **Music** | Spotify, SoundCloud | *Skipped* |
| **Productivity** | Docs, Figma, Trello | Steady |

*Skipped = Extension pauses to avoid audio conflicts*

## Popup Controls

- **Toggle**: Enable/disable auto-sync
- **Sync Now**: Manually send current context
- **Open App**: Launch Music Companion

## Permissions

- `tabs`: Read current tab URL/title
- `activeTab`: Access active tab
- `storage`: Save settings

## Icons

The extension uses placeholder text for icons. To add proper icons:

1. Create 16x16, 48x48, and 128x128 PNG files
2. Save to `extensions/browser/icons/`
3. Name them `icon16.png`, `icon48.png`, `icon128.png`
