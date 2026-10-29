import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  Send, 
  Mic, 
  MicOff, 
  Globe2, 
  MapPin, 
  Search, 
  ExternalLink, 
  Sparkles, 
  ShieldAlert, 
  HeartPulse, 
  Compass, 
  Trash2, 
  Radio, 
  RefreshCw,
  AlertTriangle,
  Zap,
  Volume2
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  groundingSources?: Array<{
    title: string;
    uri: string;
    type: 'web' | 'map';
  }>;
}

type AssistantRole = 'commander' | 'medic' | 'evacuation';
type AssistantModel = 'gemini-3.5-flash' | 'gemini-3.1-pro-preview' | 'gemini-3.1-flash-lite';

export const DisasterAiAssistant: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      role: 'model',
      text: 'Global Disaster Command Emergency Intelligence Core online. I can assist with civil defense triage, evacuation routes, search grounding for live disaster bulletins, and Google Maps shelter navigation. How can I assist you?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [role, setRole] = useState<AssistantRole>('commander');
  const [model, setModel] = useState<AssistantModel>('gemini-3.5-flash');
  const [useSearch, setUseSearch] = useState<boolean>(true);
  const [useMaps, setUseMaps] = useState<boolean>(false);
  
  // Audio Transcription state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<any>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Audio Recording with Microphone
  const startRecording = async () => {
    setMicError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setMicError('Microphone recording is not supported on this device/browser.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop all audio tracks
        stream.getTracks().forEach(track => track.stop());

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await handleAudioTranscribe(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      recordTimerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Microphone access denied or error:', err);
      setMicError(err?.message ? `Microphone access error: ${err.message}` : 'Microphone permission denied.');
    }
  };

  const stopRecording = () => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
    }
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleAudioTranscribe = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        if (!base64Data) {
          setIsTranscribing(false);
          return;
        }

        const res = await fetch((await import('../utils/api')).apiUrl('/api/transcribe'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioBase64: base64Data,
            mimeType: 'audio/webm',
          }),
        });

        const data = await res.json();
        if (data.text) {
          setInputQuery(prev => (prev ? `${prev} ${data.text}` : data.text));
        }
        setIsTranscribing(false);
      };
    } catch (error) {
      console.error('Transcription error:', error);
      setIsTranscribing(false);
    }
  };

  // Submit User Message to Gemini
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputQuery).trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputQuery('');
    setIsLoading(true);

    try {
      // Optional: Get user geolocation for Google Maps Grounding
      let userLocation: { latitude: number; longitude: number } | undefined;
      if (useMaps && 'geolocation' in navigator) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 });
          });
          userLocation = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          };
        } catch {
          // Default or fallback location if permission denied
        }
      }

      // Convert history for API
      const history = messages.slice(-8).map(m => ({
        role: m.role,
        text: m.text,
      }));

      const res = await fetch((await import('../utils/api')).apiUrl('/api/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history,
          model,
          role,
          useSearch: useSearch && !useMaps,
          useMaps,
          userLocation,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to receive Gemini response.');
      }

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        role: 'model',
        text: data.text || 'No response text received.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        groundingSources: data.groundingSources,
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (error: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'model',
        text: `⚠️ Emergency transmission error: ${error?.message || 'Server communication failed.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: `init-${Date.now()}`,
        role: 'model',
        text: 'Session history purged. Global Disaster Command Emergency Intelligence Core ready for new directive.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const samplePrompts = [
    'What are the primary structural evacuation protocols for an M7.5 earthquake?',
    'Emergency first-aid triage steps for volcanic ash inhalation & corneal burns',
    'Locate nearest disaster relief shelters & critical healthcare hubs with Google Maps',
    'Search latest live civil defense advisory for active Pacific Ring of Fire storms',
  ];

  return (
    <div className="flex flex-col h-[700px] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
      {/* Top Header & Specialized Controls */}
      <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-100">
                Disaster Intelligence Core
              </h2>
              <span className="text-[10px] text-slate-400 font-mono">
                {model}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Multi-turn civil defense reasoning • Google Search & Maps Grounding • Audio Transcribe
            </p>
          </div>
        </div>

        {/* Specialized Operational Role Selector */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800">
            <button
              onClick={() => setRole('commander')}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                role === 'commander'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Commander
            </button>
            <button
              onClick={() => setRole('medic')}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                role === 'medic'
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Medical Triage
            </button>
            <button
              onClick={() => setRole('evacuation')}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                role === 'evacuation'
                  ? 'bg-sky-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Evacuation Route
            </button>
          </div>

          {/* Model Selector */}
          <select
            value={model}
            onChange={(e) => setModel(e.target.value as AssistantModel)}
            className="bg-slate-950 border border-slate-800 text-slate-300 text-[11px] rounded-lg px-2 py-1 focus:outline-none focus:border-amber-400"
          >
            <option value="gemini-3.5-flash">Gemini 3.5 Flash (Standard)</option>
            <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Deep Reasoning)</option>
            <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (Fast)</option>
          </select>

          <button
            onClick={clearChat}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Clear conversation thread"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Grounding & Capability Bar */}
      <div className="px-4 py-2 bg-slate-950/70 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-slate-400 font-medium">Grounding Tools:</span>

          {/* Google Search Grounding Toggle */}
          <button
            onClick={() => {
              setUseSearch(!useSearch);
              if (!useSearch) setUseMaps(false);
            }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold transition-all border cursor-pointer ${
              useSearch && !useMaps
                ? 'bg-emerald-950/50 text-emerald-300 border-emerald-500/40'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            <Search className="w-3 h-3" />
            <span>Google Search Grounding</span>
          </button>

          {/* Google Maps Grounding Toggle */}
          <button
            onClick={() => {
              setUseMaps(!useMaps);
              if (!useMaps) setUseSearch(false);
            }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold transition-all border cursor-pointer ${
              useMaps
                ? 'bg-sky-950/50 text-sky-300 border-sky-500/40'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            <MapPin className="w-3 h-3" />
            <span>Google Maps Grounding</span>
          </button>
        </div>

        <div className="text-[10px] text-slate-500 font-mono">
          Model SDK: @google/genai • Real-time Grounding Enabled
        </div>
      </div>

      {/* Scrollable Conversation Thread */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold ${
                  isUser
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-800 border border-slate-700 text-amber-400'
                }`}
              >
                {isUser ? 'YOU' : <Bot className="w-4 h-4" />}
              </div>

              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 text-xs leading-relaxed ${
                  isUser
                    ? 'bg-amber-500/10 border border-amber-500/30 text-amber-100 rounded-tr-sm'
                    : 'bg-slate-950 border border-slate-800 text-slate-200 rounded-tl-sm shadow-md'
                }`}
              >
                <div className="flex items-center justify-between gap-3 text-[10px] text-slate-500 pb-1.5 border-b border-slate-800/80 mb-2 font-mono">
                  <span>{isUser ? 'Civilian / Dispatcher' : 'Emergency AI Core'}</span>
                  <span>{msg.timestamp}</span>
                </div>

                <div className="whitespace-pre-wrap">{msg.text}</div>

                {/* Grounding Citations & Direct Google Maps / Search Links */}
                {msg.groundingSources && msg.groundingSources.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-slate-800/80 space-y-1.5">
                    <div className="text-[10px] uppercase tracking-wider font-bold text-amber-400 flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" />
                      <span>Verified Grounding Intelligence Sources</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.groundingSources.map((source, idx) => (
                        <a
                          key={idx}
                          href={source.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-850 text-sky-400 hover:text-sky-300 border border-slate-700 text-[10px] transition-colors"
                        >
                          {source.type === 'map' ? (
                            <MapPin className="w-2.5 h-2.5 text-rose-400" />
                          ) : (
                            <Search className="w-2.5 h-2.5 text-amber-400" />
                          )}
                          <span className="truncate max-w-[200px]">{source.title}</span>
                          <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-70" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400 shrink-0">
              <RefreshCw className="w-4 h-4 animate-spin" />
            </div>
            <div className="p-3.5 rounded-2xl rounded-tl-sm bg-slate-950 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
              <span>Synthesizing crisis telemetry and grounding parameters...</span>
            </div>
          </div>
        )}
      </div>

      {/* Suggested Prompt Chips */}
      {messages.length <= 2 && (
        <div className="px-4 py-2 border-t border-slate-800 bg-slate-950/40">
          <div className="text-[10px] text-slate-500 font-medium mb-1.5">Quick Crisis Queries:</div>
          <div className="flex flex-wrap gap-1.5">
            {samplePrompts.map((p, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(p)}
                className="text-[11px] text-left px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors cursor-pointer truncate max-w-full"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Input Area with Audio Transcription Microphone */}
      <div className="p-4 bg-slate-950 border-t border-slate-800">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          {/* Audio Recording Toggle */}
          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              isRecording
                ? 'bg-rose-600 text-white border-rose-500 animate-pulse'
                : 'bg-slate-900 text-slate-300 hover:text-white border-slate-800 hover:border-slate-700'
            }`}
            title={isRecording ? 'Stop Recording' : 'Voice Input (Microphone Transcribe)'}
          >
            {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            {isRecording && (
              <span className="text-[11px] font-mono font-bold">
                {recordingSeconds}s
              </span>
            )}
          </button>

          {/* Text Input Field */}
          <div className="flex-1 relative">
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder={
                isTranscribing
                  ? 'Transcribing speech with gemini-3.5-transcribe...'
                  : isRecording
                  ? 'Listening to microphone... Speak clearly...'
                  : 'Ask about emergency protocols, evacuation coordinates, or medical triage...'
              }
              disabled={isRecording || isTranscribing}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
            />
            {isTranscribing && (
              <div className="absolute right-3 top-2.5 flex items-center gap-1 text-[11px] text-amber-400 font-mono">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Transcribing...</span>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!inputQuery.trim() || isLoading}
            className={`p-2.5 rounded-xl transition-all cursor-pointer shrink-0 ${
              inputQuery.trim() && !isLoading
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

        {micError && (
          <div className="mt-2 text-[11px] text-rose-400 flex items-center justify-between bg-rose-950/40 border border-rose-500/30 rounded-lg px-2.5 py-1">
            <span>⚠️ {micError}</span>
            <button
              onClick={() => setMicError(null)}
              className="text-xs text-rose-300 hover:text-white cursor-pointer ml-2"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
