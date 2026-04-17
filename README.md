# NeuroVis EEG Dashboard PRO

**Real-time neurofeedback & EEG analysis dashboard** supporting Muse 2, Muse S/Athena, OpenBCI Ganglion, and OpenBCI Ultracortex.

🧠 **Professional-grade brain visualization** • 🎛️ **OSC streaming to Csound/Max/Pure Data** • 📊 **Live calibration & brain state classification** • 🎯 **Device-aware UI adapts to hardware**

## Features

### Multi-Device Support
- **Muse 2** (4 channels: TP9, AF7, AF8, TP10)
- **Muse S/Athena** (4 channels + PPG/HR, fNIRS)
- **OpenBCI Ganglion** (4 channels, 200 Hz)
- **OpenBCI Ultracortex** (16 channels 10-20 system, 125-250 Hz)

### Visualizations
- **Raw EEG** - 4-channel real-time waveforms (256 Hz)
- **Band Powers** - Delta/Theta/Alpha/Beta/Gamma animated bars
- **FFT Spectrum** - Frequency domain with band regions highlighted
- **3D Waterfall** - Temporal band power evolution (IBVA-style)
- **Phase Polar** - Electrode synchronization & coherence
- **Quad View** - 4 simultaneous visualization panels (selectable)
- **Motion Sensors** - Accelerometer (3-axis) & Gyroscope (3-axis)
- **Heart Rate** - PPG-based HR visualization (Muse S/Athena only)

