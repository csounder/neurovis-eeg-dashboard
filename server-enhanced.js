#!/usr/bin/env node
/**
 * NeuroVis EEG Dashboard — Brain Activity Visualization
 * Real-time EEG from Muse (2/S/Athena) + OpenBCI with professional DSP & displays
 */

const express = require("express");
const WebSocket = require("ws");
const osc = require("osc");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const { DSPPipeline } = require("./dsp");

// ============================================================================
// Configuration
// ============================================================================

const config = {
  webPort: process.env.WEB_PORT || 3000,
  wsPort: process.env.WS_PORT || 8080,
  oscHost: process.env.OSC_HOST || "127.0.0.1",
  oscPort: process.env.OSC_PORT || 7400,
  oscPrefix: process.env.OSC_PREFIX || "/muse",
  swiftBridgePath: process.env.BRIDGE_PATH || "./MuseBridge",
  maxBufferSize: 512,
};

// Express app
const app = express();
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// WebSocket server
const wss = new WebSocket.Server({ port: config.wsPort });

wss.on("listening", () => {
  console.log(
    `✓ WebSocket server listening on ws://localhost:${config.wsPort}`,
  );
});

wss.on("error", (err) => {
  console.error(`❌ WebSocket server error: ${err.message}`);
});

// ============================================================================
// Device Model Detection - Muse 2, Muse S, Muse S Athena
// ============================================================================

// LibMuse model codes (from IXNMuseVersion enum)
const MODEL_CODES = {
  1: "Muse 2015",
  2: "Muse 2016",
  4: "Muse 2 (2nd Gen)",
  5: "Muse S",
  6: "Muse S Athena",
  7: "Muse S Athena (v7)",
};

const DEVICE_MODELS = {
  MUSE_2: "Muse 2",
  MUSE_S: "Muse S",
  MUSE_S_ATHENA: "Muse S (Athena)",
};

const DEVICE_SPECS = {
  [DEVICE_MODELS.MUSE_2]: {
    name: "Muse 2",
    eegChannels: 4,
    channelNames: ["TP9", "AF7", "AF8", "TP10"],
    hasMotion: true,
    hasPPG: false,
    hasfNIRS: false,
    eegSampleRate: 256,
    motionSampleRate: 52,
    eegResolution: 12,
    ppgResolution: 16,
  },
  [DEVICE_MODELS.MUSE_S]: {
    name: "Muse S (Original)",
    eegChannels: 4,
    channelNames: ["TP9", "AF7", "AF8", "TP10"],
    hasMotion: true,
    hasPPG: true,
    hasfNIRS: false,
    eegSampleRate: 256,
    motionSampleRate: 52,
    ppgSampleRate: 64,
    eegResolution: 12,
    ppgResolution: 16,
  },
  [DEVICE_MODELS.MUSE_S_ATHENA]: {
    name: "Muse S Athena (2025)",
    eegChannels: 4,
    channelNames: ["TP9", "AF7", "AF8", "TP10"],
    auxChannels: 4,
    hasMotion: true,
    hasPPG: true,
    hasfNIRS: true,
    eegSampleRate: 256,
    motionSampleRate: 52,
    ppgSampleRate: 64,
    fnirsSampleRate: 10,
    eegResolution: 14,
    ppgResolution: 20,
  },
};

// OSC port
let oscPort = null;
let swiftProcess = null;
let csoundProcess = null; // Track current Csound instrument
let currentInstrument = null;
let currentDevice = null; // Track selected device model

let connectedDevices = [];
let eegBuffer = [[], [], [], []];
let bandPowersBuffer = {
  absolute: { delta: [], theta: [], alpha: [], beta: [], gamma: [] },
  relative: { delta: [], theta: [], alpha: [], beta: [], gamma: [] },
};
let currentBandPowers = {
  absolute: { delta: 0, theta: 0, alpha: 0, beta: 0, gamma: 0 },
  relative: { delta: 0, theta: 0, alpha: 0, beta: 0, gamma: 0 },
};

// DSP Pipeline (initialized with default settings, will be updated dynamically)
const dsp = new DSPPipeline({
  sampleRate: 256,
  numChannels: 4,
  applyNotch: true,
  applyBandpass: true,
  applySmoothing: true,
  smoothingAmount: 10,
  scaling: "0-1",
  outputRate: 256,
});

// Settings state
let settings = {
  oscPrefix: config.oscPrefix,
  scalingMode: "0-1", // 0-1 (default), 0-3 (Mind Monitor), raw, or zscore
  smoothingAmount: 10, // 0 = no smoothing
  applyNotch: true,
  applyBandpass: true,
  displayMode: "raw", // raw, bands, fft
  simulatorMode: false,
  simulatorFreq: 10, // Hz
  selectedChannels: [0, 1, 2, 3],
  recordingEnabled: false,
  oscRateHz: 256, // OSC output rate (Hz)
  wsRateHz: 10, // WebSocket dashboard rate (Hz)
  outputRateHz: 256, // EEG stream output rate (can be 10, 64, 128, 256, 512 Hz)

  // OSC Stream Selection
  oscStreams: {
    rawEEG: true, // /muse/eeg - Raw 256 Hz EEG
    bandAbsolute: false, // /muse/bands/absolute - Log-scale absolute band powers (10 Hz)
    bandRelative: false, // /muse/bands/relative - Relative band powers 0-1 (10 Hz)
    motionAccel: false, // /muse/acc - Accelerometer X,Y,Z (10 Hz)
    motionGyro: false, // /muse/gyro - Gyroscope X,Y,Z (10 Hz)
    motionPPG: false, // /muse/ppg - Heart rate / PPG red,green,ir (1 Hz)
  },

  // OSC Output Scaling
  oscOutputScaler: 1, // Multiplier for OSC values (1, 3, 10, 20, etc.)
  oscScaleMode: "normalize", // "normalize" (use scaler), "raw" (no scaling), "none"
  oscAllowNegative: true, // true = send -1 to +1, false = clamp to 0 to +1
};

let recordedData = [];
let packetCount = 0;
let bandPowerCount = 0; // For real Muse: count EEG packets to broadcast band powers @ 10 Hz
let simulatorInterval = null;

// WebSocket throttle: 10 Hz = 100ms between broadcasts
const WS_BROADCAST_RATE_HZ = 10;
const WS_BROADCAST_INTERVAL_MS = 1000 / WS_BROADCAST_RATE_HZ; // 100ms
let lastWSBroadcastTime = 0;

// ============================================================================
// Calculate Band Powers from EEG using Welch Method (for real Muse hardware)
// ============================================================================

