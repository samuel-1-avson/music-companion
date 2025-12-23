/**
 * SmartAlarm - Component for managing wake-up alarms with music
 * 
 * Features:
 * - Create/edit/delete alarms
 * - Time picker and day selection
 * - Music type selection (mood, random)
 * - Fade-in duration slider
 * - Active alarm modal with snooze/dismiss
 */
import React, { useState } from 'react';
import { ICONS } from '../constants';
import { useAlarmStore, Alarm, DAY_LABELS, MUSIC_PRESETS } from '../stores/alarmStore';
import { useAlarm } from '../hooks/useAlarm';

interface SmartAlarmProps {
  onPlayMusic?: (musicType: string, musicId?: string) => void;
  onClose?: () => void;
}

const SmartAlarm: React.FC<SmartAlarmProps> = ({ onPlayMusic, onClose }) => {
  const alarms = useAlarmStore(state => state.alarms);
  const addAlarm = useAlarmStore(state => state.addAlarm);
  const updateAlarm = useAlarmStore(state => state.updateAlarm);
  const deleteAlarm = useAlarmStore(state => state.deleteAlarm);
  const toggleAlarm = useAlarmStore(state => state.toggleAlarm);
  
  const { activeAlarm, nextAlarm, snooze, dismiss, requestNotificationPermission, notificationsEnabled } = useAlarm({
    onAlarmTrigger: (alarm) => {
      onPlayMusic?.(alarm.musicType, alarm.musicId);
    }
  });
  
  const [showEditor, setShowEditor] = useState(false);
  const [editingAlarm, setEditingAlarm] = useState<Alarm | null>(null);
  
  // Editor state
  const [name, setName] = useState('Morning Alarm');
  const [time, setTime] = useState('07:00');
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri
  const [musicPreset, setMusicPreset] = useState(MUSIC_PRESETS[0]);
  const [fadeDuration, setFadeDuration] = useState(30);
  const [volume, setVolume] = useState(80);
  
  const openEditor = (alarm?: Alarm) => {
    if (alarm) {
      setEditingAlarm(alarm);
      setName(alarm.name);
      setTime(alarm.time);
      setDays([...alarm.days]);
      setMusicPreset(MUSIC_PRESETS.find(p => p.id === alarm.musicId) || MUSIC_PRESETS[0]);
      setFadeDuration(alarm.fadeDuration);
      setVolume(alarm.volume);
    } else {
      setEditingAlarm(null);
      setName('Morning Alarm');
      setTime('07:00');
      setDays([1, 2, 3, 4, 5]);
      setMusicPreset(MUSIC_PRESETS[0]);
      setFadeDuration(30);
      setVolume(80);
    }
    setShowEditor(true);
  };
  
  const saveAlarm = () => {
    const alarmData = {
      name,
      time,
      days,
      musicType: musicPreset.type,
      musicId: musicPreset.id,
      musicLabel: musicPreset.label,
      fadeDuration,
      volume,
      enabled: true,
    };
    
    if (editingAlarm) {
      updateAlarm(editingAlarm.id, alarmData);
    } else {
      addAlarm(alarmData);
    }
    
    setShowEditor(false);
  };
  
  const toggleDay = (day: number) => {
    setDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day].sort()
    );
  };
  
  const formatNextAlarm = () => {
    if (!nextAlarm) return null;
    const [hours, mins] = nextAlarm.time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${mins.toString().padStart(2, '0')} ${period}`;
  };

  return (
    <div className="bg-[var(--bg-card)] border-2 border-theme shadow-retro">
      {/* Header */}
      <div className="p-4 border-b-2 border-theme bg-[var(--bg-hover)] flex justify-between items-center">
        <h2 className="font-mono font-bold text-lg uppercase flex items-center gap-2">
          <span>⏰</span> Smart Alarms
        </h2>
        <div className="flex items-center gap-2">
          {!notificationsEnabled && (
            <button
              onClick={requestNotificationPermission}
              className="text-xs bg-[var(--primary)] text-black px-2 py-1 font-mono"
            >
              Enable Notifications
            </button>
          )}
          {onClose && (
            <button onClick={onClose} className="p-1 hover:bg-[var(--bg-main)] rounded">
              <ICONS.Close size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Active Alarm Modal */}
      {activeAlarm && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--bg-card)] border-4 border-theme p-8 max-w-sm w-full text-center animate-pulse">
            <p className="text-6xl mb-4">⏰</p>
            <h3 className="text-2xl font-bold font-mono mb-2">{activeAlarm.name}</h3>
            <p className="text-4xl font-mono text-[var(--primary)] mb-6">{activeAlarm.time}</p>
            
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => snooze(5)}
                className="px-6 py-3 bg-[var(--bg-hover)] border-2 border-theme font-mono font-bold"
              >
                Snooze 5min
              </button>
              <button
                onClick={dismiss}
                className="px-6 py-3 bg-[var(--primary)] text-black border-2 border-theme font-mono font-bold"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alarm List */}
      <div className="p-4 space-y-3">
        {/* Next Alarm Info */}
        {nextAlarm && (
          <div className="bg-[var(--bg-hover)] p-3 border border-theme mb-4">
            <p className="text-xs font-mono text-[var(--text-muted)] uppercase">Next Alarm</p>
            <p className="text-lg font-bold font-mono text-[var(--primary)]">
              {formatNextAlarm()} - {nextAlarm.name}
            </p>
          </div>
        )}

        {alarms.length === 0 ? (
          <div className="text-center py-8 text-[var(--text-muted)]">
            <p className="text-4xl mb-2">😴</p>
            <p className="font-mono text-sm">No alarms set</p>
            <p className="text-xs mt-1">Create one to wake up to music!</p>
          </div>
        ) : (
          alarms.map(alarm => (
            <div 
              key={alarm.id}
              className={`p-4 border-2 border-theme flex items-center justify-between ${
                alarm.enabled ? 'bg-[var(--bg-card)]' : 'bg-[var(--bg-hover)] opacity-60'
              }`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <p className="text-2xl font-mono font-bold">{alarm.time}</p>
                  <p className="text-sm font-mono text-[var(--text-muted)]">{alarm.name}</p>
                </div>
                <p className="text-xs font-mono text-[var(--text-muted)] mt-1">
                  {alarm.days.map(d => DAY_LABELS[d]).join(', ')} • {alarm.musicLabel}
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEditor(alarm)}
                  className="p-2 hover:bg-[var(--bg-hover)]"
                >
                  <ICONS.Settings size={16} />
                </button>
                <button
                  onClick={() => toggleAlarm(alarm.id)}
                  className={`w-12 h-6 rounded-full relative transition-colors ${
                    alarm.enabled ? 'bg-[var(--primary)]' : 'bg-gray-400'
                  }`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                    alarm.enabled ? 'left-7' : 'left-1'
                  }`} />
                </button>
              </div>
            </div>
          ))
        )}

        {/* Add Alarm Button */}
        <button
          onClick={() => openEditor()}
          className="w-full p-4 border-2 border-dashed border-theme text-[var(--text-muted)] hover:border-solid hover:bg-[var(--bg-hover)] font-mono flex items-center justify-center gap-2"
        >
          <ICONS.Plus size={20} />
          Add Alarm
        </button>
      </div>

      {/* Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--bg-card)] border-2 border-theme shadow-retro max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b-2 border-theme bg-[var(--bg-hover)] flex justify-between items-center">
              <h3 className="font-mono font-bold uppercase">
                {editingAlarm ? 'Edit Alarm' : 'New Alarm'}
              </h3>
              <button onClick={() => setShowEditor(false)} className="p-1 hover:bg-[var(--bg-main)]">
                <ICONS.Close size={16} />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              {/* Name */}
              <div>
                <label className="text-xs font-mono text-[var(--text-muted)] uppercase block mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full p-2 border-2 border-theme bg-[var(--bg-main)] font-mono"
                />
              </div>
              
              {/* Time */}
              <div>
                <label className="text-xs font-mono text-[var(--text-muted)] uppercase block mb-1">Time</label>
                <input
                  type="time"
                  value={time}
                  onChange={e => setTime(e.target.value)}
                  className="w-full p-2 border-2 border-theme bg-[var(--bg-main)] font-mono text-2xl"
                />
              </div>
              
              {/* Days */}
              <div>
                <label className="text-xs font-mono text-[var(--text-muted)] uppercase block mb-2">Repeat</label>
                <div className="flex gap-1">
                  {DAY_LABELS.map((label, i) => (
                    <button
                      key={i}
                      onClick={() => toggleDay(i)}
                      className={`flex-1 py-2 text-xs font-mono font-bold border-2 ${
                        days.includes(i)
                          ? 'bg-[var(--primary)] text-black border-theme'
                          : 'bg-[var(--bg-main)] text-[var(--text-muted)] border-transparent'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Music */}
              <div>
                <label className="text-xs font-mono text-[var(--text-muted)] uppercase block mb-2">Wake Up Music</label>
                <div className="space-y-1">
                  {MUSIC_PRESETS.map(preset => (
                    <button
                      key={preset.id}
                      onClick={() => setMusicPreset(preset)}
                      className={`w-full p-2 text-left font-mono text-sm border-2 ${
                        musicPreset.id === preset.id
                          ? 'bg-[var(--primary)] text-black border-theme'
                          : 'bg-[var(--bg-main)] border-transparent hover:border-theme'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Fade Duration */}
              <div>
                <label className="text-xs font-mono text-[var(--text-muted)] uppercase block mb-1">
                  Fade In: {fadeDuration}s
                </label>
                <input
                  type="range"
                  min="0"
                  max="60"
                  value={fadeDuration}
                  onChange={e => setFadeDuration(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              
              {/* Volume */}
              <div>
                <label className="text-xs font-mono text-[var(--text-muted)] uppercase block mb-1">
                  Volume: {volume}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={e => setVolume(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              
              {/* Actions */}
              <div className="flex gap-2 pt-4">
                {editingAlarm && (
                  <button
                    onClick={() => {
                      deleteAlarm(editingAlarm.id);
                      setShowEditor(false);
                    }}
                    className="px-4 py-2 text-red-500 border-2 border-red-500 font-mono"
                  >
                    Delete
                  </button>
                )}
                <button
                  onClick={() => setShowEditor(false)}
                  className="flex-1 px-4 py-2 border-2 border-theme font-mono"
                >
                  Cancel
                </button>
                <button
                  onClick={saveAlarm}
                  className="flex-1 px-4 py-2 bg-[var(--primary)] text-black border-2 border-theme font-mono font-bold"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartAlarm;
