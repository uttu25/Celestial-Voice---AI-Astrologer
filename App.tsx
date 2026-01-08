import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, MicOff, Volume2, Sparkles, AlertCircle, Settings as SettingsIcon, PhoneOff } from 'lucide-react';
import { Language, ASTROLOGER_PROMPT, User } from './types';
import { createPcmBlob, base64ToUint8Array, decodeAudioData } from './utils/audio';
import CrystalBall from './components/CrystalBall';
import AuthModal from './components/AuthModal';
import SettingsModal from './components/SettingsModal';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(Language.English);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false); // True if AI is speaking
  const [interruptionFeedback, setInterruptionFeedback] = useState(false); // Visual feedback for interruption
  
  // Refs for Audio Contexts and Processing
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const isMutedRef = useRef(false); // Ref to access inside closures
  
  // Ref to track audio scheduling
  const nextStartTimeRef = useRef<number>(0);
  const audioQueueRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  // Connection Refs
  const currentSessionRef = useRef<Promise<any> | null>(null);
  
  // Transcription History Refs
  const currentInputTranscription = useRef('');
  const currentOutputTranscription = useRef('');

  // Restore session on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('celestial_currentUser');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);
  
  // Cleanup function to stop audio and disconnect
  const cleanup = useCallback(() => {
    setIsConnected(false);
    setIsSpeaking(false);
    setIsMuted(false);
    isMutedRef.current = false;
    
    // Stop all playing audio sources
    audioQueueRef.current.forEach(source => {
      try {
        source.stop();
      } catch (e) { /* ignore */ }
    });
    audioQueueRef.current.clear();
    nextStartTimeRef.current = 0;

    // Explicitly close the Gemini Live Session
    if (currentSessionRef.current) {
        currentSessionRef.current.then(session => {
            try {
                session.close();
                console.log("Gemini session closed successfully");
            } catch (e) {
                console.error("Error closing Gemini session:", e);
            }
        }).catch(e => {
            console.error("Error resolving session for cleanup:", e);
        });
        currentSessionRef.current = null;
    }

    // Close microphone stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Disconnect audio nodes
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    
    // Close input context
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }

    // Reset transcription accumulators
    currentInputTranscription.current = '';
    currentOutputTranscription.current = '';
  }, []);

  const handleToggleMute = () => {
    const newState = !isMuted;
    setIsMuted(newState);
    isMutedRef.current = newState;
  };

  const handleConnect = async () => {
    setError(null);
    setIsMuted(false);
    isMutedRef.current = false;
    
    // Ensure clean state before starting
    cleanup();
    
    try {
      // 1. Setup Audio Contexts
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      inputAudioContextRef.current = new AudioContextClass({ sampleRate: 16000 });
      outputAudioContextRef.current = new AudioContextClass({ sampleRate: 24000 });

      // Resume contexts immediately (fixes Safari/Mobile autoplay policies)
      if (inputAudioContextRef.current.state === 'suspended') {
          await inputAudioContextRef.current.resume();
      }
      if (outputAudioContextRef.current.state === 'suspended') {
          await outputAudioContextRef.current.resume();
      }

      // Analyser for Visualization
      analyserRef.current = outputAudioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;

      // 2. Get Microphone Access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // 3. Initialize Gemini API
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // Load History
      const historyKey = user ? `celestial_history_${user.id}` : 'celestial_history_guest';
      let savedHistory = localStorage.getItem(historyKey) || '';
      // Truncate history if it gets too long
      if (savedHistory.length > 20000) {
        savedHistory = savedHistory.slice(savedHistory.length - 20000);
        const firstNewLine = savedHistory.indexOf('\n');
        if (firstNewLine > -1) savedHistory = savedHistory.slice(firstNewLine + 1);
      }

      const agentName = selectedLanguage === Language.English ? 'Sarah' : 'Navika';

      const config = {
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: `
            SYSTEM LANGUAGE SETTING: ${selectedLanguage}
            USER CONTEXT: Name=${user?.name || 'Unknown'}
            AGENT IDENTITY: ${agentName}
            
            You are a mystical AI Astrologer named ${agentName}.
            The user has selected the language: ${selectedLanguage}.
            The user's name is ${user?.name}. Address them by name when appropriate.
            
            CRITICAL INSTRUCTIONS:
            1. You MUST speak, listen, and think primarily in ${selectedLanguage}.
            2. IDENTITY: You are a girl named ${agentName}. You have a very soothing, melodic, and comforting voice.
            3. PERSONALITY: You are funny, grounded, and entertaining. Use humor and wit. Be quintessential.
            4. Translate all the standard questions provided below into ${selectedLanguage} before asking them.
            5. Do not revert to English unless the user explicitly asks you to.
            6. Your horoscope readings must be in ${selectedLanguage}.

            ${ASTROLOGER_PROMPT}

            === MEMORY & CONTEXT ===
            HISTORY:
            ${savedHistory}
          `,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
      };

      const sessionPromise = ai.live.connect({
        model: config.model,
        config: config.config,
        callbacks: {
          onopen: () => {
            console.log("Gemini Live Session Opened");
            setIsConnected(true);
          },
          onmessage: async (message: LiveServerMessage) => {
            const serverContent = message.serverContent;
            
            // Handle Transcription (Memory)
            if (serverContent) {
                if (serverContent.inputTranscription?.text) {
                    currentInputTranscription.current += serverContent.inputTranscription.text;
                }
                if (serverContent.outputTranscription?.text) {
                    currentOutputTranscription.current += serverContent.outputTranscription.text;
                }
                
                // Save history on turn completion
                if (serverContent.turnComplete) {
                    const input = currentInputTranscription.current.trim();
                    const output = currentOutputTranscription.current.trim();
                    
                    if (input || output) {
                        let newEntry = '';
                        if (input) newEntry += `User: ${input}\n`;
                        if (output) newEntry += `Astrologer: ${output}\n`;
                        
                        if (newEntry) {
                            const historyKey = user ? `celestial_history_${user.id}` : 'celestial_history_guest';
                            const existing = localStorage.getItem(historyKey) || '';
                            localStorage.setItem(historyKey, existing + newEntry);
                        }
                    }
                    
                    // Reset for next turn
                    currentInputTranscription.current = '';
                    currentOutputTranscription.current = '';
                }
            }

            // Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current) {
              try {
                const audioCtx = outputAudioContextRef.current;
                const audioBuffer = await decodeAudioData(
                  base64ToUint8Array(base64Audio),
                  audioCtx
                );
                
                // Determine start time to ensure smooth playback
                const currentTime = audioCtx.currentTime;
                if (nextStartTimeRef.current < currentTime) {
                  nextStartTimeRef.current = currentTime;
                }
                
                const source = audioCtx.createBufferSource();
                source.buffer = audioBuffer;
                
                // Connect to analyser for visuals, then to destination
                if (analyserRef.current) {
                    source.connect(analyserRef.current);
                    analyserRef.current.connect(audioCtx.destination);
                } else {
                    source.connect(audioCtx.destination);
                }

                source.start(nextStartTimeRef.current);
                audioQueueRef.current.add(source);
                setIsSpeaking(true);

                // Update next start time
                nextStartTimeRef.current += audioBuffer.duration;

                source.onended = () => {
                  audioQueueRef.current.delete(source);
                  if (audioQueueRef.current.size === 0) {
                    setIsSpeaking(false);
                  }
                };
              } catch (decodeErr) {
                console.error("Audio Decode Error", decodeErr);
              }
            }
            
            // Handle Interruption (User spoke while AI was speaking)
            if (message.serverContent?.interrupted) {
              console.log("AI Interrupted");
              audioQueueRef.current.forEach(src => {
                try { src.stop(); } catch(e) {}
              });
              audioQueueRef.current.clear();
              nextStartTimeRef.current = 0;
              setIsSpeaking(false);
              
              // Trigger visual feedback
              setInterruptionFeedback(true);
              setTimeout(() => setInterruptionFeedback(false), 2000);
            }
          },
          onclose: () => {
            console.log("Session Closed");
            cleanup();
          },
          onerror: (err) => {
            console.error("Session Error", err);
            setError("Connection error. Please try again.");
            cleanup();
          }
        }
      });

      currentSessionRef.current = sessionPromise;

      // 4. Setup Audio Input Processing pipeline
      // We use ScriptProcessor for raw PCM data extraction (standard for current Live API examples)
      const inputCtx = inputAudioContextRef.current;
      sourceRef.current = inputCtx.createMediaStreamSource(stream);
      // Reduce buffer size to 2048 (approx 128ms) to reduce latency while maintaining stability
      processorRef.current = inputCtx.createScriptProcessor(2048, 1, 1);
      
      processorRef.current.onaudioprocess = (e) => {
        // CRITICAL: If muted, do NOT process or send audio.
        // This prevents background noise from triggering an interruption.
        if (isMutedRef.current) return;

        const inputData = e.inputBuffer.getChannelData(0);
        // Create 16-bit PCM Blob
        const pcmBlob = createPcmBlob(inputData);
        
        // Send to Gemini
        sessionPromise.then(session => {
            session.sendRealtimeInput({ media: pcmBlob });
        }).catch(err => {
            console.error("Error sending audio input", err);
        });
      };

      sourceRef.current.connect(processorRef.current);
      processorRef.current.connect(inputCtx.destination);

    } catch (err: any) {
      console.error("Initialization Error", err);
      setError(err.message || "Failed to initialize audio or connection.");
      cleanup();
    }
  };

  // Auth Handlers
  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
  };
  
  const handleLogout = () => {
    localStorage.removeItem('celestial_currentUser');
    setUser(null);
    setShowSettings(false);
    cleanup();
  };

  const handleUpdateUser = (updatedUser: User) => {
    setUser(updatedUser);
  };

  const handleDeleteUser = () => {
    setUser(null);
    setShowSettings(false);
    cleanup();
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center min-h-screen px-4 py-8 relative z-10">
         {/* Background Elements */}
        <header className="mb-8 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
                <Sparkles className="text-yellow-400 animate-pulse" />
                <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-200 via-white to-purple-200 drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">
                Celestial Voice
                </h1>
                <Sparkles className="text-yellow-400 animate-pulse" />
            </div>
            <p className="text-indigo-300 font-light tracking-widest uppercase text-sm">AI Astrologer</p>
        </header>
        <AuthModal onLogin={handleLogin} />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center min-h-screen px-4 py-8 relative z-10">
      {/* Header */}
      <header className="w-full max-w-4xl flex justify-between items-start mb-8 relative">
        <div className="flex-1 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
                <Sparkles className="text-yellow-400 animate-pulse" />
                <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-200 via-white to-purple-200 drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">
                Celestial Voice
                </h1>
                <Sparkles className="text-yellow-400 animate-pulse" />
            </div>
            <p className="text-indigo-300 font-light tracking-widest uppercase text-sm">AI Astrologer</p>
        </div>
        
        {/* Settings Button */}
        <button 
          onClick={() => setShowSettings(true)}
          className="absolute right-0 top-2 p-2 rounded-full bg-slate-800/50 text-slate-300 hover:text-white hover:bg-slate-700 transition-all border border-slate-700"
        >
          <SettingsIcon className="w-5 h-5" />
        </button>
      </header>

      {/* Main Interface */}
      <div className="w-full max-w-md bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 shadow-2xl shadow-purple-900/20">
        
        {/* Welcome Message */}
        {!isConnected && (
            <div className="text-center mb-6">
                <p className="text-slate-300">Welcome, <span className="text-purple-300 font-serif font-bold">{user.name}</span></p>
            </div>
        )}

        {/* Language Selection */}
        {!isConnected ? (
          <div className="mb-8">
            <label className="block text-slate-400 text-sm font-semibold mb-3 uppercase tracking-wider text-center">Select Your Language</label>
            <div className="grid grid-cols-2 gap-3">
              {Object.values(Language).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setSelectedLanguage(lang)}
                  className={`py-2 px-4 rounded-xl text-sm font-medium transition-all duration-300 border ${
                    selectedLanguage === lang
                      ? 'bg-purple-600 border-purple-400 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mb-8 text-center">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-900/50 border border-purple-500/30 text-purple-200 text-sm font-medium">
               Speaking in: <span className="text-white font-bold">{selectedLanguage}</span>
            </span>
          </div>
        )}

        {/* Visualizer Area */}
        <div className="flex justify-center mb-8 relative">
           <CrystalBall 
             analyser={analyserRef.current} 
             isConnected={isConnected} 
             isSpeaking={isSpeaking}
             isMuted={isMuted} 
           />
           {isConnected && (
             <div className="absolute -bottom-4 text-center w-full">
                <span className={`text-xs font-serif tracking-widest block ${
                    interruptionFeedback ? 'text-white animate-bounce' :
                    isMuted ? 'text-red-400' : 
                    isSpeaking ? 'text-yellow-200' : 
                    'text-purple-300 animate-pulse'
                }`}>
                    {interruptionFeedback ? 'LISTENING...' :
                     isMuted ? 'MICROPHONE MUTED' : 
                     isSpeaking ? 'THE STARS ARE SPEAKING...' : 
                     'LISTENING TO YOUR AURA...'}
                </span>
             </div>
           )}
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-4">
            {error && (
                <div className="flex items-center gap-2 bg-red-900/30 border border-red-500/30 text-red-200 p-3 rounded-lg text-sm mb-2">
                    <AlertCircle size={16} />
                    {error}
                </div>
            )}

            {!isConnected ? (
                <button
                onClick={handleConnect}
                className="group relative w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-lg hover:shadow-[0_0_20px_rgba(124,58,237,0.5)] transition-all duration-300 overflow-hidden"
                >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
                <Mic className="w-6 h-6" />
                <span>Begin Consultation</span>
                </button>
            ) : (
                <div className="grid grid-cols-2 gap-4">
                    <button
                        onClick={handleToggleMute}
                        className={`flex items-center justify-center gap-2 py-4 rounded-2xl border font-semibold transition-all duration-300 ${
                            isMuted 
                                ? 'bg-red-900/50 border-red-500 text-red-100 hover:bg-red-900/70' 
                                : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white'
                        }`}
                    >
                        {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                        <span>{isMuted ? 'Unmute' : 'Mute'}</span>
                    </button>

                    <button
                        onClick={cleanup}
                        className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-slate-800 border border-slate-600 text-red-400 font-semibold hover:bg-red-900/20 hover:border-red-500/50 hover:text-red-300 transition-all duration-300"
                    >
                        <PhoneOff className="w-5 h-5" />
                        <span>End Call</span>
                    </button>
                </div>
            )}
        </div>
        
        {/* Instructions */}
        {!isConnected && (
            <div className="mt-8 text-center text-xs text-slate-500 font-light">
                <p>Allow microphone access to commune with the stars.</p>
                <p>Ensure your speakers are on to hear the prophecy.</p>
            </div>
        )}
      </div>

      {showSettings && user && (
        <SettingsModal 
          user={user} 
          onClose={() => setShowSettings(false)}
          onLogout={handleLogout}
          onUpdateUser={handleUpdateUser}
          onDeleteUser={handleDeleteUser}
        />
      )}

      <footer className="mt-8 text-slate-600 text-xs text-center">
        Powered by Gemini Multimodal Live API
      </footer>
    </div>
  );
};

export default App;