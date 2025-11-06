'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { VideoPlayer } from '../components/VideoPlayer';
import { SubtitlesTable } from '../components/SubtitlesTable';
import {
  ParsedSubtitle,
  SubtitleCue,
  SubtitleTrack,
  formatTimestamp,
  parseSubtitleFile
} from '../lib/subtitleParsers';

const DEFAULT_VIDEO = 'https://storage.googleapis.com/shaka-demo-assets/angel-one-hls/hls.m3u8';

const REFERENCE_ASSETS: Array<{ label: string; url: string }> = [
  {
    label: 'Big Buck Bunny (HLS)',
    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'
  },
  {
    label: 'Sintel Trailer (MP4)',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4'
  },
  {
    label: 'Tears of Steel (HLS)',
    url: 'https://storage.googleapis.com/shaka-demo-assets/tos-ttml/hls.m3u8'
  }
];

type SeekRequest = { id: string; time: number } | null;

type MetadataForm = {
  title: string;
  episode: string;
  language: string;
  author: string;
  version: string;
  notes: string;
};

const defaultMetadata: MetadataForm = {
  title: 'Angels of the North',
  episode: 'S01E04',
  language: 'English [CC]',
  author: 'QC Operator',
  version: 'v1.0',
  notes: 'Verify forced narrative cues against reference audio.'
};

