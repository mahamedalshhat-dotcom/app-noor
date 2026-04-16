import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, Square, RefreshCw, CheckCircle2, AlertCircle, Volume2, Square as StopIcon, ChevronDown } from 'lucide-react';
import { checkRecitation } from '../lib/gemini';
import { cn } from '../lib/utils';
import { db, type Surah, type Ayah } from '../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';

export default function RecitationCheck() {
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedSurah, setSelectedSurah] = useState<Surah | null>(null);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);
  const [surahText, setSurahText] = useState<string>('');
  const [showSurahList, setShowSurahList] = useState(false);
  
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const surahs = useLiveQuery(() => db.surahs.toArray(), []);

  useEffect(() => {
    if (selectedSurah) {
      loadSurahText(selectedSurah.id);
    }
  }, [selectedSurah]);

  const loadSurahText = async (id: number) => {
    const ayahs = await db.ayahs.where('surahId').equals(id).toArray();
    const text = ayahs.map(a => a.text).join(' ');
    setSurahText(text);
  };

  const startRecording = async () => {
    if (!selectedSurah) {
      alert("يرجى اختيار سورة أولاً");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (event) => {
        audioChunks.current.push(event.data);
      };

      mediaRecorder.current.onstop = async () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
        
        // Revoke old URL if exists
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(',')[1];
          analyzeRecitation(base64);
        };
      };

      mediaRecorder.current.start();
      setIsRecording(true);
      setResult(null);
    } catch (err) {
      console.error("Microphone Access Error:", err);
      alert("يرجى السماح بالوصول إلى الميكروفون لاستخدام هذه الميزة.");
    }
  };

  const stopRecording = () => {
    mediaRecorder.current?.stop();
    setIsRecording(false);
  };

  const analyzeRecitation = async (base64: string) => {
    setIsAnalyzing(true);
    const res = await checkRecitation(base64, surahText || selectedSurah?.name || "سورة مختارة");
    setResult(res);
    setIsAnalyzing(false);
  };

  const playPromiseRef = useRef<Promise<void> | null>(null);

  const togglePlayback = async () => {
    if (!audioUrl) return;
    
    if (isPlaying) {
      if (playPromiseRef.current) {
        try {
          await playPromiseRef.current;
        } catch (err) {
          // Ignore interruption
        }
      }
      audioRef.current?.pause();
      setIsPlaying(false);
    } else {
      const audio = new Audio();
      audio.src = audioUrl;
      audioRef.current = audio;
      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => setIsPlaying(false);
      try {
        playPromiseRef.current = audio.play();
        setIsPlaying(true);
        await playPromiseRef.current;
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error("Playback failed", err);
        }
        setIsPlaying(false);
      } finally {
        playPromiseRef.current = null;
      }
    }
  };

  return (
    <div className="h-full flex flex-col items-center space-y-6 py-4">
      <div className="text-center">
        <p className="text-[10px] uppercase tracking-[0.3em] text-sacred-gold font-bold mb-2">المصحح الذكي</p>
        <h2 className="text-xl font-display font-bold">تصحيح التلاوة بالذكاء الاصطناعي</h2>
      </div>

      {/* Surah Selection */}
      <div className="relative w-full">
        <button 
          onClick={() => setShowSurahList(!showSurahList)}
          className="w-full flex justify-between items-center p-4 bg-white/60 rounded-2xl border border-sacred-gold/10 hover:border-sacred-gold/30 transition-all"
        >
          <span className="font-bold text-sm">
            {selectedSurah ? selectedSurah.name : "اختر السورة المراد تصحيحها"}
          </span>
          <ChevronDown className={cn("w-4 h-4 transition-transform", showSurahList && "rotate-180")} />
        </button>

        <AnimatePresence>
          {showSurahList && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full left-0 right-0 mt-2 max-h-60 overflow-y-auto bg-white rounded-2xl shadow-xl border border-sacred-gold/10 z-50 p-2 space-y-1"
            >
              {surahs?.map(s => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSelectedSurah(s);
                    setShowSurahList(false);
                    setResult(null);
                    setAudioUrl(null);
                  }}
                  className="w-full text-right p-3 hover:bg-sacred-gold/10 rounded-xl transition-all font-quran text-lg"
                >
                  {s.name}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Target Text */}
      {selectedSurah && (
        <div className="glass-card rounded-3xl p-6 w-full text-center max-h-48 overflow-y-auto">
          <p className="quran-text text-xl text-sacred-green">
            {surahText || "جاري تحميل النص..."}
          </p>
        </div>
      )}

      {/* Recording Button */}
      <div className="relative pt-4">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isAnalyzing || !selectedSurah}
          className={cn(
            "w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 relative z-10",
            isRecording ? "bg-red-500 text-white shadow-red-200 shadow-2xl" : "bg-sacred-gold text-white shadow-sacred-gold/20 shadow-2xl",
            (isAnalyzing || !selectedSurah) && "opacity-50 cursor-not-allowed"
          )}
        >
          {isRecording ? <Square className="w-8 h-8 fill-current" /> : <Mic className="w-8 h-8" />}
        </motion.button>
        
        {isRecording && (
          <motion.div 
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 1.5, opacity: 0 }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="absolute inset-0 rounded-full bg-red-500 pointer-events-none"
          />
        )}
      </div>

      {/* Analysis Result */}
      <AnimatePresence>
        {isAnalyzing && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 text-sacred-gold"
          >
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="text-xs font-bold">جاري تحليل التلاوة...</span>
          </motion.div>
        )}

        {result && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
              "glass-card rounded-3xl p-6 w-full flex flex-col items-center gap-4",
              result.isCorrect ? "border-sacred-green/30" : "border-red-200"
            )}
          >
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center",
              result.isCorrect ? "bg-sacred-green/10 text-sacred-green" : "bg-red-50 text-red-500"
            )}>
              {result.isCorrect ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
            </div>
            
            <div className="text-center">
              <h4 className="font-bold text-sm mb-1">{result.isCorrect ? "أحسنت!" : "ملاحظات على التلاوة"}</h4>
              <p className="text-xs text-sacred-ink/60 leading-relaxed">{result.feedback}</p>
            </div>

            {result.mistakes?.length > 0 && (
              <div className="w-full space-y-2">
                {result.mistakes.map((m: string, i: number) => (
                  <div key={i} className="bg-red-50 text-red-600 text-[10px] p-2 rounded-lg flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-red-400" />
                    {m}
                  </div>
                ))}
              </div>
            )}

            {audioUrl && (
              <button 
                onClick={togglePlayback}
                className="flex items-center gap-2 text-[10px] text-sacred-gold font-bold hover:underline"
              >
                {isPlaying ? (
                  <>
                    <StopIcon className="w-3 h-3 fill-current" />
                    إيقاف الاستماع
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3 h-3" />
                    استمع لتسجيلك
                  </>
                )}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
