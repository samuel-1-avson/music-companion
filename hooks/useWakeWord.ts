import { useState, useEffect, useRef } from 'react';
import { SpeechRecognition, SpeechRecognitionEvent } from '../types';

export const useWakeWord = (onWake: () => void, isEnabled: boolean = true) => {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    // Check browser support
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognitionClass) {
      console.warn("Speech Recognition API not supported in this browser.");
      return;
    }

    if (!isEnabled) {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            setIsListening(false);
        }
        return;
    }

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript.trim().toLowerCase();
        // Check for wake word
        if (transcript.includes('melody')) {
           recognition.stop(); // Stop listening once triggered
           onWake();
           return;
        }
      }
    };

    recognition.onend = () => {
       // Auto-restart if it shouldn't be stopped (Browser often stops it after silence)
       if (isEnabled) {
           try {
               recognition.start();
           } catch (e) {
               // Ignore start errors (e.g. already started)
           }
       } else {
           setIsListening(false);
       }
    };

    recognition.onerror = (event: any) => {
        // console.warn("Wake word error", event.error);
        // If not-allowed, stop trying to restart
        if (event.error === 'not-allowed') {
            setIsListening(false);
        }
    };

    try {
        recognition.start();
        setIsListening(true);
    } catch (e) {
        // console.warn("Could not start wake word listener", e);
    }

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
         recognitionRef.current.onend = () => {}; // remove restart handler
         recognitionRef.current.stop();
      }
    };
  }, [isEnabled, onWake]);

  return { isListening };
};
