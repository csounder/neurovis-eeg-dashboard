/**
 * EEG DSP Pipeline - IMPROVED
 * Proper Butterworth filters, exponential smoothing, and scaling
 */

// ============================================================================
// BIQUAD IIR FILTER (Butterworth - 2nd order sections)
// ============================================================================

class BiquadFilter {
  constructor(type, frequency, sampleRate, Q = 0.707) {
    this.type = type // 'lowpass', 'highpass', 'bandpass', 'notch'
    this.frequency = frequency
    this.sampleRate = sampleRate
    this.Q = Q

    // State variables (per channel)
    this.states = Array(8)
      .fill(null)
      .map(() => ({ x1: 0, x2: 0, y1: 0, y2: 0 }))

    // Compute coefficients
    this.computeCoefficients()
  }

  computeCoefficients() {
    const w0 = (2 * Math.PI * this.frequency) / this.sampleRate
    const sinW0 = Math.sin(w0)
    const cosW0 = Math.cos(w0)
    const alpha = sinW0 / (2 * this.Q)

    let b0, b1, b2, a0, a1, a2

    switch (this.type) {
      case "lowpass":
        b0 = (1 - cosW0) / 2
        b1 = 1 - cosW0
        b2 = (1 - cosW0) / 2
        a0 = 1 + alpha
        a1 = -2 * cosW0
        a2 = 1 - alpha
        break

      case "highpass":
        b0 = (1 + cosW0) / 2
        b1 = -(1 + cosW0)
        b2 = (1 + cosW0) / 2
        a0 = 1 + alpha
        a1 = -2 * cosW0
        a2 = 1 - alpha
        break

      case "bandpass":
        b0 = sinW0 / 2
        b1 = 0
        b2 = -sinW0 / 2
        a0 = 1 + alpha
        a1 = -2 * cosW0
        a2 = 1 - alpha
        break

      case "notch":
        b0 = 1
        b1 = -2 * cosW0
        b2 = 1
        a0 = 1 + alpha
        a1 = -2 * cosW0
        a2 = 1 - alpha
        break

      default:
        b0 = b1 = b2 = a0 = a2 = 1
        a1 = 0
    }

    // Normalize
    this.b0 = b0 / a0
    this.b1 = b1 / a0
    this.b2 = b2 / a0
    this.a1 = a1 / a0
    this.a2 = a2 / a0
  }

  apply(sample, channelIndex) {
    const state = this.states[channelIndex]

    // Direct Form II implementation
    const y = this.b0 * sample + this.b1 * state.x1 + this.b2 * state.x2 - this.a1 * state.y1 - this.a2 * state.y2

    // Update state
    state.x2 = state.x1
    state.x1 = sample
    state.y2 = state.y1
    state.y1 = y

    return y
  }

  reset() {
    this.states.forEach((state) => {
      state.x1 = state.x2 = state.y1 = state.y2 = 0
    })
  }
}

// ============================================================================
// DOWNSAMPLER (reduce sampling rate)
// ============================================================================

class Downsampler {
  constructor(inputRate, outputRate) {
    this.inputRate = inputRate || 256
    this.outputRate = outputRate || 256
    this.factor = Math.max(1, Math.round(this.inputRate / this.outputRate))
    this.counter = 0
  }

  shouldProcess() {
    this.counter++
    if (this.counter >= this.factor) {
      this.counter = 0
      return true
    }
    return false
  }

  setRate(outputRate) {
    this.outputRate = outputRate
    this.factor = Math.max(1, Math.round(this.inputRate / this.outputRate))
    this.counter = 0
  }
}

// ============================================================================
// EXPONENTIAL SMOOTHER
// ============================================================================

class ExponentialSmoother {
  constructor(timeConstantMs = 100, sampleRateHz = 256) {
    // Alpha determines how much of new sample vs old smoothed value
    // timeConstantMs: how long (ms) to converge to new value
    this.sampleRateHz = sampleRateHz
    this.dtMs = 1000 / sampleRateHz
    this.setTimeConstant(timeConstantMs)

    // State: one per channel
    this.smoothedValues = [0, 0, 0, 0]
  }