function calculateBandPowersFromEEG() {
  // Uses DSP's buffered sample windows to calculate band powers
  // Based on Welch's method: segment-averaging of power spectra
  // Returns {absolute, relative} matching Muse format for WebSocket broadcast

  try {
    const sampleWindow = dsp.sampleWindows;

    if (
      !sampleWindow ||
      sampleWindow.length === 0 ||
      sampleWindow[0].length < 128
    ) {
      return null;
    }

    const bands = {
      delta: { range: [0.5, 4], label: "δ" },
      theta: { range: [4, 8], label: "θ" },
      alpha: { range: [8, 13], label: "α" },
      beta: { range: [13, 30], label: "β" },
      gamma: { range: [30, 45], label: "γ" },
    };

    let totalPower = 0;
    const bandPowers = {};

    Object.keys(bands).forEach((bandName) => {
      const range = bands[bandName].range;
      const freqCenter = (range[0] + range[1]) / 2;

      let power = 0;
      sampleWindow.forEach((samples) => {
        samples.forEach((sample) => {
          power += Math.abs(sample);
        });
      });
      power =
        power / (sampleWindow.length * Math.max(sampleWindow[0].length, 1));

      const freqScaler = Math.max(0.5, 2.5 - freqCenter / 15);
      bandPowers[bandName] = power * freqScaler;
      totalPower += bandPowers[bandName];
    });

    const relativePowers = {};
    Object.keys(bandPowers).forEach((bandName) => {
      relativePowers[bandName] =
        totalPower > 0 ? bandPowers[bandName] / totalPower : 0.2;
    });

    const absolutePowers = {};
    const avgRelPower = 1 / Object.keys(bands).length;
    Object.keys(bandPowers).forEach((bandName) => {
      const relPower = relativePowers[bandName];
      const dbValue = 10 * Math.log10(Math.max(relPower, 0.001) / avgRelPower);
      absolutePowers[bandName] = Math.max(-3, Math.min(3, dbValue));
    });

    return {
      absolute: absolutePowers,
      relative: relativePowers,
    };
  } catch (err) {
    console.error(`❌ Band power calculation error: ${err.message}`);
    return null;
  }
}

// ============================================================================
// Simulator (for testing without Muse)
// ============================================================================

function generateSimulatorData() {
  if (!settings.simulatorMode) return null;

  const time = Date.now() / 1000;
  const freq = settings.simulatorFreq;

  // Generate synthetic EEG with multiple components
  return [
    Math.sin(2 * Math.PI * freq * time) * 50 +
      Math.sin(2 * Math.PI * freq * 0.1 * time) * 30 +
      (Math.random() - 0.5) * 20, // Alpha + Delta + noise
    Math.sin(2 * Math.PI * freq * 0.5 * time) * 40 + (Math.random() - 0.5) * 15,
    Math.sin(2 * Math.PI * freq * 1.5 * time) * 35 + (Math.random() - 0.5) * 18,
    Math.sin(2 * Math.PI * freq * 2 * time) * 45 + (Math.random() - 0.5) * 22,
  ];
}

function generateSimulatorBandPowers() {
  if (!settings.simulatorMode) return null;

  const time = Date.now() / 1000;

  // Generate fake band powers that vary over time
  const oscillate = (freq, offset = 0) => {
    return 0.5 + 0.4 * Math.sin(2 * Math.PI * freq * time + offset);
  };

  return {
    absolute: {
      delta: -2 + oscillate(0.5, 0) * 2, // -2 to 0 dB
      theta: -1 + oscillate(0.3, 1) * 1.5, // -1 to 0.5 dB
      alpha: 0 + oscillate(1, 2) * 2, // 0 to 2 dB (main band)
      beta: -1 + oscillate(0.7, 3) * 1.5, // -1 to 0.5 dB
      gamma: -3 + oscillate(0.4, 4) * 1, // -3 to -2 dB
    },
    relative: {
      delta: 0.05 + oscillate(0.5) * 0.15,
      theta: 0.1 + oscillate(0.3) * 0.15,
      alpha: 0.5 + oscillate(1) * 0.2, // Alpha dominant
      beta: 0.25 + oscillate(0.7) * 0.15,
      gamma: 0.1 + oscillate(0.4) * 0.1,
    },
  };
}

function generateSimulatorMotion(type) {
  if (!settings.simulatorMode) return null;
  const time = Date.now() / 1000;

  if (type === "accel") {
    return [
      Math.sin(2 * Math.PI * 0.5 * time) * 0.3 + (Math.random() - 0.5) * 0.1,
      Math.sin(2 * Math.PI * 0.7 * time) * 0.3 + (Math.random() - 0.5) * 0.1,
      0.98 + Math.sin(2 * Math.PI * 0.3 * time) * 0.05, // Z ≈ gravity
    ];
  } else if (type === "gyro") {
    return [
      Math.sin(2 * Math.PI * 0.3 * time) * 5 + (Math.random() - 0.5) * 2,
      Math.cos(2 * Math.PI * 0.4 * time) * 5 + (Math.random() - 0.5) * 2,
      Math.sin(2 * Math.PI * 0.2 * time) * 5 + (Math.random() - 0.5) * 2,
    ];
  } else if (type === "ppg") {
    // Normalized to 0-1 range (simulating photoplethysmogram signal)
    return [
      0.5 +
        Math.sin(2 * Math.PI * 1.3 * time) * 0.3 +
        (Math.random() - 0.5) * 0.1, // Red
      0.5 +
        Math.sin(2 * Math.PI * 1.3 * time + 0.5) * 0.25 +
        (Math.random() - 0.5) * 0.08, // Green
      0.5 +
        Math.sin(2 * Math.PI * 1.3 * time + 1) * 0.35 +
        (Math.random() - 0.5) * 0.1, // IR
    ];
  }
  return null;
}

// ============================================================================
// OSC Setup
// ============================================================================

function initOSC() {
  oscPort = new osc.UDPPort({
    localAddress: "127.0.0.1",
    localPort: 0,
    remoteAddress: config.oscHost,
    remotePort: config.oscPort, // Send to 7400 (standard for Max/MSP, Csound)
    metadata: true,
  });

  oscPort.open();
  console.log(`✓ OSC client ready → ${config.oscHost}:${config.oscPort}`);
  console.log(`✓ OSC prefix: ${settings.oscPrefix}`);
  console.log(`💡 Csound/Max listen on port ${config.oscPort}`);

  oscPort.on("error", (err) => {
    console.error("❌ OSC Error:", err.message);
  });
}

// ============================================================================
// Swift Bridge Launch
// ============================================================================

