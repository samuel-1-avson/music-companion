
import { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Tool } from '@google/genai';
import { createPcmBlob, decodeAudioData, base64ToUint8Array } from '../utils/audioUtils';

interface UseLiveSessionProps {
  systemInstruction?: string;
  tools?: Tool[];
  onToolCall?: (functionCalls: any[]) => void;
}

export interface TranscriptItem {
    role: 'user' | 'model';
    text: string;
    isFinal: boolean;
}

export const useLiveSession = ({ systemInstruction, tools, onToolCall }: UseLiveSessionProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false); 
  const [volume, setVolume] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const isMutedRef = useRef(false);
  
  // Transcript State
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const currentTranscriptRef = useRef<{ role: 'user' | 'model', text: string }>({ role: 'user', text: '' });

  // Connection State Ref (to avoid stale closures in callbacks)
  const isConnectedRef = useRef(false);
  // Callback Refs
  const onToolCallRef = useRef(onToolCall);

  // Audio Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sessionRef = useRef<any>(null); 
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  
  // Video/Vision Refs
  const videoStreamRef = useRef<MediaStream | null>(null);
  const videoCaptureIntervalRef = useRef<number | null>(null);
  const videoCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const hiddenVideoRef = useRef<HTMLVideoElement | null>(null);
  const [isVideoActive, setIsVideoActive] = useState(false);
  const [videoMode, setVideoMode] = useState<'camera' | 'screen' | null>(null);

  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    onToolCallRef.current = onToolCall;
  }, [onToolCall]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
        const next = !prev;
        isMutedRef.current = next;
        return next;
    });
  }, []);

  const sendToolResponse = useCallback((response: any) => {
     if (sessionRef.current) {
        sessionRef.current.sendToolResponse(response);
     }
  }, []);

  const analyzeAudio = () => {
    if (!analyserRef.current || !isConnectedRef.current) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteFrequencyData(dataArray);

    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i];
    }
    const average = sum / bufferLength;
    
    // Normalize roughly to 0-100
    setVolume(Math.min(100, average * 1.5));

    animationFrameRef.current = requestAnimationFrame(analyzeAudio);
  };

  // Define stopVideo FIRST so startVideo can reference it
  const stopVideo = useCallback(() => {
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach(t => t.stop());
      videoStreamRef.current = null;
    }
    if (videoCaptureIntervalRef.current) {
      clearInterval(videoCaptureIntervalRef.current);
      videoCaptureIntervalRef.current = null;
    }
    if (hiddenVideoRef.current) {
      hiddenVideoRef.current.pause();
      hiddenVideoRef.current.srcObject = null;
      hiddenVideoRef.current = null;
    }
    setIsVideoActive(false);
    setVideoMode(null);
  }, []);

  const startVideo = useCallback(async (mode: 'camera' | 'screen') => {
    // Prevent duplicate starts
    if (videoStreamRef.current) stopVideo();

    try {
      if (!navigator.mediaDevices) {
          throw new Error("Media devices not supported (requires HTTPS).");
      }

      let stream: MediaStream;
      if (mode === 'camera') {
        // Use 'ideal' constraints to prevent OverconstrainedError
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: { ideal: 640 }, 
                height: { ideal: 480 } 
            } 
        });
      } else {
        // Check if getDisplayMedia is supported
        if (!navigator.mediaDevices.getDisplayMedia) {
           throw new Error("Screen sharing is not supported on this device/browser.");
        }
        // Higher quality constraints for screen sharing
        stream = await navigator.mediaDevices.getDisplayMedia({ 
            video: { 
                width: { ideal: 1920 }, 
                height: { ideal: 1080 },
                frameRate: { ideal: 30 }
            } 
        });
      }
      
      videoStreamRef.current = stream;
      setVideoMode(mode);
      setIsVideoActive(true);
      setError(null); 

      const videoEl = document.createElement('video');
      videoEl.srcObject = stream;
      videoEl.muted = true;
      videoEl.playsInline = true; // Critical for iOS/Mobile
      await videoEl.play();
      hiddenVideoRef.current = videoEl;

      if (!videoCanvasRef.current) {
        videoCanvasRef.current = document.createElement('canvas');
      }

      videoCaptureIntervalRef.current = window.setInterval(async () => {
        // Use sessionPromiseRef to be safe about session availability
        const sessionPromise = sessionPromiseRef.current;
        if (!sessionPromise || !hiddenVideoRef.current || !videoCanvasRef.current) return;
        
        try {
          const video = hiddenVideoRef.current;
          if (video.readyState < 2) return;

          const canvas = videoCanvasRef.current;
          
          // Scale logic: Higher resolution for screen sharing to ensure text readability
          // Camera: max 640px width (good balance for face/objects).
          // Screen: max 1920px width (better for readability).
          const maxWidth = mode === 'screen' ? 1920 : 640;
          const scale = Math.min(1, maxWidth / (video.videoWidth || 1));
          
          canvas.width = (video.videoWidth || 640) * scale;
          canvas.height = (video.videoHeight || 480) * scale;
          
          const ctx = canvas.getContext('2d');
          if (ctx) {
             ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
             const base64 = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
             
             sessionPromise.then(session => {
                if (session && isConnectedRef.current) {
                    try {
                        session.sendRealtimeInput({
                            media: {
                            mimeType: 'image/jpeg',
                            data: base64
                            }
                        });
                    } catch(e) {
                        // Ignore send errors
                    }
                }
             });
          }
        } catch (e) {
          console.error("Frame capture error", e);
        }
      }, 1000); 

      const track = stream.getVideoTracks()[0];
      if (track) {
         track.onended = () => stopVideo();
      }

    } catch (e: any) {
      console.warn("Video start error:", e);
      // Detailed error handling for permissions
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError' || e.message?.includes('Permission denied')) {
         setError(`${mode === 'camera' ? 'Camera' : 'Screen share'} access denied. Please check your browser settings.`);
      } else if (e.name === 'NotFoundError') {
         setError(`No ${mode} device found.`);
      } else if (e.name === 'NotReadableError') {
         setError(`Could not access ${mode} (maybe used by another app?).`);
      } else {
         setError(e.message || `Failed to start ${mode}.`);
      }
      stopVideo();
    }
  }, [stopVideo]);

  const disconnect = useCallback(() => {
    isConnectedRef.current = false;
    stopVideo();

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    
    if (processorRef.current && inputContextRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (inputContextRef.current) {
      inputContextRef.current.close();
      inputContextRef.current = null;
    }

    if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
    }
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    if (sessionRef.current) {
       try {
         sessionRef.current.close();
       } catch (e) {
         // ignore
       }
       sessionRef.current = null;
    }
    sessionPromiseRef.current = null;

    setIsConnected(false);
    setIsSpeaking(false);
    setVolume(0);
    setIsMuted(false);
    isMutedRef.current = false;
    setTranscripts([]);
  }, [stopVideo]);

  const connect = useCallback(async () => {
    if (!process.env.API_KEY) {
      setError("API Key missing");
      return;
    }

    // Cleanup previous session if any
    disconnect();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
         throw new Error("Media API not available. Ensure you are using HTTPS.");
      }

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass({ sampleRate: 24000 });
      audioContextRef.current = audioCtx;
      
      const inputCtx = new AudioContextClass({ sampleRate: 16000 });
      inputContextRef.current = inputCtx;
      
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      // Get user media BEFORE connecting to ensure permissions
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
      } catch (mediaErr: any) {
        if (mediaErr.name === 'NotAllowedError' || mediaErr.name === 'PermissionDeniedError' || mediaErr.message?.includes('Permission denied')) {
            throw new Error("Microphone access denied. Please allow microphone permissions in your browser URL bar.");
        }
        throw mediaErr;
      }
      
      // Ensure contexts are running (mobile/safari fix)
      if (audioCtx.state === 'suspended') await audioCtx.resume();
      if (inputCtx.state === 'suspended') await inputCtx.resume();

      const defaultSystemInstruction = "You are a warm, knowledgeable, and cool Music Companion. You act like a late-night radio host or a close friend hanging out in the studio. You have eyes and can see the user's screen or face if they share it. Comment on what you see (visual context, work, facial expressions) and suggest music that matches the vibe. If the user asks to download music, call the download tool.";

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            console.log("Live session opened");
            setIsConnected(true);
            isConnectedRef.current = true;
            setError(null);
            
            analyzeAudio();

            if (!inputContextRef.current) return;
            
            const source = inputContextRef.current.createMediaStreamSource(stream);
            const processor = inputContextRef.current.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
              if (!inputContextRef.current) return;
              if (isMutedRef.current) return; 
              
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createPcmBlob(inputData);
              
              // Use sessionPromise to ensure we wait for initialization
              sessionPromise.then(session => {
                if (session && isConnectedRef.current) {
                    try {
                        session.sendRealtimeInput({ media: pcmBlob });
                    } catch(err) {
                        // Suppress send errors that occur during teardown
                    }
                }
              }).catch(err => {
                 // Ignore stream send errors
              });
            };

            source.connect(processor);
            processor.connect(inputContextRef.current.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
             // Handle Tool Calls
             if (msg.toolCall) {
                onToolCallRef.current?.(msg.toolCall.functionCalls);
             }

             // Handle Transcription
             if (msg.serverContent?.outputTranscription) {
                 const text = msg.serverContent.outputTranscription.text;
                 currentTranscriptRef.current = { role: 'model', text: (currentTranscriptRef.current.role === 'model' ? currentTranscriptRef.current.text : '') + text };
                 setTranscripts(prev => {
                     const last = prev[prev.length - 1];
                     if (last && last.role === 'model' && !last.isFinal) {
                         return [...prev.slice(0, -1), { role: 'model', text: currentTranscriptRef.current.text, isFinal: false }];
                     }
                     return [...prev, { role: 'model', text: currentTranscriptRef.current.text, isFinal: false }];
                 });
             } else if (msg.serverContent?.inputTranscription) {
                 const text = msg.serverContent.inputTranscription.text;
                 currentTranscriptRef.current = { role: 'user', text: (currentTranscriptRef.current.role === 'user' ? currentTranscriptRef.current.text : '') + text };
                 setTranscripts(prev => {
                     const last = prev[prev.length - 1];
                     if (last && last.role === 'user' && !last.isFinal) {
                         return [...prev.slice(0, -1), { role: 'user', text: currentTranscriptRef.current.text, isFinal: false }];
                     }
                     return [...prev, { role: 'user', text: currentTranscriptRef.current.text, isFinal: false }];
                 });
             }

             if (msg.serverContent?.turnComplete) {
                 setTranscripts(prev => {
                     const last = prev[prev.length - 1];
                     if (last) return [...prev.slice(0, -1), { ...last, isFinal: true }];
                     return prev;
                 });
                 currentTranscriptRef.current = { role: 'user', text: '' }; // Reset
             }

             // Handle Audio Output
             const base64Audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
             if (base64Audio && audioContextRef.current && analyserRef.current) {
               setIsSpeaking(true);
               const ctx = audioContextRef.current;
               nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
               try {
                   const audioBuffer = await decodeAudioData(base64ToUint8Array(base64Audio), ctx);
                   const source = ctx.createBufferSource();
                   source.buffer = audioBuffer;
                   source.connect(analyserRef.current);
                   analyserRef.current.connect(ctx.destination);
                   source.addEventListener('ended', () => {
                      if (sourcesRef.current) {
                          sourcesRef.current.delete(source);
                          if (sourcesRef.current.size === 0) setIsSpeaking(false);
                      }
                   });
                   source.start(nextStartTimeRef.current);
                   nextStartTimeRef.current += audioBuffer.duration;
                   if (sourcesRef.current) sourcesRef.current.add(source);
               } catch (e) {
                   console.error("Audio decode error", e);
               }
             }

             if (msg.serverContent?.interrupted) {
               if (sourcesRef.current) {
                   sourcesRef.current.forEach(s => {
                       try { s.stop(); } catch(e) {}
                   });
                   sourcesRef.current.clear();
               }
               nextStartTimeRef.current = 0;
               setIsSpeaking(false);
             }
          },
          onclose: () => {
            console.log("Live session closed");
            setIsConnected(false);
            isConnectedRef.current = false;
          },
          onerror: (err) => {
            console.error("Live session error", err);
            const errMsg = err instanceof Error ? err.message : String(err);
            const lowerMsg = errMsg.toLowerCase();
            
            if (isConnectedRef.current) {
                if (
                    !lowerMsg.includes("network") && 
                    !lowerMsg.includes("close") &&
                    !lowerMsg.includes("aborted") &&
                    !lowerMsg.includes("failed to fetch") &&
                    !lowerMsg.includes("undefined")
                ) {
                    setError(`Error: ${errMsg}`);
                }
            }
            setIsConnected(false);
            isConnectedRef.current = false;
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
          },
          systemInstruction: systemInstruction || defaultSystemInstruction,
          tools: tools,
          inputAudioTranscription: {}, // Empty object to enable defaults
          outputAudioTranscription: {}, // Empty object to enable defaults
        }
      });
      
      sessionPromiseRef.current = sessionPromise;
      sessionRef.current = await sessionPromise;

    } catch (e: any) {
      console.error(e);
      disconnect(); // Cleanup
      setError(e.message || "Failed to connect");
      setIsConnected(false);
      isConnectedRef.current = false;
    }
  }, [disconnect, systemInstruction, tools]); 

  useEffect(() => {
    if (isConnected && analyserRef.current) {
       analyzeAudio();
    }
    return () => {
       if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isConnected]);

  // Cleanup on unmount
  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  return { 
    connect, 
    disconnect, 
    isConnected, 
    isSpeaking, 
    error, 
    volume,
    startVideo,
    stopVideo,
    isVideoActive,
    videoMode,
    videoStream: videoStreamRef.current,
    toggleMute,
    isMuted,
    sendToolResponse,
    transcripts // Exposed for UI
  };
};
