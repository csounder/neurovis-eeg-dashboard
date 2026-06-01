/**
 * Resolve and list NeuroVis Csound patch libraries (NIME concert + teaching examples).
 */
const fs = require("fs");
const path = require("path");

const ROOT_DIR = __dirname;
const NIME_DIR = path.join(ROOT_DIR, "csds-NIME-Selected");
const EXAMPLES_DIR = path.join(ROOT_DIR, "examples");

const SAFE_CSD = /^[A-Za-z0-9][A-Za-z0-9._+\-]*\.csd$/;

function safeCsdFilename(name) {
  const base = path.basename(String(name || "").trim());
  if (!SAFE_CSD.test(base)) return null;
  return base;
}

function displayNameFromFile(filename) {
  return filename
    .replace(/\.csd$/i, "")
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2");
}

function listCsdDir(dir, library) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".csd") && SAFE_CSD.test(f))
    .map((filename) => {
      const fullPath = path.join(dir, filename);
      const id = filename.replace(/\.csd$/i, "");
      return enrichPatch({
        id,
        filename,
        library,
        path: fullPath,
        name: displayNameFromFile(filename),
      });
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function headOf(fullPath) {
  try {
    return fs.readFileSync(fullPath, "utf8").slice(0, 12000);
  } catch {
    return "";
  }
}

function headIncludesMindMonitor(head) {
  return (
    head.includes("/muse/elements/delta_absolute") &&
    head.includes('"ffff"')
  );
}

/** NIME orchestras use massign / midic7 / note-on to trigger chord voices. */
function patchUsesUsbMidi(head) {
  return /\bmassign\b|\bmidic[017]\b|\bcpsmidi\b|\bmidinote\b/i.test(head);
}

/**
 * CLI flags CsoundQt normally adds; headless launch omitted these (no USB MIDI, weak audio).
 */
function buildCsoundLaunchArgs(csdPath, { usesMidi = true } = {}) {
  const extra = (process.env.NEUROVIS_CSOUND_EXTRA || "")
    .split(/\s+/)
    .filter(Boolean);
  const midiDev = process.env.NEUROVIS_CSOUND_MIDI_DEVICE || "0";
  const args = ["-odac"];

  if (process.platform === "darwin") {
    args.push("-+rtaudio=CoreAudio");
    if (usesMidi) args.push("-+rtmidi=portmidi", `-M${midiDev}`);
  } else if (process.platform === "win32") {
    if (usesMidi) args.push("-+rtmidi=winmm", `-M${midiDev}`);
  } else {
    args.push("-+rtaudio=alsa");
    if (usesMidi) args.push("-+rtmidi=alsa", `-M${midiDev}`);
  }

  // -K: ASCII keyboard (sensekey) on stdin — used by NeuroVis Concert console forwarding
  args.push("-d", "-K", ...extra, csdPath);
  return args;
}

function listAllPatches() {
  return {
    nime: listCsdDir(NIME_DIR, "nime"),
    examples: listCsdDir(EXAMPLES_DIR, "examples").filter((p) =>
      p.filename.startsWith("eeg_synth_"),
    ),
  };
}

function resolvePatch(library, id) {
  const lib = library === "examples" ? "examples" : "nime";
  if (lib === "nime") {
    const filename = safeCsdFilename(id.endsWith(".csd") ? id : `${id}.csd`);
    if (!filename) throw new Error("Invalid patch filename");
    const fullPath = path.join(NIME_DIR, filename);
    if (!fs.existsSync(fullPath)) throw new Error(`Patch not found: ${filename}`);
    return enrichPatch({
      library: "nime",
      id: filename.replace(/\.csd$/i, ""),
      filename,
      path: fullPath,
    });
  }

  const exampleId = String(id || "")
    .trim()
    .replace(/^eeg_synth_/, "")
    .replace(/\.csd$/i, "");
  const filename = `eeg_synth_${exampleId}.csd`;
  const fullPath = path.join(EXAMPLES_DIR, filename);
  if (!fs.existsSync(fullPath)) throw new Error(`Instrument not found: ${exampleId}`);
  return enrichPatch({
    library: "examples",
    id: exampleId,
    filename,
    path: fullPath,
  });
}

function defaultNimeV12Path() {
  const preferred = path.join(NIME_DIR, "MuseV12-EEG-Control-Matrix-Cursor.csd");
  if (fs.existsSync(preferred)) return preferred;
  const patches = listCsdDir(NIME_DIR, "nime");
  return patches[0]?.path || null;
}

function enrichPatch(patch) {
  const head = headOf(patch.path);
  const oscMatch = head.match(/OSCinit\s+(\d+)/i);
  return {
    ...patch,
    oscPort: oscMatch ? Number(oscMatch[1]) || 7400 : 7400,
    mindMonitor4Float: headIncludesMindMonitor(head),
    usesMidi: patchUsesUsbMidi(head),
  };
}

module.exports = {
  NIME_DIR,
  EXAMPLES_DIR,
  listAllPatches,
  resolvePatch,
  enrichPatch,
  buildCsoundLaunchArgs,
  defaultNimeV12Path,
  safeCsdFilename,
};