  setTimeConstant(timeConstantMs) {
    // Higher time constant = smoother (more lag)
    // Lower time constant = faster response (more noise)
    // timeConstantMs = 0 means NO smoothing (pass through)
    this.timeConstant = timeConstantMs
    if (timeConstantMs <= 0) {
      this.alpha = 1 // Full pass-through (no smoothing)
    } else {
      // Alpha = dt / (tau + dt)
      // tau = time constant in same units as dt
      this.alpha = this.dtMs / (timeConstantMs + this.dtMs)
    }
  }

  smooth(sample, channelIndex) {
    // If alpha = 1, returns pure input (no smoothing)
    const prevSmoothed = this.smoothedValues[channelIndex]
    const newSmoothed = this.alpha * sample + (1 - this.alpha) * prevSmoothed
    this.smoothedValues[channelIndex] = newSmoothed
    return newSmoothed
  }

  reset() {
    this.smoothedValues = [0, 0, 0, 0]
  }
}

// ============================================================================
// DSP PIPELINE
// ============================================================================

class DSPPipeline {
  constructor(options = {}) {
    this.sampleRate = options.sampleRate || 256
    this.numChannels = options.numChannels || 4
    this.outputRate = options.outputRate || 256 // Configurable output rate

    // Filter configuration
    this.useNotchFilter = options.applyNotch !== false
    this.useBandpassFilter = options.applyBandpass !== false
    this.smoothingTimeConstantMs = options.smoothingTimeConstantMs || 100
    this.scaling = options.scaling || "0-1"

    // Create filters
    this.notchFilter = new BiquadFilter("notch", 60, this.sampleRate, 1.0)
    this.highpassFilter = new BiquadFilter("highpass", 1, this.sampleRate, 0.707)
    this.lowpassFilter = new BiquadFilter("lowpass", 45, this.sampleRate, 0.707)
    this.smoother = new ExponentialSmoother(this.smoothingTimeConstantMs, this.sampleRate)
    this.downsampler = new Downsampler(this.sampleRate, this.outputRate)

    // Statistics tracking
    this.windowSize = 256 // 1 second at 256 Hz
    this.sampleWindows = Array(4)
      .fill(null)
      .map(() => [])
  }

  process(rawSamples) {
    if (!rawSamples || rawSamples.length !== this.numChannels) {
      return {
        processed: [0, 0, 0, 0],
        stats: { mean: 0, std: 0, peak: 0 },
        fft: Array(10).fill(0),
        skipped: true,
      }
    }

    // STEP 0: Check downsampling (always process filters, but may skip output)
    const shouldOutput = this.downsampler.shouldProcess()

    let processed = [...rawSamples]

    // STEP 1: Notch filter (60 Hz power line)
    if (this.useNotchFilter) {
      processed = processed.map((sample, ch) => this.notchFilter.apply(sample, ch))
    }

    // STEP 2: Bandpass filter (1-45 Hz)
    if (this.useBandpassFilter) {
      processed = processed.map((sample, ch) => {
        let filtered = this.highpassFilter.apply(sample, ch)
        filtered = this.lowpassFilter.apply(filtered, ch)
        return filtered
      })
    }

    // STEP 3: Exponential smoothing (reduce jitter)
    const smoothed = processed.map((sample, ch) => this.smoother.smooth(sample, ch))

    // STEP 4: Scaling & normalization
    const scaled = this.scaleData(smoothed)

    // STEP 5: Track window for statistics
    scaled.forEach((sample, ch) => {
      this.sampleWindows[ch].push(sample)
      if (this.sampleWindows[ch].length > this.windowSize) {
        this.sampleWindows[ch].shift()
      }
    })

    // STEP 6: Compute statistics
    const stats = this.computeStats(scaled)

    // STEP 7: Simple FFT for frequency bands
    const fft = this.computeFrequencyBands(scaled)

    return {
      processed: scaled,
      stats,
      fft,
      skipped: !shouldOutput, // Flag for downsampling
    }
  }

