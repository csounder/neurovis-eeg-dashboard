# NeuroOSC Display Integration Plan

## Current NeuroVis Display Options (Line 4330-4345)

1. Power+Timeline (timeline)
2. Topo Map (topo)
3. 3D Waterfall (waterfall)
4. Full Brain (fullbrain)
5. Phase (phase)
6. Coherence (coherence)
7. Sensor Connect (connect)
8. Neuro Indices (neuro)
9. FFT + Power Bands (fft) - **Combined view**
10. OSC Monitor (oscmon)
11. fNIRS (conditional - Athena only)
12. PPG/HR (conditional - Muse S/Athena)
13. IMU (conditional - all Muse)

## New Requested Order + NeurOSC Additions

1. **Power + Timeline** (existing `timeline`) ✅
2. **FFT + Bands** (existing `fft`) ✅ - Keep combined view
3. **3D Waterfall** (existing `waterfall`) ✅
4. **Traces** (NEW from NeurOSC) - Raw EEG waveforms ⭐
5. **FFT Spectrum** (NEW from NeurOSC) - Frequency spectrum only ⭐
6. **Band Powers** (NEW from NeurOSC) - Band power bars only ⭐
7. **Mental State** (NEW from NeurOSC) - Engagement/Focus/Meditation ⭐
8. **Neuro Indices** (existing `neuro`) ✅
9. **Phase** (existing `phase`) ✅
10. **Coherence** (existing `coherence`) ✅
11. **PPG/HR-Muse** (existing `ppg`) ✅
12. **IMU-Muse** (existing `imu`) ✅
13. **fNIRS-Athena** (existing `fnirs`) ✅
14. **Sensor Connect** (existing `connect`) ✅
15. **Processing** (NEW or rename existing?) - DSP settings panel?
16. **Presets** (NEW) - Save/load configurations
17. **OSC Settings** (existing - in sidebar) ✅
18. **OSC Monitor** (existing `oscmon`) ✅
19. **Recording** (existing - in sidebar) ✅

## NeurOSC Display Modes to Add

### 1. Traces View (Timeseries)

**What it shows**: Raw EEG waveforms for all channels
**Implementation**:

```javascript
function TracesView(p) {
  // Uses Chart.js line chart
  // Shows 4-second window of raw EEG samples
  // Downsamples to max 512 points for performance
  // Each channel is a different color
  // Auto-scaling or fixed range
}
```

**Data source**: Poll `/api/bands` endpoint and extract raw timeseries data

### 2. FFT Spectrum View

**What it shows**: Frequency spectrum (0.5-40Hz) for all channels
**Implementation**:

```javascript
function FFTSpectrumView(p) {
  // Uses Chart.js line chart
  // X-axis: Frequency (Hz)
  // Y-axis: Power (dB)
  // Shows spectral peaks for each brain wave band
  // Each channel is a different color
}
```

**Data source**: Poll `/api/fft` endpoint (need to add this to server)

### 3. Band Powers View

**What it shows**: Bar chart of Delta/Theta/Alpha/Beta/Gamma for each channel
**Implementation**:

```javascript
function BandPowersView(p) {
  // Uses Chart.js horizontal bar chart
  // Grouped bars: one group per channel
  // Color-coded by band (delta=purple, theta=blue, alpha=green, beta=yellow, gamma=red)
  // Shows relative power (%)
}
```

**Data source**: Poll `/api/bands` endpoint (already exists)

### 4. Mental State View

**What it shows**: Engagement, Meditation, Focus metrics
**Implementation**:

```javascript
function MentalStateView(p) {
  // Engagement Index: Beta / (Alpha + Theta)
  // Meditation Score: (Alpha + Theta) levels
  // Focus Score: Beta levels
  // State classification: Calm, Meditative, Focused, Drowsy
  // Visual elements:
  // - Large number display for primary metric
  // - Color-coded bars (green=good, yellow=moderate, red=low)
  // - State label with icon
  // - Per-channel breakdown
}
```

**Data source**: Calculate from `/api/bands` data

**Calculations** (from NeurOSC):

```javascript
// Engagement Index
const engagement = beta / (alpha + theta + 0.001);
const engagementNorm = Math.max(0, Math.min(5, engagement));

// Meditation Score
const meditation = (alpha + theta) / totalPower;

// Focus Score
const focus = beta / totalPower;

// State Classification
if (delta > 0.4) return "Drowsy";
if (alpha > 0.35 && beta < 0.25) return "Meditative";
if (beta > 0.3) return "Focused";
return "Calm";
```

## UI Structure Changes

### Current Structure

