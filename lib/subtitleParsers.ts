export type SubtitleCue = {
  id: string;
  start: number;
  end: number;
  text: string;
  payload?: unknown;
};

export type SubtitleTrack = {
  id: string;
  label: string;
  language?: string;
  format: string;
  cues: SubtitleCue[];
  fileName: string;
};

export type ParsedSubtitle = {
  track: SubtitleTrack;
  warnings: string[];
};

const TIMECODE_PATTERN = /(\d{2}):(\d{2}):(\d{2})[,\.:](\d{2,3})/;

const uuid = () => crypto.randomUUID();

const toSeconds = (
  hours: number,
  minutes: number,
  seconds: number,
  fraction: number,
  fractionDigits: number
) =>
  hours * 3600 + minutes * 60 + seconds + fraction / 10 ** Math.max(fractionDigits, 0);

const parseTimestamp = (value: string): number => {
  const trimmed = value.trim();
  if (!trimmed) {
    return 0;
  }
  if (trimmed.includes(':') && trimmed.split(':').length === 4) {
    // Timecode with frames HH:MM:SS:FF
    const [hh, mm, ss, ff] = trimmed.split(':').map(Number);
    const fps = 29.97;
    return hh * 3600 + mm * 60 + ss + ff / fps;
  }

  const match = trimmed.match(TIMECODE_PATTERN);
  if (!match) {
    const numeric = Number.parseFloat(trimmed.replace(',', '.'));
    return Number.isFinite(numeric) ? numeric : 0;
  }

  const [, hh, mm, ss, frac] = match;
  const fraction = Number.parseInt(frac, 10);
  const digits = frac.length;
  return toSeconds(Number(hh), Number(mm), Number(ss), fraction, digits);
};

const parseSrt = (input: string): SubtitleCue[] => {
  const blocks = input
    .replace(/\r/g, '')
    .trim()
    .split(/\n\s*\n/);
  const cues: SubtitleCue[] = [];
  let index = 0;

  for (const block of blocks) {
    const lines = block.split('\n').filter(Boolean);
    if (lines.length < 2) continue;

    let timeLine = lines[0];
    if (/^\d+$/.test(timeLine) && lines[1]) {
      timeLine = lines[1];
      lines.shift();
    }

    const match = timeLine.match(/([^\s]+)\s+-->\s+([^\s]+)/);
    if (!match) continue;

    const start = parseTimestamp(match[1]);
    const end = parseTimestamp(match[2]);
    const text = lines
      .slice(1)
      .join('\n')
      .replace(/<[^>]+>/g, '')
      .trim();

    cues.push({
      id: `srt-${index++}`,
      start,
      end,
      text
    });
  }

  return cues;
};

const parseVtt = (input: string): SubtitleCue[] => {
  const sanitized = input.replace(/^WEBVTT[^\n]*\n/i, '').trim();
  return parseSrt(sanitized);
};

const parseClockTime = (value: string): number => {
  const trimmed = value.trim();

  if (/^\d+(\.\d+)?s$/i.test(trimmed)) {
    return Number.parseFloat(trimmed);
  }

  if (/^\d+(\.\d+)?m$/i.test(trimmed)) {
    return Number.parseFloat(trimmed) * 60;
  }

  if (/^\d+(\.\d+)?h$/i.test(trimmed)) {
    return Number.parseFloat(trimmed) * 3600;
  }

  if (/^\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(trimmed)) {
    const [hh, mm, rest] = trimmed.split(':');
    const seconds = Number.parseFloat(rest);
    return Number(hh) * 3600 + Number(mm) * 60 + seconds;
  }

  if (/^\d{2}:\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    const [hh, mm, ss, ff] = trimmed.split(':').map(Number);
    const fps = 29.97;
    return hh * 3600 + mm * 60 + ss + ff / fps;
  }

  return parseTimestamp(trimmed);
};