export default function Page() {
  const [videoUrl, setVideoUrl] = useState(DEFAULT_VIDEO);
  const [frameRate, setFrameRate] = useState(23.976);
  const [subtitleTrack, setSubtitleTrack] = useState<SubtitleTrack | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [activeCue, setActiveCue] = useState<SubtitleCue | null>(null);
  const [seekRequest, setSeekRequest] = useState<SeekRequest>(null);
  const [metadata, setMetadata] = useState<MetadataForm>(defaultMetadata);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    if (!subtitleTrack) {
      setActiveCue(null);
      return;
    }
    const cue = subtitleTrack.cues.find(
      (item) => currentTime >= item.start && currentTime <= item.end + 0.002
    );
    setActiveCue(cue ?? null);
  }, [currentTime, subtitleTrack]);

  const handleTimeChange = useCallback((time: number, frame: number) => {
    setCurrentTime(time);
    setCurrentFrame(frame);
  }, []);

  const handleSubtitleImport = useCallback(async (fileList: FileList | null) => {
    if (!fileList || !fileList.length) return;
    const file = fileList[0];
    setIsImporting(true);
    try {
      const result: ParsedSubtitle = await parseSubtitleFile(file);
      setSubtitleTrack(result.track);
      setWarnings(result.warnings);
      setActiveCue(null);
    } catch (error) {
      console.error(error);
      setWarnings(['Failed to parse subtitle file. Please verify the file contents.']);
    } finally {
      setIsImporting(false);
    }
  }, []);

  const handleCueSelect = useCallback((cue: SubtitleCue) => {
    setActiveCue(cue);
    setSeekRequest({ id: `${cue.id}-${Date.now()}`, time: Math.max(0, cue.start - 0.05) });
  }, []);

  useEffect(() => {
    if (!seekRequest) return;
    const timer = window.setTimeout(() => setSeekRequest(null), 250);
    return () => window.clearTimeout(timer);
  }, [seekRequest]);

  const derivedStatus = useMemo(() => {
    if (!subtitleTrack) return 'Waiting for subtitle import';
    if (!subtitleTrack.cues.length) return 'Track loaded without cues';
    return `Active cue ${activeCue ? subtitleTrack.cues.indexOf(activeCue) + 1 : '–'} of ${
      subtitleTrack.cues.length
    }`;
  }, [subtitleTrack, activeCue]);

  const handleMetadataChange = useCallback(<K extends keyof MetadataForm>(key: K, value: string) => {
    setMetadata((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleVideoUrlChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setVideoUrl(event.target.value);
  }, []);

  const handleReferenceSelect = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    const option = REFERENCE_ASSETS.find((asset) => asset.url === event.target.value);
    if (option) {
      setVideoUrl(option.url);
    }
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLLabelElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const files = event.dataTransfer?.files;
      if (files && files.length) {
        void handleSubtitleImport(files);
      }
    },
    [handleSubtitleImport]
  );

  const activeCueIndex = useMemo(() => {
    if (!subtitleTrack || !activeCue) return -1;
    return subtitleTrack.cues.findIndex((cue) => cue.id === activeCue.id);
  }, [subtitleTrack, activeCue]);

  return (
    <main style={{ padding: '2rem 3vw', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', letterSpacing: '0.05em' }}>BLU Timed Text QA</h1>
          <p style={{ margin: '0.35rem 0 0', opacity: 0.7 }}>
            Frame-accurate validation for HLS and file-based media with caption review.
          </p>
        </div>
        <div style={{ textAlign: 'right', fontSize: '0.85rem', opacity: 0.8 }}>
          <span className={activeCue ? 'status-dot online' : 'status-dot offline'} />
          {derivedStatus}
        </div>
      </header>

      <div className="grid-layout">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <VideoPlayer
            src={videoUrl}
            frameRate={frameRate}
            onFrameRateChange={setFrameRate}
            onTimeChange={handleTimeChange}
            activeCue={activeCue}
            cues={subtitleTrack?.cues}
            seekRequest={seekRequest}
          />

          <section className="section-card" aria-label="Import subtitles">
            <header>
              <div className="badge">Ingest</div>
              <h2 style={{ margin: '0.4rem 0 1rem', fontSize: '1.1rem' }}>Caption Sources</h2>
            </header>
            <div className="form-grid">
              <label>
                <span style={{ display: 'block', marginBottom: '0.35rem', opacity: 0.75 }}>Video URL</span>
                <input
                  type="url"
                  value={videoUrl}
                  onChange={handleVideoUrlChange}
                  placeholder="https://example.com/stream.m3u8"
                />
              </label>
              <label>
                <span style={{ display: 'block', marginBottom: '0.35rem', opacity: 0.75 }}>Reference asset</span>
                <select value={videoUrl} onChange={handleReferenceSelect}>
                  <option value="">Select demo asset…</option>
                  {REFERENCE_ASSETS.map((asset) => (
                    <option key={asset.url} value={asset.url}>
                      {asset.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span style={{ display: 'block', marginBottom: '0.35rem', opacity: 0.75 }}>Frame rate</span>
                <input
                  type="number"
                  min={1}
                  max={240}
                  step={0.001}
                  value={frameRate}
                  onChange={(event) => setFrameRate(Number.parseFloat(event.target.value) || frameRate)}
                />
              </label>
            </div>

            <label
              className="file-drop"
              onDragOver={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept=".srt,.vtt,.ttml,.dfxp,.xml,.cc,.scc,.json,.txt"
                onChange={(event) => void handleSubtitleImport(event.target.files)}
              />
              <strong>{isImporting ? 'Importing captions…' : 'Drop SRT, VTT, TTML or CC files here'}</strong>
              <p style={{ margin: '0.5rem 0 0', opacity: 0.65 }}>
                Supported formats: SRT, WebVTT, TTML/DFXP, SCC/CEA-608, and plain text.
              </p>
            </label>

            {warnings.length ? (
              <ul style={{ margin: '0.75rem 0 0', paddingLeft: '1.25rem', color: '#fbbf60' }}>
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
          </section>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <section className="section-card" aria-label="Metadata">
            <header>
              <div className="badge">Metadata</div>
              <h2 style={{ margin: '0.4rem 0 0.6rem', fontSize: '1.1rem' }}>Session Details</h2>
            </header>
            <div className="form-grid">
              <label>
                <span style={{ display: 'block', marginBottom: '0.35rem', opacity: 0.7 }}>Title</span>
                <input
                  value={metadata.title}
                  onChange={(event) => handleMetadataChange('title', event.target.value)}
                />
              </label>
              <label>
                <span style={{ display: 'block', marginBottom: '0.35rem', opacity: 0.7 }}>Episode</span>
                <input
                  value={metadata.episode}
                  onChange={(event) => handleMetadataChange('episode', event.target.value)}
                />
              </label>
              <label>
                <span style={{ display: 'block', marginBottom: '0.35rem', opacity: 0.7 }}>Language</span>
                <input
                  value={metadata.language}
                  onChange={(event) => handleMetadataChange('language', event.target.value)}
                />
              </label>
              <label>
                <span style={{ display: 'block', marginBottom: '0.35rem', opacity: 0.7 }}>Operator</span>
                <input
                  value={metadata.author}
                  onChange={(event) => handleMetadataChange('author', event.target.value)}
                />
              </label>
              <label>
                <span style={{ display: 'block', marginBottom: '0.35rem', opacity: 0.7 }}>Version</span>
                <input
                  value={metadata.version}
                  onChange={(event) => handleMetadataChange('version', event.target.value)}
                />
              </label>
            </div>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <span style={{ opacity: 0.7 }}>Notes</span>
              <textarea
                rows={4}
                value={metadata.notes}
                onChange={(event) => handleMetadataChange('notes', event.target.value)}
                style={{ resize: 'vertical' }}
              />
            </label>
            <footer style={{ fontSize: '0.8rem', opacity: 0.65 }}>
              Current frame {currentFrame.toLocaleString()} at {formatTimestamp(currentTime)}
              {activeCueIndex >= 0 ? ` · Cue ${activeCueIndex + 1}/${subtitleTrack?.cues.length}` : ''}
            </footer>
          </section>

          <SubtitlesTable
            track={subtitleTrack}
            activeCueId={activeCue?.id}
            onCueSelect={handleCueSelect}
          />
        </div>
      </div>
    </main>
  );
}
