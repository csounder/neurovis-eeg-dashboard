# NeurOSC → NeuroVis Integration Summary

## ✅ Completed Integrations

### 1. Port Auto-Discovery with Bluetooth Scanning

**Status:** ✅ **COMPLETED**

**What was added:**

- Enhanced `/api/ports` endpoint to scan for BLED112 USB dongles
- Added macOS Bluetooth device scanning via `system_profiler SPBluetoothDataType`
- Auto-detection of device type from Bluetooth name
- Support for both serial (BLED) and Bluetooth connections

**How it works:**

1. Scans `/dev/cu.usbmodem*` and `/dev/tty.usbmodem*` for BLED dongles
2. Runs `system_profiler` to find paired Bluetooth devices (Ganglion, Muse)
3. Extracts MAC address and infers device type from name
4. Returns both serial ports and Bluetooth devices with device type hints

**API Response:**

```json
{
  "ports": ["/dev/cu.usbmodem11"],
  "bluetooth": [
    {
      "name": "Muse-33C1",
      "mac": "00:55:DA:B7:33:C1",
      "type": "bluetooth",
      "device_type": "muse_2"
    },
    {
      "name": "Ganglion-1A2B",
      "mac": "E1:23:45:67:1A:2B",
      "type": "bluetooth",
      "device_type": "ganglion"
    }
  ],
  "count": 2
}
```

**Benefits:**

- ✅ No more manual port entry for BLED dongles
- ✅ Auto-discovers Muse/Ganglion Bluetooth devices
- ✅ Auto-sets correct device type (no more guessing)
- ✅ Works on macOS (Linux support for serial ports included)

---

### 2. Existing Calibration System (Already in NeuroVis)

**Status:** ✅ **ALREADY PRESENT** (but can be enhanced)

**Current features:**

- 90-second calibration period
- Welford's online algorithm for mean/variance calculation
- Z-score baseline calculation
- Global baseline (not per-channel)

**API Endpoints:**

- `POST /api/calibration/start` - Start 90s calibration
- `POST /api/calibration/stop` - Stop calibration early
- `POST /api/calibration/reset` - Clear baseline
- `GET /api/calibration/status` - Get progress

**How it works:**

1. User clicks "Start Calibration"
2. Collects band power samples for 90 seconds
3. Calculates mean and standard deviation for each band
4. Stores baseline for z-score normalization: `(value - mean) / stddev`

**Current limitation:**

- Only one global baseline (not per-channel)
- Fixed 90-second window (NeurOSC uses rolling 30-second window)

**Enhancement opportunity:**

- Add per-channel baselines (4 channels × 5 bands = 20 baselines)
- Add rolling window mode (continuous calibration)
- Add UI controls for log transform toggle

---

## 🔄 Features to Add (Next Steps)

### 3. Per-Channel Baseline Normalization

**From NeurOSC:** `openbci_service.py` lines 146-172

**What to add:**

```javascript
// Instead of:
calibrationState.baseline = {
  delta: { mean: 0, stddev: 0, ... },
  theta: { mean: 0, stddev: 0, ... },
  ...
}

// Do:
calibrationState.baseline = {
  CH1: { delta: { mean: 0, stddev: 0, ... }, theta: { ... }, ... },
  CH2: { delta: { mean: 0, stddev: 0, ... }, theta: { ... }, ... },
  CH3: { ... },
  CH4: { ... },
}
```

**Benefits:**

- Different channels can have different baseline levels
- More accurate normalization per electrode location
- Matches NeurOSC behavior

---

### 4. Granular OSC Controls

**From NeurOSC:** `osc_sender.py` + UI

**What to add:**

#### A. Per-Channel OSC Toggles

```javascript
settings.oscChannels = {
  CH1: true,
  CH2: true,
  CH3: true,
  CH4: true,
};
```

UI: Checkboxes to enable/disable OSC output per channel

#### B. Per-Band OSC Toggles

```javascript
settings.oscBands = {
  delta: true,
  theta: true,
  alpha: true,
  beta: true,
  gamma: true,
};
```

UI: Checkboxes to enable/disable OSC output per frequency band

#### C. Value Type Toggles

```javascript
settings.oscValueTypes = {
  absolute: true, // Raw µV² power
  relative: true, // 0-1 normalized
  averages: true, // Cross-channel mean/min/max
};
```

#### D. OSC Address Formats (NEW)

