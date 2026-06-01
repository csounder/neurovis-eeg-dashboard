/** Transform-feedback concert scenes — delicate particle lace (not fullscreen synth). */

export type TfInitMode =
  | "brain"
  | "ring"
  | "shell"
  | "twin"
  | "stream"
  | "disc"
  | "helix"
  | "scatter"
  | "sheet"
  | "figure8"
  | "wedge"
  | "nova";

/** Applied in the visualizer when setting point / line uniforms. */
export const TF_LACE_POINT_BOOST = 2.25;
export const TF_LACE_LINE_BOOST = 2.0;
/** Extra scale for macro TF scenes (larger stage fill). */
export const TF_MACRO_WORLD_SCALE = 1.78;
export const TF_MACRO_POINT_BOOST = 2.55;
export const TF_MACRO_LINE_BOOST = 2.35;

export type TfPreset = {
  id: string;
  title: string;
  subtitle: string;
  particleCount: number;
  lineSlots: 1 | 2 | 3;
  lineOffsets: [number, number, number];
  init: TfInitMode;
  synapses: [[number, number], [number, number], [number, number]];
  flowGain: number;
  shellGain: number;
  curlScale: number;
  inwardGain: number;
  synapsePull: number;
  synapseRate: number;
  pointGain: number;
  lineGain: number;
  /** Override world radius (defaults to TF_LACE_WORLD_SCALE). */
  worldScale?: number;
};

