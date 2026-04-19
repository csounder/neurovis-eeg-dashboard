# NeuroVis Full Integration — Phases 2-5 Implementation Guide

## Phase 2: Per-Channel Baselines (30 min)

### Backend Changes: `server-enhanced.js`

**Location:** Around line 1720 (calibration state)

**Replace:**

```javascript
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
```

**With:**

```javascript
let calibrationState = {
  isCalibrating: false,
  startTime: null,
  duration: 30000, // 30 seconds (like NeurOSC)
  mode: "fixed", // 'fixed' or 'rolling'
  samplesCollected: 0,
  // Per-channel baselines
  baseline: {
    CH1: {
      delta: { mean: 0, m2: 0, n: 0, stddev: 0.001, history: [] },
      theta: { mean: 0, m2: 0, n: 0, stddev: 0.001, history: [] },
      alpha: { mean: 0, m2: 0, n: 0, stddev: 0.001, history: [] },
      beta: { mean: 0, m2: 0, n: 0, stddev: 0.001, history: [] },
      gamma: { mean: 0, m2: 0, n: 0, stddev: 0.001, history: [] },
    },
    CH2: {
      delta: { mean: 0, m2: 0, n: 0, stddev: 0.001, history: [] },
      theta: { mean: 0, m2: 0, n: 0, stddev: 0.001, history: [] },
      alpha: { mean: 0, m2: 0, n: 0, stddev: 0.001, history: [] },
      beta: { mean: 0, m2: 0, n: 0, stddev: 0.001, history: [] },
      gamma: { mean: 0, m2: 0, n: 0, stddev: 0.001, history: [] },
    },
    CH3: {
      delta: { mean: 0, m2: 0, n: 0, stddev: 0.001, history: [] },
      theta: { mean: 0, m2: 0, n: 0, stddev: 0.001, history: [] },
      alpha: { mean: 0, m2: 0, n: 0, stddev: 0.001, history: [] },
      beta: { mean: 0, m2: 0, n: 0, stddev: 0.001, history: [] },
      gamma: { mean: 0, m2: 0, n: 0, stddev: 0.001, history: [] },
    },
    CH4: {
      delta: { mean: 0, m2: 0, n: 0, stddev: 0.001, history: [] },
      theta: { mean: 0, m2: 0, n: 0, stddev: 0.001, history: [] },
      alpha: { mean: 0, m2: 0, n: 0, stddev: 0.001, history: [] },
      beta: { mean: 0, m2: 0, n: 0, stddev: 0.001, history: [] },
      gamma: { mean: 0, m2: 0, n: 0, stddev: 0.001, history: [] },
    },
  },
  // Optional: enable log transform before z-score
  logTransform: false,
};
```

**Update `updateCalibrationBaseline()` function:**

```javascript
function updateCalibrationBaseline(channelBandPowers) {
  if (!calibrationState.isCalibrating) return;

  const elapsed = Date.now() - calibrationState.startTime;
  if (elapsed > calibrationState.duration) {
    calibrationState.isCalibrating = false;
    calculateZScores();
    console.log("✅ Per-channel calibration complete!");
    broadcastCalibrationStatus();
    return;
  }

  // channelBandPowers format:
  // { CH1: {delta: 0.2, theta: 0.3, ...}, CH2: {...}, CH3: {...}, CH4: {...} }
  const channels = ["CH1", "CH2", "CH3", "CH4"];
  const bands = ["delta", "theta", "alpha", "beta", "gamma"];

  for (let channel of channels) {
    if (!channelBandPowers[channel]) continue;

    for (let band of bands) {
      let value = channelBandPowers[channel][band] || 0;

      // Optional: apply log transform
      if (calibrationState.logTransform) {
        value = Math.log10(Math.max(value, 1e-10));
      }

      const acc = calibrationState.baseline[channel][band];

      // Welford's online algorithm for mean and variance
      acc.n++;
      const delta = value - acc.mean;
      acc.mean += delta / acc.n;
      const delta2 = value - acc.mean;
      acc.m2 += delta * delta2;

      // For rolling baseline: keep history (last 300 samples = 30 seconds @ 10 Hz)
      if (calibrationState.mode === "rolling") {
        acc.history.push(value);
        if (acc.history.length > 300) {
          acc.history.shift(); // Remove oldest
        }
      }
    }
  }

  calibrationState.samplesCollected++;
}
```

**Update `calculateZScores()` function:**

