import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, MicOff, Volume2, Sparkles, AlertCircle, Settings as SettingsIcon, PhoneOff, User as UserIcon } from 'lucide-react';
import { Language, ASTROLOGER_PROMPT, User } from './types';
import { createPcmBlob, base64ToUint8Array, decodeAudioData } from './utils/audio';
import CrystalBall from './components/CrystalBall';
import AuthModal from './components/AuthModal';
import SettingsModal from './components/SettingsModal';
import SubscriptionModal from './components/SubscriptionModal';

// Firebase Imports
import { auth, db, isFirebaseConfigured } from './firebaseConfig';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot, updateDoc, increment, setDoc, getDoc } from 'firebase/firestore';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(Language.English);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false); // True if AI is speaking
  const [interruptionFeedback, setInterruptionFeedback] = useState(false); // Visual feedback for interruption
  const [isDemoMode, setIsDemoMode] = useState(false);
  
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

  // FIREBASE AUTH LISTENER
  useEffect(() => {
    if (isDemoMode) {
        // Guest mode logic
        return;
    }

    if (!isFirebaseConfigured()) {
        // Wait for user to either config firebase or click guest
        return;
    }

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // User is signed in, listen to Firestore document for real-time updates (premium status, chat count)
        const userDocRef = doc(db, "users", firebaseUser.uid);
        
        const unsubscribeSnapshot = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
             setUser({ id: firebaseUser.uid, ...docSnap.data() } as User);
          } else {
             // If doc doesn't exist (edge case), initialize it
             const initialData = {
                 name: firebaseUser.displayName || 'Seeker',
                 email: firebaseUser.email || '',
                 chatCount: 0,
                 isPremium: false,
                 password: '' // not used
             };
             setDoc(userDocRef, initialData);
             setUser({ id: firebaseUser.uid, ...initialData } as User);
          }
        }, (error) => {
            console.error("Firestore error:", error);
            // Fallback for permission errors
            setUser({
                id: firebaseUser.uid,
                name: firebaseUser.displayName || 'Seeker',
                email: firebaseUser.email || '',
                chatCount: 0,
                isPremium: false,
                password: ''
            });
        });
        
        return () => unsubscribeSnapshot();
      } else {
        // User is signed out
        setUser(null);
      }
    });

    return () => unsubscribeAuth();
  }, [isDemoMode]);
  
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

  const handleSubscribe = async () => {
    if (user && !isDemoMode) {
        // Update Firestore: set isPremium to true
        try {
            await updateDoc(doc(db, "users", user.id), {
                isPremium: true
            });
            setShowSubscription(false);
        } catch (e) {
            console.error("Error updating subscription:", e);
            setError("Failed to activate premium. Please try again.");
        }
    } else if (isDemoMode) {
        alert("Subscriptions are simulated in Demo Mode.");
        setShowSubscription(false);
    }
  };

  const handleGuestLogin = () => {
      setIsDemoMode(true);
      setUser({
          id: 'guest',
          name: 'Guest Soul',
          email: 'guest@celestial.void',
          password: '',
          chatCount: 0,
          isPremium: true // Grant premium features in demo mode so they can test everything
      });
  };

  const handleConnect = async () => {
    setError(null);
    setIsMuted(false);
    isMutedRef.current = false;

    if (!user) return;

    // FREEMIUM CHECK
    if (!user.isPremium && (user.chatCount ?? 0) >= 3) {
        setShowSubscription(true);
        return;
    }
    
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
      const historyKey = `celestial_history_${user.id}`;
      let savedHistory = localStorage.getItem(historyKey) || '';
      // Truncate history if it gets too long
      if (savedHistory.length > 20000) {
        savedHistory = savedHistory.slice(savedHistory.length - 20000);
        const firstNewLine = savedHistory.indexOf('\n');
        if (firstNewLine > -1) savedHistory = savedHistory.slice(firstNewLine + 1);
      }

      const agentName = selectedLanguage === Language.English ? 'Tara' : 'Navika';

      const config = {
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: `
            SYSTEM LANGUAGE SETTING: ${selectedLanguage}
            USER CONTEXT: Name=${user?.name || 'Unknown'}
            ${ASTROLOGER_PROMPT}
            
            PREVIOUS CONTEXT:
            ${savedHistory}
          `,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
        },
      };

      // 4. Connect to Live API
      const sessionPromise = ai.live.connect({
        ...config,
        callbacks: {
          onopen: () => {
             console.log("Gemini Connected");
             setIsConnected(true);
             
             // Update chat count if not premium and not demo
             if (!user.isPremium && !isDemoMode) {
                 const userRef = doc(db, "users", user.id);
                 updateDoc(userRef, { chatCount: increment(1) });
             }

             // Start Input Streaming
             if (!inputAudioContextRef.current || !streamRef.current) return;
             
             sourceRef.current = inputAudioContextRef.current.createMediaStreamSource(streamRef.current);
             processorRef.current = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
             
             processorRef.current.onaudioprocess = (e) => {
                 if (isMutedRef.current) return; // Don't send audio if muted

                 const inputData = e.inputBuffer.getChannelData(0);
                 const pcmBlob = createPcmBlob(inputData);
                 
                 sessionPromise.then(session => {
                     session.sendRealtimeInput({ media: pcmBlob });
                 });
             };
             
             sourceRef.current.connect(processorRef.current);
             processorRef.current.connect(inputAudioContextRef.current.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            // Handle Audio Output
            const base64Audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current) {
                const ctx = outputAudioContextRef.current;
                const audioData = base64ToUint8Array(base64Audio);
                const audioBuffer = await decodeAudioData(audioData, ctx);
                
                // Scheduling
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                
                const source = ctx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(analyserRef.current!); // Connect to analyser
                analyserRef.current!.connect(ctx.destination); // Connect analyser to speakers
                
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                
                audioQueueRef.current.add(source);
                setIsSpeaking(true);
                
                source.onended = () => {
                    audioQueueRef.current.delete(source);
                    if (audioQueueRef.current.size === 0) {
                        setIsSpeaking(false);
                    }
                };
            }

            // Handle Interruptions
            if (msg.serverContent?.interrupted) {
                console.log("Interrupted by user");
                audioQueueRef.current.forEach(s => s.stop());
                audioQueueRef.current.clear();
                nextStartTimeRef.current = 0;
                setIsSpeaking(false);
                setInterruptionFeedback(true);
                setTimeout(() => setInterruptionFeedback(false), 500);
            }
          },
          onclose: () => {
            console.log("Gemini Connection Closed");
            cleanup();
          },
          onerror: (err) => {
            console.error("Gemini Error:", err);
            setError("Connection to the stars was lost. Please try again.");
            cleanup();
          }
        }
      });
      
      currentSessionRef.current = sessionPromise;

    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to connect to the celestial realm.");
      cleanup();
    }
  };

  if (!user) {
    return <AuthModal onLogin={setUser} onGuestLogin={handleGuestLogin} />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-between p-6 relative bg-[#050510] overflow-hidden">
      
      {/* Header / Top Bar */}
      <div className="w-full max-w-lg flex justify-between items-center z-20">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center">
                <UserIcon className="w-5 h-5 text-slate-300" />
            </div>
            <div>
                <h3 className="text-white font-serif text-sm">{user.name}</h3>
                <div className="flex items-center gap-1">
                    {user.isPremium ? (
                        <span className="text-[10px] bg-yellow-900/50 text-yellow-500 px-1.5 py-0.5 rounded border border-yellow-700/50">PREMIUM</span>
                    ) : (
                        <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">FREE PLAN</span>
                    )}
                </div>
            </div>
        </div>
        
        <div className="flex gap-2">
            {!user.isPremium && (
                <button 
                  onClick={() => setShowSubscription(true)}
                  className="p-2 rounded-full bg-yellow-600/20 text-yellow-500 hover:bg-yellow-600/30 transition-colors"
                >
                   <Sparkles className="w-5 h-5" />
                </button>
            )}
            <button 
                onClick={() => setShowSettings(true)}
                className="p-2 rounded-full bg-slate-800/50 text-slate-300 hover:bg-slate-700 transition-colors"
            >
                <SettingsIcon className="w-5 h-5" />
            </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 w-full max-w-lg flex flex-col justify-center items-center relative z-10">
        
        {/* Language Selector (Visible when NOT connected) */}
        {!isConnected && (
            <div className="mb-8 animate-fade-in w-full">
                <label className="text-slate-400 text-xs uppercase tracking-widest mb-3 block text-center">Select Language</label>
                <div className="flex flex-wrap justify-center gap-3">
                    {Object.values(Language).map(lang => (
                        <button
                            key={lang}
                            onClick={() => setSelectedLanguage(lang)}
                            className={`px-4 py-2 rounded-xl text-sm transition-all border ${
                                selectedLanguage === lang 
                                ? 'bg-purple-600 text-white border-purple-400 shadow-[0_0_15px_rgba(147,51,234,0.5)] scale-105' 
                                : 'bg-slate-900/50 text-slate-400 border-slate-700 hover:bg-slate-800 hover:border-slate-600'
                            }`}
                        >
                            {lang}
                        </button>
                    ))}
                </div>
            </div>
        )}

        {/* Status Messages */}
        <div className="h-8 mb-4">
             {error && (
                <div className="inline-flex items-center gap-2 bg-red-900/50 text-red-200 px-4 py-2 rounded-xl text-sm border border-red-800 animate-shake">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                </div>
             )}
             
             {interruptionFeedback && (
                 <div className="text-yellow-400 text-sm font-medium animate-bounce text-center">
                     Listening...
                 </div>
             )}
        </div>

        {/* Visualizer */}
        <div className="relative">
            <CrystalBall 
                analyser={analyserRef.current} 
                isConnected={isConnected} 
                isSpeaking={isSpeaking}
                isMuted={isMuted} 
            />
            
            {/* Status Text under ball */}
            <div className="absolute -bottom-16 w-full text-center">
                <p className={`text-sm font-serif transition-colors duration-500 ${isConnected ? 'text-purple-300' : 'text-slate-500'}`}>
                    {isConnected 
                        ? (isSpeaking ? "Divining..." : (isMuted ? "Muted" : "Listening to your soul...")) 
                        : "Touch the Call button to begin"}
                </p>
            </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="w-full max-w-lg mb-8 z-20">
        <div className="flex justify-center items-center gap-6">
            
            {isConnected ? (
                <>
                    <button 
                        onClick={handleToggleMute}
                        className={`p-4 rounded-full transition-all duration-300 ${
                            isMuted 
                            ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30 ring-1 ring-red-500/50' 
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                    >
                        {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                    </button>

                    <div className="flex flex-col items-center gap-1">
                        <button 
                            onClick={cleanup}
                            className="p-6 rounded-full bg-red-600 text-white shadow-[0_0_30px_rgba(220,38,38,0.4)] hover:bg-red-700 hover:scale-105 transition-all duration-300"
                        >
                            <PhoneOff className="w-8 h-8" />
                        </button>
                        <span className="text-xs text-slate-500 font-medium">END CALL</span>
                    </div>

                    {/* Dummy Volume Indicator (Could be real output volume control) */}
                    <div className="p-4 rounded-full bg-slate-800 text-slate-500">
                        <Volume2 className="w-6 h-6" />
                    </div>
                </>
            ) : (
                <button 
                    onClick={handleConnect}
                    className="group relative flex items-center justify-center p-1 rounded-full bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 hover:scale-105 transition-transform duration-500"
                >
                    <div className="absolute inset-0 rounded-full blur-xl bg-purple-600 opacity-50 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <div className="relative bg-slate-900 rounded-full p-6 w-20 h-20 flex items-center justify-center border border-white/10">
                        <Sparkles className="w-8 h-8 text-white group-hover:animate-spin-slow" />
                    </div>
                    <div className="absolute -bottom-10 text-white font-serif text-sm tracking-widest opacity-80">
                        CONNECT
                    </div>
                </button>
            )}
        </div>
      </div>

      {/* Modals */}
      {showSettings && (
        <SettingsModal 
            user={user} 
            currentLanguage={selectedLanguage}
            onClose={() => setShowSettings(false)} 
            onLogout={() => {
                if(isDemoMode) {
                    setIsDemoMode(false);
                    setUser(null);
                } else {
                    signOut(auth);
                }
                setShowSettings(false);
            }}
            onUpdateUser={setUser}
            onDeleteUser={() => setUser(null)}
            onLanguageChange={setSelectedLanguage}
        />
      )}

      {showSubscription && (
        <SubscriptionModal 
            onSubscribe={handleSubscribe} 
            onClose={() => setShowSubscription(false)} 
        />
      )}
      
    </div>
  );
};

export default App;