/**
 * Alarm Store - Zustand state management for smart alarms
 * 
 * Features:
 * - Schedule alarms with time and days
 * - Music selection (mood, playlist, song)
 * - Fade-in duration setting
 * - Enable/disable alarms
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Alarm {
  id: string;
  name: string;
  time: string; // HH:MM format
  days: number[]; // 0-6 (Sunday-Saturday)
  musicType: 'mood' | 'playlist' | 'song' | 'random';
  musicId?: string; // ID of playlist/song, or mood name
  musicLabel?: string; // Display name of music selection
  fadeDuration: number; // seconds to fade in (0-60)
  enabled: boolean;
  volume: number; // 0-100
  createdAt: number;
}

interface AlarmState {
  alarms: Alarm[];
  activeAlarmId: string | null; // Currently ringing alarm
  
  // Actions
  addAlarm: (alarm: Omit<Alarm, 'id' | 'createdAt'>) => string;
  updateAlarm: (id: string, updates: Partial<Alarm>) => void;
  deleteAlarm: (id: string) => void;
  toggleAlarm: (id: string) => void;
  setActiveAlarm: (id: string | null) => void;
  snoozeAlarm: (id: string, minutes?: number) => void;
  dismissAlarm: (id: string) => void;
  
  // Helpers
  getNextAlarm: () => Alarm | null;
  getAlarmsForDay: (day: number) => Alarm[];
}

// Generate unique ID
const generateId = () => `alarm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Day labels
export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_LABELS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Preset options
export const MUSIC_PRESETS = [
  { id: 'calm', label: '🧘 Calm & Peaceful', type: 'mood' as const },
  { id: 'energetic', label: '⚡ Energetic Wake Up', type: 'mood' as const },
  { id: 'nature', label: '🌿 Nature Sounds', type: 'mood' as const },
  { id: 'classical', label: '🎻 Classical Morning', type: 'mood' as const },
  { id: 'random', label: '🎲 Surprise Me', type: 'random' as const },
];

export const useAlarmStore = create<AlarmState>()(
  persist(
    (set, get) => ({
      alarms: [],
      activeAlarmId: null,
      
      addAlarm: (alarmData) => {
        const id = generateId();
        const alarm: Alarm = {
          ...alarmData,
          id,
          createdAt: Date.now(),
        };
        set(state => ({ alarms: [...state.alarms, alarm] }));
        return id;
      },
      
      updateAlarm: (id, updates) => {
        set(state => ({
          alarms: state.alarms.map(a => 
            a.id === id ? { ...a, ...updates } : a
          )
        }));
      },
      
      deleteAlarm: (id) => {
        set(state => ({
          alarms: state.alarms.filter(a => a.id !== id),
          activeAlarmId: state.activeAlarmId === id ? null : state.activeAlarmId
        }));
      },
      
      toggleAlarm: (id) => {
        set(state => ({
          alarms: state.alarms.map(a => 
            a.id === id ? { ...a, enabled: !a.enabled } : a
          )
        }));
      },
      
      setActiveAlarm: (id) => {
        set({ activeAlarmId: id });
      },
      
      snoozeAlarm: (id, minutes = 5) => {
        // Clear active alarm and reschedule
        set({ activeAlarmId: null });
        // Note: Actual snooze scheduling handled by useAlarm hook
        console.log(`[Alarm] Snoozed for ${minutes} minutes`);
      },
      
      dismissAlarm: (id) => {
        set({ activeAlarmId: null });
        console.log('[Alarm] Dismissed');
      },
      
      getNextAlarm: () => {
        const { alarms } = get();
        const now = new Date();
        const currentDay = now.getDay();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        
        const enabledAlarms = alarms.filter(a => a.enabled);
        if (enabledAlarms.length === 0) return null;
        
        // Find next alarm
        let nextAlarm: Alarm | null = null;
        let minMinutesUntil = Infinity;
        
        for (const alarm of enabledAlarms) {
          const [hours, mins] = alarm.time.split(':').map(Number);
          const alarmMinutes = hours * 60 + mins;
          
          for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
            const checkDay = (currentDay + dayOffset) % 7;
            if (!alarm.days.includes(checkDay)) continue;
            
            let minutesUntil = dayOffset * 24 * 60 + alarmMinutes - currentTime;
            if (dayOffset === 0 && alarmMinutes <= currentTime) {
              continue; // Already passed today
            }
            
            if (minutesUntil < minMinutesUntil) {
              minMinutesUntil = minutesUntil;
              nextAlarm = alarm;
            }
            break; // Found next occurrence for this alarm
          }
        }
        
        return nextAlarm;
      },
      
      getAlarmsForDay: (day) => {
        return get().alarms.filter(a => a.days.includes(day) && a.enabled);
      },
    }),
    {
      name: 'alarm-storage',
    }
  )
);
