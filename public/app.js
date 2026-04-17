// ============================================================================
// Muse EEG Neuro Dashboard — NeuroVis 3-Row Layout
// ============================================================================

const WS_URL = `ws://${window.location.hostname}:8080`
let ws = null

console.log(`🔌 WebSocket URL: ${WS_URL}`)

// ============================================================================
// Global State
// ============================================================================

let state = {
  connected: false,
  simulator: false,
  currentView: "quadview",
  paneViews: {
    pane0: "timeline", // Top-left
    pane1: "phase", // Top-right
    pane2: "waterfall", // Bottom-left
    pane3: "oscmon", // Bottom-right
  },
  selectedBands: new Set(["delta", "theta", "alpha", "beta", "gamma"]),
  selectedChannels: new Set(["AF7", "AF8", "TP9", "TP10"]),
  deviceName: null,
  packetCount: 0,
  lastUpdateTime: null,
  eegData: {
    AF7: [],
    AF8: [],
    TP9: [],
    TP10: [],
  },
  bandPowers: {},
  motionData: {
    accel: [[], [], []],
    gyro: [[], [], []],
    ppg: [[], [], []],
    fnirs: [[], [], []],
  },
  recording: false,
  recordedData: [],
  charts: {},
  waterfallHistory: [],
  oscMonitorMessages: [],
}

const BAND_COLORS = {
  delta: "#ff6b6b",
  theta: "#ffa500",
  alpha: "#4ecdc4",
  beta: "#45b7d1",
  gamma: "#f39c12",
}

const BAND_INFO = {
  delta: "0.5–4 Hz | Sleep, Drowsiness",
  theta: "4–8 Hz | Creativity, Meditation",
  alpha: "8–13 Hz | Relaxation, Calm",
  beta: "13–30 Hz | Focus, Alertness",
  gamma: "30–100 Hz | High Cognitive Activity",
}

const CHANNEL_INFO = {
  AF7: "Left Forehead | Eye blinks, Concentration",
  AF8: "Right Forehead | Eye blinks, Concentration",
  TP9: "Behind Left Ear | Relaxation, Jaw clenching",
  TP10: "Behind Right Ear | Relaxation, Jaw clenching",
}

// ============================================================================
// Dropdown Toggle Function
// ============================================================================

function toggleDropdown(event, name) {
  event.stopPropagation()
  const dropdown = document.getElementById(`${name}-dropdown`)
  if (dropdown) {
    dropdown.classList.toggle("active")
    // Close other dropdowns
    document.querySelectorAll(".dropdown-content.active").forEach((el) => {
      if (el.id !== `${name}-dropdown`) {
        el.classList.remove("active")
      }
    })
  }
}

// Close dropdowns when clicking outside
document.addEventListener("click", (e) => {
  if (!e.target.closest(".dropdown")) {
    document.querySelectorAll(".dropdown-content.active").forEach((el) => {
      el.classList.remove("active")
    })
  }
})

// ============================================================================
// Band & Channel Selectors (Row 2)
// ============================================================================

function setupSelectors() {
  // Band selectors
  document.querySelectorAll("[data-band]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const band = btn.dataset.band
      if (state.selectedBands.has(band)) {
        state.selectedBands.delete(band)
        btn.classList.remove("active")
      } else {
        state.selectedBands.add(band)
        btn.classList.add("active")
      }
      updateDisplay()
    })
  })

  // Channel selectors
  document.querySelectorAll("[data-channel]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const channel = btn.dataset.channel
      if (state.selectedChannels.has(channel)) {
        state.selectedChannels.delete(channel)
        btn.classList.remove("active")
      } else {
        state.selectedChannels.add(channel)
        btn.classList.add("active")
      }
      updateDisplay()
    })
  })

  // View tabs
  document.querySelectorAll("[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"))
      btn.classList.add("active")
      state.currentView = btn.dataset.view
      updateDisplay()
    })
  })
}

// ============================================================================
// Display Switching & Descriptions
// ============================================================================

const DISPLAY_INFO = {
  timeline: {
    title: "📊 Power + Timeline",
    desc: "Real-time band power meters for each selected band. Power bars show relative amplitude 0–100%.",
  },
  fft: {
    title: "📡 FFT Spectrum",
    desc: "Frequency domain analysis (0–100 Hz) for selected channels. Shows where EEG power is concentrated.",
  },
  fftbands: {
    title: "📊 FFT + Bands",
    desc: "Left: Frequency spectrum with frequency bands highlighted. Right: Relative band power bars.",
  },
  phase: {
    title: "🔄 Phase Coherence",
    desc: "Polar plot showing phase angle and magnitude of oscillations for each electrode. Clustering = synchronization.",
  },
  coherence: {
    title: "🔗 Coherence Matrix",
    desc: "Cross-electrode phase synchronization. 100% = perfectly in-phase (strong functional connectivity).",
  },
  waterfall: {
    title: "🌊 3D Waterfall",
    desc: "Band power stacked in time (newest traces in front). Each line = one snapshot. Height = amplitude.",
  },
  topo: {
    title: "🧠 Topographic Map",
    desc: "Spatial map of band power across the head. Color intensity = band power at each electrode.",
  },
  motion: {
    title: "💨 Motion (IMU)",
    desc: "6-axis motion: Accelerometer (X,Y,Z in g) + Gyroscope (°/s) + PPG heart rate.",
  },
  fnirs: {
    title: "🧠 fNIRS Oxygenation (Athena)",
    desc: "Prefrontal cortex blood oxygenation. HbO₂ + HbR indicate cognitive load and attention.",
  },
  quadview: {
    title: "📺 Quad View",
    desc: "4-panel display: Power (TL), Phase (TR), Waterfall (BL), OSC Monitor (BR). All respond to band/channel selectors.",
  },
  debug: {
    title: "🔍 Simulator Data Debug",
    desc: "Real-time view of simulator data flowing from server. Shows EEG raw values, band powers (absolute/relative), and motion data.",
  },
  oscmon: {
    title: "📡 OSC Monitor",
    desc: "Real-time log of OSC messages being sent to Csound. Shows addresses, values, and timestamps.",
  },
}

