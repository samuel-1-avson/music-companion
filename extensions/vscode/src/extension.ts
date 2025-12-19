/**
 * Music Companion VS Code Extension
 * Detects coding context and sends it to Music Companion for smart music suggestions
 */
import * as vscode from 'vscode';
import axios from 'axios';

// Configuration
let config = {
    enabled: true,
    serverUrl: 'http://localhost:3001',
    autoSync: true,
    syncInterval: 30
};

// State
let statusBarItem: vscode.StatusBarItem;
let syncTimer: NodeJS.Timeout | undefined;
let sessionStartTime: number = Date.now();
let lastContext: string = '';

// Language to mood mapping
const LANGUAGE_MOODS: Record<string, string> = {
    // High focus languages
    'typescript': 'deep-focus',
    'javascript': 'focused',
    'python': 'analytical',
    'rust': 'intense-focus',
    'go': 'steady',
    'java': 'structured',
    'c': 'deep-concentration',
    'cpp': 'deep-concentration',
    
    // Creative languages
    'html': 'creative',
    'css': 'creative',
    'scss': 'creative',
    'markdown': 'calm',
    
    // Data/Config
    'json': 'routine',
    'yaml': 'routine',
    'xml': 'routine',
    
    // Default
    'default': 'coding'
};

export function activate(context: vscode.ExtensionContext) {
    console.log('Music Companion extension activated');
    
    // Load configuration
    loadConfig();
    
    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'musicCompanion.sendContext';
    updateStatusBar('idle');
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
    
    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('musicCompanion.sendContext', () => {
            sendContext(true);
        }),
        
        vscode.commands.registerCommand('musicCompanion.toggleAutoSync', () => {
            config.autoSync = !config.autoSync;
            vscode.window.showInformationMessage(
                `Music Companion auto-sync ${config.autoSync ? 'enabled' : 'disabled'}`
            );
            if (config.autoSync) {
                startAutoSync();
            } else {
                stopAutoSync();
            }
        }),
        
        vscode.commands.registerCommand('musicCompanion.openApp', () => {
            vscode.env.openExternal(vscode.Uri.parse('http://localhost:5173'));
        })
    );
    
    // Event listeners
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor && config.autoSync) {
                sendContext();
            }
        }),
        
        vscode.debug.onDidStartDebugSession(() => {
            sendContext(false, 'debug-started');
        }),
        
        vscode.debug.onDidTerminateDebugSession(() => {
            sendContext(false, 'debug-ended');
        }),
        
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('musicCompanion')) {
                loadConfig();
            }
        })
    );
    
    // Start auto-sync if enabled
    if (config.autoSync) {
        startAutoSync();
    }
    
    // Initial context send
    setTimeout(() => sendContext(), 2000);
}

function loadConfig() {
    const cfg = vscode.workspace.getConfiguration('musicCompanion');
    config = {
        enabled: cfg.get('enabled', true),
        serverUrl: cfg.get('serverUrl', 'http://localhost:3001'),
        autoSync: cfg.get('autoSync', true),
        syncInterval: cfg.get('syncInterval', 30)
    };
}

function startAutoSync() {
    stopAutoSync();
    syncTimer = setInterval(() => {
        if (config.enabled && config.autoSync) {
            sendContext();
        }
    }, config.syncInterval * 1000);
}

function stopAutoSync() {
    if (syncTimer) {
        clearInterval(syncTimer);
        syncTimer = undefined;
    }
}

function updateStatusBar(status: 'idle' | 'syncing' | 'synced' | 'error') {
    const icons: Record<string, string> = {
        idle: '$(music)',
        syncing: '$(sync~spin)',
        synced: '$(check)',
        error: '$(warning)'
    };
    statusBarItem.text = `${icons[status]} Music Companion`;
    statusBarItem.tooltip = `Click to sync context | Status: ${status}`;
}

async function sendContext(manual: boolean = false, event?: string) {
    if (!config.enabled) return;
    
    const editor = vscode.window.activeTextEditor;
    const context = buildContext(editor, event);
    
    // Avoid sending duplicate contexts
    const contextKey = JSON.stringify(context);
    if (!manual && contextKey === lastContext) {
        return;
    }
    lastContext = contextKey;
    
    updateStatusBar('syncing');
    
    try {
        await axios.post(`${config.serverUrl}/api/dev/context`, {
            source: 'vscode',
            ...context
        }, {
            timeout: 5000
        });
        
        updateStatusBar('synced');
        
        if (manual) {
            vscode.window.showInformationMessage(`Music Companion: Sent ${context.activity} context`);
        }
        
        // Reset to idle after 3 seconds
        setTimeout(() => updateStatusBar('idle'), 3000);
    } catch (error: any) {
        updateStatusBar('error');
        
        if (manual) {
            vscode.window.showWarningMessage(
                `Music Companion: Could not connect to server. Is the backend running?`
            );
        }
        
        setTimeout(() => updateStatusBar('idle'), 5000);
    }
}

function buildContext(editor: vscode.TextEditor | undefined, event?: string) {
    const sessionDuration = Math.floor((Date.now() - sessionStartTime) / 1000 / 60); // minutes
    
    // Determine activity type
    let activity = 'idle';
    let mood = 'calm';
    let language = 'none';
    let fileName = '';
    
    if (event === 'debug-started') {
        activity = 'debugging';
        mood = 'intense-focus';
    } else if (event === 'debug-ended') {
        activity = 'coding';
        mood = 'focused';
    } else if (editor) {
        const doc = editor.document;
        language = doc.languageId;
        fileName = doc.fileName.split(/[/\\]/).pop() || '';
        
        // Determine mood based on language
        mood = LANGUAGE_MOODS[language] || LANGUAGE_MOODS.default;
        
        // Determine activity
        if (vscode.debug.activeDebugSession) {
            activity = 'debugging';
            mood = 'intense-focus';
        } else if (doc.isDirty) {
            activity = 'writing';
        } else {
            activity = 'reading';
        }
    }
    
    // Adjust based on session duration
    if (sessionDuration > 60) {
        // Long session - suggest energy boost
        mood = 'energy-boost';
    } else if (sessionDuration > 120) {
        // Very long session - suggest break music
        mood = 'take-a-break';
    }
    
    return {
        activity,
        mood,
        language,
        fileName,
        sessionDuration,
        isDebugging: !!vscode.debug.activeDebugSession,
        timestamp: Date.now()
    };
}

export function deactivate() {
    stopAutoSync();
    console.log('Music Companion extension deactivated');
}
