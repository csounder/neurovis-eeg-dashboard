# Complete TODO List & Data Integrity Issues

## 🚨 CRITICAL DATA INTEGRITY ISSUES

### 1. **FAKE FFT DATA** - Line 2150 (server-enhanced.js)
```javascript
// TODO: Use actual FFT from DSP pipeline
// For now, return placeholder data based on current band powers
```

**Location**: `server-enhanced.js:2127-2191` (`/api/fft` endpoint)

**Problem**: 
- Generates synthetic spectrum using sine waves
- Not real frequency analysis
- Scientific research invalid

**Status**: ❌ MUST FIX - Critical for research integrity

**Action**: 
- ✅ Documented in CRITICAL_DATA_INTEGRITY.md
- [ ] Implement real FFT using fft.js library
- [ ] OR disable FFT Spectrum view until fixed

---

### 2. **Simulator Data - ACCEPTABLE** (Line 537)
```javascript
// Generate fake band powers that vary over time
```

**Location**: `server-enhanced.js:532-558` (`generateSimulatorBandPowers()`)

**Problem**: None - This is for simulator mode only

**Status**: ✅ OK - Simulator is explicitly allowed to generate test data

**Note**: User confirmed "Simulator can use simulated data" - this is fine

---

## 📋 OTHER TODOs (Non-Critical)

### 3. **Z-Score Baseline Calculation** - Line 2954 (public/app.js)
```javascript
// TODO: Calculate z-scores using calibration baseline
```

**Location**: `public/app.js:2954`

**Context**: Baseline normalization feature

**Status**: ⚠️ TODO - Feature incomplete

**Impact**: Medium - Affects data normalization quality

**Action**: 
- [ ] Implement proper z-score calculation
- [ ] Use rolling baseline window (30-60s)
- [ ] Match NeurOSC implementation

---

### 4. **Smoothing Parameter from Backend** - Line 5780 (index.html)
```javascript
smoothing: 10, // TODO: get from backend
```

**Location**: `public/index.html:5780`

**Context**: Preset system hardcodes smoothing value

**Status**: ⚠️ TODO - Should fetch from backend settings

**Impact**: Low - Presets work but don't sync with backend

**Action**:
- [ ] Add smoothing to preset schema
- [ ] Fetch from `/api/settings` endpoint
- [ ] Update preset save/load logic

---

### 5. **Per-Channel fNIRS Support** - Line 1418 (server-enhanced.js)
```javascript
// Treat as single "channel" for now (TODO: support per-channel when available)
```

**Location**: `server-enhanced.js:1418`

**Context**: fNIRS data handling

**Status**: ⚠️ TODO - Muse S Athena supports 4 fNIRS channels

**Impact**: Low - Current single-channel works for most use cases

**Action**:
- [ ] Parse per-channel fNIRS data from Muse S Athena
- [ ] Display all 4 channels separately
- [ ] Add channel selection UI

---

## 🔬 DATA INTEGRITY AUDIT RESULTS

### ✅ REAL DATA (Verified Safe):
1. **Raw EEG** (`generateSimulatorData()`) - Real sinusoidal synthesis
2. **Band Powers** (DSP filters) - Real Butterworth filtering
3. **All Bands Timeline** - Real filter bank output
4. **Traces View** - Raw voltage samples
5. **Band Powers View** - Real filtered data
6. **Motion Data** (simulator) - Realistic physics simulation
7. **PPG/Heart Rate** - Realistic PQRST complex generation

### ❌ FAKE DATA (Must Fix or Remove):
1. **FFT Spectrum** (`/api/fft`) - Synthetic sine wave approximation
2. **DSP.fft array** - Not real FFT, just placeholder

### ⚠️ INCOMPLETE FEATURES:
1. Z-score baseline normalization
2. Per-channel fNIRS
3. Backend-synced preset smoothing

---

## 📊 PRIORITY RANKING

| Priority | Issue | Status | Timeline |
|----------|-------|--------|----------|
| **P0** | Remove fake FFT data | ❌ Critical | Immediate |
| **P1** | Implement real FFT | 🔄 Required | Next sprint |
| **P2** | Z-score baseline | ⚠️ Nice to have | Future |
| **P3** | Per-channel fNIRS | ⚠️ Optional | Future |
| **P4** | Preset smoothing sync | ⚠️ Minor | Future |

---

## 🎯 RECOMMENDED IMMEDIATE ACTIONS

### Step 1: Disable Fake FFT (Today)
```javascript
// In index.html, comment out FFT Spectrum view option
// { id: "spectrum", l: "FFT Spectrum", i: "📊" },  // DISABLED - Needs real FFT
```

### Step 2: Add Warning Message
Add to FFT Spectrum view:
```
⚠️ FFT Spectrum requires real FFT implementation
Currently disabled for data integrity
Use "Band Powers" view for frequency analysis
```

### Step 3: Implement Real FFT (Next Session)
Options:
1. **fft.js library** (Recommended - fast, well-tested)
2. **Web Audio API** (AnalyserNode - built-in but limited)
3. **Port NeurOSC Python** (Most accurate, requires backend)

---

## 🔗 RELATED DOCUMENTS

- `CRITICAL_DATA_INTEGRITY.md` - Detailed FFT issue analysis
- `SESSION_SUMMARY.md` - Recent improvements log
- `VOLTAGE_SCALING_TEST.md` - Device scaling documentation

---

## 📝 NOTES

**From User Requirements:**
> "We can use simulated data in the Simulator, but there can be no FAKE data 
> in this scientific/research interface. We need to be able to read in brainwave 
> data files from the web and visualize them and then via OSC, sonify them."

**Key Points:**
1. ✅ Simulator mode can generate test data (explicitly allowed)
2. ❌ Research/analysis views MUST use real algorithms (FFT violated this)
3. 🔄 Need data file import/playback feature (new requirement)
4. 🔄 Need OSC output during playback (new requirement)

---

**Last Updated**: 2026-04-18 23:15:00
**Status**: 1 Critical issue identified, action plan documented