export const TF_WEBGL_SCENES: readonly TfPreset[] = [
  {
    id: "glTfNeuroLace",
    title: "GL TF Neuro Lace",
    subtitle: "WebGL · TF particles, web-lines, synapse pops, brain SDF lace.",
    particleCount: 12000,
    lineSlots: 3,
    lineOffsets: [37, 911, 3571],
    init: "brain",
    synapses: [[-0.22, 0.05], [0.22, 0.02], [0.0, 0.24]],
    flowGain: 0.48,
    shellGain: 0.55,
    curlScale: 2.2,
    inwardGain: 0.06,
    synapsePull: 0.28,
    synapseRate: 0.018,
    pointGain: 1,
    lineGain: 1,
  },
  {
    id: "glTfAxonStream",
    title: "GL TF Axon Stream",
    subtitle: "WebGL · filaments stream along cortical flow toward synaptic hubs.",
    particleCount: 10000,
    lineSlots: 2,
    lineOffsets: [53, 1201, 0],
    init: "stream",
    synapses: [[-0.28, -0.08], [0.28, -0.08], [0.0, 0.3]],
    flowGain: 0.62,
    shellGain: 0.42,
    curlScale: 1.6,
    inwardGain: 0.04,
    synapsePull: 0.34,
    synapseRate: 0.022,
    pointGain: 0.95,
    lineGain: 1.1,
  },
  {
    id: "glTfDendriteCrown",
    title: "GL TF Dendrite Crown",
    subtitle: "WebGL · crown arbor around upper synaptic crown, slow pulsing lace.",
    particleCount: 9000,
    lineSlots: 3,
    lineOffsets: [29, 503, 1901],
    init: "shell",
    synapses: [[-0.18, 0.22], [0.18, 0.22], [0.0, 0.32]],
    flowGain: 0.38,
    shellGain: 0.72,
    curlScale: 1.9,
    inwardGain: 0.1,
    synapsePull: 0.32,
    synapseRate: 0.016,
    pointGain: 1.05,
    lineGain: 0.95,
  },
  {
    id: "glTfSynapseMist",
    title: "GL TF Synapse Mist",
    subtitle: "WebGL · fine mist of sparks with hairline cross-links on cortex.",
    particleCount: 14000,
    lineSlots: 3,
    lineOffsets: [11, 127, 509],
    init: "brain",
    synapses: [[-0.24, 0.0], [0.24, 0.0], [0.0, 0.26]],
    flowGain: 0.35,
    shellGain: 0.48,
    curlScale: 2.8,
    inwardGain: 0.08,
    synapsePull: 0.26,
    synapseRate: 0.024,
    pointGain: 0.85,
    lineGain: 0.75,
  },
  {
    id: "glTfCorticalWeave",
    title: "GL TF Cortical Weave",
    subtitle: "WebGL · lattice weave constrained to cortical shell geometry.",
    particleCount: 11000,
    lineSlots: 3,
    lineOffsets: [61, 241, 967],
    init: "brain",
    synapses: [[-0.2, 0.12], [0.2, 0.12], [0.0, -0.2]],
    flowGain: 0.44,
    shellGain: 0.68,
    curlScale: 2.0,
    inwardGain: 0.12,
    synapsePull: 0.3,
    synapseRate: 0.014,
    pointGain: 1,
    lineGain: 1.15,
  },
  {
    id: "glTfMyelinFlow",
    title: "GL TF Myelin Flow",
    subtitle: "WebGL · laminar flow bands echo myelinated streamlines.",
    particleCount: 8000,
    lineSlots: 2,
    lineOffsets: [97, 409, 0],
    init: "stream",
    synapses: [[-0.32, 0.04], [0.32, 0.04], [0.0, 0.18]],
    flowGain: 0.58,
    shellGain: 0.38,
    curlScale: 1.4,
    inwardGain: 0.03,
    synapsePull: 0.22,
    synapseRate: 0.012,
    pointGain: 0.9,
    lineGain: 1.2,
  },
  {
    id: "glTfThalamicPulse",
    title: "GL TF Thalamic Pulse",
    subtitle: "WebGL · hub-and-spoke pulses from thalamic gates, soft filament bursts.",
    particleCount: 7500,
    lineSlots: 3,
    lineOffsets: [17, 89, 353],
    init: "twin",
    synapses: [[-0.24, 0.1], [0.24, 0.1], [0.0, 0.3]],
    flowGain: 0.4,
    shellGain: 0.5,
    curlScale: 2.4,
    inwardGain: 0.15,
    synapsePull: 0.42,
    synapseRate: 0.028,
    pointGain: 1.15,
    lineGain: 0.9,
  },
  {
    id: "glTfHippocampalArc",
    title: "GL TF Hippocampal Arc",
    subtitle: "WebGL · arcing trajectories along hippocampal curve, synapse beads.",
    particleCount: 9500,
    lineSlots: 2,
    lineOffsets: [43, 701, 0],
    init: "ring",
    synapses: [[-0.26, -0.14], [0.26, -0.14], [0.0, 0.28]],
    flowGain: 0.46,
    shellGain: 0.52,
    curlScale: 2.1,
    inwardGain: 0.07,
    synapsePull: 0.3,
    synapseRate: 0.017,
    pointGain: 1,
    lineGain: 1.05,
  },
  {
    id: "glTfCerebellarLoom",
    title: "GL TF Cerebellar Loom",
    subtitle: "WebGL · crossed laminar loom under cerebellar sheet motif.",
    particleCount: 10500,
    lineSlots: 3,
    lineOffsets: [73, 311, 1249],
    init: "shell",
    synapses: [[-0.16, -0.22], [0.16, -0.22], [0.0, 0.14]],
    flowGain: 0.52,
    shellGain: 0.45,
    curlScale: 1.75,
    inwardGain: 0.05,
    synapsePull: 0.28,
    synapseRate: 0.015,
    pointGain: 0.92,
    lineGain: 1.08,
  },
  {
    id: "glTfConnectomeFilament",
    title: "GL TF Connectome Filament",
    subtitle: "WebGL · long-range filaments between distributed cortical anchors.",
    particleCount: 6500,
    lineSlots: 3,
    lineOffsets: [131, 1543, 4201],
    init: "brain",
    synapses: [[-0.3, 0.16], [0.3, 0.16], [0.0, -0.26]],
    flowGain: 0.32,
    shellGain: 0.58,
    curlScale: 1.5,
    inwardGain: 0.09,
    synapsePull: 0.24,
    synapseRate: 0.011,
    pointGain: 1.1,
    lineGain: 1.25,
  },
  {
    id: "glTfMicrogliaHaze",
    title: "GL TF Microglia Haze",
    subtitle: "WebGL · sparse glitter haze with micro-sparks on responding tissue.",
    particleCount: 16000,
    lineSlots: 1,
    lineOffsets: [19, 0, 0],
    init: "brain",
    synapses: [[-0.2, 0.08], [0.2, 0.08], [0.0, 0.2]],
    flowGain: 0.3,
    shellGain: 0.4,
    curlScale: 3.2,
    inwardGain: 0.06,
    synapsePull: 0.2,
    synapseRate: 0.026,
    pointGain: 0.75,
    lineGain: 0.55,
  },
];