function updateDisplay() {
  const info = DISPLAY_INFO[state.currentView]
  document.getElementById("displayTitle").textContent = info.title
  document.getElementById("displayDesc").textContent = info.desc

  const content = document.getElementById("displayContent")
  content.innerHTML = ""

  switch (state.currentView) {
    case "timeline":
      renderPowerTimeline(content)
      break
    case "fft":
      renderFFT(content)
      break
    case "fftbands":
      renderFFTBands(content)
      break
    case "phase":
      renderPhase(content)
      break
    case "coherence":
      renderCoherence(content)
      break
    case "waterfall":
      renderWaterfall(content)
      break
    case "topo":
      renderTopo(content)
      break
    case "motion":
      renderMotion(content)
      break
    case "fnirs":
      renderFNIRS(content)
      break
    case "quadview":
      renderQuadView(content)
      break
    case "debug":
      renderDebugData(content)
      break
    case "oscmon":
      renderOSCMonitor(content)
      break
    default:
      content.innerHTML = '<p style="color: #666;">Select a display from Row 3 above.</p>'
  }
}

// ============================================================================
// Display Renderers (stubs — will populate from app.js functions)
// ============================================================================

function renderPowerTimeline(container) {
  const canvas = document.createElement("canvas")
  canvas.id = "powerTimelineCanvas"
  canvas.style.width = "100%"
  canvas.style.height = "100%"
  canvas.style.minHeight = "200px"
  container.appendChild(canvas)
}

function renderFFT(container) {
  const canvas = document.createElement("canvas")
  canvas.id = "fftChart"
  canvas.style.width = "100%"
  canvas.style.height = "100%"
  canvas.style.minHeight = "200px"
  container.appendChild(canvas)
}

function renderFFTBands(container) {
  const canvas = document.createElement("canvas")
  canvas.id = "fftBandsCanvas"
  canvas.style.width = "100%"
  canvas.style.height = "100%"
  canvas.style.minHeight = "200px"
  container.appendChild(canvas)
}

function renderPhase(container) {
  const canvas = document.createElement("canvas")
  canvas.id = "phaseCanvas"
  canvas.width = 400
  canvas.height = 400
  canvas.style.width = "100%"
  canvas.style.maxWidth = "360px"
  canvas.style.margin = "0 auto"
  canvas.style.display = "block"
  canvas.style.borderRadius = "8px"
  canvas.style.background = "var(--bg-tertiary)"
  container.appendChild(canvas)
  // TODO: Implement phase visualization
  const ctx = canvas.getContext("2d")
  drawPhaseVisualization(ctx, canvas.width, canvas.height)
}

