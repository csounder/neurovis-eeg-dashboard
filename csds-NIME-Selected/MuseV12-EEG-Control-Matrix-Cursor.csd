<CsoundSynthesizer>
<CsOptions>
-odac -Ma -d
</CsOptions>
<CsInstruments>

/*
====================================================================
MUSE BRAINWAVE EEG CONTROL MATRIX V12
====================================================================

SENSOR-TO-CHORD MAPPING:
- 10 harmonic palettes (selected by number keys 1-0)
- Each palette has 12 chords (indexed 0-11)
- Harmony uses ABSOLUTE Muse streams only
- Lowercase d/t/a/b selects the harmony band
- The four sensors from the selected band map to the four harmony voices
- V12 adds an EEG assignment matrix, phrase memory, musical response modes,
  and a one-second Mind Monitor dashboard.

V12 EEG CONTROL MATRIX:
=======================
Default musical assignments:
- Harmony selection: lowercase d/t/a/b chooses Delta/Theta/Alpha/Beta.
- Bass driver: Delta.
- Melody driver: Gamma.
- Rhythm/energy driver: Beta.
- Register driver: Alpha.
- Space/rest driver: Theta.

Assignment keys:
- L = cycle bass driver through Delta/Theta/Alpha/Beta/Gamma
- N = cycle melody driver through Delta/Theta/Alpha/Beta/Gamma
- r = cycle rhythm/energy driver through Delta/Theta/Alpha/Beta/Gamma
- e = cycle register driver through Delta/Theta/Alpha/Beta/Gamma
- q = cycle musical response mode:
  0 Smooth: softened chord motion
  1 Stepped: direct quantized chord motion
  2 Rhythmic: pulse-forward chord motion
  3 Dramatic: larger leaps and wider motion
  4 Meditative: narrower, slower harmonic field

PHRASE MEMORY:
==============
Each Muse band tracks a smoothed absolute mean and a trend value.
Positive trend means the stream is rising; negative trend means falling.
These trends shape chord motion, melody density, bass motion, and register.

DASHBOARD:
==========
Press P to print a concise once-per-second dashboard showing:
- current harmony band and harmonic palette
- current EEG assignment matrix
- normalized Muse values and trends
- response mode, orchestra, motion, melody settings
- active chord count and current harmony notes

KEYBOARD CONTROLS:
===================

CHORD PROGRESSION (numbers 1-0):
Select from 10 harmonic palettes

VOICING, MELODY, ORCHESTRATION:
- x = Toggle alternate chord voicings
- M = Toggle melodic line on/off  
- w = Toggle Markov/Brownian mode
- o = Cycle orchestration
- h = Cycle chord motion mode
- m = Cycle melody scale/excursion mode
- c = Cycle melody character
- [ / ] = Move melody register down/up by octave
- z = Toggle CC1 between melody volume and melody complexity

HARMONY BAND SELECTION:
- d/t/a/b = Delta/Theta/Alpha/Beta drives chord-table selection
- g = reminder that Gamma is available to the assignment matrix

VOICE CC MODE TOGGLES:
- D/T/Y/V = toggle CC21/22/23/24 between voice metro and voice volume
- G = toggle CC25 gamma volume mode

MIDI CONTROL:
- CC 1: Melody volume or melody complexity, toggled by z
- CC 21: Delta metro (0.01-40 Hz) OR Delta volume (0-1)
- CC 22: Theta metro (0.01-50 Hz) OR Theta volume (0-1)
- CC 23: Alpha metro (0.01-100 Hz) OR Alpha volume (0-1)
- CC 24: Beta metro (0.01-10 Hz) OR Beta volume (0-1)
- CC 25: Gamma volume mode
- CC 26: Chord range (1-12, default 12)
- CC 27: Global metro scaling
- CC 28: Global volume (0-1, default 0.618)

====================================================================
*/

sr = 44100
ksmps = 100
nchnls = 2
0dbfs = 1.0

seed 0

schedule 1, 0, -1  ; OSC listener
schedule 2, 0, -1  ; Key control
schedule 3, 0, -1  ; Global reverb
schedule 4, 0, -1  ; Global delay
schedule 6, 0.5, -1  ; Melody generator (delayed start, always running, gated by gkMelodyOn)
schedule 8, 0, -1  ; Global chorus
schedule 9, 0, -1  ; Melody delay
schedule 10, 0, -1 ; Bass anchor
schedule 12, 0, -1 ; V12 EEG control dashboard

garvbL init 0
garvbR init 0
gadelL init 0
gadelR init 0
gamelDelL init 0
gamelDelR init 0
gachorusL init 0
gachorusR init 0

massign 1, 5

; ============================================================
; Sensor mode flags (0=metro, 1=volume)
; ============================================================
gkSensor1Mode init 0  ; CC21 Delta mode
gkSensor2Mode init 0  ; CC22 Theta mode
gkSensor3Mode init 0  ; CC23 Alpha mode
gkSensor4Mode init 0  ; CC24 Beta mode
gkSensor5Mode init 0  ; CC25 Gamma mode (0=melody activity, 1=gamma volume)

gkSensor1Vol init 1   ; Sensor volume levels
gkSensor2Vol init 1
gkSensor3Vol init 1
gkSensor4Vol init 1
gkSensor5Vol init 1   ; Gamma volume

; ============================================================
; V10 EXOTIC HARMONIC PALETTES (12 chords x 4 voices)
; 1 Classical, 2 Pop, 3 Jazz, 4 Lydian-Chromatic, 5 Modal,
; 6 Whole Tone, 7 Schoenbergian, 8 Fibonacci, 9 Bohlen-Pierce-ish,
; 0 Partch/Carlos-inspired equal-tempered approximation.
; ============================================================

gi_prog1 ftgen 0, 0, 64, -2, \
    48,60,64,67,55,59,62,67,57,60,64,69,53,57,60,65, \
    50,57,62,65,55,59,62,65,48,60,64,67,45,52,57,60, \
    53,60,65,69,50,57,62,65,55,62,65,71,48,60,64,72

gi_prog2 ftgen 0, 0, 64, -2, \
    48,55,60,64,45,52,57,60,53,60,65,69,55,62,67,71, \
    57,64,69,72,50,57,62,65,53,60,64,69,55,59,62,67, \
    48,55,60,67,45,52,60,64,50,57,62,69,48,55,60,72

gi_prog3 ftgen 0, 0, 64, -2, \
    50,57,60,65,55,59,62,65,48,55,59,64,45,52,55,60, \
    52,59,62,67,57,60,64,69,50,57,60,65,55,59,62,65, \
    48,55,59,64,53,60,64,69,50,57,62,65,48,55,60,64

gi_prog4 ftgen 0, 0, 64, -2, \
    48,55,62,66,50,57,64,71,52,59,66,73,55,62,69,76, \
    53,60,67,74,50,57,64,71,48,55,62,66,43,50,57,64, \
    45,52,59,66,47,54,61,68,50,57,64,71,48,55,62,66

gi_prog5 ftgen 0, 0, 64, -2, \
    50,57,62,65,52,59,64,67,53,60,65,69,55,62,67,70, \
    57,64,69,72,55,62,67,70,53,60,65,69,52,59,64,67, \
    50,57,62,65,48,55,60,64,47,54,59,62,45,52,57,60

gi_prog6 ftgen 0, 0, 64, -2, \
    48,52,56,60,50,54,58,62,52,56,60,64,54,58,62,66, \
    56,60,64,68,58,62,66,70,60,64,68,72,62,66,70,74, \
    64,68,72,76,62,66,70,74,60,64,68,72,58,62,66,70

gi_prog7 ftgen 0, 0, 64, -2, \
    48,49,55,60,51,54,57,63,46,52,58,61,50,53,59,65, \
    47,50,56,62,49,55,60,66,52,58,63,69,45,51,57,64, \
    48,54,59,65,43,49,56,62,46,52,57,63,41,47,54,60

gi_prog8 ftgen 0, 0, 64, -2, \
    48,55,63,70,50,58,65,72,53,60,68,75,55,63,70,77, \
    58,65,72,80,60,68,75,82,63,70,77,84,65,72,80,87, \
    68,75,82,89,70,77,84,92,72,80,87,94,75,82,89,96

gi_prog9 ftgen 0, 0, 64, -2, \
    48,55,62,69,50,57,64,71,53,60,67,74,55,62,69,76, \
    59,66,73,80,62,69,76,83,64,71,78,85,67,74,81,88, \
    69,76,83,90,72,79,86,93,74,81,88,95,76,83,90,97

gi_prog10 ftgen 0, 0, 64, -2, \
    48,52,55,59,51,55,58,62,53,57,60,64,56,60,63,67, \
    58,62,65,69,61,65,68,72,63,67,70,74,66,70,73,77, \
    68,72,75,79,71,75,78,82,73,77,80,84,76,80,83,87

; Alternate open voicings
gi_prog1_alt ftgen 0, 0, 64, -2, \
    36,60,71,79,43,59,69,79,45,60,71,81,41,57,67,77, \
    38,57,69,77,43,59,69,77,36,60,71,79,33,52,64,72, \
    41,60,72,81,38,57,69,77,43,62,72,83,36,60,71,84

gi_prog2_alt ftgen 0, 0, 64, -2, \
    36,55,67,76,33,52,64,72,41,60,72,81,43,62,74,83, \
    45,64,76,84,38,57,69,77,41,60,71,81,43,59,69,79, \
    36,55,67,79,33,52,67,76,38,57,69,81,36,55,67,84

gi_prog3_alt ftgen 0, 0, 64, -2, \
    38,57,67,77,43,59,69,77,36,55,66,76,33,52,62,72, \
    40,59,69,79,45,60,71,81,38,57,67,77,43,59,69,77, \
    36,55,66,76,41,60,71,81,38,57,69,77,36,55,67,76

gi_prog4_alt ftgen 0, 0, 64, -2, \
    36,55,69,78,38,57,71,83,40,59,73,85,43,62,76,88, \
    41,60,74,86,38,57,71,83,36,55,69,78,31,50,64,76, \
    33,52,66,78,35,54,68,80,38,57,71,83,36,55,69,78

gi_prog5_alt ftgen 0, 0, 64, -2, \
    38,57,69,77,40,59,71,79,41,60,72,81,43,62,74,82, \
    45,64,76,84,43,62,74,82,41,60,72,81,40,59,71,79, \
    38,57,69,77,36,55,67,76,35,54,66,74,33,52,64,72

gi_prog6_alt ftgen 0, 0, 64, -2, \
    36,52,63,72,38,54,65,74,40,56,67,76,42,58,69,78, \
    44,60,71,80,46,62,73,82,48,64,75,84,50,66,77,86, \
    52,68,79,88,50,66,77,86,48,64,75,84,46,62,73,82

gi_prog7_alt ftgen 0, 0, 64, -2, \
    36,49,62,72,39,54,64,75,34,52,65,73,38,53,66,77, \
    35,50,63,74,37,55,67,78,40,58,70,81,33,51,64,76, \
    36,54,66,77,31,49,63,74,34,52,64,75,29,47,61,72

gi_prog8_alt ftgen 0, 0, 64, -2, \
    36,55,70,82,38,58,72,84,41,60,75,87,43,63,77,89, \
    46,65,79,92,48,68,82,94,51,70,84,96,53,72,87,99, \
    56,75,89,101,58,77,91,104,60,80,94,106,63,82,96,108

