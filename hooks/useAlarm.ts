/**
 * useAlarm - Hook for managing alarm scheduling and triggering
 * 
 * Features:
 * - Background alarm checking
 * - Notification API integration
 * - Audio fade-in for wake up
 */
import { useEffect, useRef, useCallback } from 'react';
import { useAlarmStore, Alarm } from '../stores/alarmStore';

interface UseAlarmOptions {
  /** Callback when alarm triggers */
  onAlarmTrigger?: (alarm: Alarm) => void;
  /** Check interval in milliseconds */
  checkInterval?: number;
}

interface UseAlarmResult {
  /** Currently active/ringing alarm */
  activeAlarm: Alarm | null;
  /** Next scheduled alarm */
  nextAlarm: Alarm | null;
  /** Snooze the active alarm */
  snooze: (minutes?: number) => void;
  /** Dismiss the active alarm */
  dismiss: () => void;
  /** Request notification permission */
  requestNotificationPermission: () => Promise<boolean>;
  /** Whether notifications are enabled */
  notificationsEnabled: boolean;
}

/**
 * Hook for managing alarm scheduling and triggering
 * 
 * @example
 * ```tsx
 * const { activeAlarm, nextAlarm, snooze, dismiss } = useAlarm({
 *   onAlarmTrigger: (alarm) => {
 *     // Start playing music, show UI, etc.
 *   }
 * });
 * ```
 */
export function useAlarm(options: UseAlarmOptions = {}): UseAlarmResult {
  const { onAlarmTrigger, checkInterval = 30000 } = options; // Check every 30 seconds
  
  const alarms = useAlarmStore(state => state.alarms);
  const activeAlarmId = useAlarmStore(state => state.activeAlarmId);
  const setActiveAlarm = useAlarmStore(state => state.setActiveAlarm);
  const snoozeAlarm = useAlarmStore(state => state.snoozeAlarm);
  const dismissAlarm = useAlarmStore(state => state.dismissAlarm);
  const getNextAlarm = useAlarmStore(state => state.getNextAlarm);
  
  const onAlarmTriggerRef = useRef(onAlarmTrigger);
  const snoozeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Keep callback ref updated
  useEffect(() => {
    onAlarmTriggerRef.current = onAlarmTrigger;
  }, [onAlarmTrigger]);
  
  // Find active alarm object
  const activeAlarm = activeAlarmId 
    ? alarms.find(a => a.id === activeAlarmId) ?? null 
    : null;
  
  // Get next scheduled alarm
  const nextAlarm = getNextAlarm();
  
  /**
   * Check if any alarm should trigger now
   */
  const checkAlarms = useCallback(() => {
    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    for (const alarm of alarms) {
      if (!alarm.enabled) continue;
      if (!alarm.days.includes(currentDay)) continue;
      if (alarm.time !== currentTime) continue;
      if (activeAlarmId === alarm.id) continue; // Already active
      
      // Trigger this alarm!
      console.log('[useAlarm] Triggering alarm:', alarm.name);
      setActiveAlarm(alarm.id);
      onAlarmTriggerRef.current?.(alarm);
      
      // Show notification if permission granted
      if (Notification.permission === 'granted') {
        new Notification(`⏰ ${alarm.name || 'Alarm'}`, {
          body: 'Time to wake up! 🎵',
          icon: '/favicon.ico',
          tag: alarm.id,
          requireInteraction: true,
        });
      }
      
      break; // Only trigger one alarm at a time
    }
  }, [alarms, activeAlarmId, setActiveAlarm]);
  
  // Set up interval to check alarms
  useEffect(() => {
    // Check immediately on mount
    checkAlarms();
    
    // Then check periodically
    const interval = setInterval(checkAlarms, checkInterval);
    
    return () => clearInterval(interval);
  }, [checkAlarms, checkInterval]);
  
  /**
   * Snooze the active alarm
   */
  const snooze = useCallback((minutes = 5) => {
    if (!activeAlarmId) return;
    
    snoozeAlarm(activeAlarmId, minutes);
    
    // Clear any existing snooze timeout
    if (snoozeTimeoutRef.current) {
      clearTimeout(snoozeTimeoutRef.current);
    }
    
    // Set timeout to re-trigger after snooze duration
    snoozeTimeoutRef.current = setTimeout(() => {
      const alarm = alarms.find(a => a.id === activeAlarmId);
      if (alarm && alarm.enabled) {
        setActiveAlarm(alarm.id);
        onAlarmTriggerRef.current?.(alarm);
      }
    }, minutes * 60 * 1000);
  }, [activeAlarmId, alarms, snoozeAlarm, setActiveAlarm]);
  
  /**
   * Dismiss the active alarm
   */
  const dismiss = useCallback(() => {
    if (!activeAlarmId) return;
    
    dismissAlarm(activeAlarmId);
    
    // Clear snooze timeout if any
    if (snoozeTimeoutRef.current) {
      clearTimeout(snoozeTimeoutRef.current);
      snoozeTimeoutRef.current = null;
    }
  }, [activeAlarmId, dismissAlarm]);
  
  /**
   * Request notification permission
   */
  const requestNotificationPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      console.warn('[useAlarm] Notifications not supported');
      return false;
    }
    
    if (Notification.permission === 'granted') {
      return true;
    }
    
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (snoozeTimeoutRef.current) {
        clearTimeout(snoozeTimeoutRef.current);
      }
    };
  }, []);
  
  return {
    activeAlarm,
    nextAlarm,
    snooze,
    dismiss,
    requestNotificationPermission,
    notificationsEnabled: typeof Notification !== 'undefined' && Notification.permission === 'granted',
  };
}

export default useAlarm;