```javascript
function calculateZScores() {
  const channels = ["CH1", "CH2", "CH3", "CH4"];
  const bands = ["delta", "theta", "alpha", "beta", "gamma"];

  for (let channel of channels) {
    for (let band of bands) {
      const acc = calibrationState.baseline[channel][band];
      const variance = acc.n > 1 ? acc.m2 / (acc.n - 1) : 0;
      const stddev = Math.sqrt(variance);
      // Store stddev for z-score calculation
      acc.stddev = stddev || 0.001; // Prevent division by zero
    }
  }

  console.log("📊 Per-channel z-scores calculated");
  console.log("  CH1 alpha:", calibrationState.baseline.CH1.alpha);
  console.log("  CH2 alpha:", calibrationState.baseline.CH2.alpha);
  console.log("  CH3 alpha:", calibrationState.baseline.CH3.alpha);
  console.log("  CH4 alpha:", calibrationState.baseline.CH4.alpha);
}
```

**Add z-score normalization function:**

```javascript
function applyZScoreNormalization(channelBandPowers) {
  if (!settings.applyBaseline) return channelBandPowers;

  const channels = ["CH1", "CH2", "CH3", "CH4"];
  const bands = ["delta", "theta", "alpha", "beta", "gamma"];
  const normalized = {};

  for (let channel of channels) {
    normalized[channel] = {};
    if (!channelBandPowers[channel]) continue;

    for (let band of bands) {
      let value = channelBandPowers[channel][band] || 0;

      // Apply log transform if enabled
      if (calibrationState.logTransform) {
        value = Math.log10(Math.max(value, 1e-10));
      }

      const baseline = calibrationState.baseline[channel][band];

      // Only normalize if we have enough samples (at least 10)
      if (baseline.n >= 10) {
        // Z-score: (value - mean) / stddev
        normalized[channel][band] = (value - baseline.mean) / baseline.stddev;
      } else {
        normalized[channel][band] = value;
      }
    }
  }

  return normalized;
}
```

**Add settings flag:**

```javascript
let settings = {
  // ... existing settings ...
  applyBaseline: false, // Master toggle for z-score normalization
  logTransform: false, // Apply log10 before z-score
};
```

**Update `/api/settings` endpoint to handle baseline toggle:**

```javascript
app.post("/api/settings", (req, res) => {
  const { oscPrefix, oscStreams, simulatorMode, applyBaseline, logTransform } =
    req.body;

  if (oscPrefix) {
    settings.oscPrefix = oscPrefix;
    console.log(`📡 OSC prefix changed to: ${oscPrefix}`);
  }

  if (oscStreams) {
    settings.oscStreams = { ...settings.oscStreams, ...oscStreams };
    console.log(`✓ OSC streams updated:`, settings.oscStreams);
  }

  if (applyBaseline !== undefined) {
    settings.applyBaseline = applyBaseline;
    console.log(`📊 Baseline normalization: ${applyBaseline ? "ON" : "OFF"}`);
  }

  if (logTransform !== undefined) {
    calibrationState.logTransform = logTransform;
    console.log(`📈 Log transform: ${logTransform ? "ON" : "OFF"}`);
  }

  // ... rest of existing code ...
});
```

---

## Phase 3: Granular OSC Controls (45 min)

### Backend: Add Granular Settings

**In `settings` object:**

```javascript
let settings = {
  // ... existing settings ...

  // Granular OSC controls (like NeurOSC)
  oscGranular: {
    channels: {
      CH1: true,
      CH2: true,
      CH3: true,
      CH4: true,
    },
    bands: {
      delta: true,
      theta: true,
      alpha: true,
      beta: true,
      gamma: true,
    },
    valueTypes: {
      absolute: true, // Raw µV² power
      relative: true, // 0-1 normalized
      averages: true, // Cross-channel mean/min/max
    },
  },
};
```

### Add `/api/osc/granular` endpoint:

```javascript
app.post("/api/osc/granular", (req, res) => {
  const { channels, bands, valueTypes } = req.body;

  if (channels) {
    settings.oscGranular.channels = {
      ...settings.oscGranular.channels,
      ...channels,
    };
    console.log(`✓ OSC channels updated:`, settings.oscGranular.channels);
  }

  if (bands) {
    settings.oscGranular.bands = { ...settings.oscGranular.bands, ...bands };
    console.log(`✓ OSC bands updated:`, settings.oscGranular.bands);
  }

  if (valueTypes) {
    settings.oscGranular.valueTypes = {
      ...settings.oscGranular.valueTypes,
      ...valueTypes,
    };
    console.log(`✓ OSC value types updated:`, settings.oscGranular.valueTypes);
  }

  res.json({ success: true, config: settings.oscGranular });
});

app.get("/api/osc/granular", (req, res) => {
  res.json(settings.oscGranular);
});
```

### Modify OSC broadcast to respect granular settings:

**Update band power OSC sending (find in server-enhanced.js):**