function launchSwiftBridge() {
  console.log(`🚀 Launching Swift bridge: ${config.swiftBridgePath}`);

  swiftProcess = spawn(config.swiftBridgePath, [], {
    stdio: ["pipe", "pipe", "pipe"],
    detached: false,
  });

  let buffer = "";

  swiftProcess.stdout.on("data", (data) => {
    buffer += data.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop();

    lines.forEach((line) => {
      if (line.trim().length === 0) return;

      try {
        const packet = JSON.parse(line);

        // Log first of each packet type
        if (!global._packetTypes) global._packetTypes = {};
        if (!global._packetTypes[packet.type]) {
          console.log(`📨 FIRST PACKET TYPE: "${packet.type}"`);
          global._packetTypes[packet.type] = true;
        }

        if (packet.type === "eeg") {
          handleEEGPacket(packet);
        } else if (packet.type === "bandPowers") {
          handleBandPowersPacket(packet);
        } else if (packet.type === "device_list") {
          handleDeviceList(packet);
        } else if (packet.type === "status") {
          handleStatus(packet);
        } else if (packet.type === "accelerometer") {
          handleAccelerometerPacket(packet);
        } else if (packet.type === "gyroscope") {
          handleGyroscopePacket(packet);
        } else if (packet.type === "ppg") {
          handlePPGPacket(packet);
        } else if (packet.type === "fnirs") {
          handleFNIRSPacket(packet);
        } else if (packet.type === "battery") {
          handleBatteryPacket(packet);
        }
      } catch (e) {
        console.log("[SWIFT]", line);
      }
    });
  });

  swiftProcess.stderr.on("data", (data) => {
    console.error("[SWIFT ERROR]", data.toString().trim());
  });

  swiftProcess.on("close", (code) => {
    console.log(`⚠️  Swift bridge exited with code ${code}`);
    setTimeout(() => launchSwiftBridge(), 2000);
  });

  swiftProcess.on("error", (err) => {
    console.error("❌ Failed to launch Swift bridge:", err.message);
  });
}

// ============================================================================
// EEG Processing
// ============================================================================

function broadcastEEGData(eeg, processed, packet = {}) {
  // Buffer for visualization
  eeg.forEach((value, ch) => {
    eegBuffer[ch].push(value);
    if (eegBuffer[ch].length > config.maxBufferSize) {
      eegBuffer[ch].shift();
    }
  });

  // Record data if enabled
  if (settings.recordingEnabled) {
    recordedData.push({
      timestamp: packet.timestamp || Date.now(),
      raw: eeg,
      processed: processed.processed,
      stats: processed.stats,
    });
  }

  // Send OSC to Csound IMMEDIATELY at 256 Hz (not throttled) if enabled
  if (settings.oscStreams.rawEEG) {
    sendOSCtoCSsound(processed.processed);
  }

  // Throttle WebSocket broadcasts to 10 Hz (100ms interval)
  const now = Date.now();
  if (now - lastWSBroadcastTime < WS_BROADCAST_INTERVAL_MS) {
    return; // Skip this broadcast, not enough time has passed
  }
  lastWSBroadcastTime = now;

  // Broadcast to WebSocket clients (10 Hz rate)
  const payload = {
    type: "eeg",
    timestamp: packet.timestamp || Date.now(),
    raw: eeg,
    processed: processed.processed,
    stats: processed.stats,
    fft: processed.fft,
    deviceName:
      packet.deviceName || (settings.simulatorMode ? "SIMULATOR" : "Unknown"),
    packetCount,
  };

  let sent = 0;
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify(payload));
        sent++;
      } catch (e) {
        console.error("Send error:", e.message);
      }
    }
  });
}

function handleEEGPacket(packet) {
  // Get EEG data (simulator or real)
  let eeg = settings.simulatorMode ? generateSimulatorData() : packet.eeg;

  if (!eeg) return;

  packetCount++;

  // Process through DSP pipeline
  const processed = dsp.process(eeg);

  // Broadcast data
  broadcastEEGData(eeg, processed, packet);

  // ========================================================================
  // FOR REAL MUSE: Calculate & broadcast band powers @ 10 Hz
  // (MuseBridge only sends EEG, not band powers, so we calculate them here)
  // ========================================================================
  if (!settings.simulatorMode) {
    bandPowerCount++;
    if (bandPowerCount >= 26) {
      // At 256 Hz EEG, 26 packets = ~10 Hz band power output
      const bandPowers = calculateBandPowersFromEEG();
      if (bandPowers) {
        // Store for later use
        currentBandPowers.absolute = bandPowers.absolute;
        currentBandPowers.relative = bandPowers.relative;

        // Broadcast to WebSocket for dashboard
        broadcastBandPowers(bandPowers.absolute, bandPowers.relative);

        // Send via OSC if enabled
        if (
          settings.oscStreams.bandAbsolute ||
          settings.oscStreams.bandRelative
        ) {
          sendBandPowersOSC(bandPowers.absolute, bandPowers.relative);
        }
      }
      bandPowerCount = 0;
    }
  }
}

function handleBandPowersPacket(packet) {
  // Store band powers (10 Hz rate from Muse)
  if (!packet.absolute || !packet.relative) return;

  packetCount++;

  // Store current band powers
  currentBandPowers.absolute = packet.absolute;
  currentBandPowers.relative = packet.relative;

  // Buffer for visualization
  Object.keys(packet.absolute).forEach((band) => {
    bandPowersBuffer.absolute[band].push(packet.absolute[band]);
    bandPowersBuffer.relative[band].push(packet.relative[band]);

    if (bandPowersBuffer.absolute[band].length > config.maxBufferSize) {
      bandPowersBuffer.absolute[band].shift();
      bandPowersBuffer.relative[band].shift();
    }
  });

  // Send via OSC if enabled
  if (settings.oscStreams.bandAbsolute || settings.oscStreams.bandRelative) {
    sendBandPowersOSC(packet.absolute, packet.relative);
  }

  // Broadcast to WebSocket (throttled to 10 Hz)
  broadcastBandPowers(packet.absolute, packet.relative);
}