function drawPhaseVisualization(ctx, W, H) {
  const cx = W / 2
  const cy = H / 2
  const r = Math.min(cx, cy) - 30

  // Background
  ctx.fillStyle = "var(--bg-tertiary)"
  ctx.fillRect(0, 0, W, H)

  // Grid circles
  ctx.strokeStyle = "var(--border)"
  ctx.lineWidth = 0.5
  ;[1, 0.75, 0.5, 0.25].forEach((scale) => {
    ctx.beginPath()
    ctx.arc(cx, cy, r * scale, 0, Math.PI * 2)
    ctx.stroke()
  })

  // Crosshairs
  ctx.beginPath()
  ctx.moveTo(cx - r, cy)
  ctx.lineTo(cx + r, cy)
  ctx.moveTo(cx, cy - r)
  ctx.lineTo(cx, cy + r)
  ctx.stroke()

  // Degree labels
  ctx.fillStyle = "var(--text-secondary)"
  ctx.font = "9px monospace"
  ;[0, 90, 180, 270].forEach((deg) => {
    const rad = (deg * Math.PI) / 180
    ctx.fillText(deg + "°", cx + Math.cos(rad) * (r + 14) - 8, cy + Math.sin(rad) * (r + 14) + 3)
  })

  // Draw electrode phase vectors (simulated)
  const channels = Array.from(state.selectedChannels)
  const colors = ["#ff6b6b", "#4ecdc4", "#45b7d1", "#f39c12"]
  channels.forEach((ch, i) => {
    const phase = Math.random() * Math.PI * 2 - Math.PI
    const magnitude = Math.random() * 0.8
    const ex = cx + Math.cos(phase) * r * magnitude
    const ey = cy + Math.sin(phase) * r * magnitude

    ctx.strokeStyle = colors[i]
    ctx.lineWidth = 2
    ctx.globalAlpha = 0.6
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(ex, ey)
    ctx.stroke()

    ctx.fillStyle = colors[i]
    ctx.globalAlpha = 1
    ctx.beginPath()
    ctx.arc(ex, ey, 4, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = "var(--text-primary)"
    ctx.font = "bold 8px monospace"
    ctx.fillText(ch, ex + 6, ey - 4)
  })
}

function renderCoherence(container) {
  const div = document.createElement("div")
  div.innerHTML = "<p style='color: #999;'>Coherence Matrix visualization coming soon...</p>"
  container.appendChild(div)
}

function renderWaterfall(container) {
  const canvas = document.createElement("canvas")
  canvas.id = "waterfallCanvas"
  canvas.style.width = "100%"
  canvas.style.height = "100%"
  canvas.style.minHeight = "200px"
  container.appendChild(canvas)
}

function renderTopo(container) {
  const canvas = document.createElement("canvas")
  canvas.id = "topoCanvas"
  canvas.style.width = "100%"
  canvas.style.height = "100%"
  canvas.style.minHeight = "200px"
  container.appendChild(canvas)
}

function renderMotion(container) {
  const div = document.createElement("div")
  div.style.padding = "12px"
  div.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
      <div style="background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 6px; padding: 12px;">
        <h4 style="margin: 0 0 8px 0; font-size: 0.9rem; color: var(--text-primary);">📍 Accelerometer (X, Y, Z)</h4>
        <div style="display: flex; gap: 12px; justify-content: space-around;">
          <div style="text-align: center;">
            <div style="font-size: 1.8rem; font-weight: bold; color: #ff6b6b;" id="accelX">0.00</div>
            <div style="font-size: 0.7rem; color: var(--text-secondary);">X (g)</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 1.8rem; font-weight: bold; color: #4ecdc4;" id="accelY">0.00</div>
            <div style="font-size: 0.7rem; color: var(--text-secondary);">Y (g)</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 1.8rem; font-weight: bold; color: #45b7d1;" id="accelZ">9.81</div>
            <div style="font-size: 0.7rem; color: var(--text-secondary);">Z (g)</div>
          </div>
        </div>
      </div>
      <div style="background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 6px; padding: 12px;">
        <h4 style="margin: 0 0 8px 0; font-size: 0.9rem; color: var(--text-primary);">🔄 Gyroscope (X, Y, Z)</h4>
        <div style="display: flex; gap: 12px; justify-content: space-around;">
          <div style="text-align: center;">
            <div style="font-size: 1.8rem; font-weight: bold; color: #f39c12;" id="gyroX">0.00</div>
            <div style="font-size: 0.7rem; color: var(--text-secondary);">X (°/s)</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 1.8rem; font-weight: bold; color: #ffa500;" id="gyroY">0.00</div>
            <div style="font-size: 0.7rem; color: var(--text-secondary);">Y (°/s)</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 1.8rem; font-weight: bold; color: #00ff88;" id="gyroZ">0.00</div>
            <div style="font-size: 0.7rem; color: var(--text-secondary);">Z (°/s)</div>
          </div>
        </div>
      </div>
      <div style="background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 6px; padding: 12px;">
        <h4 style="margin: 0 0 8px 0; font-size: 0.9rem; color: var(--text-primary);">❤️ PPG (Heart Rate)</h4>
        <div style="display: flex; gap: 12px; justify-content: space-around;">
          <div style="text-align: center;">
            <div style="font-size: 1.8rem; font-weight: bold; color: #ff6b6b;" id="ppgRed">0</div>
            <div style="font-size: 0.7rem; color: var(--text-secondary);">Red</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 1.8rem; font-weight: bold; color: #00ff88;" id="ppgGreen">0</div>
            <div style="font-size: 0.7rem; color: var(--text-secondary);">Green</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 1.8rem; font-weight: bold; color: #f39c12;" id="ppgIR">0</div>
            <div style="font-size: 0.7rem; color: var(--text-secondary);">IR</div>
          </div>
        </div>
      </div>
    </div>
  `
  container.appendChild(div)
}

function renderFNIRS(container) {
  const div = document.createElement("div")
  div.style.padding = "12px"
  div.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
      <div style="background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 6px; padding: 12px; text-align: center;">
        <div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 8px; text-transform: uppercase; font-weight: 700;">HbO₂ (Oxygenated)</div>
        <div style="font-size: 2.2rem; font-weight: bold; color: #ff6b6b;" id="fnirshbo2">0.00</div>
      </div>
      <div style="background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 6px; padding: 12px; text-align: center;">
        <div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 8px; text-transform: uppercase; font-weight: 700;">HbR (Deoxygenated)</div>
        <div style="font-size: 2.2rem; font-weight: bold; color: #4ecdc4;" id="fnirshbr">0.00</div>
      </div>
      <div style="background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 6px; padding: 12px; text-align: center;">
        <div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 8px; text-transform: uppercase; font-weight: 700;">HbTotal</div>
        <div style="font-size: 2.2rem; font-weight: bold; color: #f9ca24;" id="fnirshbtotal">0.00</div>
      </div>
      <div style="background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 6px; padding: 12px; text-align: center;">
        <div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 8px; text-transform: uppercase; font-weight: 700;">Net Brain Load</div>
        <div style="font-size: 2.2rem; font-weight: bold; color: #45b7d1;" id="fnirsBrainLoad">0.00</div>
      </div>
    </div>
  `
  container.appendChild(div)
}

function renderQuadView(container) {
  const grid = document.createElement("div")
  grid.style.display = "grid"
  grid.style.gridTemplateColumns = "1fr 1fr"
  grid.style.gap = "12px"

  const paneConfigs = [
    { id: "pane0", label: "Pane 1" },
    { id: "pane1", label: "Pane 2" },
    { id: "pane2", label: "Pane 3" },
    { id: "pane3", label: "Pane 4" },
  ]

  paneConfigs.forEach((config) => {
    const paneDiv = document.createElement("div")
    paneDiv.id = config.id
    paneDiv.style.background = "var(--bg-tertiary)"
    paneDiv.style.padding = "12px"
    paneDiv.style.borderRadius = "6px"
    paneDiv.style.display = "flex"
    paneDiv.style.flexDirection = "column"
    paneDiv.style.gap = "8px"

    // Pane header with selector dropdown
    const header = document.createElement("div")
    header.style.display = "flex"
    header.style.gap = "6px"
    header.style.alignItems = "center"

    const label = document.createElement("span")
    label.textContent = config.label
    label.style.fontSize = "0.85rem"
    label.style.fontWeight = "700"
    label.style.color = "var(--text-secondary)"

    const selector = document.createElement("select")
    selector.className = "pane-selector"
    selector.id = `${config.id}-select`
    selector.style.padding = "4px 8px"
    selector.style.borderRadius = "4px"
    selector.style.border = "1px solid var(--border)"
    selector.style.background = "var(--bg-primary)"
    selector.style.color = "var(--text-secondary)"
    selector.style.fontSize = "0.75rem"
    selector.style.flex = "1"

    const displays = [
      "timeline",
      "fft",
      "fftbands",
      "phase",
      "coherence",
      "waterfall",
      "topo",
      "motion",
      "fnirs",
      "debug",
      "oscmon",
    ]

    displays.forEach((display) => {
      const option = document.createElement("option")
      option.value = display
      option.textContent = DISPLAY_INFO[display]?.title || display
      if (state.paneViews[config.id] === display) option.selected = true
      selector.appendChild(option)
    })

    selector.addEventListener("change", (e) => {
      state.paneViews[config.id] = e.target.value
      renderPane(config.id, e.target.value)
    })

    header.appendChild(label)
    header.appendChild(selector)
    paneDiv.appendChild(header)

    // Content container
    const content = document.createElement("div")
    content.id = `${config.id}-content`
    content.style.flex = "1"
    content.style.overflow = "auto"
    content.style.minHeight = "200px"
    paneDiv.appendChild(content)

    grid.appendChild(paneDiv)

    // Initial render
    renderPane(config.id, state.paneViews[config.id])
  })

  container.appendChild(grid)
}

function renderPane(paneId, displayType) {
  const content = document.getElementById(`${paneId}-content`)
  if (!content) return

  content.innerHTML = ""

  // Render the selected display in this pane
  switch (displayType) {
    case "timeline":
      renderPowerTimeline(content)
      break
    case "fft":
      renderFFT(content)
      break
    case "fftbands":
      renderFFTBands(content)
      break
    case "phase":
      renderPhase(content)
      break
    case "coherence":
      renderCoherence(content)
      break
    case "waterfall":
      renderWaterfall(content)
      break
    case "topo":
      renderTopo(content)
      break
    case "motion":
      renderMotion(content)
      break
    case "fnirs":
      renderFNIRS(content)
      break
    case "debug":
      renderDebugData(content)
      break
    case "oscmon":
      renderOSCMonitor(content)
      break
  }
}

function drawDisplayContent(container, displayType) {
  if (!container) return

  // Debug: Log that we're trying to draw
  if (!window._drawCount) window._drawCount = {}
  if (!window._drawCount[displayType]) window._drawCount[displayType] = 0
  window._drawCount[displayType]++
  if (window._drawCount[displayType] % 60 === 0) {
    console.log(
      `🎨 Drawing ${displayType}: count=${window._drawCount[displayType]}, bandPower=${(state.bandPowers?.relative?.alpha || 0).toFixed(3)}`,
    )
  }

  switch (displayType) {
    case "timeline":
      const tlCanvas = container.querySelector("canvas")
      if (tlCanvas) {
        // Ensure canvas has size
        if (tlCanvas.width === 0 || tlCanvas.height === 0) {
          const rect = tlCanvas.getBoundingClientRect()
          tlCanvas.width = rect.width || 300
          tlCanvas.height = rect.height || 200
        }
        drawPowerBars(tlCanvas)
      }
      break
    case "fft":
      const fftCanvas = container.querySelector("canvas")
      if (fftCanvas) {
        if (fftCanvas.width === 0 || fftCanvas.height === 0) {
          const rect = fftCanvas.getBoundingClientRect()
          fftCanvas.width = rect.width || 300
          fftCanvas.height = rect.height || 200
        }
        drawFFTSpectrum(fftCanvas)
      }
      break
    case "fftbands":
      const fftbCanvas = container.querySelector("canvas")
      if (fftbCanvas) {
        if (fftbCanvas.width === 0 || fftbCanvas.height === 0) {
          const rect = fftbCanvas.getBoundingClientRect()
          fftbCanvas.width = rect.width || 300
          fftbCanvas.height = rect.height || 200
        }
        drawFFTPlusBands(fftbCanvas)
      }
      break
    case "phase":
      const phaseC = container.querySelector("canvas")
      if (phaseC) {
        if (phaseC.width === 0 || phaseC.height === 0) {
          const rect = phaseC.getBoundingClientRect()
          phaseC.width = rect.width || 300
          phaseC.height = rect.height || 200
        }
        drawPhaseVisualization(phaseC.getContext("2d"), phaseC.width, phaseC.height)
      }
      break
    case "waterfall":
      const wfCanvas = container.querySelector("canvas")
      if (wfCanvas) {
        if (wfCanvas.width === 0 || wfCanvas.height === 0) {
          const rect = wfCanvas.getBoundingClientRect()
          wfCanvas.width = rect.width || 300
          wfCanvas.height = rect.height || 200
        }
        drawWaterfallSpectrum(wfCanvas)
      }
      break
    case "topo":
      const topoC = container.querySelector("canvas")
      if (topoC) {
        if (topoC.width === 0 || topoC.height === 0) {
          const rect = topoC.getBoundingClientRect()
          topoC.width = rect.width || 300
          topoC.height = rect.height || 200
        }
        drawTopographicMap(topoC)
      }
      break
    case "motion":
      updateMotionDisplay(container)
      break
    case "fnirs":
      updateFNIRSDisplay(container)
      break
    case "oscmon":
      updateOSCLog()
      break
    case "debug":
      updateDebugData(container)
      break
  }
}

function drawPowerBars(canvas) {
  if (!canvas) return

  const ctx = canvas.getContext("2d")
  const rect = canvas.getBoundingClientRect()
  const width = rect.width
  const height = rect.height

  // Set canvas resolution ONLY if different
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }

  const bands = Array.from(state.selectedBands)
  if (bands.length === 0) return

  const barWidth = width / bands.length - 4

  // Background
  ctx.fillStyle = "#0a0e27"
  ctx.fillRect(0, 0, width, height)

  // Draw bars
  bands.forEach((band, i) => {
    const power = state.bandPowers?.relative?.[band] || 0
    const x = i * (barWidth + 4) + 2
    const barHeight = Math.max(power * (height - 30), 2)
    const y = height - barHeight - 15

    // Bar
    ctx.fillStyle = BAND_COLORS[band]
    ctx.fillRect(x, y, barWidth, barHeight)

    // Outline
    ctx.strokeStyle = BAND_COLORS[band] + "80"
    ctx.lineWidth = 1
    ctx.strokeRect(x, y, barWidth, barHeight)

    // Value text
    ctx.fillStyle = "#b0b0b0"
    ctx.font = "bold 11px monospace"
    ctx.textAlign = "center"
    ctx.fillText((power * 100).toFixed(0) + "%", x + barWidth / 2, height - 5)
  })

  // Debug log
  if (!window._powerBarLogCount) window._powerBarLogCount = 0
  window._powerBarLogCount++
  if (window._powerBarLogCount % 30 === 0) {
    console.log(`🎨 Power bars updated: α=${(state.bandPowers?.relative?.alpha || 0).toFixed(3)}`)
  }
}

