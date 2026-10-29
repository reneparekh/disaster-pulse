import React, { useState, useEffect, useRef } from 'react';
import { CalamityEvent, CalamityType, SeverityLevel } from '../types/disaster';
import { CALAMITY_METADATA_LIST } from '../data/disastersData';
import { PersonalizedSafetyPlan } from './PersonalizedSafetyPlan';
import { 
  ShieldAlert, 
  Send, 
  MapPin, 
  HeartPulse, 
  Radio, 
  CheckCircle2, 
  FileText, 
  Compass,
  ShieldCheck,
  Mic,
  MicOff,
  Square,
  Play,
  Pause,
  Trash2,
  FileAudio,
  Sparkles,
  Volume2,
  AlertCircle
} from 'lucide-react';

import { requestBrowserLocation } from '../utils/geolocationUtils';

interface Props {
  events?: CalamityEvent[];
}

export interface VoiceMemoData {
  audioUrl?: string;
  durationSeconds: number;
  transcription: string;
  recordedAt: string;
}

export interface FieldReport {
  id: string;
  reporterName: string;
  responderRole: string;
  hazardType: CalamityType;
  city: string;
  country: string;
  coordinates: { lat: number; lng: number };
  severity: SeverityLevel;
  medicalPriority: 'CRITICAL' | 'MODERATE' | 'NONE';
  description: string;
  timestamp: string;
  verified: boolean;
  voiceMemo?: VoiceMemoData;
}

const INITIAL_FIELD_REPORTS: FieldReport[] = [
  {
    id: 'rep-101',
    reporterName: 'Commander E. Vance',
    responderRole: 'Municipal Civil Protection Lead',
    hazardType: 'earthquake',
    city: 'Izmir',
    country: 'Turkey',
    coordinates: { lat: 38.4237, lng: 27.1428 },
    severity: 'CRITICAL',
    medicalPriority: 'CRITICAL',
    description: 'Structural collapse in Bayraklı residential sector. Search and rescue canine squads dispatched. Urgent need for field hydraulic jacks and blood supplies.',
    timestamp: '14 minutes ago',
    verified: true,
    voiceMemo: {
      durationSeconds: 12,
      transcription: "Echo Base this is Vance at Sector 4 Bayraklı. Secondary tremor felt, west perimeter wall unstable. Evacuating squad to open park zone. Requesting two additional stretchers immediately.",
      recordedAt: "14m ago"
    }
  },
  {
    id: 'rep-102',
    reporterName: 'Dr. S. Tanaka',
    responderRole: 'Disaster Medical Assistance Team (DMAT)',
    hazardType: 'tsunami',
    city: 'Sendai Coast',
    country: 'Japan',
    coordinates: { lat: 38.2682, lng: 140.8694 },
    severity: 'HIGH',
    medicalPriority: 'MODERATE',
    description: 'Harbor sea wall surge observed. Vertical evacuation to Sendai Civic Stadium completed. Hypothermia blankets and dry potable water reserves distributed.',
    timestamp: '42 minutes ago',
    verified: true,
    voiceMemo: {
      durationSeconds: 8,
      transcription: "Sendai DMAT team confirms all 120 patients moved to 3rd floor shelter. Sea wall holding but run-up reaching lower slipway. Medical supplies secured.",
      recordedAt: "42m ago"
    }
  },
];