gi_prog9_alt ftgen 0, 0, 64, -2, \
    36,55,69,81,38,57,71,83,41,60,74,86,43,62,76,88, \
    47,66,80,92,50,69,83,95,52,71,85,97,55,74,88,100, \
    57,76,90,102,60,79,93,105,62,81,95,107,64,83,97,109

gi_prog10_alt ftgen 0, 0, 64, -2, \
    36,52,62,71,39,55,65,74,41,57,67,76,44,60,70,79, \
    46,62,72,81,49,65,75,84,51,67,77,86,54,70,80,89, \
    56,72,82,91,59,75,85,94,61,77,87,96,64,80,90,99

; Markov transition table
gi_markov ftgen 0, 0, 64, -2, \
    0.1,0.3,0.2,0.1,0.2,0.05,0.05,0.0,  \
    0.2,0.1,0.3,0.2,0.1,0.1,0.0,0.0,    \
    0.15,0.25,0.1,0.25,0.15,0.1,0.0,0.0, \
    0.1,0.2,0.25,0.1,0.25,0.1,0.0,0.0,   \
    0.25,0.15,0.15,0.25,0.1,0.1,0.0,0.0, \
    0.1,0.2,0.1,0.15,0.3,0.1,0.05,0.0,   \
    0.05,0.1,0.1,0.1,0.2,0.3,0.15,0.0,   \
    0.3,0.2,0.15,0.15,0.1,0.05,0.05,0.0

; Jazz scales
gi_major_scale ftgen 0, 0, 8, -2, 0, 2, 4, 5, 7, 9, 11, 12
gi_dorian_scale ftgen 0, 0, 8, -2, 0, 2, 3, 5, 7, 9, 10, 12
gi_mixolydian_scale ftgen 0, 0, 8, -2, 0, 2, 4, 5, 7, 9, 10, 12
gi_locrian_scale ftgen 0, 0, 8, -2, 0, 1, 3, 5, 6, 8, 10, 12
gi_lydian_scale ftgen 0, 0, 8, -2, 0, 2, 4, 6, 7, 9, 11, 12
gi_minor_pent_scale ftgen 0, 0, 8, -2, 0, 3, 5, 7, 10, 12, 15, 17
gi_chromatic_scale ftgen 0, 0, 8, -2, -1, 0, 1, 3, 5, 7, 10, 12

; ============================================================
; Global variables - PROPERLY INITIALIZED
; ============================================================
gkCurrentProgression init 1
gkChordRange init 12
gkAlternateVoicing init 0
gkOrchestraMode init 0      ; 0=current, 1=glass/additive, 2=dark hybrid
gkHarmonyMotionMode init 0  ; 0=block, 1=arpeggio/stride, 2=slow glide
gkMelodyOn init 0
gkMelodyMode init 0
gkMelodyActivity init 0.3
gkMelodyRateMult init 0.5
gkMelodyScaleMode init 1    ; 0=chord/pent, 1=dorian, 2=lydian, 3=mixolydian, 4=chromatic
gkMelodyCharacter init 1    ; 0=mellow/languid, 1=balanced, 2=dramatic/frenetic
gkMelodyRegister init 12    ; semitone offset above chord root
gkMelodyCC1Mode init 0      ; 0=melody volume, 1=melody complexity
gkMelodyVolume init 0.7
gkMelodyComplexity init 0.35
gkActiveChordNotes init 0
gkCurrentChord init 0
gkHarmNote1 init 48
gkHarmNote2 init 60
gkHarmNote3 init 64
gkHarmNote4 init 67
gkBassNote init 36
gkBassDrive init 0.4
gkBassDriver init 0        ; 0=delta, 1=theta, 2=alpha, 3=beta, 4=gamma
gkMelodyDriver init 4      ; default gamma
gkRhythmDriver init 3      ; default beta
gkRegisterDriver init 2    ; default alpha
gkResponseMode init 1      ; 0=smooth, 1=stepped, 2=rhythmic, 3=dramatic, 4=meditative
gkDeltaNorm init 0
gkThetaNorm init 0
gkAlphaNorm init 0
gkBetaNorm init 0
gkGammaNorm init 0
gkDeltaTrend init 0
gkThetaTrend init 0
gkAlphaTrend init 0
gkBetaTrend init 0
gkGammaTrend init 0
gkLastScaleDegree init 0
gkPhraseLength init 4
gkPhraseRest init 0
gkBandSelect init 2      ; 0=delta, 1=theta, 2=alpha, 3=beta, 4=gamma

; Brainwave bands (all initialized)
gkDeltaAbs1 init 0
gkDeltaAbs2 init 0
gkDeltaAbs3 init 0
gkDeltaAbs4 init 0

gkThetaAbs1 init 0
gkThetaAbs2 init 0
gkThetaAbs3 init 0
gkThetaAbs4 init 0

gkAlphaAbs1 init 0
gkAlphaAbs2 init 0
gkAlphaAbs3 init 0
gkAlphaAbs4 init 0

gkBetaAbs1 init 0
gkBetaAbs2 init 0
gkBetaAbs3 init 0
gkBetaAbs4 init 0

gkGammaAbs1 init 0
gkGammaAbs2 init 0
gkGammaAbs3 init 0
gkGammaAbs4 init 0

gkDeltaRel1 init 0
gkDeltaRel2 init 0
gkDeltaRel3 init 0
gkDeltaRel4 init 0

gkThetaRel1 init 0
gkThetaRel2 init 0
gkThetaRel3 init 0
gkThetaRel4 init 0

gkAlphaRel1 init 0
gkAlphaRel2 init 0
gkAlphaRel3 init 0
gkAlphaRel4 init 0

gkBetaRel1 init 0
gkBetaRel2 init 0
gkBetaRel3 init 0
gkBetaRel4 init 0

gkGammaRel1 init 0
gkGammaRel2 init 0
gkGammaRel3 init 0
gkGammaRel4 init 0

gkPlaybackMode init 1       ; ABSOLUTE-only performance path

; CRITICAL: Volume and melody MUST be initialized!
gkGlobalVolume init 0.618
gkGlobalVolumeSmooth init 0.618
gkMetroScale init 0.25
gkMelodyActivity init 0.5
gkChordRange init 12
gkPrintToggle init 0


instr 1  ; OSC listener and relative value calculator

	gihandle OSCinit 7400

	kk1 OSClisten gihandle, "/muse/elements/delta_absolute", "ffff", gkDeltaAbs1, gkDeltaAbs2, gkDeltaAbs3, gkDeltaAbs4
	kk2 OSClisten gihandle, "/muse/elements/theta_absolute", "ffff", gkThetaAbs1, gkThetaAbs2, gkThetaAbs3, gkThetaAbs4
	kk3 OSClisten gihandle, "/muse/elements/alpha_absolute", "ffff", gkAlphaAbs1, gkAlphaAbs2, gkAlphaAbs3, gkAlphaAbs4
	kk4 OSClisten gihandle, "/muse/elements/beta_absolute", "ffff", gkBetaAbs1, gkBetaAbs2, gkBetaAbs3, gkBetaAbs4
	kk5 OSClisten gihandle, "/muse/elements/gamma_absolute", "ffff", gkGammaAbs1, gkGammaAbs2, gkGammaAbs3, gkGammaAbs4
	
	; Detect if OSC data is being received
	kOSCDataSum = abs(gkDeltaAbs1) + abs(gkThetaAbs1) + abs(gkAlphaAbs1) + abs(gkBetaAbs1)
	kOSCPrintOnce init 1
	if kOSCPrintOnce == 1 then
		if kOSCDataSum > 0.01 then
			printks ">>> OSC DATA RECEIVED! Mind Monitor connected.\n", 0
			kOSCPrintOnce = 0
		endif
	endif
	
	; Calculate relative values from absolute
	kDelta1Lin = pow(10, gkDeltaAbs1)
	kTheta1Lin = pow(10, gkThetaAbs1)
	kAlpha1Lin = pow(10, gkAlphaAbs1)
	kBeta1Lin = pow(10, gkBetaAbs1)
	kGamma1Lin = pow(10, gkGammaAbs1)
	kSum1 = kDelta1Lin + kTheta1Lin + kAlpha1Lin + kBeta1Lin + kGamma1Lin + 0.0001
	gkDeltaRel1 = kDelta1Lin / kSum1
	gkThetaRel1 = kTheta1Lin / kSum1
	gkAlphaRel1 = kAlpha1Lin / kSum1
	gkBetaRel1 = kBeta1Lin / kSum1
	gkGammaRel1 = kGamma1Lin / kSum1

	kDelta2Lin = pow(10, gkDeltaAbs2)
	kTheta2Lin = pow(10, gkThetaAbs2)
	kAlpha2Lin = pow(10, gkAlphaAbs2)
	kBeta2Lin = pow(10, gkBetaAbs2)
	kGamma2Lin = pow(10, gkGammaAbs2)
	kSum2 = kDelta2Lin + kTheta2Lin + kAlpha2Lin + kBeta2Lin + kGamma2Lin + 0.0001
	gkDeltaRel2 = kDelta2Lin / kSum2
	gkThetaRel2 = kTheta2Lin / kSum2
	gkAlphaRel2 = kAlpha2Lin / kSum2
	gkBetaRel2 = kBeta2Lin / kSum2
	gkGammaRel2 = kGamma2Lin / kSum2

	kDelta3Lin = pow(10, gkDeltaAbs3)
	kTheta3Lin = pow(10, gkThetaAbs3)
	kAlpha3Lin = pow(10, gkAlphaAbs3)
	kBeta3Lin = pow(10, gkBetaAbs3)
	kGamma3Lin = pow(10, gkGammaAbs3)
	kSum3 = kDelta3Lin + kTheta3Lin + kAlpha3Lin + kBeta3Lin + kGamma3Lin + 0.0001
	gkDeltaRel3 = kDelta3Lin / kSum3
	gkThetaRel3 = kTheta3Lin / kSum3
	gkAlphaRel3 = kAlpha3Lin / kSum3
	gkBetaRel3 = kBeta3Lin / kSum3
	gkGammaRel3 = kGamma3Lin / kSum3

	kDelta4Lin = pow(10, gkDeltaAbs4)
	kTheta4Lin = pow(10, gkThetaAbs4)
	kAlpha4Lin = pow(10, gkAlphaAbs4)
	kBeta4Lin = pow(10, gkBetaAbs4)
	kGamma4Lin = pow(10, gkGammaAbs4)
	kSum4 = kDelta4Lin + kTheta4Lin + kAlpha4Lin + kBeta4Lin + kGamma4Lin + 0.0001
	gkDeltaRel4 = kDelta4Lin / kSum4
	gkThetaRel4 = kTheta4Lin / kSum4
	gkAlphaRel4 = kAlpha4Lin / kSum4
	gkBetaRel4 = kBeta4Lin / kSum4
	gkGammaRel4 = kGamma4Lin / kSum4
	
	; V12 phrase memory and normalized Mind Monitor dashboard values.
	kDeltaMean = (gkDeltaAbs1 + gkDeltaAbs2 + gkDeltaAbs3 + gkDeltaAbs4) / 4
	kThetaMean = (gkThetaAbs1 + gkThetaAbs2 + gkThetaAbs3 + gkThetaAbs4) / 4
	kAlphaMean = (gkAlphaAbs1 + gkAlphaAbs2 + gkAlphaAbs3 + gkAlphaAbs4) / 4
	kBetaMean = (gkBetaAbs1 + gkBetaAbs2 + gkBetaAbs3 + gkBetaAbs4) / 4
	kGammaMean = (gkGammaAbs1 + gkGammaAbs2 + gkGammaAbs3 + gkGammaAbs4) / 4
	kDeltaNorm = limit((kDeltaMean + 2.5) / 4.0, 0, 1)
	kThetaNorm = limit((kThetaMean + 2.5) / 4.0, 0, 1)
	kAlphaNorm = limit((kAlphaMean + 2.5) / 4.0, 0, 1)
	kBetaNorm = limit((kBetaMean + 2.5) / 4.0, 0, 1)
	kGammaNorm = limit((kGammaMean + 2.5) / 4.0, 0, 1)
	kDeltaSmooth portk kDeltaNorm, 0.8
	kThetaSmooth portk kThetaNorm, 0.8
	kAlphaSmooth portk kAlphaNorm, 0.8
	kBetaSmooth portk kBetaNorm, 0.8
	kGammaSmooth portk kGammaNorm, 0.8
	gkDeltaTrend = kDeltaNorm - kDeltaSmooth
	gkThetaTrend = kThetaNorm - kThetaSmooth
	gkAlphaTrend = kAlphaNorm - kAlphaSmooth
	gkBetaTrend = kBetaNorm - kBetaSmooth
	gkGammaTrend = kGammaNorm - kGammaSmooth
	gkDeltaNorm = kDeltaNorm
	gkThetaNorm = kThetaNorm
	gkAlphaNorm = kAlphaNorm
	gkBetaNorm = kBetaNorm
	gkGammaNorm = kGammaNorm