function drawFFTSpectrum(canvas) {
  if (!canvas) return
  const ctx = canvas.getContext("2d")
  const rect = canvas.getBoundingClientRect()

  // Only resize if needed
  if (canvas.width !== rect.width || canvas.height !== rect.height) {
    canvas.width = rect.width
    canvas.height = rect.height
  }

  const width = canvas.width
  const height = canvas.height

  if (width < 10 || height < 10) return

  // Background
  ctx.fillStyle = "#0a0e27"
  ctx.fillRect(0, 0, width, height)

  // Draw frequency spectrum (simulated with band data)
  const bands = ["delta", "theta", "alpha", "beta", "gamma"]
  const freqRanges = [2, 6, 10, 20, 45]
  const bandWidth = width / bands.length

  bands.forEach((band, i) => {
    const power = state.bandPowers?.relative?.[band] || 0
    const x = i * bandWidth
    const barHeight = Math.max(power * (height - 30), 2)
    const y = height - barHeight - 15

    ctx.fillStyle = BAND_COLORS[band]
    ctx.fillRect(x, y, bandWidth - 2, barHeight)

    // Frequency label
    ctx.fillStyle = "#b0b0b0"
    ctx.font = "10px monospace"
    ctx.textAlign = "center"
    ctx.fillText(freqRanges[i] + " Hz", x + bandWidth / 2, height - 2)
  })

  // Axes
  ctx.strokeStyle = "#2a2d4a"
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, height - 15)
  ctx.lineTo(width, height - 15)
  ctx.stroke()
}