/** Original delicate cortical lace presets. */
export const TF_WEBGL_LACE_SCENES = TF_WEBGL_SCENES;

/** Larger TF presets — more particles, wider field, distinct distributions. */
export const TF_WEBGL_MACRO_SCENES: readonly TfPreset[] = [
  {
    id: "glTfGalaxyDisc",
    title: "GL TF Galaxy Disc",
    subtitle: "WebGL · macro particle disc, long-range filament arms.",
    particleCount: 20000,
    lineSlots: 3,
    lineOffsets: [211, 4201, 9871],
    init: "disc",
    synapses: [[-0.38, 0.12], [0.38, 0.12], [0.0, -0.32]],
    flowGain: 0.42,
    shellGain: 0.62,
    curlScale: 2.4,
    inwardGain: 0.04,
    synapsePull: 0.26,
    synapseRate: 0.016,
    pointGain: 1.05,
    lineGain: 1.2,
    worldScale: TF_MACRO_WORLD_SCALE,
  },
  {
    id: "glTfNebulaScatter",
    title: "GL TF Nebula Scatter",
    subtitle: "WebGL · volumetric star-cloud scatter with misty cross-links.",
    particleCount: 22000,
    lineSlots: 3,
    lineOffsets: [47, 503, 2503],
    init: "scatter",
    synapses: [[-0.3, 0.18], [0.3, 0.18], [0.0, 0.34]],
    flowGain: 0.36,
    shellGain: 0.55,
    curlScale: 3.0,
    inwardGain: 0.03,
    synapsePull: 0.22,
    synapseRate: 0.02,
    pointGain: 0.9,
    lineGain: 0.95,
    worldScale: 1.85,
  },
  {
    id: "glTfDnaBraid",
    title: "GL TF DNA Braid",
    subtitle: "WebGL · large helical braid lattice, bead synapse flashes.",
    particleCount: 16000,
    lineSlots: 2,
    lineOffsets: [89, 1543, 0],
    init: "helix",
    synapses: [[-0.22, -0.28], [0.22, -0.28], [0.0, 0.36]],
    flowGain: 0.5,
    shellGain: 0.48,
    curlScale: 1.8,
    inwardGain: 0.05,
    synapsePull: 0.34,
    synapseRate: 0.019,
    pointGain: 1.1,
    lineGain: 1.15,
    worldScale: 1.72,
  },
  {
    id: "glTfColliderSpray",
    title: "GL TF Collider Spray",
    subtitle: "WebGL · off-axis particle jets (CERN-like sprays, no center blob).",
    particleCount: 18000,
    lineSlots: 2,
    lineOffsets: [127, 911, 0],
    init: "nova",
    synapses: [[-0.42, 0.0], [0.42, 0.0], [0.0, 0.0]],
    flowGain: 0.68,
    shellGain: 0.35,
    curlScale: 2.2,
    inwardGain: 0.02,
    synapsePull: 0.48,
    synapseRate: 0.032,
    pointGain: 1.2,
    lineGain: 1.05,
    worldScale: 1.8,
  },
  {
    id: "glTfSwarmOrbit",
    title: "GL TF Swarm Orbit",
    subtitle: "WebGL · multi-orbit swarms with tangled filament trails.",
    particleCount: 19000,
    lineSlots: 3,
    lineOffsets: [33, 257, 1597],
    init: "figure8",
    synapses: [[-0.28, 0.24], [0.28, 0.24], [0.0, -0.24]],
    flowGain: 0.55,
    shellGain: 0.5,
    curlScale: 2.6,
    inwardGain: 0.04,
    synapsePull: 0.36,
    synapseRate: 0.024,
    pointGain: 1.0,
    lineGain: 1.1,
    worldScale: 1.76,
  },
  {
    id: "glTfSmokePlume",
    title: "GL TF Smoke Plume",
    subtitle: "WebGL · rising sheet plumes, laminar smoke filaments.",
    particleCount: 17000,
    lineSlots: 2,
    lineOffsets: [61, 733, 0],
    init: "sheet",
    synapses: [[-0.2, -0.34], [0.2, -0.34], [0.0, 0.3]],
    flowGain: 0.45,
    shellGain: 0.4,
    curlScale: 1.5,
    inwardGain: 0.06,
    synapsePull: 0.28,
    synapseRate: 0.014,
    pointGain: 0.95,
    lineGain: 1.25,
    worldScale: 1.7,
  },
  {
    id: "glTfFractalGrid",
    title: "GL TF Fractal Grid",
    subtitle: "WebGL · warped grid lattice with curl-churned fractal motion.",
    particleCount: 21000,
    lineSlots: 3,
    lineOffsets: [17, 129, 1021],
    init: "wedge",
    synapses: [[-0.34, 0.08], [0.34, 0.08], [0.0, 0.28]],
    flowGain: 0.4,
    shellGain: 0.58,
    curlScale: 3.4,
    inwardGain: 0.05,
    synapsePull: 0.25,
    synapseRate: 0.015,
    pointGain: 0.88,
    lineGain: 1.3,
    worldScale: 1.82,
  },
  {
    id: "glTfStarfall",
    title: "GL TF Starfall",
    subtitle: "WebGL · wide streaming rain of particles, vertical filaments.",
    particleCount: 24000,
    lineSlots: 1,
    lineOffsets: [41, 0, 0],
    init: "stream",
    synapses: [[-0.36, 0.32], [0.36, 0.32], [0.0, -0.3]],
    flowGain: 0.52,
    shellGain: 0.32,
    curlScale: 1.2,
    inwardGain: 0.02,
    synapsePull: 0.2,
    synapseRate: 0.012,
    pointGain: 0.85,
    lineGain: 1.35,
    worldScale: 1.88,
  },
  {
    id: "glTfTwinNebula",
    title: "GL TF Twin Nebula",
    subtitle: "WebGL · dual-lobe macro clouds with bridge filaments.",
    particleCount: 15000,
    lineSlots: 3,
    lineOffsets: [73, 601, 2801],
    init: "twin",
    synapses: [[-0.32, 0.14], [0.32, 0.14], [0.0, 0.0]],
    flowGain: 0.38,
    shellGain: 0.52,
    curlScale: 2.8,
    inwardGain: 0.05,
    synapsePull: 0.32,
    synapseRate: 0.021,
    pointGain: 1.15,
    lineGain: 1.0,
    worldScale: 1.74,
  },
  {
    id: "glTfMacroRing",
    title: "GL TF Macro Ring",
    subtitle: "WebGL · oversized cortical ring, dense lace filaments.",
    particleCount: 18500,
    lineSlots: 3,
    lineOffsets: [101, 809, 5101],
    init: "ring",
    synapses: [[-0.26, 0.26], [0.26, 0.26], [0.0, -0.28]],
    flowGain: 0.44,
    shellGain: 0.65,
    curlScale: 2.0,
    inwardGain: 0.06,
    synapsePull: 0.3,
    synapseRate: 0.017,
    pointGain: 1.08,
    lineGain: 1.22,
    worldScale: 1.8,
  },
] as const;

export const TF_WEBGL_ALL_SCENES: readonly TfPreset[] = [...TF_WEBGL_SCENES, ...TF_WEBGL_MACRO_SCENES];

export type TfWebglSceneId =
  | (typeof TF_WEBGL_SCENES)[number]["id"]
  | (typeof TF_WEBGL_MACRO_SCENES)[number]["id"];

export const TF_WEBGL_SCENE_IDS = new Set<string>(TF_WEBGL_ALL_SCENES.map((s) => s.id));

export function tfPresetForScene(sceneId: string): TfPreset | undefined {
  return TF_WEBGL_ALL_SCENES.find((s) => s.id === sceneId);
}

export function isTfMacroScene(sceneId: string): boolean {
  return TF_WEBGL_MACRO_SCENES.some((s) => s.id === sceneId);
}

export function isTfWebglScene(sceneId: string): sceneId is TfWebglSceneId {
  return TF_WEBGL_SCENE_IDS.has(sceneId);
}