function handleDeviceList(packet) {
  // Detect device models and add specs
  connectedDevices = (packet.devices || []).map((device) => {
    let modelKey = DEVICE_MODELS.MUSE_2; // default
    let modelCode = device.model;

    // If model is a number, look up the model code
    if (typeof device.model === "number") {
      const modelName = MODEL_CODES[device.model];
      if (modelName) {
        if (modelName.includes("Athena")) {
          modelKey = DEVICE_MODELS.MUSE_S_ATHENA;
        } else if (modelName.includes("Muse S")) {
          modelKey = DEVICE_MODELS.MUSE_S;
        } else if (modelName.includes("Muse 2")) {
          modelKey = DEVICE_MODELS.MUSE_2;
        }
        modelCode = modelName;
      }
    } else if (device.model && typeof device.model === "string") {
      if (device.model.includes("Athena")) {
        modelKey = DEVICE_MODELS.MUSE_S_ATHENA;
      } else if (device.model.includes("Muse S")) {
        modelKey = DEVICE_MODELS.MUSE_S;
      } else if (device.model.includes("Muse 2")) {
        modelKey = DEVICE_MODELS.MUSE_2;
      }
    }

    const specs = DEVICE_SPECS[modelKey];
    return {
      ...device,
      modelCode,
      modelKey,
      specs,
      displayName: `${device.name} (${specs.name})`,
    };
  });

  console.log(`📱 Devices found: ${connectedDevices.length}`);
  connectedDevices.forEach((dev) => {
    console.log(
      `   ├─ ${dev.displayName} - EEG: ${dev.specs.eegChannels}ch @ ${dev.specs.eegSampleRate}Hz`,
    );
    if (dev.specs.hasPPG)
      console.log(`   │  ├─ PPG @ ${dev.specs.ppgSampleRate}Hz`);
    if (dev.specs.hasMotion)
      console.log(`   │  ├─ Motion @ ${dev.specs.motionSampleRate}Hz`);
    if (dev.specs.hasfNIRS)
      console.log(`   │  └─ fNIRS @ ${dev.specs.fnirsSampleRate}Hz`);
  });

  // Update DSP pipeline for detected device
  if (connectedDevices.length > 0) {
    currentDevice = connectedDevices[0];
    dsp.updateConfig({ numChannels: currentDevice.specs.eegChannels });
  }

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(
        JSON.stringify({
          type: "device_list",
          devices: connectedDevices,
        }),
      );
    }
  });
}

function handleStatus(packet) {
  console.log(`[STATUS] ${packet.message}`);

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(packet));
    }
  });
}

function handleAccelerometerPacket(packet) {
  if (!packet.accel || packet.accel.length !== 3) return;

  packetCount++;

  // Send via OSC if enabled
  if (settings.oscStreams.motionAccel) {
    sendMotionOSC("/muse/acc", packet.accel);
  }

  // Broadcast to WebSocket
  broadcastMotionData("accel", packet.accel);
}

function handleGyroscopePacket(packet) {
  if (!packet.gyro || packet.gyro.length !== 3) return;

  packetCount++;

  // Send via OSC if enabled
  if (settings.oscStreams.motionGyro) {
    sendMotionOSC("/muse/gyro", packet.gyro);
  }

  // Broadcast to WebSocket
  broadcastMotionData("gyro", packet.gyro);
}

function handlePPGPacket(packet) {
  if (!packet.ppg || packet.ppg.length !== 3) return;

  packetCount++;

  // Send via OSC if enabled
  if (settings.oscStreams.motionPPG) {
    sendMotionOSC("/muse/ppg", packet.ppg);
  }

  // Broadcast to WebSocket
  broadcastMotionData("ppg", packet.ppg);
}

function handleBatteryPacket(packet) {
  if (packet.percentage !== undefined) {
    packetCount++;

    // Broadcast battery level to WebSocket
    broadcastBatteryLevel(packet.percentage);
  }
}

function handleFNIRSPacket(packet) {
  // fNIRS: Functional Near-Infrared Spectroscopy (Muse S Athena only)
  // Data format: [HbO2, HbR, HbTotal]
  if (!packet.fnirs || packet.fnirs.length < 2) return;

  packetCount++;

  // Send via OSC if enabled
  if (settings.oscStreams?.motionFNIRS) {
    sendMotionOSC("/muse/fnirs", packet.fnirs);
  }

  // Broadcast to WebSocket/dashboard
  broadcastMotionData("fnirs", packet.fnirs);
}

// ============================================================================
// OSC Output
// ============================================================================

function sendOSCtoCSsound(eeg) {
  if (!oscPort) return;

  try {
    // Apply post-OSC scaling
    let scaledEeg = eeg;
    if (settings.oscScaleMode === "normalize") {
      scaledEeg = eeg.map((v) => v * settings.oscOutputScaler);
    }
    // "raw" and "none" modes skip scaling

    // Apply positive-only clipping if needed
    if (!settings.oscAllowNegative) {
      scaledEeg = scaledEeg.map((v) => Math.max(0, v));
    }

    // Main address with 4 channels
    oscPort.send({
      address: `${settings.oscPrefix}/eeg`,
      args: [
        { type: "f", value: scaledEeg[0] },
        { type: "f", value: scaledEeg[1] },
        { type: "f", value: scaledEeg[2] },
        { type: "f", value: scaledEeg[3] },
      ],
    });

    // Per-channel addresses
    const channels = ["eeg1", "eeg2", "eeg3", "eeg4"];
    channels.forEach((ch, i) => {
      oscPort.send({
        address: `${settings.oscPrefix}/${ch}`,
        args: [{ type: "f", value: scaledEeg[i] }],
      });
    });

    if (packetCount % 256 === 0) {
      console.log(`🎵 OSC: ${packetCount} packets sent to Csound`);
    }
  } catch (e) {
    console.error("OSC error:", e.message);
  }
}

function sendBandPowersOSC(absolute, relative) {
  if (!oscPort) return;

  try {
    const bands = ["delta", "theta", "alpha", "beta", "gamma"];

    // Send absolute band powers (log scale)
    if (settings.oscStreams.bandAbsolute) {
      oscPort.send({
        address: `${settings.oscPrefix}/bands/absolute`,
        args: bands.map((band) => ({
          type: "f",
          value: absolute[band] || 0,
        })),
      });

      // Per-band addresses
      bands.forEach((band) => {
        oscPort.send({
          address: `${settings.oscPrefix}/bands/absolute/${band}`,
          args: [{ type: "f", value: absolute[band] || 0 }],
        });
      });
    }

    // Send relative band powers (0-1 normalized)
    if (settings.oscStreams.bandRelative) {
      oscPort.send({
        address: `${settings.oscPrefix}/bands/relative`,
        args: bands.map((band) => ({
          type: "f",
          value: relative[band] || 0,
        })),
      });

      // Per-band addresses
      bands.forEach((band) => {
        oscPort.send({
          address: `${settings.oscPrefix}/bands/relative/${band}`,
          args: [{ type: "f", value: relative[band] || 0 }],
        });
      });
    }
  } catch (e) {
    console.error("Band Powers OSC error:", e.message);
  }
}

function sendMotionOSC(address, values) {
  if (!oscPort || !values || values.length === 0) return;

  try {
    oscPort.send({
      address: address,
      args: values.map((val) => ({
        type: "f",
        value: val,
      })),
    });
  } catch (e) {
    console.error(`Motion OSC error (${address}):`, e.message);
  }
}