```javascript
function sendBandPowersOSC(bandPowers) {
  if (
    !settings.oscSending ||
    (!settings.oscStreams.bandAbsolute && !settings.oscStreams.bandRelative)
  ) {
    return;
  }

  if (!oscPort) return;

  const channels = ["CH1", "CH2", "CH3", "CH4"];
  const channelNames = ["TP9", "AF7", "AF8", "TP10"]; // or use from device config
  const bands = ["delta", "theta", "alpha", "beta", "gamma"];

  // Per-channel, per-band messages
  for (let i = 0; i < channels.length; i++) {
    const ch = channels[i];
    const chName = channelNames[i] || ch;

    // Skip if channel disabled
    if (!settings.oscGranular.channels[ch]) continue;

    for (let band of bands) {
      // Skip if band disabled
      if (!settings.oscGranular.bands[band]) continue;

      const value = bandPowers[ch]?.[band] || 0;

      // Absolute values
      if (
        settings.oscGranular.valueTypes.absolute &&
        settings.oscStreams.bandAbsolute
      ) {
        oscPort.send({
          address: `${settings.oscPrefix}/bands/${chName}/${band}`,
          args: [{ type: "f", value: value }],
        });
      }

      // Relative values (normalized 0-1)
      if (
        settings.oscGranular.valueTypes.relative &&
        settings.oscStreams.bandRelative
      ) {
        // Normalize using fixed ranges (from NeurOSC)
        const ranges = {
          delta: [0.5, 100.0],
          theta: [0.5, 50.0],
          alpha: [1.0, 100.0],
          beta: [0.5, 30.0],
          gamma: [0.5, 20.0],
        };
        const [min, max] = ranges[band];
        const normalized = Math.max(
          0,
          Math.min(1, (value - min) / (max - min)),
        );

        oscPort.send({
          address: `${settings.oscPrefix}/bands/${chName}/${band}-relative`,
          args: [{ type: "f", value: normalized }],
        });
      }
    }
  }

  // Averages (cross-channel)
  if (settings.oscGranular.valueTypes.averages) {
    for (let band of bands) {
      if (!settings.oscGranular.bands[band]) continue;

      // Collect enabled channel values
      const values = channels
        .filter((ch) => settings.oscGranular.channels[ch])
        .map((ch) => bandPowers[ch]?.[band] || 0);

      if (values.length === 0) continue;

      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const max = Math.max(...values);
      const min = Math.min(...values);

      oscPort.send({
        address: `${settings.oscPrefix}/bands/${band}`,
        args: [{ type: "f", value: mean }],
      });

      oscPort.send({
        address: `${settings.oscPrefix}/bands/${band}/max`,
        args: [{ type: "f", value: max }],
      });

      oscPort.send({
        address: `${settings.oscPrefix}/bands/${band}/min`,
        args: [{ type: "f", value: min }],
      });
    }

    // Muse-style combined messages (arrays)
    for (let band of bands) {
      if (!settings.oscGranular.bands[band]) continue;

      const absoluteValues = channels
        .filter((ch) => settings.oscGranular.channels[ch])
        .map((ch) => ({ type: "f", value: bandPowers[ch]?.[band] || 0 }));

      oscPort.send({
        address: `${settings.oscPrefix}/elements/${band}_absolute`,
        args: absoluteValues,
      });

      // Relative values (normalized)
      const ranges = {
        delta: [0.5, 100.0],
        theta: [0.5, 50.0],
        alpha: [1.0, 100.0],
        beta: [0.5, 30.0],
        gamma: [0.5, 20.0],
      };
      const [minVal, maxVal] = ranges[band];

      const relativeValues = channels
        .filter((ch) => settings.oscGranular.channels[ch])
        .map((ch) => {
          const value = bandPowers[ch]?.[band] || 0;
          const normalized = Math.max(
            0,
            Math.min(1, (value - minVal) / (maxVal - minVal)),
          );
          return { type: "f", value: normalized };
        });

      oscPort.send({
        address: `${settings.oscPrefix}/elements/${band}_relative`,
        args: relativeValues,
      });
    }
  }
}
```

---

## Phase 4: DSP Controls (30 min)

### Add DSP configuration endpoint:

