import path from "node:path";

/** Optional desktop CsoundQt companion (OSC/MIDI). NeuroVis Teaching / Concert / Research are the main web product. */
export const DEFAULT_V12_CSD_PATH =
  "/Users/richardboulanger/Desktop/MuscV12-EEG-Control-Matrix-Cursor.csd";

/** Server-only: absolute path to optional desktop `.csd` for `/api/csound/v12`. */
export function resolveV12CsdPath(): string {
  const override = process.env.NEUROVIS_V12_CSD_PATH?.trim();
  return override || DEFAULT_V12_CSD_PATH;
}

export function v12CsdDownloadFilename(csdPath = resolveV12CsdPath()): string {
  return path.basename(csdPath);
}