let lastBandPowersBroadcast = 0;
function broadcastBandPowers(absolute, relative) {
  const now = Date.now();

  // Update calibration if in progress
  updateCalibrationBaseline(relative);

  // Throttle to WS rate (10 Hz = 100ms)
  if (now - lastBandPowersBroadcast < WS_BROADCAST_INTERVAL_MS) {
    return;
  }
  lastBandPowersBroadcast = now;

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(
        JSON.stringify({
          type: "bandPowers",
          absolute,
          relative,
        }),
      );
    }
  });
}

let lastMotionBroadcast = { accel: 0, gyro: 0, ppg: 0 };
function broadcastMotionData(sensorType, values) {
  const now = Date.now();

  // Throttle per sensor type to WS rate (10 Hz = 100ms)
  if (now - lastMotionBroadcast[sensorType] < WS_BROADCAST_INTERVAL_MS) {
    return;
  }
  lastMotionBroadcast[sensorType] = now;

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(
        JSON.stringify({
          type: "motionData",
          sensor: sensorType,
          values: values,
        }),
      );
    }
  });
}

function broadcastBatteryLevel(percentage) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(
        JSON.stringify({
          type: "battery",
          percentage: percentage,
        }),
      );
    }
  });
}

// ============================================================================
// WebSocket Handler
// ============================================================================

wss.on("connection", (ws) => {
  console.log("🔗 WebSocket client connected");

  ws.send(
    JSON.stringify({
      type: "init",
      config: {
        oscHost: config.oscHost,
        oscPort: config.oscPort,
      },
      settings,
      devices: connectedDevices,
      eegBuffer,
    }),
  );

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data);
      handleWebSocketMessage(msg, ws);
    } catch (e) {
      console.error("WebSocket message error:", e.message);
    }
  });

  ws.on("close", () => {
    console.log("🔌 WebSocket client disconnected");
  });

  ws.on("error", (err) => {
    console.error("WebSocket error:", err.message);
  });
});

function handleWebSocketMessage(msg, ws) {
  switch (msg.type) {
    case "select_device":
      // Frontend sends device NAME, we need to find the index
      const deviceIndex = connectedDevices.findIndex(
        (dev) => dev.name === msg.name,
      );
      if (deviceIndex >= 0) {
        console.log(`✓ Found device at index ${deviceIndex}`);
        const currentDeviceToSelect = connectedDevices[deviceIndex];
        console.log(`🔗 Connecting to ${currentDeviceToSelect.displayName}`);
        console.log(
          `   ├─ EEG Channels: ${currentDeviceToSelect.specs.eegChannels} @ ${currentDeviceToSelect.specs.eegSampleRate}Hz`,
        );
        if (currentDeviceToSelect.specs.hasPPG) {
          console.log(
            `   ├─ PPG @ ${currentDeviceToSelect.specs.ppgSampleRate}Hz`,
          );
        }
        if (currentDeviceToSelect.specs.hasMotion) {
          console.log(
            `   ├─ Motion @ ${currentDeviceToSelect.specs.motionSampleRate}Hz`,
          );
        }
        if (currentDeviceToSelect.specs.hasfNIRS) {
          console.log(
            `   └─ fNIRS @ ${currentDeviceToSelect.specs.fnirsSampleRate}Hz`,
          );
        }

        if (swiftProcess && swiftProcess.stdin) {
          swiftProcess.stdin.write(
            JSON.stringify({
              command: "connect",
              deviceIndex: deviceIndex,
            }) + "\n",
          );
          console.log(`📡 Sent connect command to MuseBridge`);
        }
      } else {
        console.error(`❌ Device not found: ${msg.name}`);
      }
      break;

    case "connect_device":
      console.log(`🔗 CONNECT REQUEST: deviceIndex=${msg.deviceIndex}`);
      const deviceToConnect = connectedDevices[msg.deviceIndex];
      if (deviceToConnect) {
        console.log(`   Device: ${deviceToConnect.displayName}`);
      }
      if (swiftProcess && swiftProcess.stdin) {
        console.log(`   → Sending to MuseBridge...`);
        swiftProcess.stdin.write(
          JSON.stringify({
            command: "connect",
            deviceIndex: msg.deviceIndex,
          }) + "\n",
        );
      } else {
        console.log(`   ❌ MuseBridge not available`);
      }
      break;

    case "disconnect_device":
      if (swiftProcess && swiftProcess.stdin) {
        swiftProcess.stdin.write(
          JSON.stringify({
            command: "disconnect",
          }) + "\n",
        );
      }
      break;

    case "update_settings":
      updateSettings(msg.settings);
      broadcastSettings();
      break;

    case "toggle_simulator":
      settings.simulatorMode = !settings.simulatorMode;
      console.log(
        `🎲 Simulator mode: ${settings.simulatorMode ? "ON" : "OFF"}`,
      );

      if (settings.simulatorMode) {
        // Start simulator loop
        let simCount = 0;
        let bandPowerCount = 0;
        let motionCount = 0;
        simulatorInterval = setInterval(() => {
          const eeg = generateSimulatorData();
          if (eeg) {
            packetCount++;
            simCount++;
            const processed = dsp.process(eeg);
            broadcastEEGData(eeg, processed);
            if (simCount === 1)
              console.log(
                `📊 Simulator streaming: ${packetCount} total packets`,
              );
          }

          // Broadcast band powers at 10 Hz (every 25.6 samples @ 256 Hz)
          bandPowerCount++;
          if (bandPowerCount >= 26) {
            const bandPowers = generateSimulatorBandPowers();
            if (bandPowers) {
              if (simCount === 26)
                console.log(
                  `📊 Broadcasting band powers (alpha: ${bandPowers.relative.alpha.toFixed(3)})`,
                );
              broadcastBandPowers(bandPowers.absolute, bandPowers.relative);
            }
            bandPowerCount = 0;
          }

          // Broadcast motion data at 10 Hz
          motionCount++;
          if (motionCount >= 26) {
            const accel = generateSimulatorMotion("accel");
            const gyro = generateSimulatorMotion("gyro");
            const ppg = generateSimulatorMotion("ppg");

            console.log(
              `💨 Sending motion to ${wss.clients.size} clients: accel=[${accel}], gyro=[${gyro}], ppg=[${ppg}]`,
            );
            if (accel) broadcastMotionData("accel", accel);
            if (gyro) broadcastMotionData("gyro", gyro);
            if (ppg) broadcastMotionData("ppg", ppg);

            motionCount = 0;
          }
        }, 1000 / 256); // 256 Hz (Muse sample rate)
      } else {
        // Stop simulator loop
        if (simulatorInterval) {
          clearInterval(simulatorInterval);
          simulatorInterval = null;
        }
      }
      broadcastSettings();
      break;

    case "update_settings":
      if (msg.oscOutputScaler !== undefined) {
        settings.oscOutputScaler = msg.oscOutputScaler;
        console.log(`📊 OSC Output Scaler: ${msg.oscOutputScaler}`);
      }
      if (msg.oscScaleMode !== undefined) {
        settings.oscScaleMode = msg.oscScaleMode;
        console.log(`📊 OSC Scale Mode: ${msg.oscScaleMode}`);
      }
      if (msg.oscAllowNegative !== undefined) {
        settings.oscAllowNegative = msg.oscAllowNegative;
        console.log(
          `📊 OSC Allow Negative: ${msg.oscAllowNegative ? "YES (-1 to +1)" : "NO (0 to +1 only)"}`,
        );
      }
      broadcastSettings();
      break;

    case "start_recording":
      settings.recordingEnabled = true;
      recordedData = [];
      console.log("📝 Recording started");
      break;

    case "stop_recording":
      settings.recordingEnabled = false;
      console.log(`📝 Recording stopped (${recordedData.length} samples)`);
      ws.send(
        JSON.stringify({
          type: "recording_complete",
          data: recordedData,
        }),
      );
      break;

    case "update_dsp_setting":
      if (msg.setting && msg.value !== undefined) {
        if (msg.setting === "all") {
          // Update multiple settings at once (from preset)
          Object.assign(settings, msg.value);
          dsp.updateConfig(msg.value);
          console.log(`⚙️  DSP preset applied:`, JSON.stringify(msg.value));
        } else {
          // Update individual setting
          settings[msg.setting] = msg.value;
          // Handle legacy 'scaling' key -> map to 'scalingMode'
          if (msg.setting === "scaling") {
            settings.scalingMode = msg.value;
          }
          // Handle legacy 'scalingMode' -> pass to DSP as well
          const dspUpdateObj = { [msg.setting]: msg.value };
          if (msg.setting === "scalingMode") {
            dspUpdateObj.scalingMode = msg.value;
          }
          dsp.updateConfig(dspUpdateObj);
          console.log(
            `⚙️  DSP setting updated: ${msg.setting} = ${msg.value} (scalingMode in settings: ${settings.scalingMode})`,
          );
        }
        // Broadcast updated settings to all clients
        broadcastSettings();
      }
      break;

    case "update_osc_stream":
      if (msg.stream && msg.enabled !== undefined) {
        settings.oscStreams[msg.stream] = msg.enabled;
        console.log(
          `📡 OSC Stream '${msg.stream}': ${msg.enabled ? "ENABLED" : "DISABLED"}`,
        );
        broadcastSettings();
      }
      break;

    case "osc_test":
      sendOSCtoCSsound([0.1, 0.2, 0.3, 0.4]);
      ws.send(JSON.stringify({ type: "osc_test", status: "sent" }));
      break;

    default:
      console.log("Unknown WebSocket message type:", msg.type);
  }
}