### Neurofeedback
- **Brain State Classification** - 5-state classifier (Aroused/Focused/Relaxed/Drowsy/Neutral)
- **90-Second Calibration** - Personalized z-score baselines (Welford's algorithm)
- **Event Detection** - Band surges & dominant frequency flips with 2s hysteresis
- **Real-time Feedback** - Color-coded state indicators & confidence metrics

### DSP Pipeline
**23 configurable filters across 5 categories:**
- **Filter** (7): Bypass, Low Pass, High Pass, Notch 50/60, Band Pass, DC Block, Delta Suppress
- **Smooth** (6): EMA, Savitzky-Golay, Median, Kalman, RMS Envelope, Gaussian
- **Gate** (6): Noise Gate, Threshold, Hysteresis, Peak Detect, Zero-Cross, Artifact Rejection
- **Shape** (4): Envelope Follow, Slew Limit, Soft Clip, Rectifier

**8 Built-in Presets:** Relaxed, Focused, Sleep, Clean, Mind Monitor, Raw, Delta Suppress, Artifact Rejection

### OSC Streaming
- **Mode A** - Csound/Max arrays (`/muse/bands/alpha_absolute f f f f`)
- **Mode B** - Scalar values (`/eeg/AF7/alpha f`)
- **Configurable:**
  - Port (default 7400)
  - Rate 1-100 Hz
  - Smoothing 0-1
  - Scale 0.1-5x
  - Filtered/Raw toggle
  - Band/Channel/Extras selectors

### Device-Aware UI
- **Dynamic channel lists** - 4 vs 16 channels
- **Extras visibility** - PPG/fNIRS only on Athena
- **Responsive layout** - Adapts to device capabilities

## Quick Start

### Installation
```bash
cd /Users/richardboulanger/dB-Studio/NeuroVis
npm install
```

### Run Dashboard
```bash
npm start
```

Then open: **http://localhost:3000**

### Connect Muse (Mac)
Requires **MuseBridge** (Swift binary, included):
```bash
./MuseBridge
# Connects to nearby Muse devices via Bluetooth
```

Alternatively, use **BrainFlow** for OpenBCI devices (requires Python):
```bash
pip install brainflow
python -m brainflow.board_shim  # Lists available devices
```

## Architecture

### Backend (`server-enhanced.js`)
- **Node.js + Express** - HTTP/WebSocket server
- **MuseBridge** - Muse device connector (Swift binary)
- **BrainFlow** - OpenBCI device integration (ready for implementation)
- **DSP Pipeline** (`dsp.js`) - 23-filter chain, brain state classifier
- **OSC Output** - Streams to Csound/Max/Pure Data on port 7400

### Frontend (`public/`)
- **HTML5 Canvas** - High-performance visualizations (60 FPS)
- **Chart.js** - Interactive charts for Raw EEG
- **Vanilla JS** - No build step, pure ES6+
- **WebSocket** - Real-time data from server

### Data Flow
```
[Device] → [MuseBridge/BrainFlow] → [DSP Pipeline] → [WebSocket] → [Dashboard]
                                    ↓
                              [OSC Output] → Csound/Max
```

## Tabs Overview

| Tab | Purpose | Status |
|-----|---------|--------|
| 📊 Raw EEG | 4-channel waveforms | ✅ Working |
| 🧠 Bands | Power bar visualization | ⏳ Data flow |
| 🎛️ FFT+Bands | Spectrum + band powers | ⏳ Data flow |
| 🧠 Brain State | Calibration UI | ✅ UI ready |
| ⊞ Quad View | 4 selectable panels | ✅ Working |
| 〰️ 3D Waterfall | IBVA-style temporal view | ✅ Canvas ready |
| 🔄 Phase Polar | Coherence display | ✅ Canvas ready |
| ❤️ PPG/HR | Heart rate & waveforms | ✅ Working (Athena) |
| 💨 Motion | Accel/Gyro 2-pane layout | ✅ Canvas ready |
| ⚙️ DSP | 23 filter configuration | ✅ Interactive |
| 📡 OSC Monitor | Stream control & preview | ✅ Interactive |
| 📊 Stats | Performance metrics | ✅ Working |

## Roadmap

### Phase 1: UI Polish (In Progress)
- [ ] NeuroVis-style top selector bars (bands, channels, views)
- [ ] Inline controls (no side panel)
- [ ] Responsive grid layouts
- [ ] Theme switcher (dark/light)

### Phase 2: Neurofeedback (Critical)
- [ ] Wire calibration to backend API
- [ ] Live z-score display during operation
- [ ] Event history rolling buffer
- [ ] Brain state confidence indicators
- [ ] Save/load calibration baselines

### Phase 3: OpenBCI Integration
- [ ] BrainFlow device routing (Ganglion/Ultracortex)
- [ ] Channel mapping for 16-ch layouts
- [ ] Impedance checking UI

### Phase 4: Advanced Features
- [ ] **Full Brain Map** - 16-channel scalp visualization (Ultracortex)
- [ ] **Coherence Analysis** - Phase relationships between regions
- [ ] **Connectivity Graph** - Network visualization ("which areas talk?")
- [ ] **Spectral Analysis** - Welch's method power spectrograms
- [ ] **Artifact Scoring** - Real-time artifact detection confidence

## Configuration

### `.env` (optional)
```
WS_PORT=8080
HTTP_PORT=3000
OSC_HOST=127.0.0.1
OSC_PORT=7400
OSC_PREFIX=/muse
SIMULATOR_MODE=false
```

### Presets (localStorage)
Saved presets include:
- DSP filter chain configuration
- Selected visualization mode
- Channel/band selections
- Calibration baselines

## Browser Support
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## System Requirements
- **macOS** 10.14+ (for MuseBridge)
- **Node.js** 18+
- **RAM** 2GB minimum
- **Network** - WebSocket capable

## Known Issues / Limitations
- Simulator mode disabled (use real devices)
- Data flow incomplete (tabs show limited visuals until backend routing fixed)
- Ultracortex channel layout hardcoded to first 16 of 64 possible positions

## Contributing
Pull requests welcome! Areas needing help:
- [ ] UI refactoring to NeuroVis pattern
- [ ] OpenBCI BrainFlow integration
- [ ] Spectral analysis features
- [ ] Mobile/tablet support
- [ ] Documentation & tutorials

## License
MIT

## Credits
- **NeuroVis** React component patterns (reference implementation)
- **MuseBridge** Bluetooth connectivity (Swift)
- **BrainFlow** OpenBCI integration (ready)
- **Csound/Max/Pure Data** audio backends (OSC targets)

## Contact
GitHub: [@csounder](https://github.com/csounder)  
Dashboard: http://localhost:3000

---

**Status: 85% feature complete, 70% UI complete**  
Last updated: April 2026