endin


instr 2  ; ASCII key control with sensor mode toggle

	kKey, kKeyDown sensekey
	
	; Number keys for progression
	if kKeyDown == 1 && kKey >= 48 && kKey <= 57 then
		if kKey == 48 then
			gkCurrentProgression = 10
		else
			gkCurrentProgression = kKey - 48
		endif
		printks ">>> Progression %d selected\n", 0, gkCurrentProgression
	endif
	
	; x = Toggle voicing
	if kKeyDown == 1 && kKey == 120 then
		gkAlternateVoicing = (gkAlternateVoicing == 0 ? 1 : 0)
		if gkAlternateVoicing == 0 then
			printks ">>> Voicing: STANDARD close/SATB jazz voicings\n", 0
		else
			printks ">>> Voicing: OPEN JAZZ voicings\n", 0
		endif
	endif
	
	; o = Cycle orchestration
	if kKeyDown == 1 && kKey == 111 then
		gkOrchestraMode = gkOrchestraMode + 1
		if gkOrchestraMode > 2 then
			gkOrchestraMode = 0
		endif
		printks ">>> Orchestra: %s\n", 0, (gkOrchestraMode == 0 ? "Classic Sine Ensemble" : (gkOrchestraMode == 1 ? "Glass Additive" : "Dark Hybrid"))
	endif
	
	; h = Cycle harmony motion
	if kKeyDown == 1 && kKey == 104 then
		gkHarmonyMotionMode = gkHarmonyMotionMode + 1
		if gkHarmonyMotionMode > 2 then
			gkHarmonyMotionMode = 0
		endif
		printks ">>> Harmony Motion: %s\n", 0, (gkHarmonyMotionMode == 0 ? "Block" : (gkHarmonyMotionMode == 1 ? "Arpeggio/Stride" : "Slow Glide"))
	endif
	
	; q = Cycle V12 musical response mode
	if kKeyDown == 1 && kKey == 113 then
		gkResponseMode = gkResponseMode + 1
		if gkResponseMode > 4 then
			gkResponseMode = 0
		endif
		printks ">>> V12 Response: %s\n", 0, (gkResponseMode == 0 ? "Smooth" : (gkResponseMode == 1 ? "Stepped" : (gkResponseMode == 2 ? "Rhythmic" : (gkResponseMode == 3 ? "Dramatic" : "Meditative"))))
	endif
	
	; L/N/r/e cycle EEG assignment matrix drivers.
	if kKeyDown == 1 && kKey == 76 then
		gkBassDriver = gkBassDriver + 1
		if gkBassDriver > 4 then
			gkBassDriver = 0
		endif
		printks ">>> Bass EEG Driver: %s\n", 0, (gkBassDriver == 0 ? "Delta" : (gkBassDriver == 1 ? "Theta" : (gkBassDriver == 2 ? "Alpha" : (gkBassDriver == 3 ? "Beta" : "Gamma"))))
	endif
	if kKeyDown == 1 && kKey == 78 then
		gkMelodyDriver = gkMelodyDriver + 1
		if gkMelodyDriver > 4 then
			gkMelodyDriver = 0
		endif
		printks ">>> Melody EEG Driver: %s\n", 0, (gkMelodyDriver == 0 ? "Delta" : (gkMelodyDriver == 1 ? "Theta" : (gkMelodyDriver == 2 ? "Alpha" : (gkMelodyDriver == 3 ? "Beta" : "Gamma"))))
	endif
	if kKeyDown == 1 && kKey == 114 then
		gkRhythmDriver = gkRhythmDriver + 1
		if gkRhythmDriver > 4 then
			gkRhythmDriver = 0
		endif
		printks ">>> Rhythm/Energy EEG Driver: %s\n", 0, (gkRhythmDriver == 0 ? "Delta" : (gkRhythmDriver == 1 ? "Theta" : (gkRhythmDriver == 2 ? "Alpha" : (gkRhythmDriver == 3 ? "Beta" : "Gamma"))))
	endif
	if kKeyDown == 1 && kKey == 101 then
		gkRegisterDriver = gkRegisterDriver + 1
		if gkRegisterDriver > 4 then
			gkRegisterDriver = 0
		endif
		printks ">>> Register EEG Driver: %s\n", 0, (gkRegisterDriver == 0 ? "Delta" : (gkRegisterDriver == 1 ? "Theta" : (gkRegisterDriver == 2 ? "Alpha" : (gkRegisterDriver == 3 ? "Beta" : "Gamma"))))
	endif
	
	; M = Toggle melody
	if kKeyDown == 1 && kKey == 77 then
		gkMelodyOn = (gkMelodyOn == 0 ? 1 : 0)
		if gkMelodyOn == 1 then
			printks ">>> Melody: ON (assignment matrix controls activity)\n", 0
		else
			printks ">>> Melody: OFF\n", 0
		endif
	endif
	
	; w = Toggle Markov/Brownian
	if kKeyDown == 1 && kKey == 119 then
		gkMelodyMode = (gkMelodyMode == 0 ? 1 : 0)
		printks ">>> Melody Mode: %s\n", 0, (gkMelodyMode == 0 ? "Markov" : "Brownian")
	endif
	
	; z = Toggle CC1 assignment for melody
	if kKeyDown == 1 && kKey == 122 then
		gkMelodyCC1Mode = (gkMelodyCC1Mode == 0 ? 1 : 0)
		printks ">>> CC1 Melody Control: %s\n", 0, (gkMelodyCC1Mode == 0 ? "VOLUME BALANCE" : "COMPLEXITY/RATE")
	endif
	
	; m = Cycle melodic scale/excursion mode
	if kKeyDown == 1 && kKey == 109 then
		gkMelodyScaleMode = gkMelodyScaleMode + 1
		if gkMelodyScaleMode > 4 then
			gkMelodyScaleMode = 0
		endif
		printks ">>> Melody Scale: %s\n", 0, (gkMelodyScaleMode == 0 ? "Chord/Pentatonic" : (gkMelodyScaleMode == 1 ? "Dorian" : (gkMelodyScaleMode == 2 ? "Lydian" : (gkMelodyScaleMode == 3 ? "Mixolydian" : "Chromatic Excursions"))))
	endif
	
	; c = Cycle melody character
	if kKeyDown == 1 && kKey == 99 then
		gkMelodyCharacter = gkMelodyCharacter + 1
		if gkMelodyCharacter > 2 then
			gkMelodyCharacter = 0
		endif
		printks ">>> Melody Character: %s\n", 0, (gkMelodyCharacter == 0 ? "Mellow/Languid" : (gkMelodyCharacter == 1 ? "Balanced" : "Dramatic/Frenetic"))
	endif
	
	; [ and ] transpose the melody register by octaves
	if kKeyDown == 1 && kKey == 91 then
		gkMelodyRegister = limit(gkMelodyRegister - 12, -12, 36)
		printks ">>> Melody Register: %+d semitones\n", 0, gkMelodyRegister
	endif
	if kKeyDown == 1 && kKey == 93 then
		gkMelodyRegister = limit(gkMelodyRegister + 12, -12, 36)
		printks ">>> Melody Register: %+d semitones\n", 0, gkMelodyRegister
	endif
	
	; P = Print toggle
	if kKeyDown == 1 && (kKey == 112 || kKey == 80) then
		gkPrintToggle = (gkPrintToggle == 0 ? 1 : 0)
		printks ">>> Print: %s\n", 0, (gkPrintToggle == 0 ? "OFF" : "ON")
	endif
	
	; A = Absolute mode reminder. Relative/Both modes are intentionally disabled.
	if kKeyDown == 1 && kKey == 65 then
		gkPlaybackMode = 1
		printks ">>> Mode: ABSOLUTE only\n", 0
	endif
	
	; ============================================================
	; BAND SELECTION (lowercase d/t/a/b). Gamma is reserved for melody.
	; ============================================================
	if kKeyDown == 1 && kKey == 100 then
		gkBandSelect = 0
		printks ">>> Band selected: DELTA\n", 0
	endif
	if kKeyDown == 1 && kKey == 116 then
		gkBandSelect = 1
		printks ">>> Band selected: THETA\n", 0
	endif
	if kKeyDown == 1 && kKey == 97 then
		gkBandSelect = 2
		printks ">>> Band selected: ALPHA\n", 0
	endif
	if kKeyDown == 1 && kKey == 98 then
		gkBandSelect = 3
		printks ">>> Band selected: BETA\n", 0
	endif
	if kKeyDown == 1 && kKey == 103 then
		printks ">>> Gamma absolute data is reserved for melody activity\n", 0
	endif
	
	; ============================================================
	; CC MODE TOGGLES (uppercase D/T/A/B/G)
	; ============================================================
	
	; D = Toggle CC21 mode (Voice 1)
	if kKeyDown == 1 && kKey == 68 then
		gkSensor1Mode = (gkSensor1Mode == 0 ? 1 : 0)
		printks ">>> CC21 Voice 1: %s mode\n", 0, (gkSensor1Mode == 0 ? "METRO" : "VOLUME")
	endif
	
	; T = Toggle CC22 mode (Voice 2)
	if kKeyDown == 1 && kKey == 84 then
		gkSensor2Mode = (gkSensor2Mode == 0 ? 1 : 0)
		printks ">>> CC22 Voice 2: %s mode\n", 0, (gkSensor2Mode == 0 ? "METRO" : "VOLUME")
	endif
	
	; A is already absolute playback, so use Y for CC23 Voice 3 mode.
	if kKeyDown == 1 && kKey == 89 then
		gkSensor3Mode = (gkSensor3Mode == 0 ? 1 : 0)
		printks ">>> CC23 Voice 3: %s mode\n", 0, (gkSensor3Mode == 0 ? "METRO" : "VOLUME")
	endif
	
	; B is already both playback, so use V for CC24 Voice 4 mode.
	if kKeyDown == 1 && kKey == 86 then
		gkSensor4Mode = (gkSensor4Mode == 0 ? 1 : 0)
		printks ">>> CC24 Voice 4: %s mode\n", 0, (gkSensor4Mode == 0 ? "METRO" : "VOLUME")
	endif
	
	; G = Toggle CC25 mode (Gamma)
	if kKeyDown == 1 && kKey == 71 then
		gkSensor5Mode = (gkSensor5Mode == 0 ? 1 : 0)
		printks ">>> CC25 Gamma: %s mode\n", 0, (gkSensor5Mode == 0 ? "MELODY ACTIVITY" : "GAMMA VOLUME")
	endif

	; Legacy lowercase key toggles removed: lowercase keys now select EEG bands.
	if 0 == 1 then
	; d = Toggle CC21 mode (Delta)
	if kKeyDown == 1 && kKey == 100 then
		gkSensor1Mode = (gkSensor1Mode == 0 ? 1 : 0)
		printks ">>> CC21 Delta: %s mode\n", 0, (gkSensor1Mode == 0 ? "METRO" : "VOLUME")
	endif
	
	; t = Toggle CC22 mode (Theta)
	if kKeyDown == 1 && kKey == 116 then
		gkSensor2Mode = (gkSensor2Mode == 0 ? 1 : 0)
		printks ">>> CC22 Theta: %s mode\n", 0, (gkSensor2Mode == 0 ? "METRO" : "VOLUME")
	endif
	
	; a = Toggle CC23 mode (Alpha)
	if kKeyDown == 1 && kKey == 97 then
		gkSensor3Mode = (gkSensor3Mode == 0 ? 1 : 0)
		printks ">>> CC23 Alpha: %s mode\n", 0, (gkSensor3Mode == 0 ? "METRO" : "VOLUME")
	endif
	
	; b = Toggle CC24 mode (Beta)
	if kKeyDown == 1 && kKey == 98 then
		gkSensor4Mode = (gkSensor4Mode == 0 ? 1 : 0)
		printks ">>> CC24 Beta: %s mode\n", 0, (gkSensor4Mode == 0 ? "METRO" : "VOLUME")
	endif
	
	; g = Toggle CC25 mode (Gamma controls melody)
	if kKeyDown == 1 && kKey == 103 then
		gkSensor5Mode = (gkSensor5Mode == 0 ? 1 : 0)
		printks ">>> CC25 Gamma: %s mode\n", 0, (gkSensor5Mode == 0 ? "MELODY ACTIVITY" : "GAMMA VOLUME")
	endif
	endif

