# Music Companion VS Code Extension

Integrates with Music Companion to suggest music based on your coding activity.

## Features

- 🎯 **Activity Detection**: Detects if you're writing, reading, or debugging
- 🔤 **Language Awareness**: Suggests different music based on file type
- ⏱️ **Session Tracking**: Adjusts suggestions based on coding duration
- 🔄 **Auto-Sync**: Automatically sends context updates

## Installation

### Development Mode

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Click "..." menu → "Install from VSIX..."
4. Or press F5 in this folder to run in debug mode

### Building VSIX

```bash
cd extensions/vscode
npm install
npm run compile
npx vsce package
```

## Configuration

Open VS Code Settings and search for "Music Companion":

| Setting | Default | Description |
|---------|---------|-------------|
| `musicCompanion.enabled` | `true` | Enable/disable the extension |
| `musicCompanion.serverUrl` | `http://localhost:3001` | Backend server URL |
| `musicCompanion.autoSync` | `true` | Auto-send context updates |
| `musicCompanion.syncInterval` | `30` | Seconds between syncs |

## Commands

- **Music Companion: Send Current Context** - Manually sync context
- **Music Companion: Toggle Auto-Sync** - Enable/disable auto-sync
- **Music Companion: Open App** - Open Music Companion in browser

## How It Works

The extension detects:

1. **File Type** → Language-specific music moods
2. **Activity** → Writing vs Reading vs Debugging
3. **Session Duration** → Energy suggestions after long sessions

### Language Mood Mapping

| Language | Suggested Mood |
|----------|----------------|
| TypeScript | Deep Focus |
| Python | Analytical |
| Rust | Intense Focus |
| CSS/HTML | Creative |
| Markdown | Calm |