const parseTtml = (input: string): SubtitleCue[] => {
  if (typeof DOMParser === 'undefined') {
    return [];
  }

  const parser = new DOMParser();
  const xml = parser.parseFromString(input, 'application/xml');
  const paragraphs = Array.from(xml.getElementsByTagName('p'));
  let index = 0;

  return paragraphs
    .map((element) => {
      const begin = element.getAttribute('begin') ?? '0';
      const endAttr = element.getAttribute('end');
      const dur = element.getAttribute('dur');
      const start = parseClockTime(begin);
      const end = endAttr ? parseClockTime(endAttr) : dur ? start + parseClockTime(dur) : start + 2;
      const text = (element.textContent ?? '').replace(/\s+/g, ' ').trim();

      if (!text) return null;

      return {
        id: `ttml-${index++}`,
        start,
        end,
        text
      } satisfies SubtitleCue;
    })
    .filter(Boolean) as SubtitleCue[];
};



const parseCea608 = (input: string): SubtitleCue[] => {
  const lines = input.replace(/\r/g, '').split('\n');
  const cues: SubtitleCue[] = [];
  const fps = 29.97;

  let lastCue: SubtitleCue | null = null;
  let index = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const match = line.match(/^(\d{2}):(\d{2}):(\d{2}):(\d{2})\s+(.+)$/);
    if (!match) continue;

    const [, hh, mm, ss, ff, payload] = match;
    const start =
      Number(hh) * 3600 + Number(mm) * 60 + Number(ss) + Number(ff) / fps;
    const text = decodeCea608Words(payload);

    if (!text) continue;

    if (lastCue) {
      lastCue.end = start;
    }

    lastCue = {
      id: `cea-${index++}`,
      start,
      end: start + 2,
      text
    };

    cues.push(lastCue);
  }

  return cues;
};

const decodeCea608Words = (payload: string): string => {
  const words = payload.trim().split(/\s+/);
  const chars: string[] = [];

  for (const word of words) {
    if (word.length % 2 !== 0) continue;
    for (let i = 0; i < word.length; i += 2) {
      const hex = word.slice(i, i + 2);
      const code = Number.parseInt(hex, 16);
      if (!Number.isFinite(code)) continue;
      if (code >= 0x20 && code <= 0x7e) {
        chars.push(String.fromCharCode(code));
      }
    }
  }

  return chars.join('').replace(/\s+/g, ' ').trim();
};

const detectFormat = (fileName: string, text: string): string => {
  const lowered = fileName.toLowerCase();
  if (lowered.endsWith('.srt')) return 'srt';
  if (lowered.endsWith('.vtt')) return 'vtt';
  if (lowered.endsWith('.ttml') || lowered.endsWith('.dfxp') || lowered.endsWith('.xml')) return 'ttml';
  if (lowered.endsWith('.cc') || lowered.endsWith('.scc')) return 'cea-608';

  if (text.trim().startsWith('WEBVTT')) return 'vtt';
  if (/<tt\b[^>]*>/i.test(text)) return 'ttml';
  if (/-->/.test(text)) return 'srt';

  return 'plain';
};

export const parseSubtitleFile = async (file: File): Promise<ParsedSubtitle> => {
  const text = await file.text();
  const format = detectFormat(file.name, text);
  const warnings: string[] = [];
  let cues: SubtitleCue[] = [];

  switch (format) {
    case 'srt':
      cues = parseSrt(text);
      break;
    case 'vtt':
      cues = parseVtt(text);
      break;
    case 'ttml':
      cues = parseTtml(text);
      break;
    case 'cea-608':
      cues = parseCea608(text);
      warnings.push('CEA-608 decoding is best-effort and may not render control codes.');
      break;
    default:
      cues = text
        .split(/\r?\n/)
        .map((line, index) => ({
          id: `plain-${index}`,
          start: index * 2,
          end: index * 2 + 1.5,
          text: line
        }))
        .filter((cue) => cue.text.trim().length > 0);
      warnings.push('Unknown subtitle format. Created sequential cues from plain text.');
      break;
  }

  if (!cues.length) {
    warnings.push('No cues were parsed from the supplied file.');
  }

  const track: SubtitleTrack = {
    id: uuid(),
    label: file.name,
    language: undefined,
    format,
    cues,
    fileName: file.name
  };

  return { track, warnings };
};

export const formatTimestamp = (seconds: number): string => {
  const clamped = Math.max(seconds, 0);
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const secs = Math.floor(clamped % 60);
  const millis = Math.floor((clamped % 1) * 1000);
  return [hours, minutes, secs]
    .map((unit) => unit.toString().padStart(2, '0'))
    .join(':')
    .concat(`.${millis.toString().padStart(3, '0')}`);
};