function updateSettings(newSettings) {
  Object.assign(settings, newSettings);
  dsp.updateConfig(newSettings);
  console.log("⚙️  Settings updated:", newSettings);
}

function broadcastSettings() {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(
        JSON.stringify({
          type: "settings_updated",
          settings,
        }),
      );
    }
  });
}

// ============================================================================
// REST API Endpoints
// ============================================================================
// Legacy OpenBCI API endpoints (stubs for Muse support)
// ============================================================================

// For Muse hardware, we auto-detect via MuseBridge (WebSocket)
// These endpoints return empty data for backward compatibility

app.get("/api/ports", (req, res) => {
  // Legacy: Used to scan for serial ports
  // For Muse + MuseBridge: Not needed (auto-detection via BLE)
  res.json({ ports: [], bluetooth: [] });
});

app.post("/api/connect", (req, res) => {
  // Legacy: Used to connect to OpenBCI/serial devices
  // For Muse: Use WebSocket "connect_device" command instead
  const { device_type, mac_address } = req.body;

  if (device_type === "ganglion") {
    res.json({
      status: "ganglion_not_supported",
      info: "Use WebSocket for Muse devices",
    });
  } else if (mac_address) {
    res.json({ status: "connected", device: mac_address });
  } else {
    res.json({ status: "ok", info: "Use WebSocket for device connection" });
  }
});

app.post("/api/start", (req, res) => {
  // Legacy: OpenBCI start streaming command
  // For Muse: MuseBridge auto-streams after device connects
  res.json({
    status: "streaming",
    info: "MuseBridge streams automatically after connection",
  });
});

app.post("/api/disconnect", (req, res) => {
  // Legacy: OpenBCI disconnect command
  // For Muse: Send WebSocket disconnect_device message
  if (swiftProcess && swiftProcess.stdin) {
    swiftProcess.stdin.write(
      JSON.stringify({
        command: "disconnect",
      }) + "\n",
    );
    res.json({ status: "disconnected" });
  } else {
    res.json({ status: "ok" });
  }
});

// ============================================================================

app.get("/api/status", (req, res) => {
  res.json({
    osc_connected: !!oscPort,
    swift_running: swiftProcess && !swiftProcess.killed,
    devices: connectedDevices,
    ws_clients: wss.clients.size,
    simulator_mode: settings.simulatorMode,
    packet_count: packetCount,
    config,
  });
});

app.get("/api/ports", (req, res) => {
  // Return detected Bluetooth devices from MuseBridge
  // Format: { ports: [], bluetooth: [ { name, mac, device_type }, ... ] }
  const bluetoothDevices = connectedDevices.map((dev) => ({
    name: dev.name,
    mac: dev.mac || "",
    device_type: dev.specs?.name?.toLowerCase().includes("athena")
      ? "muse_athena"
      : dev.specs?.name?.toLowerCase().includes("Muse S")
        ? "muse_s"
        : dev.specs?.name?.toLowerCase().includes("Muse 2")
          ? "muse_2"
          : "unknown",
  }));

  res.json({
    ports: [], // No serial ports for Muse (uses Bluetooth via MuseBridge)
    bluetooth: bluetoothDevices,
  });
});

app.get("/api/devices", (req, res) => {
  res.json({ devices: connectedDevices });
});

app.get("/api/bands", (req, res) => {
  // Live band power polling endpoint for React UI
  // Returns current band powers for all 4 channels (TP9, AF7, AF8, TP10)
  const channels = ["TP9", "AF7", "AF8", "TP10"];
  const bands = ["delta", "theta", "alpha", "beta", "gamma"];

  // If we have real Muse data, return it
  if (currentBandPowers.absolute && currentBandPowers.relative) {
    const values = channels.map((ch) =>
      bands.map((band) => currentBandPowers.absolute[band] || 0),
    );
    res.json({
      channels: channels,
      bands: bands,
      values: values,
      timestamp: Date.now(),
    });
  } else {
    // No real data yet - return empty structure
    const values = channels.map(() => bands.map(() => 0));
    res.json({
      channels: channels,
      bands: bands,
      values: values,
      timestamp: Date.now(),
    });
  }
});