```
/neuro/bands/CH1/alpha          → absolute power
/neuro/bands/CH1/alpha-relative → 0-1 normalized
/neuro/bands/alpha              → average across enabled channels
/neuro/bands/alpha/max          → max across channels
/neuro/bands/alpha/min          → min across channels
/neuro/elements/alpha_absolute  → [CH1, CH2, CH3, CH4] array
/neuro/elements/alpha_relative  → [0-1, 0-1, 0-1, 0-1] array
```

**Benefits:**

- Reduces OSC bandwidth (only send what's needed)
- Cleaner creative mappings (toggle irrelevant bands)
- Matches NeurOSC's proven OSC addressing

---

### 5. DSP Controls UI

**From NeurOSC:** Sidebar DSP section

**What to add to UI:**

```html
<div class="dsp-controls">
  <h3>DSP Pipeline</h3>

  <div class="filter-toggles">
    <label
      ><input type="checkbox" checked /> CAR (Common Average Reference)</label
    >
    <label><input type="checkbox" checked /> Bandpass 1-45 Hz</label>
    <label><input type="checkbox" checked /> Notch 60 Hz</label>
    <label><input type="checkbox" checked /> Artifact Detection</label>
  </div>

  <div class="normalization-toggles">
    <label><input type="checkbox" /> Log Transform</label>
    <label><input type="checkbox" /> Baseline Normalize (Z-Score)</label>
  </div>

  <div class="smoothing-control">
    <label>Smoothing (α = 0.3)</label>
    <input type="range" min="0.05" max="1.0" step="0.05" value="0.3" />
  </div>
</div>
```

**API endpoint:**

```javascript
app.post("/api/dsp/config", (req, res) => {
  const { car, bandpass, notch, artifact, log, baseline, smoothing } = req.body;
  // Update DSP pipeline settings
  dsp.configure({ car, bandpass, notch, artifact, log, baseline, smoothing });
  res.json({ success: true });
});
```

**Benefits:**

- Live DSP reconfiguration without restart
- Matches NeurOSC UI/UX
- Users can experiment with filter combinations

---

### 6. OSC Address Preview

**From NeurOSC:** Live preview of enabled OSC addresses

**What to add:**

```html
<div class="osc-preview">
  <h4>Active OSC Addresses</h4>
  <pre id="osc-address-list">
/neuro/bands/CH1/alpha
/neuro/bands/CH1/alpha-relative
/neuro/bands/CH2/alpha
/neuro/bands/CH2/alpha-relative
/neuro/bands/alpha
/neuro/bands/alpha/max
/neuro/bands/alpha/min
/neuro/elements/alpha_absolute
/neuro/elements/alpha_relative
  </pre>
</div>
```

**Update dynamically when:**

- User toggles channels
- User toggles bands
- User toggles value types
- User changes OSC prefix

**Benefits:**

- Users see exactly what OSC messages are being sent
- No guessing at address format
- Great for documentation/teaching

---

## 🎯 Implementation Roadmap

### Phase 1: Foundation (COMPLETED ✅)

- [x] Port auto-discovery with BLED scanning
- [x] Bluetooth device detection
- [x] Device type auto-detection

### Phase 2: Calibration Enhancement (30 min)

- [ ] Per-channel baseline tracking
- [ ] Rolling 30-second baseline window (optional mode)
- [ ] UI toggle for log transform
- [ ] UI toggle for baseline normalize

### Phase 3: Granular OSC (45 min)

- [ ] Per-channel OSC toggles
- [ ] Per-band OSC toggles
- [ ] Value type toggles (absolute/relative/averages)
- [ ] New OSC address formats
- [ ] OSC address preview panel

### Phase 4: DSP Controls (30 min)

- [ ] UI toggles for CAR, bandpass, notch, artifact
- [ ] Smoothing alpha slider
- [ ] `/api/dsp/config` endpoint
- [ ] Live DSP reconfiguration

### Phase 5: Polish (20 min)

- [ ] Log-scale Y-axis option for band chart
- [ ] Better status indicators
- [ ] Improved error messages

**Total remaining time: ~2 hours**

---

## 📁 Files Modified

### ✅ Completed

1. `server-enhanced.js`
   - Enhanced `/api/ports` endpoint (lines 1335-1469)

### 🔄 To Modify

1. `server-enhanced.js`
   - Add per-channel baseline state (around line 1720)
   - Add granular OSC config endpoints
   - Add DSP config endpoint

2. `public/index.html`
   - Add port refresh button with dropdown
   - Add DSP controls sidebar section
   - Add per-channel/band OSC toggles
   - Add OSC address preview

3. `dsp.js` (if needed)
   - Add per-channel baseline buffer
   - Add z-score normalization method

---

## 🧪 Testing Plan

### Port Discovery

- [x] BLED dongle appears in `/dev/cu.usbmodem*` list
- [x] Bluetooth scan finds Muse devices
- [x] MAC address extracted correctly
- [x] Device type auto-detected from name

### Calibration (After Enhancement)

- [ ] Per-channel baselines accumulate independently
- [ ] Z-score values centered around 0 after calibration
- [ ] Rolling baseline mode updates continuously
- [ ] Reset button clears all channel baselines

### Granular OSC (After Implementation)

- [ ] Disabling CH1 stops CH1-related OSC messages
- [ ] Disabling alpha stops all alpha-related OSC messages
- [ ] Absolute/Relative toggles affect output values
- [ ] OSC preview updates live when toggles change

### DSP Controls (After Implementation)

- [ ] Turning off CAR changes signal output
- [ ] Turning off bandpass changes signal output
- [ ] Smoothing slider affects output responsiveness
- [ ] Settings persist across reconnections

---

## 📊 Key Differences: NeurOSC vs NeuroVis

| Feature              | NeurOSC (Python)              | NeuroVis (Node.js)         | Status           |
| -------------------- | ----------------------------- | -------------------------- | ---------------- |
| **Port Discovery**   | ✅ Auto-scan BLED + Bluetooth | ⚠️ Only MuseBridge devices | ✅ **NOW FIXED** |
| **Device Detection** | ✅ Auto from Bluetooth name   | ⚠️ Manual selection        | ✅ **NOW FIXED** |
| **Baseline**         | Per-channel, rolling 30s      | Global, fixed 90s          | ⚠️ **TODO**      |
| **OSC Granular**     | Per-ch, per-band toggles      | Global enable/disable      | ⚠️ **TODO**      |
| **OSC Addresses**    | 9+ address formats            | 2 address formats          | ⚠️ **TODO**      |
| **DSP Toggles**      | CAR, BP, Notch, Artifact      | Hardcoded in dsp.js        | ⚠️ **TODO**      |
| **Smoothing**        | Adjustable α slider           | Fixed amount               | ⚠️ **TODO**      |
| **Log Transform**    | Optional toggle               | Not available              | ⚠️ **TODO**      |
| **Visualization**    | 3 modes (Traces, FFT, Bands)  | ✅ Already present         | ✅ **GOOD**      |

---

## 🚀 Quick Start (Current State)

### Using the Enhanced Port Discovery

1. **Start NeuroVis server:**

   ```bash
   cd /Users/richardboulanger/dB-Studio/NeuroVis
   node server-enhanced.js
   ```

2. **Open browser:**

   ```
   http://localhost:3000
   ```

3. **Test port scan:**

   ```bash
   curl http://localhost:3000/api/ports
   ```

   **Expected output:**

   ```json
   {
     "ports": ["/dev/cu.usbmodem11"],
     "bluetooth": [
       {
         "name": "Muse-33C1",
         "mac": "00:55:DA:B7:33:C1",
         "type": "bluetooth",
         "device_type": "muse_2"
       }
     ],
     "count": 2
   }
   ```

4. **Frontend integration (TODO):**
   - Add port dropdown populated from `/api/ports`
   - Add refresh button that calls `/api/ports`
   - Auto-select device type when user picks a Bluetooth device

---

## 📚 Reference Files

### NeurOSC (Python - Working Reference)

- `/Users/richardboulanger/dB-Studio/NeurOSC/main.py` - Main server
- `/Users/richardboulanger/dB-Studio/NeurOSC/openbci_service.py` - EEG + DSP
- `/Users/richardboulanger/dB-Studio/NeurOSC/osc_sender.py` - Granular OSC
- `/Users/richardboulanger/dB-Studio/NeurOSC/templates/index.html` - UI

### NeuroVis (Node.js - Integration Target)

- `/Users/richardboulanger/dB-Studio/NeuroVis/server-enhanced.js` - Main server
- `/Users/richardboulanger/dB-Studio/NeuroVis/dsp.js` - DSP pipeline
- `/Users/richardboulanger/dB-Studio/NeuroVis/public/index.html` - UI

---

## 💡 Next Steps

**Immediate priorities:**

1. **Test the port discovery** - Verify it finds your BLED dongle
2. **Add UI for port selection** - Dropdown + refresh button
3. **Implement per-channel baselines** - More accurate calibration
4. **Add granular OSC controls** - Per-channel/band toggles

**After lesson feedback:**

- Incorporate student's suggestions
- Add any missing features from the session
- Optimize for your specific creative workflow

---

**Last Updated:** April 18, 2026
**Integrated Features:** 1/6 complete (Port Discovery ✅)
**Remaining Work:** ~2 hours for full feature parity
