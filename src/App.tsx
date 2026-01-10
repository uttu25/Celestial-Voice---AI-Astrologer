import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, HarmCategory, HarmBlockThreshold } from '@google/genai';
import { Mic, MicOff, Volume2, Sparkles, AlertCircle, Settings as SettingsIcon, PhoneOff, User as UserIcon, Menu } from 'lucide-react';
import { Language, ASTROLOGER_PROMPT, User } from './types';
import { createPcmBlob, base64ToUint8Array, decodeAudioData } from './utils/audio';
// CHANGED: Import api instead of storage
import { api } from './api'; 
import CrystalBall from './components/CrystalBall';
import AuthModal from './components/AuthModal';
import SettingsModal from './components/SettingsModal';
import SubscriptionModal from './components/SubscriptionModal';
import SummaryModal from './components/SummaryModal';
import ProfileModal from './components/ProfileModal';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(Language.English);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [interruptionFeedback, setInterruptionFeedback] = useState(false);
  
  // Sparkle Particles
  const [particles, setParticles] = useState<Array<{x: number, y: number, size: number, duration: number, delay: number}>>([]);
  
  // Summary State
  const [showSummary, setShowSummary] = useState(false);
  const [summaryContent, setSummaryContent] = useState('');
  const [transcriptContent, setTranscriptContent] = useState('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  
  // Refs
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const isMutedRef = useRef(false);
  const nextStartTimeRef = useRef<number>(0);
  const audioQueueRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const currentSessionRef = useRef<Promise<any> | null>(null);
  const transcriptionHistoryRef = useRef<string[]>([]);
  const currentInputTranscription = useRef('');
  const currentOutputTranscription = useRef('');

  // ----------------------------------------------------------------------
  // INITIALIZATION
  // ----------------------------------------------------------------------
  useEffect(() => {
    // 1. Check API Key (Supports both Vite env and standard env)
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey || apiKey.length < 10) {
        setError("Service unavailable. Please contact support.");
    }

    // 2. Load User from Supabase (CHANGED: Replaces storage.getUser)
    const initSession = async () => {
        try {
            const currentUser = await api.getCurrentSession();
            if (currentUser) {
                setUser(currentUser);
            }
        } catch (err) {
            console.error("Failed to restore session", err);
        }
    };
    initSession();

    // 3. Init Particles
    const newParticles = Array.from({ length: 40 }).map(() => ({
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 3 + 1,
        duration: Math.random() * 3 + 2, // 2-5s
        delay: Math.random() * 5
    }));
    setParticles(newParticles);
  }, []);

  // ----------------------------------------------------------------------
  // LOGIC
  // ----------------------------------------------------------------------

  const generateCallSummary = async (transcript: string) => {
    setTranscriptContent(transcript);
    setShowSummary(true);

    if (!transcript.trim()) {
        setSummaryContent("The stars were silent. No conversation was recorded.");
        return;
    }

    setIsGeneratingSummary(true);

    try {
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.API_KEY;
        if (!apiKey) {
            throw new Error("System error. Cannot generate summary.");
        }

        const ai = new GoogleGenAI({ apiKey });
        
        const prompt = `
        You are an expert Vedic Astrologer. 
        Analyze the following conversation transcript between you (the Astrologer) and the user (the Seeker).
        
        TRANSCRIPT:
        ${transcript}
        
        Provide a structured summary using the following sections with Markdown headers:
        
        ### 🔮 Guidance
        [List actionable advice given]
        
        ### 🛡️ Protection
        [List protection mantras, rituals, or habits mentioned]
        
        ### 🌌 Future Insight
        [Summarize predictions made]
        
        Tone: Compassionate, spiritual, and empowering.
        Language: ${selectedLanguage}
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash', 
            contents: prompt,
            config: {
                safetySettings: [
                    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
                    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
                    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
                    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
                ]
            }
        });
        
        const generatedText = response.text || "The stars are silent. No summary could be generated.";
        setSummaryContent(generatedText);

        // CHANGED: Save to Supabase (Replaces storage.saveChat)
        if (user) {
            await api.saveChat(user.id, {
                id: '', // Database generates ID
                transcript,
                summary: generatedText,
                timestamp: new Date().toISOString(),
                language: selectedLanguage
            });
        }

    } catch (e: any) {
        console.error("Summary generation failed");
        let errorMsg = "Failed to consult the archives of fate.";
        
        if (e.message && e.message.includes("404")) {
            errorMsg = "Service Temporarily Unavailable.";
        }
        
        setSummaryContent(errorMsg + "\n\n(You can still view the full transcript in the 'Transcript' tab)");
    } finally {
        setIsGeneratingSummary(false);
    }
  };

  const cleanup = useCallback(async (shouldGenerateSummary = false) => {
    setIsConnected(false);
    setIsSpeaking(false);
    setIsMuted(false);
    isMutedRef.current = false;
    
    const finalHistory = [...transcriptionHistoryRef.current];
    if (currentInputTranscription.current.trim()) {
        finalHistory.push(`User: ${currentInputTranscription.current}`);
    }
    if (currentOutputTranscription.current.trim()) {
        finalHistory.push(`Astrologer: ${currentOutputTranscription.current}`);
    }
    
    audioQueueRef.current.forEach(source => {
      try { source.stop(); } catch (e) { /* ignore */ }
    });
    audioQueueRef.current.clear();
    nextStartTimeRef.current = 0;

    if (currentSessionRef.current) {
        currentSessionRef.current.then(session => {
            try { session.close(); } catch (e) { console.error("Error closing session:", e); }
        }).catch(e => { console.error("Error handling session:", e); });
        currentSessionRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    
    if (inputAudioContextRef.current) {
      if (inputAudioContextRef.current.state !== 'closed') {
        inputAudioContextRef.current.close();
      }
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
       if (outputAudioContextRef.current.state !== 'closed') {
        outputAudioContextRef.current.close();
      }
      outputAudioContextRef.current = null;
    }

    transcriptionHistoryRef.current = [];
    currentInputTranscription.current = '';
    currentOutputTranscription.current = '';

    if (shouldGenerateSummary) {
        await generateCallSummary(finalHistory.join('\n'));
    }

  }, [user, selectedLanguage]);

  const handleToggleMute = () => {
    const newState = !isMuted;
    setIsMuted(newState);
    isMutedRef.current = newState;
  };

  const handleSubscribe = async () => {
    if (user) {
        // CHANGED: Update via Supabase API (Replaces storage.updateUserFields)
        try {
            const updated = await api.updateUser(user.id, { isPremium: true });
            if (updated) setUser(updated);
            setShowSubscription(false);
        } catch (e) {
            console.error("Subscription update failed", e);
            setError("Payment recorded but synchronization failed. Please refresh.");
        }
    }
  };

  const handleEndCall = () => {
      cleanup(true);
  };

  const handleConnect = async () => {
    setError(null);
    setIsMuted(false);
    isMutedRef.current = false;
    setSummaryContent('');
    setTranscriptContent('');
    setShowSummary(false);

    if (!navigator.onLine) {
        setError("No internet connection. The spirits cannot reach you.");
        return;
    }

    // Get API Key
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
        setError("System configuration missing.");
        return;
    }

    if (!user) return;

    // Use current user state for check
    if (user && !user.isPremium && (user.chatCount ?? 0) >= 3) {
        setShowSubscription(true);
        return;
    }
    
    await cleanup(false);
    
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      inputAudioContextRef.current = new AudioContextClass({ sampleRate: 16000 });
      outputAudioContextRef.current = new AudioContextClass({ sampleRate: 24000 });

      if (inputAudioContextRef.current.state === 'suspended') {
          await inputAudioContextRef.current.resume();
      }
      if (outputAudioContextRef.current.state === 'suspended') {
          await outputAudioContextRef.current.resume();
      }

      analyserRef.current = outputAudioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ai = new GoogleGenAI({ apiKey });
      
      const config = {
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {}, 
          outputAudioTranscription: {},
          systemInstruction: `
            SYSTEM LANGUAGE SETTING: ${selectedLanguage}
            USER CONTEXT: Name=${user?.name || 'Unknown'}
            ${ASTROLOGER_PROMPT}
          `,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          safetySettings: [
             { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
             { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
             { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
             { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
          ]
        },
      };

      const sessionPromise = ai.live.connect({
        ...config,
        callbacks: {
          onopen: async () => { // CHANGED: Added async
             console.log("Gemini Connected");
             setIsConnected(true);
             
             // CHANGED: Increment Chat Count via Supabase
             if (user && !user.isPremium) {
                 const newCount = (user.chatCount || 0) + 1;
                 try {
                     const updated = await api.updateUser(user.id, { chatCount: newCount });
                     if (updated) setUser(updated);
                 } catch (e) {
                     console.error("Failed to update count", e);
                 }
             }

             if (!inputAudioContextRef.current || !streamRef.current) return;
             
             sourceRef.current = inputAudioContextRef.current.createMediaStreamSource(streamRef.current);
             processorRef.current = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
             
             processorRef.current.onaudioprocess = (e) => {
                 if (isMutedRef.current) return;

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
            if (msg.serverContent?.outputTranscription) {
                currentOutputTranscription.current += msg.serverContent.outputTranscription.text;
            } else if (msg.serverContent?.inputTranscription) {
                currentInputTranscription.current += msg.serverContent.inputTranscription.text;
            }

            if (msg.serverContent?.turnComplete) {
                const fullInput = currentInputTranscription.current;
                const fullOutput = currentOutputTranscription.current;
                
                if (fullInput) transcriptionHistoryRef.current.push(`User: ${fullInput}`);
                if (fullOutput) transcriptionHistoryRef.current.push(`Astrologer: ${fullOutput}`);
                
                currentInputTranscription.current = '';
                currentOutputTranscription.current = '';
            }

            const base64Audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current) {
                const ctx = outputAudioContextRef.current;
                const audioData = base64ToUint8Array(base64Audio);
                const audioBuffer = await decodeAudioData(audioData, ctx);
                
                if (ctx.state === 'suspended') {
                    await ctx.resume();
                }

                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                
                const source = ctx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(analyserRef.current!); 
                analyserRef.current!.connect(ctx.destination);
                
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

            if (msg.serverContent?.interrupted) {
                audioQueueRef.current.forEach(s => s.stop());
                audioQueueRef.current.clear();
                nextStartTimeRef.current = 0;
                setIsSpeaking(false);
                setInterruptionFeedback(true);
                setTimeout(() => setInterruptionFeedback(false), 500);
            }
          },
          onclose: (e) => {
            console.log("Gemini Connection Closed", e);
            cleanup(true);
          },
          onerror: (err: any) => {
            console.error("Gemini Error:", err);
            
            let errorMessage = "Connection to the stars was lost. ";
            
            if (err instanceof Error) {
                errorMessage += err.message;
            } else if (typeof err === 'object' && err !== null) {
                if (err.type === 'error' && err.target instanceof WebSocket) {
                   errorMessage += "Connection failed. Please check your network.";
                } else {
                   errorMessage += "An unknown error occurred.";
                }
            } else {
                errorMessage += "Unknown Error.";
            }
            
            setError(errorMessage);
            cleanup(false);
          }
        }
      });
      
      currentSessionRef.current = sessionPromise;

    } catch (e: any) {
      console.error(e);
      setError("Failed to connect to the celestial realm.");
      cleanup(false);
    }
  };

  if (error && error.includes("Service unavailable")) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 text-center">
            <div className="glass-panel border-red-500/30 p-8 rounded-3xl max-w-md backdrop-blur-xl">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl text-white font-serif mb-2">Configuration Error</h2>
                <p className="text-slate-300 mb-6">{error}</p>
            </div>
        </div>
      );
  }

  if (!user) {
    return <AuthModal onLogin={setUser} />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-between p-6 relative overflow-hidden font-sans">
      
      {/* Floating Particles/Stars */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          {particles.map((p, i) => (
              <div 
                  key={i}
                  className="absolute bg-white rounded-full animate-twinkle opacity-0"
                  style={{
                      left: `${p.x}%`, 
                      top: `${p.y}%`,
                      width: `${p.size}px`, 
                      height: `${p.size}px`,
                      animationDuration: `${p.duration}s`,
                      animationDelay: `${p.delay}s`,
                      boxShadow: `0 0 ${p.size * 2}px rgba(255,255,255,0.8)`
                  }}
              />
          ))}
      </div>

      {/* Ambient Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-900/30 rounded-full blur-[100px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-900/30 rounded-full blur-[100px] animate-pulse delay-700"></div>

      {/* Header / Top Bar */}
      <div className="w-full max-w-lg flex justify-between items-center z-20 animate-slide-up">
        <button 
            onClick={() => setShowProfile(true)}
            className="flex items-center gap-3 group bg-white/5 hover:bg-white/10 p-2 pr-4 rounded-full border border-white/5 transition-all duration-300"
        >
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg group-hover:shadow-purple-500/30 transition-shadow">
                <UserIcon className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
                <h3 className="text-white font-serif text-sm group-hover:text-purple-300 transition-colors">{user.name}</h3>
                <div className="flex items-center gap-1">
                    {user.isPremium ? (
                        <span className="text-[10px] text-yellow-400 font-medium tracking-wide">STAR CHILD</span>
                    ) : (
                        <span className="text-[10px] text-slate-400">SEEKER</span>
                    )}
                </div>
            </div>
        </button>
        
        <div className="flex gap-2">
            {!user.isPremium && (
                <button 
                  onClick={() => setShowSubscription(true)}
                  className="p-2.5 rounded-full bg-gradient-to-r from-yellow-600/20 to-amber-600/20 text-yellow-500 border border-yellow-500/20 hover:bg-yellow-600/30 transition-all shadow-[0_0_15px_rgba(234,179,8,0.1)] hover:shadow-[0_0_20px_rgba(234,179,8,0.3)]"
                >
                   <Sparkles className="w-5 h-5" />
                </button>
            )}
            <button 
                onClick={() => setShowSettings(true)}
                className="p-2.5 rounded-full bg-white/5 text-slate-300 border border-white/5 hover:bg-white/10 hover:text-white transition-colors"
            >
                <Menu className="w-5 h-5" />
            </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 w-full max-w-lg flex flex-col justify-center items-center relative z-10">
        
        {!isConnected && (
            <div className="mb-10 animate-fade-in w-full text-center">
                <h1 className="text-3xl font-serif text-transparent bg-clip-text bg-gradient-to-r from-white via-purple-200 to-slate-400 mb-6 drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
                    Celestial Voice
                </h1>
                
                <label className="text-slate-400 text-xs uppercase tracking-[0.2em] mb-4 block">Select Your Tongue</label>
                <div className="flex flex-wrap justify-center gap-3">
                    {Object.values(Language).map(lang => (
                        <button
                            key={lang}
                            onClick={() => setSelectedLanguage(lang)}
                            className={`px-5 py-2.5 rounded-xl text-sm transition-all border duration-300 ${
                                selectedLanguage === lang 
                                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-purple-400 shadow-[0_0_20px_rgba(126,34,206,0.4)] transform scale-105' 
                                : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10 hover:border-white/10 hover:text-slate-200'
                            }`}
                        >
                            {lang}
                        </button>
                    ))}
                </div>
            </div>
        )}

        <div className="h-12 mb-2 w-full flex justify-center items-center">
             {error && (
                <div className="inline-flex items-center gap-2 bg-red-500/10 text-red-200 px-4 py-2 rounded-xl text-sm border border-red-500/30 backdrop-blur-md animate-shake shadow-lg">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span className="truncate max-w-[250px]">{error}</span>
                </div>
             )}
             
             {interruptionFeedback && !error && (
                 <div className="px-4 py-2 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 text-sm font-medium animate-pulse backdrop-blur-md">
                     Listening to the universe...
                 </div>
             )}
        </div>

        <div className="relative">
            <CrystalBall 
                analyser={analyserRef.current} 
                isConnected={isConnected} 
                isSpeaking={isSpeaking}
                isMuted={isMuted} 
            />
            
            <div className="absolute -bottom-20 w-full text-center">
                <p className={`text-base font-serif tracking-wide transition-colors duration-500 ${isConnected ? 'text-purple-200 drop-shadow-[0_0_8px_rgba(216,180,254,0.5)]' : 'text-slate-500'}`}>
                    {isConnected 
                        ? (isSpeaking ? "Divining..." : (isMuted ? "Muted" : "Speaking to the Stars...")) 
                        : "Touch the Orbit to Begin"}
                </p>
            </div>
        </div>
      </div>

      <div className="w-full max-w-lg mb-8 z-20">
        <div className="flex justify-center items-center gap-8">
            
            {isConnected ? (
                <>
                    <button 
                        onClick={handleToggleMute}
                        className={`p-5 rounded-full transition-all duration-300 backdrop-blur-md border ${
                            isMuted 
                            ? 'bg-red-500/20 text-red-400 border-red-500/40 hover:bg-red-500/30' 
                            : 'bg-white/10 text-slate-300 border-white/10 hover:bg-white/20'
                        }`}
                    >
                        {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                    </button>

                    <div className="flex flex-col items-center gap-2 -mt-4">
                        <button 
                            onClick={handleEndCall}
                            className="p-8 rounded-full bg-gradient-to-b from-red-600 to-red-700 text-white shadow-[0_0_40px_rgba(220,38,38,0.5)] border-4 border-red-900/50 hover:scale-105 hover:shadow-[0_0_60px_rgba(220,38,38,0.7)] transition-all duration-300 group"
                        >
                            <PhoneOff className="w-8 h-8 group-hover:animate-pulse" />
                        </button>
                        <span className="text-[10px] text-red-400 font-bold tracking-widest uppercase">End Ritual</span>
                    </div>

                    <div className="p-5 rounded-full bg-white/5 text-slate-600 border border-white/5 backdrop-blur-md">
                        <Volume2 className="w-6 h-6" />
                    </div>
                </>
            ) : (
                <button 
                    onClick={handleConnect}
                    className="group relative flex items-center justify-center p-1"
                >
                    <div className="absolute inset-0 rounded-full blur-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 opacity-40 group-hover:opacity-70 transition-opacity duration-700 animate-pulse"></div>
                    
                    <div className="relative bg-[#090A0F] rounded-full p-1 border border-white/10 shadow-2xl">
                         <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-900/80 to-slate-900 flex items-center justify-center border border-white/10 group-hover:border-purple-500/50 transition-colors duration-500 overflow-hidden relative">
                             {/* Inner glow */}
                             <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                             
                             <Sparkles className="w-8 h-8 text-purple-200 group-hover:scale-110 group-hover:text-white transition-transform duration-500 relative z-10" />
                         </div>
                    </div>
                </button>
            )}
        </div>
      </div>

      {/* MODALS */}
      {showProfile && user && (
          <ProfileModal 
            user={user} 
            onClose={() => setShowProfile(false)} 
            onEdit={() => {
                setShowProfile(false);
                setShowSettings(true);
            }}
            onSubscribe={() => {
                setShowProfile(false);
                setShowSubscription(true);
            }}
          />
      )}

      {showSettings && (
        <SettingsModal 
            user={user} 
            currentLanguage={selectedLanguage}
            onClose={() => setShowSettings(false)} 
            // CHANGED: Logout via Supabase
            onLogout={async () => {
                await api.logout();
                setUser(null);
                setShowSettings(false);
            }}
            onUpdateUser={setUser}
            onDeleteUser={async () => {
                await api.logout();
                setUser(null);
            }}
            onLanguageChange={setSelectedLanguage}
        />
      )}

      {showSubscription && (
        <SubscriptionModal 
            onSubscribe={handleSubscribe} 
            onClose={() => setShowSubscription(false)} 
        />
      )}

      <SummaryModal 
        isOpen={showSummary}
        onClose={() => setShowSummary(false)}
        summary={summaryContent}
        transcript={transcriptContent}
        isLoading={isGeneratingSummary}
      />
      
    </div>
  );
};

export default App;
