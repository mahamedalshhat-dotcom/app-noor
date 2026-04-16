import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, SkipBack, SkipForward, X, Volume2, Music } from 'lucide-react';
import { cn } from '../lib/utils';

interface AudioState {
  url: string;
  title: string;
  subtitle: string;
  isPlaying: boolean;
}

export default function AudioPlayer() {
  const [state, setState] = useState<AudioState | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const handlePlayAudio = (e: any) => {
      const { url, title, subtitle } = e.detail;
      setState({ url, title, subtitle, isPlaying: true });
    };

    window.addEventListener('play-quran-audio', handlePlayAudio);
    return () => window.removeEventListener('play-quran-audio', handlePlayAudio);
  }, []);

  const playPromiseRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (state?.url && audioRef.current) {
      audioRef.current.src = state.url;
      if (state.isPlaying) {
        playPromiseRef.current = audioRef.current.play();
        playPromiseRef.current.catch(err => {
          if (err.name !== 'AbortError') {
            console.error("Playback failed", err);
          }
        });
      }
    }
  }, [state?.url]);

  const togglePlay = async () => {
    if (!audioRef.current) return;
    
    if (state?.isPlaying) {
      // If there's an ongoing play request, wait for it before pausing
      if (playPromiseRef.current) {
        try {
          await playPromiseRef.current;
        } catch (err) {
          // Ignore interruption errors
        }
      }
      audioRef.current.pause();
      setState(prev => prev ? { ...prev, isPlaying: false } : null);
    } else {
      try {
        playPromiseRef.current = audioRef.current.play();
        setState(prev => prev ? { ...prev, isPlaying: true } : null);
        await playPromiseRef.current;
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error("Playback failed", err);
        }
        setState(prev => prev ? { ...prev, isPlaying: false } : null);
      } finally {
        playPromiseRef.current = null;
      }
    }
  };

  if (!state) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-24 left-4 right-4 max-w-[calc(448px-2rem)] mx-auto bg-sacred-ink text-white p-4 rounded-3xl shadow-2xl z-[150] flex items-center gap-4 border border-white/10 backdrop-blur-xl"
      >
        <audio 
          ref={audioRef} 
          onEnded={() => setState(prev => prev ? { ...prev, isPlaying: false } : null)}
          onPlay={() => setState(prev => prev ? { ...prev, isPlaying: true } : null)}
          onPause={() => setState(prev => prev ? { ...prev, isPlaying: false } : null)}
        />
        
        <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-sacred-gold shrink-0">
          <Music className={cn("w-6 h-6", state.isPlaying && "animate-pulse")} />
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold truncate">{state.title}</h4>
          <p className="text-[10px] text-white/60 truncate">{state.subtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={togglePlay}
            className="w-10 h-10 rounded-full bg-white text-sacred-ink flex items-center justify-center hover:scale-105 transition-all"
          >
            {state.isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
          </button>
          <button 
            onClick={() => setState(null)}
            className="p-2 text-white/40 hover:text-white transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export function playQuranAudio(url: string, title: string, subtitle: string) {
  window.dispatchEvent(new CustomEvent('play-quran-audio', { detail: { url, title, subtitle } }));
}