function drawFFTPlusBands(canvas) {
  if (!canvas) return
  const ctx = canvas.getContext("2d")
  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width
  canvas.height = rect.height

  // Split canvas: left spectrum, right band bars
  const width = canvas.width
  const height = canvas.height
  const midX = width * 0.6

  // Background
  ctx.fillStyle = "#0a0e27"
  ctx.fillRect(0, 0, width, height)

  // Left side: Frequency spectrum
  const bands = ["delta", "theta", "alpha", "beta", "gamma"]
  const bandWidth = midX / bands.length

  bands.forEach((band, i) => {
    const power = state.bandPowers?.relative?.[band] || 0.3
    const x = i * bandWidth
    const barHeight = power * (height - 30)
    const y = height - barHeight - 15

    ctx.fillStyle = BAND_COLORS[band]
    ctx.fillRect(x, y, bandWidth - 2, barHeight)
  })

  // Right side: Band power bars with history
  const rightStart = midX + 10
  const bandBarWidth = (width - rightStart - 10) / bands.length

  bands.forEach((band, i) => {
    const power = state.bandPowers?.relative?.[band] || 0.3
    const x = rightStart + i * (bandBarWidth + 2)
    const barHeight = power * (height - 30)
    const y = height - barHeight - 15

    ctx.fillStyle = BAND_COLORS[band]
    ctx.fillRect(x, y, bandBarWidth - 2, barHeight)

    // Label
    ctx.fillStyle = "#b0b0b0"
    ctx.font = "9px monospace"
    ctx.textAlign = "center"
    ctx.fillText(band, x + bandBarWidth / 2, height - 2)
  })
}

function drawWaterfallSpectrum(canvas) {
  if (!canvas) return
  const ctx = canvas.getContext("2d")
  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width
  canvas.height = rect.height

  const width = canvas.width
  const height = canvas.height

  // Background
  ctx.fillStyle = "#0a0e27"
  ctx.fillRect(0, 0, width, height)

  // Draw waterfall-like visualization with band powers as horizontal lines
  const bands = ["delta", "theta", "alpha", "beta", "gamma"]
  const lineHeight = height / (bands.length + 1)
  const time = Date.now() / 1000

  bands.forEach((band, i) => {
    const y = (i + 1) * lineHeight
    const power = state.bandPowers?.relative?.[band] || 0.3

    // Draw oscillating line
    ctx.strokeStyle = BAND_COLORS[band]
    ctx.lineWidth = 2
    ctx.globalAlpha = 0.7
    ctx.beginPath()

    for (let x = 0; x < width; x += 5) {
      const waveY = y + Math.sin((x + time * 50) / 20) * (power * 20)
      if (x === 0) ctx.moveTo(x, waveY)
      else ctx.lineTo(x, waveY)
    }
    ctx.stroke()
    ctx.globalAlpha = 1

    // Label
    ctx.fillStyle = "#b0b0b0"
    ctx.font = "10px monospace"
    ctx.textAlign = "right"
    ctx.fillText(band, width - 5, y + 4)
  })
}

function drawTopographicMap(canvas) {
  if (!canvas) return
  const ctx = canvas.getContext("2d")
  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width
  canvas.height = rect.height

  const width = canvas.width
  const height = canvas.height
  const cx = width / 2
  const cy = height / 2
  const headRadius = Math.min(width, height) / 2 - 20

  // Background
  ctx.fillStyle = "#0a0e27"
  ctx.fillRect(0, 0, width, height)

  // Draw head (simple circle with nose marker)
  ctx.strokeStyle = "#2a2d4a"
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(cx, cy, headRadius, 0, Math.PI * 2)
  ctx.stroke()

  // Nose marker
  ctx.strokeStyle = "#666"
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(cx, cy - headRadius - 10)
  ctx.lineTo(cx - 5, cy - headRadius)
  ctx.lineTo(cx + 5, cy - headRadius)
  ctx.closePath()
  ctx.stroke()

  // Electrode positions
  const channels = Array.from(state.selectedChannels)
  const positions = {
    AF7: { angle: 135, dist: 0.7 },
    AF8: { angle: 45, dist: 0.7 },
    TP9: { angle: 180, dist: 0.6 },
    TP10: { angle: 0, dist: 0.6 },
  }

  // Get selected band (use first selected or alpha)
  const selectedBand = Array.from(state.selectedBands)[0] || "alpha"
  const bandPower = state.bandPowers?.relative?.[selectedBand] || 0.5

  channels.forEach((ch) => {
    const pos = positions[ch]
    if (!pos) return

    const angle = (pos.angle * Math.PI) / 180
    const dist = pos.dist * headRadius
    const x = cx + Math.cos(angle) * dist
    const y = cy + Math.sin(angle) * dist

    // Heat color based on band power
    const hue = bandPower * 120 // 0 (red) to 120 (green)
    ctx.fillStyle = `hsl(${hue}, 100%, 50%)`
    ctx.globalAlpha = 0.8

    ctx.beginPath()
    ctx.arc(x, y, 12, 0, Math.PI * 2)
    ctx.fill()

    ctx.globalAlpha = 1
    ctx.fillStyle = "#fff"
    ctx.font = "bold 9px monospace"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(ch, x, y)
  })
}