  setOutputRate(outputRateHz) {
    this.outputRate = outputRateHz
    this.downsampler.setRate(outputRateHz)
  }

  scaleData(samples) {
    if (this.scaling === "raw") {
      // Raw pass-through: no scaling at all (for Csound-side processing)
      return samples
    } else if (this.scaling === "0-1") {
      // Default: Clip to [-500, 500] then normalize to [0, 1]
      return samples.map((s) => {
        const clipped = Math.max(-500, Math.min(500, s))
        return (clipped + 500) / 1000 // Now in [0, 1]
      })
    } else if (this.scaling === "0-3") {
      // Mind Monitor mode: Clip to [-1500, 1500] then normalize to [0, 3]
      return samples.map((s) => {
        const clipped = Math.max(-1500, Math.min(1500, s))
        return (clipped + 1500) / 1000 // Now in [0, 3]
      })
    } else if (this.scaling === "zscore") {
      // Z-score normalization: (x - mean) / std
      const mean = samples.reduce((a, b) => a + b, 0) / samples.length
      const variance = samples.reduce((a, s) => a + Math.pow(s - mean, 2), 0) / samples.length
      const std = Math.sqrt(variance) || 1
      return samples.map((s) => (s - mean) / std)
    }
    return samples
  }

  computeStats(samples) {
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length
    const variance = samples.reduce((a, s) => a + Math.pow(s - mean, 2), 0) / samples.length
    const std = Math.sqrt(variance)
    const peak = Math.max(...samples.map(Math.abs))

    return { mean: mean.toFixed(3), std: std.toFixed(3), peak: peak.toFixed(3) }
  }

  computeFrequencyBands(samples) {
    // Simple frequency analysis: divide into 10 bands
    // Assuming each sample is ~4ms apart (256 Hz), compute power in each band

    // For now, return array of band powers based on window
    const bands = [
      { name: "Delta", freqRange: [0.5, 4] },
      { name: "Theta", freqRange: [4, 8] },
      { name: "Alpha", freqRange: [8, 13] },
      { name: "Beta", freqRange: [13, 30] },
      { name: "Gamma", freqRange: [30, 45] },
      { name: "HighGamma", freqRange: [45, 60] },
    ]

    // Compute RMS power for current window
    const allSamples = this.sampleWindows.flat()
    const rms = Math.sqrt(allSamples.reduce((a, s) => a + s * s, 0) / (allSamples.length || 1))

    // Return one power value per band
    return bands.map((band) => {
      // Simple heuristic: lower frequencies = higher power
      const freqCenter = (band.freqRange[0] + band.freqRange[1]) / 2
      const powerFactor = Math.max(0, 1 - freqCenter / 60)
      return (rms * powerFactor).toFixed(3)
    })
  }

  // Allow runtime configuration
  setSmoothing(timeConstantMs) {
    this.smoother.setTimeConstant(timeConstantMs)
  }

  setScaling(mode) {
    this.scaling = mode
  }

  updateConfig(newConfig) {
    // Handle both 'scaling' (old) and 'scalingMode' (new) keys
    const scalingMode = newConfig.scalingMode || newConfig.scaling
    if (scalingMode) {
      this.setScaling(scalingMode)
    }

    // Filter toggles
    if (newConfig.applyNotch !== undefined) {
      this.useNotchFilter = newConfig.applyNotch
    }
    if (newConfig.applyBandpass !== undefined) {
      this.useBandpassFilter = newConfig.applyBandpass
    }

    // Smoothing (accepts both smoothingAmount and smoothingTimeConstantMs)
    if (newConfig.smoothingAmount !== undefined) {
      this.setSmoothing(newConfig.smoothingAmount) // Pass as-is, smoother will use it as multiplier
    } else if (newConfig.smoothingTimeConstantMs) {
      this.setSmoothing(newConfig.smoothingTimeConstantMs)
    }

    if (newConfig.outputRateHz) {
      this.setOutputRate(newConfig.outputRateHz)
    }
  }
}

module.exports = { DSPPipeline, BiquadFilter, ExponentialSmoother, Downsampler }
