import type { CsoundConsoleLine } from "@/lib/types";

export type CsoundCcSnapshot = {
  cc: number;
  label: string;
  value?: string;
  updatedAt: number;
};

export type ConcertCsoundMirrorState = {
  cc: CsoundCcSnapshot[];
  messages: string[];
};

const CC_LINE =
  /CC\s*(\d{1,2})\b[^=\d]*(?:=\s*|:\s*|changed to\s+|volume\s*=\s*|scale\s*=\s*|range\s*=\s*)([^\n|]+)/i;
const CC_GLOBAL_VOL = /CC\s*28\b[^0-9]*(\d+\.?\d*)/i;
const CC_MELODY_VOL = /CC\s*1\s+Melody\s+volume\s*=\s*(\d+\.?\d*)/i;
const CC_MELODY_CX = /CC\s*1\s+Melody\s+complexity\s*=\s*(\d+\.?\d*)/i;
const CC_RANGE = /CC\s*26\b[^0-9]*(\d+)/i;
const CC_METRO_SCALE = /CC\s*27\b[^0-9]*(\d+\.?\d*)/i;
const MESSAGE_PREFIX = /^>>>\s*/;

/** printk2 / float-only lines we skip unless they look like labels. */
function isNoiseLine(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (/^rtmidi:/i.test(t)) return true;
  if (/^---\s/.test(t)) return true;
  if (/^csound\s/i.test(t)) return true;
  return false;
}

function normalizeMessage(text: string): string {
  return text.replace(MESSAGE_PREFIX, "").replace(/\s+/g, " ").trim();
}

function upsertCc(
  map: Map<number, CsoundCcSnapshot>,
  cc: number,
  label: string,
  value: string | undefined,
  t: number,
) {
  const prev = map.get(cc);
  const next: CsoundCcSnapshot = {
    cc,
    label: label.slice(0, 120),
    value: value?.slice(0, 80),
    updatedAt: t,
  };
  if (!prev || t >= prev.updatedAt) map.set(cc, next);
}

function parseLine(text: string, t: number, map: Map<number, CsoundCcSnapshot>, messages: string[]) {
  const line = text.trim();
  if (isNoiseLine(line)) return;

  const mVol = line.match(CC_GLOBAL_VOL);
  if (mVol) upsertCc(map, 28, "Global volume", mVol[1], t);

  const mRange = line.match(CC_RANGE);
  if (mRange) upsertCc(map, 26, "Chord range", mRange[1], t);

  const mScale = line.match(CC_METRO_SCALE);
  if (mScale) upsertCc(map, 27, "Metro scale", mScale[1], t);

  const mMv = line.match(CC_MELODY_VOL);
  if (mMv) upsertCc(map, 1, "Melody volume", mMv[1], t);

  const mMc = line.match(CC_MELODY_CX);
  if (mMc) upsertCc(map, 1, "Melody complexity", mMc[1], t);

  const ccMatch = line.match(CC_LINE);
  if (ccMatch) {
    const cc = Number(ccMatch[1]);
    if (cc >= 1 && cc <= 127) {
      const raw = ccMatch[2].trim();
      upsertCc(map, cc, line.slice(0, 72), raw.slice(0, 48), t);
    }
  } else if (/\bCC\s*\d{1,2}\b/i.test(line)) {
    const num = line.match(/\bCC\s*(\d{1,2})\b/i);
    if (num) {
      upsertCc(map, Number(num[1]), line.slice(0, 80), undefined, t);
    }
  }

  if (line.includes(">>>") || line.includes("PRINT") || /progression|orchestra|melody|delta|theta|alpha|beta|gamma/i.test(line)) {
    const msg = normalizeMessage(line);
    if (msg.length > 2 && msg.length < 280) {
      messages.push(msg);
    }
  } else if (/printk/i.test(line)) {
    messages.push(line.trim().slice(0, 200));
  }
}

export function buildConcertCsoundMirror(lines: CsoundConsoleLine[]): ConcertCsoundMirrorState {
  const map = new Map<number, CsoundCcSnapshot>();
  const messages: string[] = [];

  for (const row of lines) {
    if (!row.text) continue;
    parseLine(row.text, row.t, map, messages);
  }

  const cc = Array.from(map.values()).sort((a, b) => a.cc - b.cc);
  const uniqueMessages = messages.slice(-24);

  return { cc, messages: uniqueMessages };
}