endin


instr 5  ; Jazz chord synth with FIXED sensor assignment

	; Initial display on first note
	kFirstNote init 1
	kNoteCounted init 0
	if kNoteCounted == 0 then
		gkActiveChordNotes += 1
		kNoteCounted = 1
	endif

	; ============================================================
	; FIXED SENSOR ASSIGNMENTS - No band switching!
	; Each voice gets its FIXED brainwave band
	; Mode only affects metro vs volume control
	; ============================================================
	
	; Read controller values. Metro defaults are preserved until a CC moves,
	; so MIDI zero does not collapse every metro to its minimum rate.
	kCC21Speed midic7 21, .01, 40
	kCC22Speed midic7 22, .01, 50
	kCC23Speed midic7 23, .01, 100
	kCC24Speed midic7 24, .01, 10
	kCC21Vol midic7 21, 0, 1
	kCC22Vol midic7 22, 0, 1
	kCC23Vol midic7 23, 0, 1
	kCC24Vol midic7 24, 0, 1
	
	kspeed1 init 4
	kspeed2 init 3
	kspeed3 init 2
	kspeed4 init 1
	kLastCC21 init 0
	kLastCC22 init 0
	kLastCC23 init 0
	kLastCC24 init 0
	kCC21Ready init 0
	kCC22Ready init 0
	kCC23Ready init 0
	kCC24Ready init 0
	kLastCC21Vol init 0
	kLastCC22Vol init 0
	kLastCC23Vol init 0
	kLastCC24Vol init 0
	
	; CC21 - Delta controls Voice 1
	if gkSensor1Mode == 0 then
		gkSensor1Vol = 1.0
		if kCC21Ready == 0 then
			kLastCC21 = kCC21Speed
			kLastCC21Vol = kCC21Vol
			kCC21Ready = 1
		elseif kCC21Speed != kLastCC21 then
			kspeed1 = kCC21Speed
			kLastCC21 = kCC21Speed
			kLastCC21Vol = kCC21Vol
			printks ">>> CC21 Voice 1 | metro %.3f Hz raw / %.3f Hz scaled | volume value %.3f (active vol %.3f)\n", 0, kspeed1, kspeed1 * gkMetroScale, kCC21Vol, gkSensor1Vol
		endif
	else
		gkSensor1Vol = kCC21Vol
		kspeed1 = 10
		if kCC21Vol != kLastCC21Vol then
			kLastCC21Vol = kCC21Vol
			kLastCC21 = kCC21Speed
			printks ">>> CC21 Voice 1 | metro value %.3f Hz raw / %.3f Hz scaled | active volume %.3f\n", 0, kCC21Speed, kCC21Speed * gkMetroScale, gkSensor1Vol
		endif
	endif
	
	; CC22 - Theta controls Voice 2
	if gkSensor2Mode == 0 then
		gkSensor2Vol = 1.0
		if kCC22Ready == 0 then
			kLastCC22 = kCC22Speed
			kLastCC22Vol = kCC22Vol
			kCC22Ready = 1
		elseif kCC22Speed != kLastCC22 then
			kspeed2 = kCC22Speed
			kLastCC22 = kCC22Speed
			kLastCC22Vol = kCC22Vol
			printks ">>> CC22 Voice 2 | metro %.3f Hz raw / %.3f Hz scaled | volume value %.3f (active vol %.3f)\n", 0, kspeed2, kspeed2 * gkMetroScale, kCC22Vol, gkSensor2Vol
		endif
	else
		gkSensor2Vol = kCC22Vol
		kspeed2 = 15
		if kCC22Vol != kLastCC22Vol then
			kLastCC22Vol = kCC22Vol
			kLastCC22 = kCC22Speed
			printks ">>> CC22 Voice 2 | metro value %.3f Hz raw / %.3f Hz scaled | active volume %.3f\n", 0, kCC22Speed, kCC22Speed * gkMetroScale, gkSensor2Vol
		endif
	endif
	
	; CC23 - Alpha controls Voice 3
	if gkSensor3Mode == 0 then
		gkSensor3Vol = 1.0
		if kCC23Ready == 0 then
			kLastCC23 = kCC23Speed
			kLastCC23Vol = kCC23Vol
			kCC23Ready = 1
		elseif kCC23Speed != kLastCC23 then
			kspeed3 = kCC23Speed
			kLastCC23 = kCC23Speed
			kLastCC23Vol = kCC23Vol
			printks ">>> CC23 Voice 3 | metro %.3f Hz raw / %.3f Hz scaled | volume value %.3f (active vol %.3f)\n", 0, kspeed3, kspeed3 * gkMetroScale, kCC23Vol, gkSensor3Vol
		endif
	else
		gkSensor3Vol = kCC23Vol
		kspeed3 = 25
		if kCC23Vol != kLastCC23Vol then
			kLastCC23Vol = kCC23Vol
			kLastCC23 = kCC23Speed
			printks ">>> CC23 Voice 3 | metro value %.3f Hz raw / %.3f Hz scaled | active volume %.3f\n", 0, kCC23Speed, kCC23Speed * gkMetroScale, gkSensor3Vol
		endif
	endif
	
	; CC24 - Beta controls Voice 4
	if gkSensor4Mode == 0 then
		gkSensor4Vol = 1.0
		if kCC24Ready == 0 then
			kLastCC24 = kCC24Speed
			kLastCC24Vol = kCC24Vol
			kCC24Ready = 1
		elseif kCC24Speed != kLastCC24 then
			kspeed4 = kCC24Speed
			kLastCC24 = kCC24Speed
			kLastCC24Vol = kCC24Vol
			printks ">>> CC24 Voice 4 | metro %.3f Hz raw / %.3f Hz scaled | volume value %.3f (active vol %.3f)\n", 0, kspeed4, kspeed4 * gkMetroScale, kCC24Vol, gkSensor4Vol
		endif
	else
		gkSensor4Vol = kCC24Vol
		kspeed4 = 5
		if kCC24Vol != kLastCC24Vol then
			kLastCC24Vol = kCC24Vol
			kLastCC24 = kCC24Speed
			printks ">>> CC24 Voice 4 | metro value %.3f Hz raw / %.3f Hz scaled | active volume %.3f\n", 0, kCC24Speed, kCC24Speed * gkMetroScale, gkSensor4Vol
		endif
	endif
	
	; CC25 - optional gamma melody amount trim. Gamma ABS data is the source.
	if gkSensor5Mode == 0 then
		kGammaMean = (gkGammaAbs1 + gkGammaAbs2 + gkGammaAbs3 + gkGammaAbs4) / 4
		gkMelodyActivity = limit((kGammaMean + 2.5) / 4.0, 0, 1)
	else
		gkSensor5Vol midic7 25, 0, 1
		if changed(gkSensor5Vol) == 1 then
			printks ">>> CC25 Gamma volume = %.3f\n", 0, gkSensor5Vol
		endif
	endif
	
	; CC26 - Chord range
	kRangeCC midic7 26, 1, 12
	gkChordRange = int(kRangeCC)
	if changed(gkChordRange) == 1 then
		printks ">>> CC26 Chord range = %d\n", 0, gkChordRange
	endif
	
	; CC27 - Global metro scaling. Default is intentionally slow.
	kMetroCC midic7 27, 0.01, 3
	kLastMetroCC init 0
	kMetroCCReady init 0
	if kMetroCCReady == 0 then
		kLastMetroCC = kMetroCC
		kMetroCCReady = 1
	elseif kMetroCC != kLastMetroCC then
		gkMetroScale = kMetroCC
		kLastMetroCC = kMetroCC
		printks ">>> CC27 Global metro scale = %.3f (x%d%%)\n", 0, gkMetroScale, gkMetroScale * 100
	endif
	
	; CC28 - Global volume. Preserve the .618 default until CC28 is moved.
	kVolCC midic7 28, 0, 1
	kLastVolCC init 0
	kVolCCReady init 0
	if kVolCCReady == 0 then
		kLastVolCC = kVolCC
		kVolCCReady = 1
	elseif kVolCC != kLastVolCC then
		gkGlobalVolume = kVolCC
		kLastVolCC = kVolCC
		printks ">>> CC28 Global volume = %.3f\n", 0, gkGlobalVolume
	endif
	gkGlobalVolumeSmooth portk gkGlobalVolume, 0.05
	
	; V4-style startup display after all defaults and controller latches are ready.
	if kFirstNote == 1 then
		printks "\n>>> V12 - EEG CONTROL MATRIX HARMONIC EXPLORER\n", 0
		printks "    Current Palette: %d (1 Classical, 2 Pop, 3 Jazz, 4 Lydian-Chromatic, 5 Modal, 6 Whole Tone, 7 Schoenbergian, 8 Fibonacci, 9 Bohlen-Pierce-ish, 0 Partch/Carlos-ish)\n", 0, gkCurrentProgression
		printks "    Voicing: %s (press x to toggle)\n", 0, (gkAlternateVoicing == 0 ? "Standard close/SATB" : "Open Jazz")
		printks "    Playback Mode: Absolute Muse streams only\n", 0
		printks "    CC26 Chord Range: %d chords\n", 0, gkChordRange
		printks "    CC27 Global Metro Scale: %.3f (x%d%%)\n", 0, gkMetroScale, gkMetroScale * 100
		printks "    CC28 Global Volume: %.3f\n", 0, gkGlobalVolume
		printks "    Harmony Band: %s\n", 0, (gkBandSelect == 0 ? "Delta" : (gkBandSelect == 1 ? "Theta" : (gkBandSelect == 2 ? "Alpha" : "Beta")))
		printks "    CC21 Voice 1 Metro: %.3f Hz raw / %.3f Hz scaled\n", 0, kspeed1, kspeed1 * gkMetroScale
		printks "    CC22 Voice 2 Metro: %.3f Hz raw / %.3f Hz scaled\n", 0, kspeed2, kspeed2 * gkMetroScale
		printks "    CC23 Voice 3 Metro: %.3f Hz raw / %.3f Hz scaled\n", 0, kspeed3, kspeed3 * gkMetroScale
		printks "    CC24 Voice 4 Metro: %.3f Hz raw / %.3f Hz scaled\n", 0, kspeed4, kspeed4 * gkMetroScale
		printks "    CC21-24 Volume Values: V1 %.3f | V2 %.3f | V3 %.3f | V4 %.3f\n", 0, kCC21Vol, kCC22Vol, kCC23Vol, kCC24Vol
		printks "    Active Voice Volumes: V1 %.3f | V2 %.3f | V3 %.3f | V4 %.3f\n", 0, gkSensor1Vol, gkSensor2Vol, gkSensor3Vol, gkSensor4Vol
		printks "    CC Modes: V1 %s | V2 %s | V3 %s | V4 %s\n", 0, (gkSensor1Mode == 0 ? "METRO" : "VOLUME"), (gkSensor2Mode == 0 ? "METRO" : "VOLUME"), (gkSensor3Mode == 0 ? "METRO" : "VOLUME"), (gkSensor4Mode == 0 ? "METRO" : "VOLUME")
		printks "    Melody driver activity %.3f\n", 0, gkMelodyActivity
		printks "    Melody: scale %s | character %s | register %+d\n", 0, (gkMelodyScaleMode == 0 ? "Chord/Pent" : (gkMelodyScaleMode == 1 ? "Dorian" : (gkMelodyScaleMode == 2 ? "Lydian" : (gkMelodyScaleMode == 3 ? "Mixolydian" : "Chromatic")))), (gkMelodyCharacter == 0 ? "Mellow" : (gkMelodyCharacter == 1 ? "Balanced" : "Frenetic")), gkMelodyRegister
		printks "    Orchestra: %s | Harmony Motion: %s\n", 0, (gkOrchestraMode == 0 ? "Classic Sine" : (gkOrchestraMode == 1 ? "Glass Additive" : "Dark Hybrid")), (gkHarmonyMotionMode == 0 ? "Block" : (gkHarmonyMotionMode == 1 ? "Arpeggio/Stride" : "Slow Glide"))
		printks "    CC1 Melody: %s | volume %.3f | complexity %.3f | toggle with z\n", 0, (gkMelodyCC1Mode == 0 ? "Volume" : "Complexity"), gkMelodyVolume, gkMelodyComplexity
		printks "    Press P for live metro/EEG/chord diagnostics.\n", 0
		kFirstNote = 0
	endif
	
	; Metro triggers with V4-style global scaling and a musical cap.
	; Turning CC21-24 up means faster chord selection, not granular audio.
	kEffSpeed1 = limit(kspeed1 * gkMetroScale, 0.01, 4)
	kEffSpeed2 = limit(kspeed2 * gkMetroScale, 0.01, 4)
	kEffSpeed3 = limit(kspeed3 * gkMetroScale, 0.01, 4)
	kEffSpeed4 = limit(kspeed4 * gkMetroScale, 0.01, 4)
	ktrig1 metro kEffSpeed1
	ktrig2 metro kEffSpeed2
	ktrig3 metro kEffSpeed3
	ktrig4 metro kEffSpeed4
	
	; ============================================================
	; SELECTED BAND ASSIGNMENT
	; ============================================================
	; Lowercase d/t/a/b selects one ABSOLUTE EEG band. The four Muse sensors
	; from that band drive the four harmony voices, as in V4.
	
	if gkBandSelect == 0 then
		kAbs1 = gkDeltaAbs1
		kAbs2 = gkDeltaAbs2
		kAbs3 = gkDeltaAbs3
		kAbs4 = gkDeltaAbs4
	elseif gkBandSelect == 1 then
		kAbs1 = gkThetaAbs1
		kAbs2 = gkThetaAbs2
		kAbs3 = gkThetaAbs3
		kAbs4 = gkThetaAbs4
	elseif gkBandSelect == 2 then
		kAbs1 = gkAlphaAbs1
		kAbs2 = gkAlphaAbs2
		kAbs3 = gkAlphaAbs3
		kAbs4 = gkAlphaAbs4
	else
		kAbs1 = gkBetaAbs1
		kAbs2 = gkBetaAbs2
		kAbs3 = gkBetaAbs3
		kAbs4 = gkBetaAbs4
	endif
	
	kVal1L = kAbs1
	kVal2L = kAbs2
	kVal3L = kAbs3
	kVal4L = kAbs4
	kVal1R = kAbs1
	kVal2R = kAbs2
	kVal3R = kAbs3
	kVal4R = kAbs4
	
	kRaw1L samphold kVal1L, ktrig1
	kRaw2L samphold kVal2L, ktrig2
	kRaw3L samphold kVal3L, ktrig3
	kRaw4L samphold kVal4L, ktrig4
	kRaw1R samphold kVal1R, ktrig1
	kRaw2R samphold kVal2R, ktrig2
	kRaw3R samphold kVal3R, ktrig3
	kRaw4R samphold kVal4R, ktrig4
	
	; Adaptive per-sensor scaling. Direct absolute scaling was too compressed
	; for Muse data, so each sensor's recent live range is stretched across
	; the available chord table.
	kMin1 init 999
	kMin2 init 999
	kMin3 init 999
	kMin4 init 999
	kMax1 init -999
	kMax2 init -999
	kMax3 init -999
	kMax4 init -999
	kLastBand init -1
	if kLastBand != gkBandSelect then
		kMin1 = kRaw1L
		kMin2 = kRaw2L
		kMin3 = kRaw3L
		kMin4 = kRaw4L
		kMax1 = kRaw1L
		kMax2 = kRaw2L
		kMax3 = kRaw3L
		kMax4 = kRaw4L
		kLastBand = gkBandSelect
	endif
	if kRaw1L < kMin1 then
		kMin1 = kRaw1L
	endif
	if kRaw2L < kMin2 then
		kMin2 = kRaw2L
	endif
	if kRaw3L < kMin3 then
		kMin3 = kRaw3L
	endif
	if kRaw4L < kMin4 then
		kMin4 = kRaw4L
	endif
	if kRaw1L > kMax1 then
		kMax1 = kRaw1L
	endif
	if kRaw2L > kMax2 then
		kMax2 = kRaw2L
	endif
	if kRaw3L > kMax3 then
		kMax3 = kRaw3L
	endif
	if kRaw4L > kMax4 then
		kMax4 = kRaw4L
	endif
	kSpan1 = kMax1 - kMin1
	kSpan2 = kMax2 - kMin2
	kSpan3 = kMax3 - kMin3
	kSpan4 = kMax4 - kMin4
	kFallback1 = limit((kRaw1L + 2.5) / 4.0, 0, 0.999)
	kFallback2 = limit((kRaw2L + 2.5) / 4.0, 0, 0.999)
	kFallback3 = limit((kRaw3L + 2.5) / 4.0, 0, 0.999)
	kFallback4 = limit((kRaw4L + 2.5) / 4.0, 0, 0.999)
	kHeld1L = (kSpan1 > 0.08 ? limit((kRaw1L - kMin1) / kSpan1, 0, 0.999) : kFallback1)
	kHeld2L = (kSpan2 > 0.08 ? limit((kRaw2L - kMin2) / kSpan2, 0, 0.999) : kFallback2)
	kHeld3L = (kSpan3 > 0.08 ? limit((kRaw3L - kMin3) / kSpan3, 0, 0.999) : kFallback3)
	kHeld4L = (kSpan4 > 0.08 ? limit((kRaw4L - kMin4) / kSpan4, 0, 0.999) : kFallback4)
	kHeld1R = kHeld1L
	kHeld2R = kHeld2L
	kHeld3R = kHeld3L
	kHeld4R = kHeld4L
	
	kRange = limit(int(gkChordRange), 1, 12)
	kChord1L = limit(int(kHeld1L * kRange), 0, kRange - 1)
	kChord2L = limit(int(kHeld2L * kRange), 0, kRange - 1)
	kChord3L = limit(int(kHeld3L * kRange), 0, kRange - 1)
	kChord4L = limit(int(kHeld4L * kRange), 0, kRange - 1)
	kChord1R = limit(int(kHeld1R * kRange), 0, kRange - 1)
	kChord2R = limit(int(kHeld2R * kRange), 0, kRange - 1)
	kChord3R = limit(int(kHeld3R * kRange), 0, kRange - 1)
	kChord4R = limit(int(kHeld4R * kRange), 0, kRange - 1)
	
	; V12 musical response modes and phrase-memory trends.
	kBandTrend = (gkBandSelect == 0 ? gkDeltaTrend : (gkBandSelect == 1 ? gkThetaTrend : (gkBandSelect == 2 ? gkAlphaTrend : gkBetaTrend)))
	kTrendStep = (kBandTrend > 0.015 ? 1 : (kBandTrend < -0.015 ? -1 : 0))
	kPrevChord1 init 0
	kPrevChord2 init 0
	kPrevChord3 init 0
	kPrevChord4 init 0
	
	if gkResponseMode == 0 then
		; Smooth: soften leaps by blending toward the previous slot.
		kChord1L = int((kChord1L + kPrevChord1) / 2)
		kChord2L = int((kChord2L + kPrevChord2) / 2)
		kChord3L = int((kChord3L + kPrevChord3) / 2)
		kChord4L = int((kChord4L + kPrevChord4) / 2)
	elseif gkResponseMode == 2 then
		; Rhythmic: rising/falling EEG nudges all voices forward/back.
		kChord1L = kChord1L + kTrendStep
		kChord2L = kChord2L + kTrendStep
		kChord3L = kChord3L + kTrendStep
		kChord4L = kChord4L + kTrendStep
	elseif gkResponseMode == 3 then
		; Dramatic: expand the contour and offset voices.
		kChord1L = kChord1L * 2
		kChord2L = kChord2L * 2 + 3
		kChord3L = kChord3L * 2 + 5
		kChord4L = kChord4L * 2 + 7
	elseif gkResponseMode == 4 then
		; Meditative: narrower field, but trend still breathes the harmony.
		kMeditRange = max(3, int(kRange / 2))
		kChord1L = int((kChord1L + kTrendStep) / 2)
		kChord2L = int((kChord2L + kTrendStep) / 2)
		kChord3L = int((kChord3L + kTrendStep) / 2)
		kChord4L = int((kChord4L + kTrendStep) / 2)
		kRange = kMeditRange
	endif
	
	kChord1L = kChord1L - int(kChord1L / kRange) * kRange
	kChord2L = kChord2L - int(kChord2L / kRange) * kRange
	kChord3L = kChord3L - int(kChord3L / kRange) * kRange
	kChord4L = kChord4L - int(kChord4L / kRange) * kRange
	if kChord1L < 0 then
		kChord1L += kRange
	endif
	if kChord2L < 0 then
		kChord2L += kRange
	endif
	if kChord3L < 0 then
		kChord3L += kRange
	endif
	if kChord4L < 0 then
		kChord4L += kRange
	endif
	kChord1R = kChord1L
	kChord2R = kChord2L
	kChord3R = kChord3L
	kChord4R = kChord4L
	kPrevChord1 = kChord1L
	kPrevChord2 = kChord2L
	kPrevChord3 = kChord3L
	kPrevChord4 = kChord4L
	
	gkCurrentChord = int((kChord1L + kChord2L + kChord3L + kChord4L) / 4)
	
	; Select table based on voicing
	if gkAlternateVoicing == 0 then
		kProgTable = gi_prog1 + limit(int(gkCurrentProgression) - 1, 0, 9)
	else
		kProgTable = gi_prog1_alt + limit(int(gkCurrentProgression) - 1, 0, 9)
	endif
	
	; Each sensor selects the chord source for its harmony voice.
	kNote1L tablekt kChord1L*4 + 0, kProgTable
	kNote2L tablekt kChord2L*4 + 1, kProgTable
	kNote3L tablekt kChord3L*4 + 2, kProgTable
	kNote4L tablekt kChord4L*4 + 3, kProgTable
	
	kNote1R tablekt kChord1R*4 + 0, kProgTable
	kNote2R tablekt kChord2R*4 + 1, kProgTable
	kNote3R tablekt kChord3R*4 + 2, kProgTable
	kNote4R tablekt kChord4R*4 + 3, kProgTable
	
	; Publish the currently sounding left-channel harmony for the melody.
	gkHarmNote1 = kNote1L
	gkHarmNote2 = kNote2L
	gkHarmNote3 = kNote3L
	gkHarmNote4 = kNote4L
	gkBassNote = limit(kNote1L - 12, 24, 60)
	kDeltaBass = (gkDeltaAbs1 + gkDeltaAbs2 + gkDeltaAbs3 + gkDeltaAbs4) / 4
	gkBassDrive = limit((kDeltaBass + 2.5) / 4.0, 0.15, 1)
	
	; Convert to frequency
	kFreq1L = cpsmidinn(kNote1L)
	kFreq2L = cpsmidinn(kNote2L)
	kFreq3L = cpsmidinn(kNote3L)
	kFreq4L = cpsmidinn(kNote4L)
	
	kFreq1R = cpsmidinn(kNote1R)
	kFreq2R = cpsmidinn(kNote2R)
	kFreq3R = cpsmidinn(kNote3R)
	kFreq4R = cpsmidinn(kNote4R)
	
	; Harmony motion: block, rhythmic arpeggio/stride, or slow glide.
	kPortTime = (gkHarmonyMotionMode == 2 ? 0.55 : 0.035)
	kFreq1L portk kFreq1L, kPortTime
	kFreq2L portk kFreq2L, kPortTime
	kFreq3L portk kFreq3L, kPortTime
	kFreq4L portk kFreq4L, kPortTime
	kFreq1R portk kFreq1R, kPortTime
	kFreq2R portk kFreq2R, kPortTime
	kFreq3R portk kFreq3R, kPortTime
	kFreq4R portk kFreq4R, kPortTime
	
	kGate1 = 1
	kGate2 = 1
	kGate3 = 1
	kGate4 = 1
	if gkHarmonyMotionMode == 1 then
		kArpTrig metro 2.5 + (gkMetroScale * 2)
		kArpStep init 0
		if kArpTrig == 1 then
			kArpStep = kArpStep + 1
			if kArpStep > 5 then
				kArpStep = 0
			endif
		endif
		kGate1 = (kArpStep == 0 || kArpStep == 4 ? 1 : 0.18)
		kGate2 = (kArpStep == 1 ? 1 : 0.12)
		kGate3 = (kArpStep == 2 ? 1 : 0.12)
		kGate4 = (kArpStep == 3 || kArpStep == 5 ? 1 : 0.18)
	endif
	kGate1 portk kGate1, 0.025
	kGate2 portk kGate2, 0.025
	kGate3 portk kGate3, 0.025
	kGate4 portk kGate4, 0.025
	
	if gkPrintToggle == 1 && changed(kChord1L + kChord2L*10 + kChord3L*100 + kChord4L*1000 + gkBandSelect*10000) == 1 then
		printks "\n>>> STATE harmonyBand=%s mode=Absolute progression=%d range=%d voicing=%s\n", 0, (gkBandSelect == 0 ? "Delta" : (gkBandSelect == 1 ? "Theta" : (gkBandSelect == 2 ? "Alpha" : "Beta"))), gkCurrentProgression, kRange, (gkAlternateVoicing == 0 ? "Standard close/SATB" : "Open Jazz")
		printks "    Rates Hz: V1 %.3f | V2 %.3f | V3 %.3f | V4 %.3f | scale %.3f\n", 0, kEffSpeed1, kEffSpeed2, kEffSpeed3, kEffSpeed4, gkMetroScale
		printks "    CC Modes: V1 %s | V2 %s | V3 %s | V4 %s | Vol %.3f\n", 0, (gkSensor1Mode == 0 ? "METRO" : "VOLUME"), (gkSensor2Mode == 0 ? "METRO" : "VOLUME"), (gkSensor3Mode == 0 ? "METRO" : "VOLUME"), (gkSensor4Mode == 0 ? "METRO" : "VOLUME"), gkGlobalVolume
		printks "    EEG raw L: %.3f %.3f %.3f %.3f | norm: %.3f %.3f %.3f %.3f\n", 0, kRaw1L, kRaw2L, kRaw3L, kRaw4L, kHeld1L, kHeld2L, kHeld3L, kHeld4L
		printks "    Adaptive spans: %.3f %.3f %.3f %.3f | mins %.3f %.3f %.3f %.3f | maxs %.3f %.3f %.3f %.3f\n", 0, kSpan1, kSpan2, kSpan3, kSpan4, kMin1, kMin2, kMin3, kMin4, kMax1, kMax2, kMax3, kMax4
		printks "    Chord slots L: V1 %d | V2 %d | V3 %d | V4 %d\n", 0, kChord1L, kChord2L, kChord3L, kChord4L
		printks "    MIDI notes L: %.0f %.0f %.0f %.0f | Hz: %.1f %.1f %.1f %.1f\n", 0, kNote1L, kNote2L, kNote3L, kNote4L, kFreq1L, kFreq2L, kFreq3L, kFreq4L
		printks "    Orchestra %s | Motion %s | Bass note %.0f drive %.3f\n", 0, (gkOrchestraMode == 0 ? "Classic" : (gkOrchestraMode == 1 ? "Glass" : "Dark")), (gkHarmonyMotionMode == 0 ? "Block" : (gkHarmonyMotionMode == 1 ? "Arp" : "Glide")), gkBassNote, gkBassDrive
	endif
	
	icps cpsmidi
	
	; Vibrato
	kvibrato oscili 0.003, 5.2
	kdetune = 1 + kvibrato
	
	; V11 orchestrated chord players: each voice has its own timbre/envelope.
	kEnv1 madsr 0.03, 0.35, 0.82, 0.8   ; Voice 1: warm cello/horn foundation
	kEnv2 madsr 0.012, 0.18, 0.58, 0.35 ; Voice 2: plucked/harp-like inner voice
	kEnv3 madsr 0.08, 0.55, 0.7, 1.1    ; Voice 3: airy reed/pad
	kEnv4 madsr 0.005, 0.12, 0.45, 0.28 ; Voice 4: bright mallet/top voice
	
	a1L0 oscili 0.22 * gkSensor1Vol * kGate1, kFreq1L * (icps/440) * 0.5
	a1L1 oscili 0.28 * gkSensor1Vol * kGate1, kFreq1L * (icps/440)
	a1L2 oscili 0.10 * gkSensor1Vol * kGate1, kFreq1L * (icps/440) * 1.5
	aout1L = (a1L0 + a1L1 + a1L2) * kEnv1
	aout1L tone aout1L, 950
	a1R0 oscili 0.22 * gkSensor1Vol * kGate1, kFreq1R * (icps/440) * 0.5
	a1R1 oscili 0.28 * gkSensor1Vol * kGate1, kFreq1R * (icps/440) * 1.001
	a1R2 oscili 0.10 * gkSensor1Vol * kGate1, kFreq1R * (icps/440) * 1.498
	aout1R = (a1R0 + a1R1 + a1R2) * kEnv1
	aout1R tone aout1R, 950
	
	a2L1 oscili 0.20 * gkSensor2Vol * kGate2, kFreq2L * (icps/440)
	a2L2 oscili 0.12 * gkSensor2Vol * kGate2, kFreq2L * (icps/440) * 2.01
	a2L3 oscili 0.08 * gkSensor2Vol * kGate2, kFreq2L * (icps/440) * 3.02
	aout2L = (a2L1 + a2L2 + a2L3) * kEnv2
	aout2L tone aout2L, 2400
	a2R1 oscili 0.20 * gkSensor2Vol * kGate2, kFreq2R * (icps/440) * 1.002
	a2R2 oscili 0.12 * gkSensor2Vol * kGate2, kFreq2R * (icps/440) * 2.02
	a2R3 oscili 0.08 * gkSensor2Vol * kGate2, kFreq2R * (icps/440) * 3.01
	aout2R = (a2R1 + a2R2 + a2R3) * kEnv2
	aout2R tone aout2R, 2400
	
	a3Vib oscili 0.006, 4.1
	a3L1 oscili 0.18 * gkSensor3Vol * kGate3, kFreq3L * (icps/440) * (1 + a3Vib)
	a3L2 oscili 0.10 * gkSensor3Vol * kGate3, kFreq3L * (icps/440) * 1.997
	aout3L = (a3L1 + a3L2) * kEnv3
	aout3L tone aout3L, 1800
	a3R1 oscili 0.18 * gkSensor3Vol * kGate3, kFreq3R * (icps/440) * (1 - a3Vib)
	a3R2 oscili 0.10 * gkSensor3Vol * kGate3, kFreq3R * (icps/440) * 2.003
	aout3R = (a3R1 + a3R2) * kEnv3
	aout3R tone aout3R, 1800
	
	a4L1 oscili 0.16 * gkSensor4Vol * kGate4, kFreq4L * (icps/440)
	a4L2 oscili 0.12 * gkSensor4Vol * kGate4, kFreq4L * (icps/440) * 4.01
	a4L3 oscili 0.06 * gkSensor4Vol * kGate4, kFreq4L * (icps/440) * 7.02
	aout4L = (a4L1 + a4L2 + a4L3) * kEnv4
	aout4L tone aout4L, 4200
	a4R1 oscili 0.16 * gkSensor4Vol * kGate4, kFreq4R * (icps/440) * 1.001
	a4R2 oscili 0.12 * gkSensor4Vol * kGate4, kFreq4R * (icps/440) * 4.02
	a4R3 oscili 0.06 * gkSensor4Vol * kGate4, kFreq4R * (icps/440) * 7.01
	aout4R = (a4R1 + a4R2 + a4R3) * kEnv4
	aout4R tone aout4R, 4200
	
	; Optional Gamma voice (if in gamma volume mode)
	if gkSensor5Mode == 1 then
		aout5L oscili 0.3 * gkSensor5Vol, kFreq1L * (icps/440) * 1.5 * kdetune
		aout5R oscili 0.3 * gkSensor5Vol, kFreq1R * (icps/440) * 1.5 * kdetune
		aoutL = aout1L + aout2L + aout3L + aout4L + aout5L
		aoutR = aout1R + aout2R + aout3R + aout4R + aout5R
	else
		aoutL = aout1L + aout2L + aout3L + aout4L
		aoutR = aout1R + aout2R + aout3R + aout4R
	endif
	
	aadsr madsr 1.5, 0.8, 0.75, 1.2
	
	aoutL = aoutL * 0.15 * aadsr * gkGlobalVolumeSmooth
	aoutR = aoutR * 0.15 * aadsr * gkGlobalVolumeSmooth
	
	garvbL += aoutL * 0.7
	garvbR += aoutR * 0.7
	gadelL += aoutL * 0.35
	gadelR += aoutR * 0.35
	gachorusL += aoutL * 0.55
	gachorusR += aoutR * 0.55
	
	outs aoutL * 0.3, aoutR * 0.3
	
	kReleased release
	if kReleased == 1 && kNoteCounted == 1 then
		gkActiveChordNotes = max(0, gkActiveChordNotes - 1)
		kNoteCounted = 2
	endif
	