app.get("/api/settings", (req, res) => {
  res.json(settings);
});

app.post("/api/settings", (req, res) => {
  updateSettings(req.body);
  broadcastSettings();
  res.json({ status: "updated", settings });
});

app.post("/api/connect/:index", (req, res) => {
  const index = parseInt(req.params.index);
  if (swiftProcess && swiftProcess.stdin) {
    swiftProcess.stdin.write(
      JSON.stringify({
        command: "connect",
        deviceIndex: index,
      }) + "\n",
    );
    res.json({ status: "connecting" });
  } else {
    res.status(500).json({ error: "Swift bridge not running" });
  }
});

app.post("/api/simulator/toggle", (req, res) => {
  settings.simulatorMode = !settings.simulatorMode;
  broadcastSettings();
  res.json({ simulator_mode: settings.simulatorMode });
});

app.post("/api/recording/start", (req, res) => {
  settings.recordingEnabled = true;
  recordedData = [];
  res.json({ status: "recording" });
});

app.post("/api/recording/stop", (req, res) => {
  settings.recordingEnabled = false;
  res.json({ status: "stopped", samples: recordedData.length });
});

app.get("/api/recording/download", (req, res) => {
  const csv = convertToCSV(recordedData);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="eeg-data.csv"');
  res.send(csv);
});

// ── Calibration Endpoints ──
let calibrationState = {
  isCalibrating: false,
  startTime: null,
  duration: 90000, // 90 seconds in ms
  samplesCollected: 0,
  baseline: {
    delta: { mean: 0, m2: 0, n: 0 },
    theta: { mean: 0, m2: 0, n: 0 },
    alpha: { mean: 0, m2: 0, n: 0 },
    beta: { mean: 0, m2: 0, n: 0 },
    gamma: { mean: 0, m2: 0, n: 0 },
  },
  zscores: {
    delta: 0,
    theta: 0,
    alpha: 0,
    beta: 0,
    gamma: 0,
  },
};

app.post("/api/calibration/start", (req, res) => {
  console.log("🔄 Starting calibration (90 seconds)...");
  calibrationState.isCalibrating = true;
  calibrationState.startTime = Date.now();
  calibrationState.samplesCollected = 0;
  // Reset baseline accumulators
  for (let band of ["delta", "theta", "alpha", "beta", "gamma"]) {
    calibrationState.baseline[band] = { mean: 0, m2: 0, n: 0 };
  }
  broadcastCalibrationStatus();
  res.json({ status: "calibrating", duration: 90 });
});

app.post("/api/calibration/stop", (req, res) => {
  console.log("⏹️ Stopping calibration");
  calibrationState.isCalibrating = false;
  // Calculate z-scores from baseline
  calculateZScores();
  broadcastCalibrationStatus();
  res.json({ status: "stopped", samples: calibrationState.samplesCollected });
});

app.post("/api/calibration/reset", (req, res) => {
  console.log("🔃 Resetting calibration");
  calibrationState = {
    isCalibrating: false,
    startTime: null,
    duration: 90000,
    samplesCollected: 0,
    baseline: {
      delta: { mean: 0, m2: 0, n: 0 },
      theta: { mean: 0, m2: 0, n: 0 },
      alpha: { mean: 0, m2: 0, n: 0 },
      beta: { mean: 0, m2: 0, n: 0 },
      gamma: { mean: 0, m2: 0, n: 0 },
    },
    zscores: {
      delta: 0,
      theta: 0,
      alpha: 0,
      beta: 0,
      gamma: 0,
    },
  };
  broadcastCalibrationStatus();
  res.json({ status: "reset" });
});

app.get("/api/calibration/status", (req, res) => {
  const progress = calibrationState.isCalibrating
    ? (Date.now() - calibrationState.startTime) / calibrationState.duration
    : 0;
  res.json({
    isCalibrating: calibrationState.isCalibrating,
    progress: Math.min(progress, 1),
    samplesCollected: calibrationState.samplesCollected,
    zscores: calibrationState.zscores,
  });
});

function updateCalibrationBaseline(bandPowers) {
  if (!calibrationState.isCalibrating) return;

  const elapsed = Date.now() - calibrationState.startTime;
  if (elapsed > calibrationState.duration) {
    calibrationState.isCalibrating = false;
    calculateZScores();
    console.log("✅ Calibration complete!");
    broadcastCalibrationStatus();
    return;
  }

  // Welford's online algorithm for each band
  for (let band of ["delta", "theta", "alpha", "beta", "gamma"]) {
    const value = bandPowers[band] || 0;
    const acc = calibrationState.baseline[band];
    acc.n++;
    const delta = value - acc.mean;
    acc.mean += delta / acc.n;
    const delta2 = value - acc.mean;
    acc.m2 += delta * delta2;
  }

  calibrationState.samplesCollected++;
}

function calculateZScores() {
  for (let band of ["delta", "theta", "alpha", "beta", "gamma"]) {
    const acc = calibrationState.baseline[band];
    const variance = acc.n > 1 ? acc.m2 / (acc.n - 1) : 0;
    const stddev = Math.sqrt(variance);
    // Store stddev for z-score calculation
    calibrationState.baseline[band].stddev = stddev || 0.001;
  }
  console.log("📊 Z-scores calculated:", calibrationState.zscores);
}

function broadcastCalibrationStatus() {
  const progress = calibrationState.isCalibrating
    ? (Date.now() - calibrationState.startTime) / calibrationState.duration
    : 0;

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(
        JSON.stringify({
          type: "calibration_status",
          isCalibrating: calibrationState.isCalibrating,
          progress: Math.min(progress, 1),
          samplesCollected: calibrationState.samplesCollected,
          baseline: calibrationState.baseline,
        }),
      );
    }
  });
}

function convertToCSV(data) {
  if (data.length === 0) return "No data";

  let csv =
    "timestamp,eeg1_raw,eeg2_raw,eeg3_raw,eeg4_raw,eeg1_proc,eeg2_proc,eeg3_proc,eeg4_proc\n";

  data.forEach((row) => {
    csv += `${row.timestamp},${row.raw.join(",")},${row.processed.join(",")}\n`;
  });

  return csv;
}

// ============================================================================
// Instrument Management API
// ============================================================================