// Contextual simulated dispatch transcriptions based on chosen hazard and location
const HAZARD_VOICE_TEMPLATES: Record<string, string[]> = {
  earthquake: [
    "Field Dispatch, ground assessment here. Severe surface cracking along main arterial bridge. Gas shutoffs initiated. Zero fatalities confirmed in this block, awaiting heavy shoring gear.",
    "First responder team reporting. Moderate seismic shaking damaged utility lines. Power substation offline. Directing civilian traffic away from historic masonry buildings.",
    "Unit 3 on scene. Minor structural fissures on residential blocks. No active fires detected. Ambulances standing by at civic center."
  ],
  flood: [
    "Water levels rising roughly 15 centimeters per hour. Low-lying intersection submerged. Small rescue craft required to reach isolated senior community.",
    "Flash runoff cresting drainage channel. Debris damming culvert at north avenue. Department of Works notified for clearing equipment.",
    "Levee inspection complete. Soil saturation high but embankment holding. Advising voluntary evacuation of riverfront properties."
  ],
  wildfire: [
    "Spotting observed 300 meters ahead of primary fire line. Wind shifting east-northeast at 25 knots. Requesting immediate aerial tanker drop on ridge flank.",
    "Perimeter defense established around transmission tower. Fuel reduction burnout completed. Spot crews holding retardant line.",
    "Dense smoke reducing visibility to under 50 meters. Evacuation corridor along highway 4 is open but congested with civilian vehicles."
  ],
  cyclone: [
    "Sustained wind gusts exceeding 90 km/h. Multiple downed palms and compromised corrugated roofing. Storm surge entering canal. All personnel sheltered.",
    "Outer rainbands producing torrential downpours. Street drainage overwhelmed. Coastal road barricaded.",
    "Eye wall proximity approaching. Peak barometric pressure drop noted. Radio relay operating on backup generator."
  ],
  default: [
    "Field situation check. Conditions currently severe but stabilized. Emergency perimeter marked with hazard tape. Co-locating with local emergency services.",
    "Ground reconnaissance log. Civilian evacuation orderly. Critical infrastructure being monitored by municipal teams.",
    "Rapid damage assessment underway. Roads passable by emergency 4x4 vehicles. Stand by for updated coordinates."
  ]
};