endin


instr 6  ; Safe melodic generator (controlled by Gamma) - uses schedkwhen

	; Skip if melody is off
	if gkMelodyOn == 0 goto skip
	
	; Wait a bit for initialization
	kInitTime timeinsts
	if kInitTime < 0.2 goto skip
	
	; CC1 controls melody balance or complexity, toggled with z.
	kCC1 midic7 1, 0, 1
	kLastCC1 init 0
	kCC1Ready init 0
	if kCC1Ready == 0 then
		kLastCC1 = kCC1
		kCC1Ready = 1
	elseif kCC1 != kLastCC1 then
		if gkMelodyCC1Mode == 0 then
			gkMelodyVolume = kCC1
			printks ">>> CC1 Melody volume = %.3f\n", 0, gkMelodyVolume
		else
			gkMelodyComplexity = kCC1
			printks ">>> CC1 Melody complexity = %.3f\n", 0, gkMelodyComplexity
		endif
		kLastCC1 = kCC1
	endif
	
	; Muse-shaped melody:
	; Gamma = activity/rate, Beta = duration/energy,
	; Theta = rests/space, Alpha = register lift.
	kGammaMean = (gkGammaAbs1 + gkGammaAbs2 + gkGammaAbs3 + gkGammaAbs4) / 4
	kBetaMean = (gkBetaAbs1 + gkBetaAbs2 + gkBetaAbs3 + gkBetaAbs4) / 4
	kThetaMean = (gkThetaAbs1 + gkThetaAbs2 + gkThetaAbs3 + gkThetaAbs4) / 4
	kAlphaMean = (gkAlphaAbs1 + gkAlphaAbs2 + gkAlphaAbs3 + gkAlphaAbs4) / 4
	kGammaActivity = limit((kGammaMean + 2.5) / 4.0, 0, 1)
	kBetaActivity = limit((kBetaMean + 2.5) / 4.0, 0, 1)
	kThetaActivity = limit((kThetaMean + 2.5) / 4.0, 0, 1)
	kAlphaActivity = limit((kAlphaMean + 2.5) / 4.0, 0, 1)
	kMelodySource = (gkMelodyDriver == 0 ? gkDeltaNorm : (gkMelodyDriver == 1 ? gkThetaNorm : (gkMelodyDriver == 2 ? gkAlphaNorm : (gkMelodyDriver == 3 ? gkBetaNorm : gkGammaNorm))))
	kRhythmSource = (gkRhythmDriver == 0 ? gkDeltaNorm : (gkRhythmDriver == 1 ? gkThetaNorm : (gkRhythmDriver == 2 ? gkAlphaNorm : (gkRhythmDriver == 3 ? gkBetaNorm : gkGammaNorm))))
	kRegisterSource = (gkRegisterDriver == 0 ? gkDeltaNorm : (gkRegisterDriver == 1 ? gkThetaNorm : (gkRegisterDriver == 2 ? gkAlphaNorm : (gkRegisterDriver == 3 ? gkBetaNorm : gkGammaNorm))))
	kMelodyTrend = (gkMelodyDriver == 0 ? gkDeltaTrend : (gkMelodyDriver == 1 ? gkThetaTrend : (gkMelodyDriver == 2 ? gkAlphaTrend : (gkMelodyDriver == 3 ? gkBetaTrend : gkGammaTrend))))
	gkMelodyActivity = portk(kMelodySource, 0.25)
	kBetaActivity = kRhythmSource
	kAlphaActivity = kRegisterSource
	
	if gkMelodyCharacter == 0 then
		kRateMult = 0.45
		kDurMult = 1.8
		kRestBase = 0.25
	elseif gkMelodyCharacter == 1 then
		kRateMult = 1.0
		kDurMult = 1.0
		kRestBase = 0.12
	else
		kRateMult = 1.75
		kDurMult = 0.55
		kRestBase = 0.04
	endif
	
	kRate = (0.08 + (gkMelodyActivity * 1.2) + (kBetaActivity * 0.5) + max(0, kMelodyTrend) * 4) * kRateMult * (0.65 + gkMelodyComplexity * 1.4)
	kRate = limit(kRate, 0.04, 3.5)
	
	ktrig metro kRate
	kTailNotes init 0
	if gkActiveChordNotes > 0 then
		kTailNotes = 3
	endif
	if gkActiveChordNotes <= 0 && kTailNotes <= 0 then
		goto skip
	endif
	
	; Rest handling
	if gkPhraseRest > 0 then
		if ktrig == 1 then
			gkPhraseRest = gkPhraseRest - 1
		endif
		goto skip
	endif
	
	; New phrase
	if gkPhraseLength <= 0 then
		if ktrig == 1 then
			gkPhraseLength random 3, 6
			gkPhraseLength = int(gkPhraseLength)
			kNewRest random 0, 3
			gkPhraseRest = int(kNewRest * kThetaActivity)
		endif
		goto skip
	endif
	
	; Theta opens space in the phrase. Dramatic mode resists rests.
	kRestProb = limit(kRestBase + (kThetaActivity * 0.35) - (kBetaActivity * 0.18) - (gkMelodyComplexity * 0.12), 0.02, 0.65)
	kRestRoll random 0, 1
	if ktrig == 1 && kRestRoll < kRestProb then
		gkPhraseLength = gkPhraseLength - 1
		goto skip
	endif
	
	; Follow the currently sounding harmony, not an averaged chord index.
	kRootNote = gkHarmNote1
	kChordToneChoice random 0, 4
	kChordToneChoice = int(kChordToneChoice)
	if kChordToneChoice == 0 then
		kChordTone = gkHarmNote1
	elseif kChordToneChoice == 1 then
		kChordTone = gkHarmNote2
	elseif kChordToneChoice == 2 then
		kChordTone = gkHarmNote3
	else
		kChordTone = gkHarmNote4
	endif
	
	; Melodic scale/excursion mode
	kDegree random 0, 7
	kDegree = int(kDegree)
	kDegree = limit(kDegree, 0, 7)
	kExcursionRoll random 0, 1
	if gkMelodyScaleMode == 0 || kExcursionRoll > gkMelodyComplexity then
		; Main strategy: stay on the actual sounding chord.
		kMelodyBase = kChordTone
		kInterval = 0
	elseif gkMelodyScaleMode == 1 then
		kMelodyBase = kRootNote
		kInterval tablekt kDegree, gi_dorian_scale
	elseif gkMelodyScaleMode == 2 then
		kMelodyBase = kRootNote
		kInterval tablekt kDegree, gi_lydian_scale
	elseif gkMelodyScaleMode == 3 then
		kMelodyBase = kRootNote
		kInterval tablekt kDegree, gi_mixolydian_scale
	else
		; Chromatic excursions orbit a chord tone, so they return home.
		kMelodyBase = kChordTone
		kInterval tablekt kDegree, gi_chromatic_scale
	endif
	
	kOctave = gkMelodyRegister + (int(kAlphaActivity * 3) * 12)
	if gkMelodyCharacter == 2 then
		kLeap random 0, 2
		kOctave += int(kLeap) * 12
	endif
	kMelodyNote = kMelodyBase + kInterval + kOctave
	kMelodyNote = limit(kMelodyNote, 36, 96)  ; Limit to reasonable MIDI range
	
	kDur = (0.18 + (1 - kBetaActivity) * 0.8 + kThetaActivity * 0.45) * kDurMult
	kDur = limit(kDur, 0.08, 2.5)
	kVel = (0.10 + gkMelodyActivity * 0.22 + kBetaActivity * 0.18) * gkMelodyVolume
	kVel = limit(kVel, 0, 0.55)
	
	if gkPrintToggle == 1 && ktrig == 1 then
		printks ">>> MELODY mode=%s char=%s CC1=%s | activeChords %d tail %d | chord %.0f %.0f %.0f %.0f | base %.0f int %.0f note %.0f | melody %.3f rhythm %.3f theta %.3f register %.3f trend %.3f | rate %.2f dur %.2f vel %.2f vol %.2f cx %.2f\n", 0, (gkMelodyScaleMode == 0 ? "Chord" : (gkMelodyScaleMode == 1 ? "Dorian" : (gkMelodyScaleMode == 2 ? "Lydian" : (gkMelodyScaleMode == 3 ? "Mixolydian" : "Chromatic")))), (gkMelodyCharacter == 0 ? "Mellow" : (gkMelodyCharacter == 1 ? "Balanced" : "Frenetic")), (gkMelodyCC1Mode == 0 ? "Volume" : "Complexity"), gkActiveChordNotes, kTailNotes, gkHarmNote1, gkHarmNote2, gkHarmNote3, gkHarmNote4, kMelodyBase, kInterval, kMelodyNote, gkMelodyActivity, kBetaActivity, kThetaActivity, kAlphaActivity, kMelodyTrend, kRate, kDur, kVel, gkMelodyVolume, gkMelodyComplexity
	endif
	
	; Use schedkwhen instead of event (safer in Csound 6)
	schedkwhen ktrig, 0, 0, 7, 0, kDur, kMelodyNote, kVel
	
	if ktrig == 1 then
		gkPhraseLength = gkPhraseLength - 1
		if gkActiveChordNotes <= 0 then
			kTailNotes = max(0, kTailNotes - 1)
		endif
	endif
	