function updateMotionDisplay(container) {
  // Update motion values in the HTML
  const accel = state.motionData?.accel || [0, 0, 0]
  const gyro = state.motionData?.gyro || [0, 0, 0]
  const ppg = state.motionData?.ppg || [0, 0, 0]

  const setVal = (id, val) => {
    const el = container.querySelector(`#${id}`)
    if (el) el.textContent = typeof val === "number" ? val.toFixed(2) : val
  }

  setVal("accelX", accel[0] || 0)
  setVal("accelY", accel[1] || 0)
  setVal("accelZ", accel[2] || 9.81)
  setVal("gyroX", gyro[0] || 0)
  setVal("gyroY", gyro[1] || 0)
  setVal("gyroZ", gyro[2] || 0)
  setVal("ppgRed", Math.round((ppg[0] || 0) * 100))
  setVal("ppgGreen", Math.round((ppg[1] || 0) * 100))
  setVal("ppgIR", Math.round((ppg[2] || 0) * 100))
}

function updateFNIRSDisplay(container) {
  // Update fNIRS values
  const fnirs = state.motionData?.fnirs || [0, 0, 0]

  const setVal = (id, val) => {
    const el = container.querySelector(`#${id}`)
    if (el) el.textContent = typeof val === "number" ? val.toFixed(2) : val
  }

  setVal("fnirshbo2", fnirs[0] || 0.3)
  setVal("fnirshbr", fnirs[1] || 0.2)
  setVal("fnirshbtotal", (fnirs[0] || 0.3) + (fnirs[1] || 0.2))
  setVal("fnirsBrainLoad", Math.abs((fnirs[0] || 0.3) - (fnirs[1] || 0.2)))
}

function updateDebugData(container) {
  // Update debug data display
  const el = container.querySelector("div")
  if (!el) return

  const data = {
    timestamp: new Date().toLocaleTimeString(),
    eeg_samples: state.eegData.AF7 ? `${state.eegData.AF7.length} samples` : "0 samples",
    band_powers: state.bandPowers?.relative || {},
    motion_accel: state.motionData?.accel || [0, 0, 0],
    simulator_on: state.simulator,
  }

  el.innerHTML = `<pre style="margin: 0; font-size: 0.75rem; color: var(--accent); overflow-x: auto;">${JSON.stringify(data, null, 2)}</pre>`
}

function drawPhaseCanvas(canvas) {
  const ctx = canvas.getContext("2d")
  const { width, height } = canvas.getBoundingClientRect()
  canvas.width = width
  canvas.height = height

  const cx = width / 2
  const cy = height / 2
  const r = Math.min(cx, cy) - 20

  ctx.fillStyle = "var(--bg-primary)"
  ctx.fillRect(0, 0, width, height)

  ctx.strokeStyle = "var(--border)"
  ctx.lineWidth = 0.5
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()

  const channels = Array.from(state.selectedChannels)
  const colors = ["#ff6b6b", "#4ecdc4", "#45b7d1", "#f39c12"]
  const time = Date.now() / 1000

  channels.forEach((ch, i) => {
    const phase = Math.sin(time * 2 + i) * Math.PI
    const magnitude = 0.5 + 0.3 * Math.sin(time + i)
    const ex = cx + Math.cos(phase) * r * magnitude
    const ey = cy + Math.sin(phase) * r * magnitude

    ctx.strokeStyle = colors[i]
    ctx.lineWidth = 2
    ctx.globalAlpha = 0.6
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(ex, ey)
    ctx.stroke()

    ctx.fillStyle = colors[i]
    ctx.globalAlpha = 1
    ctx.beginPath()
    ctx.arc(ex, ey, 3, 0, Math.PI * 2)
    ctx.fill()
  })
}

function updateQuadDataLog() {
  const log = document.getElementById("quadDataLog")
  if (!log) return

  const lines = [
    `⏱ ${new Date().toLocaleTimeString()}`,
    `📊 EEG: ${state.eegData?.AF7?.[state.eegData.AF7.length - 1]?.toFixed(2) || "—"} µV (AF7)`,
    `🧠 Bands: Δ ${(state.bandPowers?.relative?.delta || 0).toFixed(2)} | θ ${(state.bandPowers?.relative?.theta || 0).toFixed(2)} | α ${(state.bandPowers?.relative?.alpha || 0).toFixed(2)} | β ${(state.bandPowers?.relative?.beta || 0).toFixed(2)} | γ ${(state.bandPowers?.relative?.gamma || 0).toFixed(2)}`,
    `💨 Accel: ${state.motionData?.accel?.[0]?.toFixed(2) || "—"} g`,
  ]

  log.innerHTML = lines.map((line) => `<div>${line}</div>`).join("")
}

function renderDebugData(container) {
  const div = document.createElement("div")
  div.style.fontFamily = "monospace"
  div.style.fontSize = "0.8rem"
  div.style.color = "var(--text-secondary)"
  div.style.whiteSpace = "pre-wrap"

  const data = {
    timestamp: new Date().toLocaleTimeString(),
    eeg_raw: state.eegData.AF7
      ? `[${state.eegData.AF7.slice(-4)
          .map((v) => v.toFixed(2))
          .join(", ")}...]`
      : "—",
    band_powers_relative: state.bandPowers?.relative || {},
    band_powers_absolute: state.bandPowers?.absolute || {},
    motion_accel: state.motionData?.accel || [0, 0, 0],
    motion_gyro: state.motionData?.gyro || [0, 0, 0],
    selected_bands: Array.from(state.selectedBands),
    selected_channels: Array.from(state.selectedChannels),
    simulator_on: state.simulator,
  }

  div.innerHTML = `
    <div style="background:var(--bg-tertiary); border:1px solid var(--border); border-radius:6px; padding:16px;">
      <h3 style="margin:0 0 12px 0; color:var(--accent);">📊 SIMULATOR DATA STREAM</h3>
      <div style="line-height:1.8;">
${JSON.stringify(data, null, 2)
  .split("\n")
  .map((line) => `<div>${line}</div>`)
  .join("")}
      </div>
    </div>
  `
  container.appendChild(div)
}

function renderOSCMonitor(container) {
  const div = document.createElement("div")
  div.innerHTML = `
    <div style="display:flex; gap:6px; margin-bottom:12px;">
      <button class="btn btn-secondary btn-small" onclick="clearOSCLog()">Clear</button>
      <button class="btn btn-secondary btn-small" onclick="toggleOSCPause()">Pause</button>
      <label style="display:flex; align-items:center; gap:4px; margin:0;">
        <input type="checkbox" id="oscAutoScroll" checked />
        Auto-scroll
      </label>
      <span style="margin-left:auto; font-size:0.8rem; color:var(--text-secondary);">
        Messages: <span id="oscMsgCount">0</span>
      </span>
    </div>
    <div id="oscLog" style="background:var(--bg-tertiary); border:1px solid var(--border); border-radius:4px; padding:12px; height:300px; overflow-y:auto; font-size:0.75rem; font-family:monospace; color:var(--accent);">
      <div style="color:#666;">Waiting for OSC messages...</div>
    </div>
  `
  container.appendChild(div)
}