```javascript
app.post("/api/dsp/config", (req, res) => {
  const { applyCAR, applyBandpass, applyNotch, applyArtifact, smoothingAlpha } =
    req.body;

  if (applyCAR !== undefined) {
    dsp.config.applyCAR = applyCAR;
    console.log(`✓ CAR (Common Average Reference): ${applyCAR ? "ON" : "OFF"}`);
  }

  if (applyBandpass !== undefined) {
    dsp.config.applyBandpass = applyBandpass;
    console.log(`✓ Bandpass filter (1-45 Hz): ${applyBandpass ? "ON" : "OFF"}`);
  }

  if (applyNotch !== undefined) {
    dsp.config.applyNotch = applyNotch;
    console.log(`✓ Notch filter (60 Hz): ${applyNotch ? "ON" : "OFF"}`);
  }

  if (applyArtifact !== undefined) {
    dsp.config.applyArtifact = applyArtifact;
    console.log(`✓ Artifact detection: ${applyArtifact ? "ON" : "OFF"}`);
  }

  if (smoothingAlpha !== undefined) {
    dsp.config.smoothingAlpha = Math.max(0.05, Math.min(1.0, smoothingAlpha));
    console.log(`✓ Smoothing alpha: ${dsp.config.smoothingAlpha.toFixed(2)}`);
  }

  res.json({ success: true, config: dsp.config });
});

app.get("/api/dsp/config", (req, res) => {
  res.json(
    dsp.config || {
      applyCAR: true,
      applyBandpass: true,
      applyNotch: true,
      applyArtifact: true,
      smoothingAlpha: 0.3,
    },
  );
});
```

---

## Phase 5: Display Enhancements (60 min)

### Add Display Modes (like NeurOSC tabs)

The current NeuroVis already has good displays, but we need to add:

1. Auto-scale toggle
2. Manual Y-axis range slider
3. Mode tabs (Traces / FFT / Bands)

Since the UI is React-based, I'll provide the conceptual changes.

**What to add in the React UI (index.html):**

1. **Mode tabs** - Already exists in ConnectView but needs to be global
2. **Auto-scale toggle** - Add to chart controls
3. **Y-axis range slider** - Add to chart controls
4. **Log-scale toggle for band chart** - Prevent alpha dominance

**Conceptual UI structure:**

```javascript
// Add mode state
const [displayMode, setDisplayMode] = useState("timeseries"); // 'timeseries', 'fft', 'bands'
const [autoScale, setAutoScale] = useState(true);
const [yAxisRange, setYAxisRange] = useState(100); // µV

// Mode tabs
h(
  "div",
  { className: "mode-tabs" },
  h(
    "button",
    {
      className: displayMode === "timeseries" ? "active" : "",
      onClick: () => setDisplayMode("timeseries"),
    },
    "Traces",
  ),
  h(
    "button",
    {
      className: displayMode === "fft" ? "active" : "",
      onClick: () => setDisplayMode("fft"),
    },
    "FFT",
  ),
  h(
    "button",
    {
      className: displayMode === "bands" ? "active" : "",
      onClick: () => setDisplayMode("bands"),
    },
    "Bands",
  ),
);

// Auto-scale toggle + manual range
h(
  "div",
  { className: "scale-controls" },
  h(
    "label",
    {},
    h("input", {
      type: "checkbox",
      checked: autoScale,
      onChange: (e) => setAutoScale(e.target.checked),
    }),
    "Auto",
  ),
  !autoScale &&
    h("input", {
      type: "range",
      min: 10,
      max: 200,
      value: yAxisRange,
      onChange: (e) => setYAxisRange(Number(e.target.value)),
    }),
  !autoScale && h("span", {}, `±${yAxisRange} µV`),
);
```

---

## Implementation Sequence

### Step 1: Per-Channel Baselines

1. Update calibration state structure
2. Update `updateCalibrationBaseline()`
3. Update `calculateZScores()`
4. Add `applyZScoreNormalization()`
5. Update `/api/settings` endpoint
6. Test: Start calibration, verify per-channel baselines accumulate

### Step 2: Granular OSC

1. Add `oscGranular` to settings
2. Add `/api/osc/granular` endpoints
3. Update OSC broadcast function
4. Test: Toggle channels/bands, verify OSC messages filtered

### Step 3: DSP Controls

1. Add `/api/dsp/config` endpoints
2. Update DSP pipeline to respect runtime config
3. Test: Toggle filters, verify signal changes

### Step 4: Display Enhancements

1. Add mode tabs to UI
2. Add auto-scale + manual range controls
3. Add log-scale option for band chart
4. Test: Switch modes, adjust scale, verify rendering

---

## Testing Commands

```bash
# Start server
cd /Users/richardboulanger/dB-Studio/NeuroVis
node server-enhanced.js

# Test granular OSC config
curl -X POST http://localhost:3000/api/osc/granular \
  -H "Content-Type: application/json" \
  -d '{"channels":{"CH1":true,"CH2":false,"CH3":false,"CH4":true}}'

# Test DSP config
curl -X POST http://localhost:3000/api/dsp/config \
  -H "Content-Type: application/json" \
  -d '{"applyNotch":false,"smoothingAlpha":0.5}'

# Test baseline settings
curl -X POST http://localhost:3000/api/settings \
  -H "Content-Type: application/json" \
  -d '{"applyBaseline":true,"logTransform":false}'
```

---

This is the complete implementation guide for all remaining phases!