skip:
endin


instr 7  ; Melody voice

	iNote = p4
	iVel = p5
	
	kEnv madsr 0.018, 0.12, 0.62, 0.45
	kFreq = cpsmidinn(iNote)
	kVib oscili 0.004, 5.7
	aLead1 oscili iVel * 0.75, kFreq * (1 + kVib)
	aLead2 oscili iVel * 0.28, kFreq * 2.01
	aLead3 oscili iVel * 0.12, kFreq * 3.02
	aout = (aLead1 + aLead2 + aLead3) * kEnv
	aout tone aout, 3600
	
	garvbL += aout * 0.4
	garvbR += aout * 0.4
	gamelDelL += aout * 0.45
	gamelDelR += aout * 0.45
	gachorusL += aout * 0.35
	gachorusR += aout * 0.35
	
	outs aout * 0.3, aout * 0.3
	
endin


instr 3  ; Global reverb
	denorm garvbL, garvbR
	aL, aR reverbsc garvbL, garvbR, 0.88, 9000
	aL butterhp aL, 80
	aR butterhp aR, 80
	outs aL * 0.5, aR * 0.5
	clear garvbL, garvbR
endin


instr 4  ; Global delay
	adelL init 0
	adelR init 0
	denorm gadelL, gadelR
	adelL delay gadelL + (adelL * 0.32), 0.25
	adelR delay gadelR + (adelR * 0.30), 0.333
	adelL butterlp adelL, 2600
	adelR butterlp adelR, 2600
	outs adelL * 0.24, adelR * 0.24
	clear gadelL, gadelR
