'use client';

import React, { useState, useRef } from 'react';
import { VoiceLog } from '../../types/project';
import {
  Play,
  Pause,
  Volume2,
  MapPin,
  Clock,
  User,
  Sparkles,
  ListChecks,
  HardDrive,
  FileAudio,
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { formatDateTime } from '../../lib/utils';

interface VoiceNotePlayerProps {
  voiceLog: VoiceLog;
  onApproveMaterial?: (materialId: string, deductInventory: boolean) => void;
}

export const VoiceNotePlayer: React.FC<VoiceNotePlayerProps> = ({ voiceLog }) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(24); // mock duration in seconds
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play().catch(() => {
          // Mock play state for simulated audio
          setIsPlaying(true);
        });
        setIsPlaying(true);
      }
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 shadow-sm space-y-4">
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="purple" className="flex items-center gap-1 text-[11px] font-bold">
            <Sparkles className="h-3 w-3" />
            {voiceLog.workflow_title || 'Voice Field Note'}
          </Badge>

          <span className="text-xs text-slate-400 flex items-center gap-1">
            <User className="h-3 w-3 text-sky-400" />
            {voiceLog.user_name}
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDateTime(voiceLog.timestamp)}
          </span>
          <Badge variant="success" className="text-[10px]">
            {voiceLog.sync_status}
          </Badge>
        </div>
      </div>

      {/* Embedded Audio Waveform & Player */}
      <div className="rounded-lg bg-slate-950 p-3.5 border border-slate-800/80 flex items-center gap-3">
        <button
          onClick={togglePlay}
          className="h-10 w-10 rounded-full bg-sky-500 hover:bg-sky-600 text-white flex items-center justify-center shadow-md transition-transform active:scale-95 shrink-0 cursor-pointer"
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
        </button>

        <div className="flex-1 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1 font-mono">
              <FileAudio className="h-3 w-3 text-sky-400" />
              {voiceLog.audio_url.split('/').pop() || 'voice_recording.m4a'}
            </span>
            <span className="font-mono text-slate-400">
              {isPlaying ? '0:14' : '0:00'} / 0:24
            </span>
          </div>

          {/* Animated waveform bars simulation */}
          <div className="flex items-center gap-0.5 h-6">
            {[35, 60, 45, 80, 95, 40, 65, 85, 30, 70, 90, 50, 40, 75, 60, 45, 90, 100, 65, 40, 55, 70, 85, 50, 35, 60, 80, 45].map((height, i) => (
              <div
                key={i}
                style={{ height: `${height}%` }}
                className={`flex-1 rounded-full transition-colors ${
                  isPlaying && i < 12
                    ? 'bg-sky-400'
                    : 'bg-slate-800 hover:bg-slate-700'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Hidden HTML5 audio element */}
        <audio
          ref={audioRef}
          src={voiceLog.audio_url}
          onEnded={() => setIsPlaying(false)}
          className="hidden"
        />
      </div>

      {/* Technical Summary */}
      <div className="rounded-lg bg-slate-950/60 p-3.5 border border-slate-800 text-xs">
        <p className="font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-purple-400" />
          On-Device AI Technical Summary
        </p>
        <p className="text-slate-300 leading-relaxed">{voiceLog.summary}</p>
      </div>

      {/* Raw Transcript Collapsible snippet */}
      <details className="text-xs text-slate-400 cursor-pointer">
        <summary className="hover:text-slate-200 transition-colors font-medium">
          View Raw Spoken Transcript
        </summary>
        <p className="mt-2 p-3 bg-slate-950 rounded-lg border border-slate-850 text-slate-300 text-xs italic font-serif leading-relaxed">
          "{voiceLog.raw_transcript}"
        </p>
      </details>

      {/* Action Items */}
      {voiceLog.action_items && voiceLog.action_items.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
            <ListChecks className="h-3.5 w-3.5 text-emerald-400" />
            Extracted Follow-Up Action Items:
          </p>
          <div className="space-y-1">
            {voiceLog.action_items.map((act, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 text-xs text-slate-200 bg-slate-950/40 p-2 rounded border border-slate-800"
              >
                <span className="text-emerald-400 font-bold">•</span>
                <span>{act}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GPS Location & Site Metadata Footer */}
      {voiceLog.location_address && (
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
          <MapPin className="h-3.5 w-3.5 text-sky-400 shrink-0" />
          <span className="truncate">{voiceLog.location_address}</span>
          {voiceLog.latitude && voiceLog.longitude && (
            <span className="font-mono text-slate-500 text-[10px]">
              ({voiceLog.latitude.toFixed(4)}, {voiceLog.longitude.toFixed(4)})
            </span>
          )}
        </div>
      )}
    </div>
  );
};