- Sidebar with controls
- Main panel(s) - single or quad view
- Panels selected from `displayOpts` array

### New Structure

**Top Toolbar** (NEW):

```html
<div class="view-toolbar">
  <button class="view-btn active" data-view="timeline">Power+Timeline</button>
  <button class="view-btn" data-view="fft">FFT+Bands</button>
  <button class="view-btn" data-view="waterfall">3D Waterfall</button>
  <button class="view-btn" data-view="traces">Traces</button>
  <!-- ... all 19 buttons ... -->
  <div class="view-dropdown">
    <button class="dropdown-toggle">More ▾</button>
    <div class="dropdown-menu">
      <!-- All views as dropdown items -->
    </div>
  </div>
</div>
```

**Both buttons AND dropdown**:

- First ~10 most common views as buttons
- Overflow menu with ALL views
- Dropdown also available in quad view panel selectors

### Quad View Integration

Update quad view panel selectors to include all 19 views:

```javascript
// Each of 4 panels gets full dropdown
var displayOpts = [
  { id: "timeline", l: "1. Power+Timeline" },
  { id: "fft", l: "2. FFT+Bands" },
  { id: "waterfall", l: "3. 3D Waterfall" },
  { id: "traces", l: "4. Traces (NeurOSC)" },
  { id: "spectrum", l: "5. FFT Spectrum (NeurOSC)" },
  { id: "bands", l: "6. Band Powers (NeurOSC)" },
  { id: "mentalstate", l: "7. Mental State (NEW)" },
  { id: "neuro", l: "8. Neuro Indices" },
  // ... all 19 options
];
```

## Server Endpoints Needed

### Already Exists

✅ `/api/bands` - Returns band powers for all channels

### Need to Add

❌ `/api/timeseries` - Returns raw EEG samples
❌ `/api/fft` - Returns FFT spectrum data

**Proposed `/api/timeseries` response**:

```json
{
  "channels": ["TP9", "AF7", "AF8", "TP10"],
  "timestamps": [0.0, 0.004, 0.008, ...],  // 4-second window
  "samples": [
    [12.3, 15.1, ...],  // TP9 samples
    [8.4, 11.2, ...],   // AF7 samples
    [9.1, 10.5, ...],   // AF8 samples
    [13.2, 14.8, ...]   // TP10 samples
  ],
  "sampleRate": 256
}
```

**Proposed `/api/fft` response**:

```json
{
  "channels": ["TP9", "AF7", "AF8", "TP10"],
  "frequencies": [0.5, 1.0, 1.5, ..., 40.0],
  "power": [
    [2.3, 3.1, ...],  // TP9 power spectrum (dB)
    [1.8, 2.9, ...],  // AF7 power spectrum
    [2.1, 3.2, ...],  // AF8 power spectrum
    [2.5, 3.4, ...]   // TP10 power spectrum
  ]
}
```

## Implementation Steps

### Phase 1: Server Endpoints (30 min)

1. Add `/api/timeseries` endpoint
2. Add `/api/fft` endpoint
3. Test with curl

### Phase 2: New View Components (3 hours)

1. Create `TracesView` component (1 hour)
2. Create `FFTSpectrumView` component (1 hour)
3. Create `BandPowersView` component (30 min)
4. Create `MentalStateView` component (30 min)

### Phase 3: Reorder Display Options (30 min)

1. Update `displayOpts` array with new order
2. Add new view IDs
3. Test quad view selection

### Phase 4: Add Toolbar + Dropdown (1 hour)

1. Add CSS for view toolbar
2. Add button elements
3. Add dropdown menu
4. Wire up click handlers
5. Sync with quad view state

### Phase 5: Testing (30 min)

1. Test all views with simulator
2. Test toolbar navigation
3. Test quad view with all combinations
4. Test dropdown menu

**Total Time: ~6 hours**

## Styling Reference from NeurOSC

```css
.mode-tabs {
  display: inline-flex;
  background: var(--bg-card);
  border-radius: var(--radius-full);
  padding: 3px;
  gap: 3px;
}

.mode-tab {
  padding: 6px 16px;
  border-radius: var(--radius-full);
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.mode-tab:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.mode-tab.active {
  background: var(--accent);
  color: var(--bg-primary);
  box-shadow: 0 0 14px var(--accent-glow);
}
```

## Next Actions

1. ✅ Document plan (this file)
2. ⏳ Add `/api/timeseries` and `/api/fft` endpoints to server
3. ⏳ Create new view components
4. ⏳ Reorganize displayOpts array
5. ⏳ Add toolbar UI
6. ⏳ Test everything