function clearOSCLog() {
  state.oscMonitorMessages = []
  updateOSCLog()
}

function toggleOSCPause() {
  // TODO: Implement pause logic
}

function updateOSCLog() {
  const log = document.getElementById("oscLog")
  const count = document.getElementById("oscMsgCount")
  if (!log) return

  log.innerHTML =
    state.oscMonitorMessages.map((msg) => `<div>${msg}</div>`).join("") ||
    "<div style='color:#666;'>Waiting for messages...</div>"

  count.textContent = state.oscMonitorMessages.length

  if (document.getElementById("oscAutoScroll")?.checked) {
    log.parentElement.scrollTop = log.parentElement.scrollHeight
  }
}

// ============================================================================
// WebSocket Connection
// ============================================================================

function setupWebSocket() {
  console.log(`🔌 Attempting WebSocket connection to ${WS_URL}`)
  ws = new WebSocket(WS_URL)

  ws.onopen = () => {
    console.log("✅ WebSocket connected")
    updateStatus("wsStatus", true)
    updateStatusDisplay()
  }

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data)

      // Debug: Log all message types
      if (!window._msgCount) window._msgCount = {}
      if (!window._msgCount[msg.type]) window._msgCount[msg.type] = 0
      window._msgCount[msg.type]++

      // Log first of each type
      if (window._msgCount[msg.type] === 1) {
        console.log(`📨 First ${msg.type} message received!`)
      }

      switch (msg.type) {
        case "init":
          console.log("🎯 Init message received:", msg)
          console.log(`   📱 Devices: ${msg.devices?.length || 0}`)
          console.log(`   ⚙️ Settings:`, msg.settings)
          // Process devices from init message
          if (msg.devices && msg.devices.length > 0) {
            console.log(`   ✓ Processing ${msg.devices.length} device(s)`)
            handleDeviceList({ devices: msg.devices })
          }
          updateStatusDisplay()
          break
        case "device_list":
          handleDeviceList(msg)
          break
        case "eeg":
          handleEEGData(msg)
          break
        case "bandPowers":
          // Update state but don't call updateDisplay() - let render loop handle it
          state.bandPowers = { absolute: msg.absolute, relative: msg.relative }
          state.lastUpdateTime = Date.now()
          updateStatusDisplay()
          if (window._msgCount["bandPowers"] % 10 === 0) {
            console.log(
              `🧠 Bands received: α=${(msg.relative?.alpha || 0).toFixed(3)} β=${(msg.relative?.beta || 0).toFixed(3)} θ=${(msg.relative?.theta || 0).toFixed(3)}`,
            )
          }
          break
        case "motionData":
          // Update state but don't call updateDisplay()
          state.motionData = msg
          if (window._msgCount["motionData"] % 10 === 0) {
            console.log(`💨 Motion: accel=[${msg.accel?.map((v) => v.toFixed(2)).join(",")}]`)
          }
          break
        default:
          if (window._msgCount[msg.type] === 1) {
            console.log(`❓ Unknown message type: ${msg.type}`, msg)
          }
      }
    } catch (e) {
      console.error("❌ Failed to parse WebSocket message:", e, event.data)
    }
  }

  ws.onerror = (err) => {
    console.error("WebSocket error:", err)
    updateStatus("wsStatus", false)
  }

  ws.onclose = () => {
    console.log("⚠️ WebSocket disconnected")
    updateStatus("wsStatus", false)
    setTimeout(setupWebSocket, 2000) // Reconnect
  }
}

function handleDeviceList(msg) {
  const devices = msg.devices || []
  console.log(`📱 Device list received: ${devices.length} device(s)`)

  const deviceList = document.getElementById("deviceList")
  if (!deviceList) return

  if (devices.length === 0) {
    deviceList.innerHTML = '<p class="placeholder">No devices found</p>'
    return
  }

  deviceList.innerHTML = devices
    .map(
      (dev) => `
      <div style="padding: 8px; background: var(--bg-primary); border: 1px solid var(--border); border-radius: 4px; cursor: pointer; transition: all 0.2s ease;" 
           onmouseover="this.style.background='var(--bg-tertiary)'" 
           onmouseout="this.style.background='var(--bg-primary)'"
           onclick="selectDevice('${dev.name}', '${dev.displayName}')">
        <div style="font-weight: 700; color: var(--text-primary);">${dev.displayName}</div>
        <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 4px;">
          ${dev.specs.eegChannels}ch EEG @ ${dev.specs.eegSampleRate}Hz
          ${dev.specs.hasPPG ? " | PPG" : ""}
          ${dev.specs.hasMotion ? " | Motion" : ""}
          ${dev.specs.hasfNIRS ? " | fNIRS" : ""}
        </div>
      </div>
    `,
    )
    .join("")
}

function selectDevice(deviceName, displayName) {
  console.log(`✓ Selected device: ${displayName}`)
  state.deviceName = displayName
  updateStatusDisplay()
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "select_device", name: deviceName }))
    console.log(`📡 Sent select_device to server`)
  }
}

function updateStatusDisplay() {
  // Device name
  const deviceNameEl = document.getElementById("deviceNameDisplay")
  if (deviceNameEl) {
    deviceNameEl.textContent = state.deviceName || "—"
  }

  // Device status
  const deviceStatusEl = document.getElementById("deviceStatusDisplay")
  if (deviceStatusEl) {
    if (state.deviceName) {
      deviceStatusEl.textContent = "✓ Connected"
      deviceStatusEl.style.color = "var(--success)"
    } else {
      deviceStatusEl.textContent = "⚠ Not connected"
      deviceStatusEl.style.color = "var(--warning)"
    }
  }

  // Packet count
  const packetEl = document.getElementById("packetDisplay")
  if (packetEl) {
    packetEl.textContent = `EEG: ${state.packetCount} pk`
  }

  // Band powers
  const bandEl = document.getElementById("bandDisplay")
  if (bandEl) {
    const alpha = (state.bandPowers?.relative?.alpha || 0).toFixed(2)
    const beta = (state.bandPowers?.relative?.beta || 0).toFixed(2)
    bandEl.textContent = `α: ${alpha} | β: ${beta}`
  }

  // Last update time
  const lastUpdateEl = document.getElementById("lastUpdateDisplay")
  if (lastUpdateEl && state.lastUpdateTime) {
    lastUpdateEl.textContent = new Date(state.lastUpdateTime).toLocaleTimeString()
  }

  // Pulse effect on EEG indicator
  const pulse = document.getElementById("eegPulse")
  if (pulse && state.packetCount > 0) {
    pulse.style.background = "#00ff88"
    pulse.style.boxShadow = "0 0 8px #00ff88"
    setTimeout(() => {
      pulse.style.background = "#ff4444"
      pulse.style.boxShadow = "none"
    }, 200)
  }
}

