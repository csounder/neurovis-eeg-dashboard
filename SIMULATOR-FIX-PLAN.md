# Simulator Fix Plan - NeuroVis

## Problem Analysis

The simulator in NeuroVis is generating data on the server (confirmed: 17,000+ packets sent, bandPowers/motionData messages flowing via WebSocket), but the React UI doesn't display it.

## Root Cause

After investigating NeurOSC's working implementation, I found the key difference:

### NeurOSC Approach (Working)

1. **Raw EEG Generation**: Generates realistic raw EEG samples using sine waves at different frequencies (delta, theta, alpha, beta, gamma)
2. **Buffer-Based**: Stores raw samples in a deque buffer
3. **On-Demand Processing**: Computes band powers from buffered samples using FFT when requested
4. **Polling Architecture**: UI polls `/api/bands` endpoint which reads from buffer
5. **Data Flow**: Raw samples → Buffer → FFT → Band Powers → UI

### NeuroVis Current Approach (Broken)

1. **Direct Generation**: Generates band powers directly using random values
2. **No Buffer**: No persistent buffer of raw EEG samples
3. **WebSocket Push**: Pushes data via WebSocket but UI polls `/api/bands`
4. **Disconnect**: WebSocket data and `/api/bands` endpoint are separate
5. **Data Flow**: Random band powers → WebSocket (ignored) vs `/api/bands` (zeros)

## The Fix Required

### Option 1: Make UI Use WebSocket Data (Quick Fix)

Change React UI to use the WebSocket `bandPowers` messages it's already receiving instead of polling `/api/bands`.

**Pros**:

- Data is already flowing via WebSocket
- Less server load (no polling)
- Real-time updates

**Cons**:

- Still generating unrealistic random band powers
- Doesn't match NeurOSC's proven approach

### Option 2: Implement NeurOSC-Style Simulator (Proper Fix) ⭐

Port NeurOSC's simulator logic to NeuroVis server:

1. Generate realistic raw EEG samples using sine waves
2. Buffer samples in memory
3. Compute band powers from buffered samples using FFT
4. Update `currentBandPowers` so `/api/bands` returns real data
5. Keep WebSocket broadcasts working

**Pros**:

- Realistic brain wave simulation with proper frequency components
- Matches proven NeurOSC implementation
- Works with existing React UI polling
- Useful for debugging/testing without hardware

**Cons**:

- More code to port
- Need FFT library (already have DSP pipeline in NeuroVis)

## Implementation Plan (Option 2 - Recommended)

### Phase 1: Port Signal Generation

```javascript
// In server-enhanced.js
function generateRealisticEEG(time, channel, mode = "normal") {
  // Define band frequencies
  const DELTA = [0.5, 4.0];
  const THETA = [4.0, 8.0];
  const ALPHA = [8.0, 13.0];
  const BETA = [13.0, 30.0];
  const GAMMA = [30.0, 50.0];

  // Mode-specific amplitudes (microvolts)
  const amplitudes = {
    normal: { delta: 8, theta: 10, alpha: 20, beta: 15, gamma: 5 },
    meditation: { delta: 10, theta: 30, alpha: 40, beta: 5, gamma: 2 },
    focused: { delta: 3, theta: 5, alpha: 10, beta: 35, gamma: 8 },
    drowsy: { delta: 40, theta: 25, alpha: 15, beta: 5, gamma: 2 },
  };

  const amp = amplitudes[mode];
  const channelFactor = 1.0 + 0.1 * channel;

  // Generate signal as sum of sine waves
  let signal = 0;
  signal +=
    amp.delta *
    channelFactor *
    Math.sin(2 * Math.PI * randomInRange(...DELTA) * time);
  signal +=
    amp.theta *
    channelFactor *
    Math.sin(2 * Math.PI * randomInRange(...THETA) * time);
  signal +=
    amp.alpha *
    channelFactor *
    Math.sin(2 * Math.PI * randomInRange(...ALPHA) * time);
  signal +=
    amp.beta *
    channelFactor *
    Math.sin(2 * Math.PI * randomInRange(...BETA) * time);
  signal +=
    amp.gamma *
    channelFactor *
    Math.sin(2 * Math.PI * randomInRange(...GAMMA) * time);

  // Add noise and drift
  signal += randomGaussian(0, 2.0);
  signal += 5.0 * Math.sin(2 * Math.PI * 0.1 * time);

  return signal;
}
```

