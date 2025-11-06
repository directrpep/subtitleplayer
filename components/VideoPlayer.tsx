'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import { SubtitleCue, formatTimestamp } from '../lib/subtitleParsers';

type VideoPlayerProps = {
  src: string;
  title?: string;
  poster?: string;
  frameRate: number;
  onFrameRateChange: (value: number) => void;
  onTimeChange?: (time: number, frame: number) => void;
  activeCue?: SubtitleCue | null;
  cues?: SubtitleCue[];
  seekRequest?: { id: string; time: number } | null;
};

type VideoElement = HTMLVideoElement & {
  requestVideoFrameCallback?: (
    callback: (now: number, metadata: VideoFrameCallbackMetadata) => void
  ) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

type VideoFrameCallbackMetadata = {
  presentationTime: number;
  expectedDisplayTime: number;
  width: number;
  height: number;
  mediaTime: number;
  presentedFrames: number;
};

const DEFAULT_POSTER =
  'https://images.pexels.com/photos/3856024/pexels-photo-3856024.jpeg?auto=compress&cs=tinysrgb&w=1600';

export function VideoPlayer({
  src,
  title = 'Program Stream',
  poster = DEFAULT_POSTER,
  frameRate,
  onFrameRateChange,
  onTimeChange,
  activeCue,
  cues,
  seekRequest
}: VideoPlayerProps) {
  const videoRef = useRef<VideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [frameNumber, setFrameNumber] = useState(0);

  const frameDuration = useMemo(() => (frameRate > 0 ? 1 / frameRate : 1 / 24), [frameRate]);

  const setupVideoSource = useCallback(
    (video: VideoElement, source: string) => {
      if (!video) return;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      if (source.endsWith('.m3u8')) {
        if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = source;
        } else if (Hls.isSupported()) {
          const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
          hls.loadSource(source);
          hls.attachMedia(video);
          hlsRef.current = hls;
        } else {
          console.warn('HLS is not supported in this browser.');
          video.src = source;
        }
      } else {
        video.src = source;
      }
    },
    []
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setupVideoSource(video, src);
  }, [setupVideoSource, src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let frameHandle: number | null = null;
    let rafHandle: number | null = null;

    const notify = (time: number, frame: number) => {
      setCurrentTime(time);
      setFrameNumber(frame);
      onTimeChange?.(time, frame);
    };

    const updateFromVideo = () => {
      const time = video.currentTime;
      const frame = Math.round(time * frameRate);
      notify(time, frame);
    };

    if (typeof video.requestVideoFrameCallback === 'function') {
      const tick = (_now: number, metadata: VideoFrameCallbackMetadata) => {
        const frame =
          typeof metadata.presentedFrames === 'number'
            ? metadata.presentedFrames
            : Math.round(metadata.mediaTime * frameRate);
        notify(metadata.mediaTime, frame);
        frameHandle = video.requestVideoFrameCallback!(tick);
      };
      frameHandle = video.requestVideoFrameCallback(tick);
    } else {
      const loop = () => {
        updateFromVideo();
        rafHandle = window.requestAnimationFrame(loop);
      };
      rafHandle = window.requestAnimationFrame(loop);
    }

    return () => {
      if (frameHandle && typeof video.cancelVideoFrameCallback === 'function') {
        video.cancelVideoFrameCallback(frameHandle);
      }
      if (rafHandle) {
        window.cancelAnimationFrame(rafHandle);
      }
    };
  }, [frameRate, onTimeChange]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoaded = () => setDuration(video.duration || 0);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('loadedmetadata', handleLoaded);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    if (!Number.isNaN(video.duration) && video.duration) {
      setDuration(video.duration);
    }

    return () => {
      video.removeEventListener('loadedmetadata', handleLoaded);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, []);

  const togglePlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
    } else {
      video.pause();
    }
  }, []);

  const seekTo = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;
    const limit = Number.isFinite(duration) && duration > 0 ? duration : video.duration || 0;
    const safeTime = Math.min(Math.max(time, 0), limit || 0);
    video.currentTime = safeTime;
  }, [duration]);

  useEffect(() => {
    if (!seekRequest) return;
    seekTo(seekRequest.time);
  }, [seekRequest, seekTo]);

  const stepFrame = useCallback(
    (direction: 1 | -1) => {
      const video = videoRef.current;
      if (!video) return;
      const target = video.currentTime + frameDuration * direction;
      seekTo(target);
    },
    [frameDuration, seekTo]
  );

  const handleFrameRateInput = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const next = Number.parseFloat(event.target.value);
      if (Number.isFinite(next) && next > 0) {
        onFrameRateChange(next);
      }
    },
    [onFrameRateChange]
  );

  const handleSlider = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      seekTo(Number.parseFloat(event.target.value));
    },
    [seekTo]
  );

  const progress = useMemo(() => {
    if (!duration) return 0;
    return Math.min(100, (currentTime / duration) * 100);
  }, [currentTime, duration]);

  const activeText = activeCue?.text ?? '';

  const handleCueClick = useCallback(
    (cue: SubtitleCue) => () => {
      seekTo(cue.start + 0.01);
    },
    [seekTo]
  );

  return (
    <section className="section-card" aria-label="Media player">
      <header className="control-row" style={{ justifyContent: 'space-between' }}>
        <div>
          <div className="badge">Primary Stream</div>
          <h2 style={{ margin: '0.35rem 0 0', fontSize: '1.25rem' }}>{title}</h2>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Current frame</div>
          <strong style={{ fontSize: '1.2rem' }}>{frameNumber.toLocaleString()}</strong>
          <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>{formatTimestamp(currentTime)}</div>
        </div>
      </header>

      <div className="video-shell">
        <video ref={videoRef} poster={poster} controls={false} preload="metadata" />
        {activeText ? <div className="video-overlay">{activeText}</div> : null}
      </div>

      <div className="timeline" role="presentation">
        <div className="progress" style={{ width: `${progress}%` }} />
      </div>

      <div className="control-row" style={{ marginTop: '0.5rem' }}>
        <button onClick={() => stepFrame(-1)} title="Previous frame">
          ⟸ Frame
        </button>
        <button onClick={togglePlayback} title={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <button onClick={() => stepFrame(1)} title="Next frame">
          Frame ⟹
        </button>
        <div className="spacer" />
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.85rem', opacity: 0.75 }}>Frame rate</span>
          <input
            type="number"
            min={1}
            max={240}
            step={0.01}
            value={frameRate.toString()}
            onChange={handleFrameRateInput}
            style={{ width: '6rem' }}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.85rem', opacity: 0.75 }}>Seek</span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={frameDuration}
            value={currentTime}
            onChange={handleSlider}
            style={{ width: '220px' }}
          />
        </label>
      </div>

      {cues && cues.length > 0 ? (
        <div
          className="control-row"
          style={{ flexWrap: 'wrap', gap: '0.5rem', alignItems: 'flex-start' }}
        >
          <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>Jump to cue:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {cues.slice(0, 6).map((cue) => (
              <button
                key={cue.id}
                onClick={handleCueClick(cue)}
                style={{
                  background: 'rgba(45, 109, 246, 0.15)',
                  border: '1px solid rgba(111, 134, 255, 0.4)',
                  color: '#d6dcff',
                  padding: '0.35rem 0.6rem',
                  fontSize: '0.75rem'
                }}
              >
                {formatTimestamp(cue.start)}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