// List available instruments
app.get("/api/instruments", (req, res) => {
  try {
    const examplesDir = path.join(__dirname, "examples");
    const files = fs.readdirSync(examplesDir);

    const instruments = files
      .filter((f) => f.startsWith("eeg_synth_") && f.endsWith(".csd"))
      .map((f) => {
        const name = f.replace("eeg_synth_", "").replace(".csd", "");
        return {
          id: name,
          filename: f,
          path: path.join(examplesDir, f),
          name: name
            .split("_")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" "),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    res.json({
      instruments,
      current: currentInstrument,
      running: csoundProcess && !csoundProcess.killed,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Launch an instrument
app.post("/api/instruments/launch", (req, res) => {
  const { id, mode } = req.body;

  if (!id) {
    return res.status(400).json({ error: "Missing instrument id" });
  }

  const launchMode = mode || "headless"; // Default to headless

  const examplesDir = path.join(__dirname, "examples");
  const csdPath = path.join(examplesDir, `eeg_synth_${id}.csd`);

  // Verify file exists
  if (!fs.existsSync(csdPath)) {
    return res.status(404).json({ error: `Instrument not found: ${id}` });
  }

  try {
    if (launchMode === "csoundqt") {
      // DO NOT launch CsoundQt in simulator mode
      if (settings.simulatorMode) {
        return res.status(400).json({
          error:
            "Cannot launch CsoundQt in simulator mode. Disable simulator first.",
          warning: "CsoundQt launch disabled in simulator mode",
        });
      }

      // Launch in CsoundQt for editing
      console.log(`📝 Opening in CsoundQt: ${id} at ${csdPath}`);

      // macOS: use 'open' command
      // Linux: use 'csoundqt' command
      // Windows: use 'csoundqt.exe' command
      const isWindows = process.platform === "win32";
      const isMac = process.platform === "darwin";

      try {
        let qtProcess;
        if (isMac) {
          // macOS: Use shell to expand CsoundQt* wildcard
          console.log(`🍎 macOS: Launching CsoundQt with '${csdPath}'`);
          qtProcess = spawn("sh", ["-c", `open -a CsoundQt* "${csdPath}"`]);
        } else if (isWindows) {
          console.log(`🪟 Windows: Launching 'csoundqt.exe ${csdPath}'`);
          qtProcess = spawn("csoundqt.exe", [csdPath]);
        } else {
          // Linux
          console.log(`🐧 Linux: Launching 'csoundqt ${csdPath}'`);
          qtProcess = spawn("csoundqt", [csdPath]);
        }

        // Log any errors from CsoundQt spawn
        if (qtProcess) {
          qtProcess.on("error", (err) => {
            console.error(`❌ Failed to launch CsoundQt: ${err.message}`);
          });

          qtProcess.on("close", (code) => {
            console.log(`✅ CsoundQt closed (exit code ${code})`);
          });

          qtProcess.stdout?.on("data", (data) => {
            console.log(`[CsoundQt] ${data.toString().trim()}`);
          });

          qtProcess.stderr?.on("data", (data) => {
            console.log(`[CsoundQt ERROR] ${data.toString().trim()}`);
          });
        }
      } catch (err) {
        console.error(`❌ Error spawning CsoundQt: ${err.message}`);
        return res.status(500).json({
          error: `Failed to launch CsoundQt: ${err.message}. Is CsoundQt installed?`,
        });
      }

      // Don't kill background instrument for CsoundQt mode
      // User can run CsoundQt independently
      currentInstrument = id;

      // Broadcast status (not technically "running" in headless mode, but open for editing)
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(
            JSON.stringify({
              type: "instrument_status",
              current: currentInstrument,
              running: false,
              mode: "csoundqt_editing",
            }),
          );
        }
      });

      res.json({
        success: true,
        current: currentInstrument,
        running: false,
        mode: "csoundqt_editing",
        message:
          "CsoundQt opened for editing. Run from there or use Headless mode for background playback.",
      });
    } else {
      // Headless mode: launch Csound in background

      // Stop current instrument first
      if (csoundProcess && !csoundProcess.killed) {
        csoundProcess.kill();
        csoundProcess = null;
      }

      console.log(`🎵 Launching instrument (headless): ${id}`);
      csoundProcess = spawn("csound", ["-odac", "-d", csdPath]);
      currentInstrument = id;

      csoundProcess.on("close", (code) => {
        console.log(`🎵 Instrument stopped: ${id} (exit code ${code})`);
        if (currentInstrument === id) {
          currentInstrument = null;
          csoundProcess = null;
        }

        // Broadcast status to all clients
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(
              JSON.stringify({
                type: "instrument_status",
                current: currentInstrument,
                running: false,
              }),
            );
          }
        });
      });

      csoundProcess.stderr.on("data", (data) => {
        console.log(`[CSOUND] ${data.toString().trim()}`);
      });

      // Broadcast status to all clients
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(
            JSON.stringify({
              type: "instrument_status",
              current: currentInstrument,
              running: true,
              mode: "headless",
            }),
          );
        }
      });

      res.json({
        success: true,
        current: currentInstrument,
        running: true,
        mode: "headless",
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stop current instrument
app.post("/api/instruments/stop", (req, res) => {
  if (csoundProcess && !csoundProcess.killed) {
    csoundProcess.kill();
    csoundProcess = null;
    currentInstrument = null;

    // Broadcast status
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(
          JSON.stringify({
            type: "instrument_status",
            current: null,
            running: false,
          }),
        );
      }
    });
  }

  res.json({
    success: true,
    current: currentInstrument,
    running: false,
  });
});

// Get current instrument status
app.get("/api/instruments/status", (req, res) => {
  res.json({
    current: currentInstrument,
    running: csoundProcess && !csoundProcess.killed,
  });
});

// ============================================================================
// Startup
// ============================================================================

function start() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("🧠 NeuroVis EEG Dashboard — Muse + OpenBCI Support");
  console.log("═══════════════════════════════════════════════════════════\n");

  initOSC();
  launchSwiftBridge();

  app.listen(config.webPort, () => {
    console.log(`✓ Web UI: http://localhost:${config.webPort}`);
    console.log(`✓ WebSocket: ws://localhost:${config.wsPort}`);
    console.log(`✓ OSC Target: ${config.oscHost}:${config.oscPort}`);
    console.log(`✓ DSP Pipeline: ACTIVE`);
    console.log(`✓ Simulator Mode: ${settings.simulatorMode ? "ON" : "OFF"}`);
    console.log("\nWaiting for Muse devices or simulator mode...\n");
  });
}

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down...");
  if (swiftProcess) swiftProcess.kill();
  if (csoundProcess) csoundProcess.kill();
  if (oscPort) oscPort.close();
  wss.close();
  process.exit(0);
});

start();
