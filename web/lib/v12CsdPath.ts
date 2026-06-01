import fs from "node:fs";
import path from "node:path";

function repoNimeV12Path(): string {
  const candidates = [
    path.join(process.cwd(), "csds-NIME-Selected", "MuseV12-EEG-Control-Matrix-Cursor.csd"),
    path.join(process.cwd(), "..", "csds-NIME-Selected", "MuseV12-EEG-Control-Matrix-Cursor.csd"),
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? candidates[0];
}

/** Optional desktop CsoundQt companion (OSC/MIDI). NeuroVis Teaching / Concert / Research are the main web product. */
export const DEFAULT_V12_CSD_PATH =
  "/Users/richardboulanger/Desktop/MuscV12-EEG-Control-Matrix-Cursor.csd";

/** Server-only: absolute path to optional desktop `.csd` for `/api/csound/v12`. */
export function resolveV12CsdPath(): string {
  const override = process.env.NEUROVIS_V12_CSD_PATH?.trim();
  if (override) return override;
  const repoV12 = repoNimeV12Path();
  if (fs.existsSync(repoV12)) return repoV12;
  return DEFAULT_V12_CSD_PATH;
}

export function v12CsdDownloadFilename(csdPath = resolveV12CsdPath()): string {
  return path.basename(csdPath);
}