endin


instr 8  ; Global chorus
	denorm gachorusL, gachorusR
	klfo1 oscili 2.5, 0.18
	klfo2 oscili 3.0, 0.27
	klfo3 oscili 1.5, 0.11
	adel1L vdelay gachorusL, 12 + klfo1, 25
	adel2L vdelay gachorusL, 18 + klfo2, 25
	adel1R vdelay gachorusR, 14 + klfo2, 25
	adel2R vdelay gachorusR, 21 + klfo3, 25
	aoutL = gachorusL * 0.45 + adel1L * 0.28 + adel2L * 0.27
	aoutR = gachorusR * 0.45 + adel1R * 0.28 + adel2R * 0.27
	outs aoutL * 0.32, aoutR * 0.32
	clear gachorusL, gachorusR
endin


instr 9  ; Melody delay, separate from chord delay
	amelL init 0
	amelR init 0
	denorm gamelDelL, gamelDelR
	amelL delay gamelDelL + (amelL * 0.46), 0.42
	amelR delay gamelDelR + (amelR * 0.42), 0.58
	amelL butterlp amelL, 4200
	amelR butterlp amelR, 3900
	outs amelL * 0.28, amelR * 0.28
	clear gamelDelL, gamelDelR
endin


instr 10 ; Delta-driven walking bass generator
	kDeltaMean = (gkDeltaAbs1 + gkDeltaAbs2 + gkDeltaAbs3 + gkDeltaAbs4) / 4
	kThetaMean = (gkThetaAbs1 + gkThetaAbs2 + gkThetaAbs3 + gkThetaAbs4) / 4
	kBetaMean = (gkBetaAbs1 + gkBetaAbs2 + gkBetaAbs3 + gkBetaAbs4) / 4
	kDeltaActivity = limit((kDeltaMean + 2.5) / 4.0, 0, 1)
	kThetaActivity = limit((kThetaMean + 2.5) / 4.0, 0, 1)
	kBetaActivity = limit((kBetaMean + 2.5) / 4.0, 0, 1)
	kBassSource = (gkBassDriver == 0 ? gkDeltaNorm : (gkBassDriver == 1 ? gkThetaNorm : (gkBassDriver == 2 ? gkAlphaNorm : (gkBassDriver == 3 ? gkBetaNorm : gkGammaNorm))))
	kBassTrend = (gkBassDriver == 0 ? gkDeltaTrend : (gkBassDriver == 1 ? gkThetaTrend : (gkBassDriver == 2 ? gkAlphaTrend : (gkBassDriver == 3 ? gkBetaTrend : gkGammaTrend))))
	kBassRate = limit(0.55 + (kBassSource * 0.85) + (kBetaActivity * 0.25) + max(0, kBassTrend) * 3, 0.35, 1.6)
	ktrig metro kBassRate
	
	kStep init 0
	kLastBass init 36
	if gkActiveChordNotes <= 0 goto done
	
	if ktrig == 1 then
		kStep = kStep + 1
		if kStep > 7 then
			kStep = 0
		endif
		
		if kStep == 0 then
			kBassNote = gkHarmNote1 - 12
		elseif kStep == 1 then
			kBassNote = gkHarmNote2 - 12
		elseif kStep == 2 then
			kBassNote = gkHarmNote1
		elseif kStep == 3 then
			kBassNote = gkHarmNote3 - 12
		elseif kStep == 4 then
			kBassNote = gkHarmNote2
		elseif kStep == 5 then
			kBassNote = gkHarmNote4 - 12
		elseif kStep == 6 then
			kApproachToRoot random -2, 3
			kBassNote = (gkHarmNote1 - 12) + int(kApproachToRoot)
		else
			kApproach random -2, 3
			kBassNote = kLastBass + int(kApproach)
		endif
		
		if kBassNote < 36 then
			kBassNote = kBassNote + 12
		endif
		if kBassNote < 36 then
			kBassNote = kBassNote + 12
		endif
		if kBassNote > 57 then
			kBassNote = kBassNote - 12
		endif
		kBassNote = limit(kBassNote, 36, 57)
		kLastBass = kBassNote
		kDur = 0.20 + (kThetaActivity * 0.45)
		kAmp = 0.022 + (kBassSource * 0.035)
		schedkwhen 1, 0, 0, 11, 0, kDur, kBassNote, kAmp
		
		if gkPrintToggle == 1 then
			printks ">>> BASS rate %.2f step %d note %.0f amp %.3f source %.3f trend %.3f theta %.3f beta %.3f\n", 0, kBassRate, kStep, kBassNote, kAmp, kBassSource, kBassTrend, kThetaActivity, kBetaActivity
		endif
	endif
