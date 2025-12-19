import React, { useState } from 'react';
import { ICONS } from '../constants';
import { Song } from '../types';

interface PlaylistRule {
  id: string;
  type: 'artist' | 'genre' | 'mood' | 'year' | 'plays' | 'recent';
  operator: 'is' | 'contains' | 'greater' | 'less';
  value: string;
}

interface SmartPlaylist {
  id: string;
  name: string;
  rules: PlaylistRule[];
  matchAll: boolean; // AND vs OR
  limit: number;
  songs: Song[];
  lastUpdated: Date;
}

interface SmartPlaylistEditorProps {
  onSave: (playlist: SmartPlaylist) => void;
  onClose: () => void;
  existingPlaylist?: SmartPlaylist;
}

const RULE_TYPES: { id: PlaylistRule['type']; label: string; operators: PlaylistRule['operator'][] }[] = [
  { id: 'artist', label: 'Artist', operators: ['is', 'contains'] },
  { id: 'genre', label: 'Genre', operators: ['is', 'contains'] },
  { id: 'mood', label: 'Mood', operators: ['is'] },
  { id: 'year', label: 'Year', operators: ['is', 'greater', 'less'] },
  { id: 'plays', label: 'Play Count', operators: ['greater', 'less'] },
  { id: 'recent', label: 'Added', operators: ['less'] },
];

const SmartPlaylistEditor: React.FC<SmartPlaylistEditorProps> = ({ onSave, onClose, existingPlaylist }) => {
  const [name, setName] = useState(existingPlaylist?.name || 'My Smart Playlist');
  const [rules, setRules] = useState<PlaylistRule[]>(existingPlaylist?.rules || [
    { id: '1', type: 'genre', operator: 'is', value: '' }
  ]);
  const [matchAll, setMatchAll] = useState(existingPlaylist?.matchAll ?? true);
  const [limit, setLimit] = useState(existingPlaylist?.limit || 50);

  const addRule = () => {
    setRules([...rules, { id: Date.now().toString(), type: 'artist', operator: 'is', value: '' }]);
  };

  const updateRule = (id: string, updates: Partial<PlaylistRule>) => {
    setRules(rules.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const removeRule = (id: string) => {
    if (rules.length > 1) {
      setRules(rules.filter(r => r.id !== id));
    }
  };

  const handleSave = () => {
    const playlist: SmartPlaylist = {
      id: existingPlaylist?.id || Date.now().toString(),
      name,
      rules,
      matchAll,
      limit,
      songs: [],
      lastUpdated: new Date()
    };
    onSave(playlist);
  };

  const getOperatorLabel = (op: PlaylistRule['operator']) => {
    switch (op) {
      case 'is': return 'is';
      case 'contains': return 'contains';
      case 'greater': return 'greater than';
      case 'less': return 'less than';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--bg-card)] border-2 border-theme shadow-retro w-full max-w-lg">
        {/* Header */}
        <div className="p-4 border-b-2 border-theme bg-[var(--bg-hover)] flex justify-between items-center">
          <h2 className="font-mono font-bold text-lg uppercase flex items-center gap-2">
            🔄 Smart Playlist
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-[var(--bg-main)] rounded">
            <ICONS.Close size={16} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Name */}
          <div>
            <label className="block text-xs font-mono text-[var(--text-muted)] uppercase mb-2">Playlist Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--bg-main)] border-2 border-theme font-mono focus:border-[var(--primary)] outline-none"
            />
          </div>

          {/* Match Type */}
          <div className="flex items-center gap-4">
            <span className="text-xs font-mono text-[var(--text-muted)]">Match</span>
            <button
              onClick={() => setMatchAll(true)}
              className={`px-3 py-1 text-xs font-mono font-bold ${matchAll ? 'bg-[var(--primary)] text-black' : 'bg-[var(--bg-hover)]'}`}
            >
              ALL rules
            </button>
            <button
              onClick={() => setMatchAll(false)}
              className={`px-3 py-1 text-xs font-mono font-bold ${!matchAll ? 'bg-[var(--primary)] text-black' : 'bg-[var(--bg-hover)]'}`}
            >
              ANY rule
            </button>
          </div>

          {/* Rules */}
          <div className="space-y-3">
            <label className="block text-xs font-mono text-[var(--text-muted)] uppercase">Rules</label>
            {rules.map((rule, idx) => (
              <div key={rule.id} className="flex items-center gap-2 bg-[var(--bg-hover)] p-2 border border-theme">
                <select
                  value={rule.type}
                  onChange={(e) => updateRule(rule.id, { type: e.target.value as PlaylistRule['type'] })}
                  className="px-2 py-1 bg-[var(--bg-main)] border border-theme text-xs font-mono"
                >
                  {RULE_TYPES.map(rt => (
                    <option key={rt.id} value={rt.id}>{rt.label}</option>
                  ))}
                </select>
                <select
                  value={rule.operator}
                  onChange={(e) => updateRule(rule.id, { operator: e.target.value as PlaylistRule['operator'] })}
                  className="px-2 py-1 bg-[var(--bg-main)] border border-theme text-xs font-mono"
                >
                  {RULE_TYPES.find(rt => rt.id === rule.type)?.operators.map(op => (
                    <option key={op} value={op}>{getOperatorLabel(op)}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={rule.value}
                  onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                  placeholder="Value..."
                  className="flex-1 px-2 py-1 bg-[var(--bg-main)] border border-theme text-xs font-mono"
                />
                <button onClick={() => removeRule(rule.id)} className="p-1 hover:text-red-500">
                  <ICONS.Close size={14} />
                </button>
              </div>
            ))}
            <button
              onClick={addRule}
              className="w-full py-2 border-2 border-dashed border-theme text-xs font-mono text-[var(--text-muted)] hover:border-[var(--primary)] hover:text-[var(--primary)]"
            >
              + Add Rule
            </button>
          </div>

          {/* Limit */}
          <div className="flex items-center gap-4">
            <label className="text-xs font-mono text-[var(--text-muted)]">Limit to</label>
            <input
              type="number"
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value) || 50)}
              min={1}
              max={500}
              className="w-20 px-2 py-1 bg-[var(--bg-main)] border border-theme text-xs font-mono"
            />
            <span className="text-xs font-mono text-[var(--text-muted)]">songs</span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-theme bg-[var(--bg-hover)] flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-mono font-bold border border-theme hover:bg-[var(--bg-main)]"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-xs font-mono font-bold bg-[var(--primary)] text-black hover:opacity-90"
          >
            Save Playlist
          </button>
        </div>
      </div>
    </div>
  );
};

export default SmartPlaylistEditor;