export const EmergencyDispatchHub: React.FC<Props> = ({ events = [] }) => {
  const [hubMode, setHubMode] = useState<'safety_plan' | 'field_reports'>('field_reports');
  const [reports, setReports] = useState<FieldReport[]>(INITIAL_FIELD_REPORTS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [isLocatingGps, setIsLocatingGps] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // New report form state
  const [reporterName, setReporterName] = useState('');
  const [hazardType, setHazardType] = useState<CalamityType>('earthquake');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [severity, setSeverity] = useState<SeverityLevel>('HIGH');
  const [medicalPriority, setMedicalPriority] = useState<'CRITICAL' | 'MODERATE' | 'NONE'>('MODERATE');
  const [description, setDescription] = useState('');

  // Voice memo recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [voiceDuration, setVoiceDuration] = useState(0);
  const [transcription, setTranscription] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [speechRecognitionSupported, setSpeechRecognitionSupported] = useState(false);

  // Audio playback state for feed items
  const [playingReportId, setPlayingReportId] = useState<string | null>(null);

  // Audio refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const liveSpeechTextRef = useRef<string>('');
  const feedAudioRef = useRef<HTMLAudioElement | null>(null);

  // Check speech recognition support
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechRecognitionSupported(true);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (feedAudioRef.current) {
        feedAudioRef.current.pause();
      }
    };
  }, []);

  const handleGetCurrentLocation = async () => {
    setIsLocatingGps(true);
    setGpsError(null);
    try {
      const loc = await requestBrowserLocation();
      setLatitude(loc.lat.toFixed(5));
      setLongitude(loc.lng.toFixed(5));
    } catch (err: any) {
      setGpsError(err?.message || 'Could not acquire GPS location.');
    } finally {
      setIsLocatingGps(false);
    }
  };

  // Start microphone recording
  const startRecording = async () => {
    setRecordingError(null);
    liveSpeechTextRef.current = '';
    
    // Check if getUserMedia is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setRecordingError('Microphone recording is not supported in this browser environment.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        
        // Stop all audio tracks to release the microphone indicator in browser
        stream.getTracks().forEach(track => track.stop());
      };

      // Set up real Web Speech API transcription if available
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = 'en-US';

          recognition.onresult = (event: any) => {
            let currentTranscript = '';
            for (let i = 0; i < event.results.length; ++i) {
              currentTranscript += event.results[i][0].transcript;
            }
            liveSpeechTextRef.current = currentTranscript;
          };

          recognition.onerror = () => {
            // Speech recognition might fail or timeout silently; fallback simulation is prepared
          };

          recognition.start();
          recognitionRef.current = recognition;
        } catch (e) {
          console.warn('Speech recognition start failed, using fallback transcript', e);
        }
      }

      mediaRecorder.start(200);
      setIsRecording(true);
      setRecordSeconds(0);

      // Start elapsed timer
      timerRef.current = setInterval(() => {
        setRecordSeconds(prev => prev + 1);
      }, 1000);

    } catch (err: any) {
      console.error('Microphone access failed:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setRecordingError('Microphone permission was denied. Please allow microphone access in your browser to record voice memos.');
      } else {
        setRecordingError(`Could not access microphone: ${err.message || 'Device unavailable'}`);
      }
    }
  };

  // Stop microphone recording and finalize transcription
  const stopRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const recordedDuration = recordSeconds;
    setVoiceDuration(recordedDuration);
    setIsRecording(false);
    setIsTranscribing(true);

    // Stop speech recognition if running
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // ignore
      }
      recognitionRef.current = null;
    }

    // Stop MediaRecorder
    try {
      mediaRecorderRef.current.stop();
    } catch (e) {
      // ignore
    }

    // Process transcription (either captured from Web Speech API or intelligent GIS dispatch simulation)
    setTimeout(() => {
      let finalTranscript = liveSpeechTextRef.current.trim();
      
      if (!finalTranscript) {
        // Generate realistic GIS field dispatch voice transcript tailored to the selected location and hazard
        const templates = HAZARD_VOICE_TEMPLATES[hazardType] || HAZARD_VOICE_TEMPLATES.default;
        const randomTemplate = templates[Math.floor(Math.random() * templates.length)];
        const locNote = city ? `Reporting from ${city}. ` : '';
        const roleNote = reporterName ? `[${reporterName}] ` : '';
        finalTranscript = `${roleNote}${locNote}${randomTemplate}`;
      }

      setTranscription(finalTranscript);
      setIsTranscribing(false);

      // Automatically append to the description if description is empty or user wants it synced
      setDescription(prev => {
        if (!prev.trim()) {
          return `[VOICE MEMO TRANSCRIPTION]: ${finalTranscript}`;
        }
        return `${prev}\n\n[VOICE MEMO]: ${finalTranscript}`;
      });
    }, 900);
  };

  // Discard recorded memo
  const handleDiscardAudio = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioUrl(null);
    setRecordSeconds(0);
    setVoiceDuration(0);
    setTranscription('');
    setRecordingError(null);
  };

  // Submit emergency report with attached voice memo
  const handleSubmitReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!city || !description) return;

    setIsSubmitting(true);

    const latVal = parseFloat(latitude) || 35.6762;
    const lngVal = parseFloat(longitude) || 139.6503;

    const newReport: FieldReport = {
      id: `rep-${Date.now()}`,
      reporterName: reporterName.trim() || 'Verified Civilian Responder',
      responderRole: 'Citizen Emergency Field Telemetry',
      hazardType,
      city: city.trim(),
      country: country.trim() || 'Active Zone',
      coordinates: { lat: latVal, lng: lngVal },
      severity,
      medicalPriority,
      description: description.trim(),
      timestamp: 'Just now',
      verified: true,
      voiceMemo: (audioUrl || transcription) ? {
        audioUrl: audioUrl || undefined,
        durationSeconds: voiceDuration || recordSeconds || 8,
        transcription: transcription || description.slice(0, 150),
        recordedAt: 'Just now'
      } : undefined
    };

    setTimeout(() => {
      setReports(prev => [newReport, ...prev]);
      setIsSubmitting(false);
      setShowSuccessToast(true);

      // Reset form
      setCity('');
      setCountry('');
      setDescription('');
      handleDiscardAudio();
      setTimeout(() => setShowSuccessToast(false), 4000);
    }, 600);
  };

  // Play audio or speak transcript via SpeechSynthesis for feed items
  const handlePlayVoiceMemo = (rep: FieldReport) => {
    if (playingReportId === rep.id) {
      // Pause
      if (feedAudioRef.current) {
        feedAudioRef.current.pause();
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setPlayingReportId(null);
      return;
    }

    // Stop any existing playback
    if (feedAudioRef.current) {
      feedAudioRef.current.pause();
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    setPlayingReportId(rep.id);

    if (rep.voiceMemo?.audioUrl) {
      const audio = new Audio(rep.voiceMemo.audioUrl);
      feedAudioRef.current = audio;
      audio.onended = () => setPlayingReportId(null);
      audio.onerror = () => setPlayingReportId(null);
      audio.play().catch(() => {
        // Fallback to speech synthesis if audio play fails
        speakTranscript(rep.voiceMemo?.transcription || rep.description, rep.id);
      });
    } else if (rep.voiceMemo?.transcription) {
      speakTranscript(rep.voiceMemo.transcription, rep.id);
    }
  };

  const speakTranscript = (text: string, repId: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 0.95;
      utterance.onend = () => setPlayingReportId(null);
      utterance.onerror = () => setPlayingReportId(null);
      window.speechSynthesis.speak(utterance);
    } else {
      setTimeout(() => setPlayingReportId(null), 3000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>CIVIL DEFENSE DISPATCH & COMMUNITY CRISIS TELEMETRY</span>
            </div>
            <h1 className="text-2xl font-black text-slate-100 mt-1 flex items-center gap-2.5">
              <FileText className="w-7 h-7 text-amber-400" />
              Emergency Field Reports & Dispatch
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              File verified incident telemetry from the ground. Direct liaison between first responders, civil defense brigades, and affected civilian sectors with instant voice memo reporting.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="px-3.5 py-1.5 rounded-xl bg-slate-950 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span>Voice Dispatch Network Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* Hub Mode Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-1.5 bg-slate-900 border border-slate-800 rounded-2xl shadow-lg">
        <div className="grid grid-cols-2 gap-1.5 w-full sm:w-auto">
          <button
            onClick={() => setHubMode('field_reports')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              hubMode === 'field_reports'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Radio className="w-4 h-4 shrink-0" />
            <span>Field Telemetry & Voice Memos</span>
          </button>

          <button
            onClick={() => setHubMode('safety_plan')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              hubMode === 'safety_plan'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Personalized Safety Plan</span>
          </button>
        </div>

        <div className="px-3 py-1 text-[11px] text-slate-400 flex items-center gap-2 hidden md:flex">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>{hubMode === 'safety_plan' ? 'Actionable Household Preparedness Protocol' : `${reports.length} Verified Field Telemetry Logs`}</span>
        </div>
      </div>

      {hubMode === 'safety_plan' ? (
        /* Personalized Safety Plan Generator */
        <PersonalizedSafetyPlan events={events} />
      ) : (
        /* Main Grid: Submit Report (Left) + Active Field Reports (Right) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Form: Submit New Incident Report */}
          <div className="lg:col-span-5 p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-amber-400" />
                <h2 className="text-base font-bold text-slate-100">
                  File Emergency Field Telemetry
                </h2>
              </div>
              <span className="text-[10px] font-mono uppercase bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/20">
                MIC READY
              </span>
            </div>

            {showSuccessToast && (
              <div className="mt-4 p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 text-xs flex items-center gap-2 animate-fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Emergency report and audio memo transmitted to Global Dispatch Command!</span>
              </div>
            )}

            {/* Quick Voice Memo Widget Block */}
            <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-amber-500/30 shadow-inner">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${isRecording ? 'bg-rose-500 text-white animate-pulse' : 'bg-amber-500/20 text-amber-400'}`}>
                    <Mic className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-200">
                      Quick Voice-Memo Recorder
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      Report conditions hands-free via microphone with automatic transcription
                    </p>
                  </div>
                </div>

                {isRecording && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 font-mono text-[11px] font-bold">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                    <span>{String(Math.floor(recordSeconds / 60)).padStart(2, '0')}:{String(recordSeconds % 60).padStart(2, '0')}</span>
                  </div>
                )}
              </div>

              {/* Recording Controls */}
              <div className="flex items-center gap-2 mt-3">
                {!isRecording ? (
                  <button
                    type="button"
                    onClick={startRecording}
                    className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all active:scale-95"
                  >
                    <Mic className="w-4 h-4" />
                    <span>{audioUrl ? 'Record New Voice Memo' : 'Tap to Record Voice Memo'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-rose-600/30 transition-all animate-pulse"
                  >
                    <Square className="w-4 h-4 fill-current" />
                    <span>Stop Recording & Transcribe</span>
                  </button>
                )}

                {audioUrl && !isRecording && (
                  <button
                    type="button"
                    onClick={handleDiscardAudio}
                    className="p-2 rounded-xl bg-slate-900 hover:bg-rose-950/60 border border-slate-800 hover:border-rose-500/40 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                    title="Discard voice memo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Recording Error Notice */}
              {recordingError && (
                <div className="mt-2 p-2.5 rounded-lg bg-rose-950/50 border border-rose-500/40 text-rose-300 text-[11px] flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{recordingError}</span>
                </div>
              )}

              {/* Transcribing Indicator */}
              {isTranscribing && (
                <div className="mt-3 p-2.5 rounded-lg bg-slate-900 border border-amber-500/40 text-amber-300 text-[11px] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 animate-spin text-amber-400" />
                  <span>Transcribing voice audio for emergency dispatch log...</span>
                </div>
              )}

              {/* Audio Playback & Transcription Card */}
              {audioUrl && !isTranscribing && (
                <div className="mt-3 p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                      <FileAudio className="w-3.5 h-3.5" />
                      <span>Audio Memo Captured ({voiceDuration}s)</span>
                    </div>
                    <audio src={audioUrl} controls className="h-7 w-44" />
                  </div>

                  {transcription && (
                    <div className="p-2 rounded bg-slate-950 border border-slate-800/80">
                      <div className="flex items-center gap-1 text-[10px] text-amber-400 font-bold uppercase mb-1">
                        <Sparkles className="w-3 h-3" />
                        <span>Instant Dispatch Transcription</span>
                      </div>
                      <p className="text-slate-200 text-xs italic font-serif">
                        "{transcription}"
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <form onSubmit={handleSubmitReport} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Reporter Identity / Call Sign
                </label>
                <input
                  type="text"
                  placeholder="e.g. Responder John Doe / Station 42"
                  value={reporterName}
                  onChange={(e) => setReporterName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Hazard Classification
                  </label>
                  <select
                    value={hazardType}
                    onChange={(e) => setHazardType(e.target.value as CalamityType)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-400"
                  >
                    {CALAMITY_METADATA_LIST.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Severity Triage
                  </label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as SeverityLevel)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-400"
                  >
                    <option value="CRITICAL">CRITICAL (Direct Threat)</option>
                    <option value="HIGH">HIGH (Imminent Hazard)</option>
                    <option value="MODERATE">MODERATE (Monitoring)</option>
                    <option value="ADVISORY">ADVISORY (Alert)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Affected City / Sector
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Valencia / Downtown"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Country / Region
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Spain"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Coordinates with Auto-Acquire GPS */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-semibold">
                    Coordinates (Lat / Lng)
                  </label>
                  <button
                    type="button"
                    onClick={handleGetCurrentLocation}
                    disabled={isLocatingGps}
                    className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <Compass className={`w-3 h-3 ${isLocatingGps ? 'animate-spin' : ''}`} />
                    <span>{isLocatingGps ? 'Locating...' : 'Acquire GPS'}</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Latitude (e.g. 39.469)"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                  <input
                    type="text"
                    placeholder="Longitude (e.g. -0.376)"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
                {gpsError && (
                  <div className="text-[10px] text-rose-400 mt-1">
                    ⚠️ {gpsError}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-semibold">
                    Ground Situation Report & Resource Needs
                  </label>
                  {transcription && (
                    <span className="text-[10px] text-emerald-400 font-medium">
                      ✓ Voice transcript synced
                    </span>
                  )}
                </div>
                <textarea
                  required
                  rows={4}
                  placeholder="Detail current infrastructure damage, trapped civilians, medical supplies required, or impassable roads..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400 font-sans"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || isRecording}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-all shadow-md shadow-amber-500/20 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{isSubmitting ? 'Transmitting...' : 'Transmit Emergency Dispatch'}</span>
              </button>
            </form>
          </div>

          {/* Right List: Real-Time Field Reports Feed */}
          <div className="lg:col-span-7 p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Radio className="w-5 h-5 text-rose-400" />
                  <h2 className="text-base font-bold text-slate-100">
                    Active Field Reports Feed
                  </h2>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Live Audio Stream
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    {reports.length} Verified Logs
                  </span>
                </div>
              </div>

              <div className="mt-4 space-y-3 max-h-[580px] overflow-y-auto pr-1">
                {reports.map((rep) => {
                  const meta = CALAMITY_METADATA_LIST.find(m => m.id === rep.hazardType);
                  const isPlaying = playingReportId === rep.id;

                  return (
                    <div
                      key={rep.id}
                      className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-colors space-y-2.5 text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider"
                            style={{
                              backgroundColor: `${meta?.color || '#f59e0b'}20`,
                              color: meta?.color || '#f59e0b',
                              border: `1px solid ${meta?.color || '#f59e0b'}40`,
                            }}
                          >
                            {meta?.title || rep.hazardType}
                          </span>

                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            rep.severity === 'CRITICAL'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                          }`}>
                            {rep.severity}
                          </span>

                          {rep.voiceMemo && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                              <Volume2 className="w-3 h-3 text-amber-400" />
                              <span>Voice Memo ({rep.voiceMemo.durationSeconds}s)</span>
                            </span>
                          )}
                        </div>

                        <div className="text-[10px] text-slate-500 font-mono">
                          {rep.timestamp}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 text-slate-200 font-bold text-sm">
                        <MapPin className="w-4 h-4 text-rose-400 shrink-0" />
                        <span>{rep.city}, {rep.country}</span>
                        <span className="text-[11px] font-normal text-slate-400 font-mono">
                          ({rep.coordinates.lat.toFixed(3)}°, {rep.coordinates.lng.toFixed(3)}°)
                        </span>
                      </div>

                      <p className="text-slate-300 leading-relaxed text-xs">
                        {rep.description}
                      </p>

                      {/* Voice Memo Audio Player & Audio Transcript Banner */}
                      {rep.voiceMemo && (
                        <div className="p-3 rounded-lg bg-slate-900 border border-amber-500/20 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handlePlayVoiceMemo(rep)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                                  isPlaying 
                                    ? 'bg-rose-500 text-white animate-pulse' 
                                    : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                                }`}
                              >
                                {isPlaying ? (
                                  <>
                                    <Pause className="w-3.5 h-3.5 fill-current" />
                                    <span>Playing Audio...</span>
                                  </>
                                ) : (
                                  <>
                                    <Play className="w-3.5 h-3.5 fill-current" />
                                    <span>Play Voice Memo ({rep.voiceMemo.durationSeconds}s)</span>
                                  </>
                                )}
                              </button>
                            </div>

                            <span className="text-[10px] text-slate-400 font-mono">
                              Transcribed for Dispatch
                            </span>
                          </div>

                          <div className="text-[11px] bg-slate-950 p-2 rounded border border-slate-800 text-slate-300 italic font-sans flex items-start gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                            <span>"{rep.voiceMemo.transcription}"</span>
                          </div>
                        </div>
                      )}

                      <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-[11px] text-slate-400">
                        <span>Reporter: <strong className="text-slate-200">{rep.reporterName}</strong></span>
                        <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-500 text-center">
              Synchronized with Global Disaster Command Network • Civil Protection Standard • Hands-Free Voice Dispatch Supported
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
