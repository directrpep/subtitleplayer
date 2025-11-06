'use client';

import { useMemo, useState } from 'react';
import { SubtitleCue, SubtitleTrack, formatTimestamp } from '../lib/subtitleParsers';

export type SubtitlesTableProps = {
  track: SubtitleTrack | null;
  activeCueId?: string;
  onCueSelect?: (cue: SubtitleCue) => void;
};

export function SubtitlesTable({ track, activeCueId, onCueSelect }: SubtitlesTableProps) {
  const [query, setQuery] = useState('');

  const cues = useMemo(() => {
    const all = track?.cues ?? [];
    if (!query.trim()) return all;
    const lower = query.toLowerCase();
    return all.filter((cue) => cue.text.toLowerCase().includes(lower));
  }, [track?.cues, query]);

  return (
    <section className="section-card" aria-label="Subtitle events">
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="badge">Subtitle Track</div>
          <h2 style={{ margin: '0.4rem 0 0', fontSize: '1.1rem' }}>{track?.label ?? 'No track loaded'}</h2>
          <p style={{ margin: '0.2rem 0 0', opacity: 0.65, fontSize: '0.85rem' }}>
            {track ? `${track.cues.length} cues` : 'Import a caption file to begin timing review.'}
          </p>
        </div>
        <input
          type="search"
          placeholder="Search captions"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          style={{ width: '14rem' }}
          aria-label="Search cues"
        />
      </header>

      <div className="table-container" style={{ maxHeight: '55vh', overflow: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: '120px' }}>Start</th>
              <th style={{ width: '120px' }}>End</th>
              <th>Text</th>
            </tr>
          </thead>
          <tbody>
            {cues.map((cue) => {
              const isActive = cue.id === activeCueId;
              return (
                <tr
                  key={cue.id}
                  onClick={() => onCueSelect?.(cue)}
                  style={{
                    backgroundColor: isActive ? 'rgba(45, 109, 246, 0.12)' : undefined,
                    cursor: 'pointer'
                  }}
                >
                  <td>{formatTimestamp(cue.start)}</td>
                  <td>{formatTimestamp(cue.end)}</td>
                  <td>
                    <div style={{ fontWeight: isActive ? 600 : 500 }}>{cue.text}</div>
                  </td>
                </tr>
              );
            })}
            {!cues.length ? (
              <tr>
                <td colSpan={3} style={{ textAlign: 'center', padding: '2rem', opacity: 0.6 }}>
                  {track ? 'No cues match this filter.' : 'Load a subtitle or caption file to inspect its cues.'}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