done:
endin


instr 11 ; Bass note voice
	iNote = p4
	iAmp = p5
	kEnv madsr 0.025, 0.10, 0.55, 0.24
	kFreq = cpsmidinn(iNote)
	aSub oscili iAmp * 0.15, kFreq * 0.5
	aFund oscili iAmp * 0.72, kFreq
	aGrowl oscili iAmp * 0.20, kFreq * 1.5
	aClick oscili iAmp * 0.10, kFreq * 2.0
	aBass = (aSub + aFund + aGrowl + aClick) * kEnv
	aBass tone aBass, 780
	garvbL += aBass * 0.08
	garvbR += aBass * 0.08
	gadelL += aBass * 0.04
	gadelR += aBass * 0.04
	outs aBass * 0.14, aBass * 0.14
endin


instr 12 ; V12 Mind Monitor EEG control dashboard
	if gkPrintToggle == 0 goto done
	ktrig metro 1
	if ktrig == 1 then
		printks "\n>>> V12 EEG DASHBOARD | palette %d range %d | band %s | response %s\n", 0, gkCurrentProgression, gkChordRange, (gkBandSelect == 0 ? "Delta" : (gkBandSelect == 1 ? "Theta" : (gkBandSelect == 2 ? "Alpha" : "Beta"))), (gkResponseMode == 0 ? "Smooth" : (gkResponseMode == 1 ? "Stepped" : (gkResponseMode == 2 ? "Rhythmic" : (gkResponseMode == 3 ? "Dramatic" : "Meditative"))))
		printks "    Assignments: Bass=%s Melody=%s Rhythm=%s Register=%s\n", 0, (gkBassDriver == 0 ? "Delta" : (gkBassDriver == 1 ? "Theta" : (gkBassDriver == 2 ? "Alpha" : (gkBassDriver == 3 ? "Beta" : "Gamma")))), (gkMelodyDriver == 0 ? "Delta" : (gkMelodyDriver == 1 ? "Theta" : (gkMelodyDriver == 2 ? "Alpha" : (gkMelodyDriver == 3 ? "Beta" : "Gamma")))), (gkRhythmDriver == 0 ? "Delta" : (gkRhythmDriver == 1 ? "Theta" : (gkRhythmDriver == 2 ? "Alpha" : (gkRhythmDriver == 3 ? "Beta" : "Gamma")))), (gkRegisterDriver == 0 ? "Delta" : (gkRegisterDriver == 1 ? "Theta" : (gkRegisterDriver == 2 ? "Alpha" : (gkRegisterDriver == 3 ? "Beta" : "Gamma"))))
		printks "    Norms: D %.3f T %.3f A %.3f B %.3f G %.3f\n", 0, gkDeltaNorm, gkThetaNorm, gkAlphaNorm, gkBetaNorm, gkGammaNorm
		printks "    Trends: D %+.3f T %+.3f A %+.3f B %+.3f G %+.3f\n", 0, gkDeltaTrend, gkThetaTrend, gkAlphaTrend, gkBetaTrend, gkGammaTrend
		printks "    Harmony notes: %.0f %.0f %.0f %.0f | active MIDI chords %d\n", 0, gkHarmNote1, gkHarmNote2, gkHarmNote3, gkHarmNote4, gkActiveChordNotes
		printks "    Orchestra=%s Motion=%s Melody=%s Char=%s CC1=%s Vol %.2f Cx %.2f\n", 0, (gkOrchestraMode == 0 ? "Classic" : (gkOrchestraMode == 1 ? "Glass" : "Dark")), (gkHarmonyMotionMode == 0 ? "Block" : (gkHarmonyMotionMode == 1 ? "Arp" : "Glide")), (gkMelodyScaleMode == 0 ? "Chord" : (gkMelodyScaleMode == 1 ? "Dorian" : (gkMelodyScaleMode == 2 ? "Lydian" : (gkMelodyScaleMode == 3 ? "Mixolydian" : "Chromatic")))), (gkMelodyCharacter == 0 ? "Mellow" : (gkMelodyCharacter == 1 ? "Balanced" : "Frenetic")), (gkMelodyCC1Mode == 0 ? "Volume" : "Complexity"), gkMelodyVolume, gkMelodyComplexity
	endif
done:
endin



</CsInstruments>
<CsScore>

</CsScore>
</CsoundSynthesizer>


















<bsbPanel>
 <label>Widgets</label>
 <objectName/>
 <x>0</x>
 <y>0</y>
 <width>0</width>
 <height>0</height>
 <visible>true</visible>
 <uuid/>
 <bgcolor mode="background">
  <r>240</r>
  <g>240</g>
  <b>240</b>
 </bgcolor>
</bsbPanel>
<bsbPresets>
</bsbPresets>