### Phase 2: Buffer Management

- Store raw EEG samples in circular buffer
- Use existing `eegBuffer` or create dedicated simulator buffer

### Phase 3: Use Existing DSP Pipeline

- NeuroVis already has DSP pipeline with FFT
- Feed simulator samples through `dsp.process(eeg)`
- Extract band powers from DSP output

### Phase 4: Update currentBandPowers

- Already fixed: `broadcastBandPowers()` now updates `currentBandPowers`
- Ensure simulator uses this function

## UI Reorganization Plan

### Current Display Buttons (Need Reordering)

1. EEG Timeline
2. Power Spectrum
3. Band Powers
4. FFT Spectrum
5. Statistics
6. 3D Waterfall
7. Phase
8. Coherence
9. fNIRS (Athena only)
10. PPG/HR (Muse S/Athena)
11. IMU/Motion

### Requested New Order

1. **Power + Timeline** (combine existing views)
2. **FFT + Bands** (combine existing views)
3. **3D Waterfall** (existing)
4. **Traces/FFT/Bands Combined** (NEW - from NeurOSC)
5. **Neuro** (existing - what is this? needs clarification)
6. **Mental State** (NEW - Calm/Meditative/Focused/etc from NeurOSC)
7. **Phase** (existing)
8. **Coherence** (existing)
9. **PPG/HR-Muse** (existing)
10. **IMU-Muse** (existing)
11. **fNIRS-Athena** (existing)
12. **Connect** (existing - settings panel?)
13. **Processing** (existing - DSP settings?)
14. **Presets** (existing?)
15. **OSC** (existing - OSC settings)
16. **OSC Monitoring** (existing - OSC message view)
17. **Recording** (existing)

### Questions for User

1. **"Neuro" view** - What is this? Brain state visualization?
2. **Combined view** - Should this be a single panel with 3 sub-panels or switchable tabs?
3. **Mental State** - Port from NeurOSC or new implementation?
4. **Dropdown menu** - Do you want:
   - A. Main toolbar with all 17 buttons
   - B. Dropdown menu to select which buttons to show
   - C. Both (toolbar + dropdown for overflow)
5. **Quad View integration** - Should quad view allow mixing any 4 of these 17 views?

### Technical Approach for UI

1. Create array of view configurations with order numbers
2. Render buttons in sorted order
3. Add dropdown selector for quad view panels
4. Port NeurOSC Mental State component (shows engagement, meditation, focus levels)

## Next Steps

**When you return from meeting:**

1. Confirm which fix to implement (Option 1 quick or Option 2 proper)
2. Answer UI reorganization questions above
3. Prioritize: Simulator fix first or UI reorg first?
4. Review NeurOSC Mental State component to understand what to port

## Files to Modify

### Simulator Fix

- `server-enhanced.js` - Add realistic signal generation
- Test with `/api/bands` endpoint

### UI Reorganization

- `/Users/richardboulanger/dB-Studio/NeuroVis/public/index.html` - React UI view definitions
- Add new Mental State component
- Reorder button array
- Update quad view dropdowns

## NeurOSC Mental State Reference

The Mental State view in NeurOSC shows:

- **Engagement Index**: Beta / (Alpha + Theta)
- **Meditation Score**: Alpha + Theta levels
- **Focus Score**: Beta levels
- **Calm/Meditative/Focused/Drowsy** classification
- Color-coded bars and real-time indicators

This would be a valuable addition to NeuroVis for neurofeedback applications.