function handleEEGData(msg) {
  const channels = ["AF7", "AF8", "TP9", "TP10"]
  channels.forEach((ch, i) => {
    if (!state.eegData[ch]) state.eegData[ch] = []
    state.eegData[ch].push(msg.raw[i])
    if (state.eegData[ch].length > 512) state.eegData[ch].shift()
  })

  // Update packet count and last update time
  state.packetCount++
  state.lastUpdateTime = Date.now()
  updateStatusDisplay()

  // Log data streaming
  if (msg.raw) {
    // Throttle logging to every 10th message
    if (!window._eegLogCount) window._eegLogCount = 0
    window._eegLogCount++
    if (window._eegLogCount % 10 === 0) {
      console.log(`📊 EEG streaming: ${msg.raw.map((v) => v.toFixed(1)).join(", ")} µV`)
    }
  }
}

// ============================================================================
// Control Setup
// ============================================================================

function setupControls() {
  // Simulator toggle - SEND MESSAGE TO SERVER
  document.getElementById("simulatorToggle")?.addEventListener("change", (e) => {
    const shouldBeOn = e.target.checked

    // Tell server to toggle simulator
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.error("❌ WebSocket not connected! Cannot toggle simulator")
      alert("❌ WebSocket not connected. Please refresh the page.")
      e.target.checked = !shouldBeOn
      return
    }

    ws.send(JSON.stringify({ type: "toggle_simulator" }))
    console.log(`📡 Sent toggle_simulator (should be ${shouldBeOn ? "ON" : "OFF"})`)

    // Update UI
    state.simulator = shouldBeOn
    const controls = document.getElementById("simControls")
    if (controls) controls.style.display = shouldBeOn ? "block" : "none"
    const label = document.getElementById("simLabel")
    if (label) label.textContent = shouldBeOn ? "Sim" : "Live"
  })

  // EEG scaling sliders
  for (let i = 1; i <= 4; i++) {
    const slider = document.getElementById(`eegScale${i}`)
    const display = document.getElementById(`scale${i}Display`)
    slider?.addEventListener("input", (e) => {
      if (display) display.textContent = e.target.value + "%"
    })
  }

  // Recording button
  document.getElementById("recordBtn")?.addEventListener("click", toggleRecording)
  document.getElementById("downloadBtn")?.addEventListener("click", downloadRecording)
}

function toggleRecording() {
  state.recording = !state.recording
  const btn = document.getElementById("recordBtn")
  if (btn) {
    btn.textContent = state.recording ? "Stop Recording" : "Start Recording"
    btn.style.background = state.recording ? "var(--danger)" : "var(--success)"
  }
}

function downloadRecording() {
  if (state.recordedData.length === 0) {
    alert("No data to download")
    return
  }
  const csv = generateCSV(state.recordedData)
  const blob = new Blob([csv], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `eeg-session-${new Date().toISOString().slice(0, 19)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function generateCSV(data) {
  if (data.length === 0) return ""
  const headers = Object.keys(data[0])
  const rows = data.map((row) => headers.map((h) => row[h]).join(","))
  return [headers.join(","), ...rows].join("\n")
}

// ============================================================================
// Status Indicators
// ============================================================================

function updateStatus(id, isActive) {
  const el = document.getElementById(id)
  if (el) {
    const dot = el.querySelector(".dot")
    if (dot) {
      dot.style.background = isActive ? "var(--success)" : "var(--warning)"
    }
  }
}

// ============================================================================
// Continuous Rendering Loop
// ============================================================================

let animationFrameId = null

function renderLoop() {
  // Re-render current display based on latest data
  const content = document.getElementById("displayContent")
  if (!content) {
    animationFrameId = requestAnimationFrame(renderLoop)
    return
  }

  // Re-render specific displays that update frequently
  switch (state.currentView) {
    case "timeline":
      const tlCanvas = content.querySelector("canvas")
      if (tlCanvas) drawPowerBars(tlCanvas)
      break
    case "phase":
      const phaseCanvas = content.querySelector("canvas")
      if (phaseCanvas) drawPhaseVisualization(phaseCanvas.getContext("2d"), phaseCanvas.width, phaseCanvas.height)
      break
    case "quadview":
      // Update all 4 panes based on their selected displays
      Object.keys(state.paneViews).forEach((paneId) => {
        const displayType = state.paneViews[paneId]
        const paneContent = document.getElementById(`${paneId}-content`)
        if (!paneContent) return

        // Render pane-specific content based on display type
        drawDisplayContent(paneContent, displayType)
      })
      break
    case "debug":
      // Update debug display
      break
  }

  animationFrameId = requestAnimationFrame(renderLoop)
}

// ============================================================================
// Initialization
// ============================================================================

document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 Initializing Muse EEG Neuro Dashboard (NeuroVis Style)")

  // Fetch server settings to sync simulator state
  fetch("/api/settings")
    .then((r) => r.json())
    .then((settings) => {
      state.simulator = settings.simulatorMode || false
      const checkbox = document.getElementById("simulatorToggle")
      if (checkbox) checkbox.checked = state.simulator
      const label = document.getElementById("simLabel")
      if (label) label.textContent = state.simulator ? "Sim" : "Live"
      console.log(`📡 Server simulator: ${state.simulator ? "ON" : "OFF"}`)
    })
    .catch((e) => console.error("❌ Failed to fetch settings:", e))

  setupSelectors()
  setupControls()
  setupWebSocket()
  updateDisplay()

  // Start continuous rendering loop
  renderLoop()
})
