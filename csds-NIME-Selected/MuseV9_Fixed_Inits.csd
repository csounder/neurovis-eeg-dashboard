<CsoundSynthesizer>
<CsOptions>
-odac -Ma -d
</CsOptions>
<CsInstruments>

/*
====================================================================
MUSE BRAINWAVE JAZZ - INTELLIGENT MELODIC SYSTEM V9
====================================================================

SENSOR-TO-CHORD MAPPING:
- 10 chord progressions (selected by number keys 1-0)
- Each progression has 8 chords (indexed 0-7)
- Harmony uses ABSOLUTE Muse streams only
- Lowercase d/t/a/b selects the harmony band
- The four sensors from the selected band map to the four harmony voices
- Gamma absolute data is reserved for the melody system

KEYBOARD CONTROLS:
===================

CHORD PROGRESSION (numbers 1-0):
Select from 10 jazz progressions

VOICING & MELODY:
- x = Toggle alternate chord voicings
- M = Toggle melodic line on/off  
- w = Toggle Markov/Brownian mode

SENSOR MODE TOGGLE (lowercase):
- d = Toggle CC21 between Delta metro/volume mode (Voice 1)
- t = Toggle CC22 between Theta metro/volume mode (Voice 2)
- a = Toggle CC23 between Alpha metro/volume mode (Voice 3)
- b = Toggle CC24 between Beta metro/volume mode (Voice 4)
- g = Toggle CC25 between Gamma melody activity/volume mode

PLAYBACK MODE (UPPERCASE):
- R = Relative mode (both channels)
- A = Absolute mode (both channels) - DEFAULT
- B = Both mode (L=Absolute, R=Relative)

MIDI CONTROL:
- CC 1: Reserved for modulation wheel
- CC 21: Delta metro (0.01-40 Hz) OR Delta volume (0-1)
- CC 22: Theta metro (0.01-50 Hz) OR Theta volume (0-1)
- CC 23: Alpha metro (0.01-100 Hz) OR Alpha volume (0-1)
- CC 24: Beta metro (0.01-10 Hz) OR Beta volume (0-1)
- CC 25: Gamma melody activity (0-1) OR Gamma volume (0-1)
- CC 26: Chord range (1-8, default 8)
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

garvbL init 0
garvbR init 0
gadelL init 0
gadelR init 0
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
; JAZZ CHORD PROGRESSION TABLES (Standard voicings)
; ============================================================

gi_prog1 ftgen 0, 0, 32, -2, \
    50,62,65,69,  43,59,62,65,  48,60,64,67,  45,57,60,64, \
    52,59,64,67,  45,57,61,64,  50,62,65,69,  43,59,62,65

gi_prog2 ftgen 0, 0, 32, -2, \
    48,60,64,67,  45,57,60,64,  50,62,65,69,  43,59,62,65, \
    52,59,64,67,  45,57,60,64,  53,60,65,69,  43,59,62,65

gi_prog3 ftgen 0, 0, 32, -2, \
    52,59,64,67,  45,57,60,64,  50,62,65,69,  43,59,62,65, \
    48,60,64,67,  53,60,65,69,  47,59,62,65,  52,59,64,67

gi_prog4 ftgen 0, 0, 32, -2, \
    48,60,64,67,  53,60,65,69,  52,59,64,67,  45,57,60,64, \
    50,62,65,69,  43,59,62,65,  48,60,64,67,  43,59,62,65

gi_prog5 ftgen 0, 0, 32, -2, \
    50,62,65,69,  43,59,62,65,  52,59,64,67,  45,57,60,64, \
    53,60,65,69,  47,59,62,65,  52,59,64,67,  45,57,60,64

gi_prog6 ftgen 0, 0, 32, -2, \
    53,60,65,69,  43,59,62,65,  52,59,64,67,  45,57,60,64, \
    50,62,65,69,  43,59,62,65,  48,60,64,67,  45,57,60,64

gi_prog7 ftgen 0, 0, 32, -2, \
    45,57,60,64,  50,62,65,69,  43,59,62,65,  48,60,64,67, \
    53,60,65,69,  48,60,64,67,  50,62,65,69,  43,59,62,65

gi_prog8 ftgen 0, 0, 32, -2, \
    48,60,64,67,  48,58,64,66,  53,60,65,69,  53,60,65,68, \
    48,60,64,67,  45,57,60,64,  50,62,65,69,  43,59,62,65

gi_prog9 ftgen 0, 0, 32, -2, \
    50,62,65,69,  49,61,64,67,  48,60,64,67,  45,57,60,64, \
    50,62,65,69,  43,59,62,65,  52,59,64,67,  45,57,60,64

gi_prog10 ftgen 0, 0, 32, -2, \
    48,60,64,67,  46,58,62,65,  53,60,65,69,  48,60,64,67, \
    50,62,65,69,  43,59,62,65,  48,60,64,67,  48,60,64,67

; Alternate open voicings (10 tables)
gi_prog1_alt ftgen 0, 0, 32, -2, \
    38,65,69,74,  43,62,65,71,  36,64,67,72,  45,60,64,69, \
    40,64,67,71,  45,61,64,69,  38,65,69,74,  43,62,65,71

gi_prog2_alt ftgen 0, 0, 32, -2, \
    36,64,67,72,  45,60,64,69,  38,65,69,74,  43,62,65,71, \
    40,64,67,71,  45,60,64,69,  41,65,69,72,  43,62,65,71

gi_prog3_alt ftgen 0, 0, 32, -2, \
    40,64,67,71,  45,60,64,69,  38,65,69,74,  43,62,65,71, \
    36,64,67,72,  41,65,69,72,  47,62,65,71,  40,64,67,71

gi_prog4_alt ftgen 0, 0, 32, -2, \
    36,64,67,72,  41,65,69,72,  40,64,67,71,  45,60,64,69, \
    38,65,69,74,  43,62,65,71,  36,64,67,72,  43,62,65,71

gi_prog5_alt ftgen 0, 0, 32, -2, \
    38,65,69,74,  43,62,65,71,  40,64,67,71,  45,60,64,69, \
    41,65,69,72,  47,62,65,71,  40,64,67,71,  45,60,64,69

gi_prog6_alt ftgen 0, 0, 32, -2, \
    41,65,69,72,  43,62,65,71,  40,64,67,71,  45,60,64,69, \
    38,65,69,74,  43,62,65,71,  36,64,67,72,  45,60,64,69

gi_prog7_alt ftgen 0, 0, 32, -2, \
    45,60,64,69,  38,65,69,74,  43,62,65,71,  36,64,67,72, \
    41,65,69,72,  36,64,67,72,  38,65,69,74,  43,62,65,71

gi_prog8_alt ftgen 0, 0, 32, -2, \
    36,64,67,72,  48,58,66,70,  41,65,69,72,  41,65,68,72, \
    36,64,67,72,  45,60,64,69,  38,65,69,74,  43,62,65,71

gi_prog9_alt ftgen 0, 0, 32, -2, \
    38,65,69,74,  37,64,67,73,  36,64,67,72,  45,60,64,69, \
    38,65,69,74,  43,62,65,71,  40,64,67,71,  45,60,64,69

gi_prog10_alt ftgen 0, 0, 32, -2, \
    36,64,67,72,  46,58,65,70,  41,65,69,72,  36,64,67,72, \
    38,65,69,74,  43,62,65,71,  36,64,67,72,  36,64,67,72

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

; ============================================================
; Global variables - PROPERLY INITIALIZED
; ============================================================
gkCurrentProgression init 1
gkChordRange init 8
gkAlternateVoicing init 0
gkMelodyOn init 0
gkMelodyMode init 0
gkMelodyActivity init 0.3
gkMelodyRateMult init 0.5
gkCurrentChord init 0
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
gkChordRange init 8
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
	
	; M = Toggle melody
	if kKeyDown == 1 && kKey == 77 then
		gkMelodyOn = (gkMelodyOn == 0 ? 1 : 0)
		if gkMelodyOn == 1 then
			printks ">>> Melody: ON (Gamma controls activity)\n", 0
		else
			printks ">>> Melody: OFF\n", 0
		endif
	endif
	
	; w = Toggle Markov/Brownian
	if kKeyDown == 1 && kKey == 119 then
		gkMelodyMode = (gkMelodyMode == 0 ? 1 : 0)
		printks ">>> Melody Mode: %s\n", 0, (gkMelodyMode == 0 ? "Markov" : "Brownian")
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
	kRangeCC midic7 26, 1, 8
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
		printks "\n>>> JAZZ V9 - EEG CHORD SEQUENCER\n", 0
		printks "    Current Progression: %d\n", 0, gkCurrentProgression
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
		printks "    Gamma Melody: absolute gamma controls rate/activity %.3f\n", 0, gkMelodyActivity
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
	
	kNorm1L = limit((kVal1L + 2.5) / 4.0, 0, 0.999)
	kNorm2L = limit((kVal2L + 2.5) / 4.0, 0, 0.999)
	kNorm3L = limit((kVal3L + 2.5) / 4.0, 0, 0.999)
	kNorm4L = limit((kVal4L + 2.5) / 4.0, 0, 0.999)
	kNorm1R = kNorm1L
	kNorm2R = kNorm2L
	kNorm3R = kNorm3L
	kNorm4R = kNorm4L
	
	kRaw1L samphold kVal1L, ktrig1
	kRaw2L samphold kVal2L, ktrig2
	kRaw3L samphold kVal3L, ktrig3
	kRaw4L samphold kVal4L, ktrig4
	kRaw1R samphold kVal1R, ktrig1
	kRaw2R samphold kVal2R, ktrig2
	kRaw3R samphold kVal3R, ktrig3
	kRaw4R samphold kVal4R, ktrig4
	kHeld1L samphold kNorm1L, ktrig1
	kHeld2L samphold kNorm2L, ktrig2
	kHeld3L samphold kNorm3L, ktrig3
	kHeld4L samphold kNorm4L, ktrig4
	kHeld1R samphold kNorm1R, ktrig1
	kHeld2R samphold kNorm2R, ktrig2
	kHeld3R samphold kNorm3R, ktrig3
	kHeld4R samphold kNorm4R, ktrig4
	
	kRange = limit(int(gkChordRange), 1, 8)
	kChord1L = limit(int(kHeld1L * kRange), 0, kRange - 1)
	kChord2L = limit(int(kHeld2L * kRange), 0, kRange - 1)
	kChord3L = limit(int(kHeld3L * kRange), 0, kRange - 1)
	kChord4L = limit(int(kHeld4L * kRange), 0, kRange - 1)
	kChord1R = limit(int(kHeld1R * kRange), 0, kRange - 1)
	kChord2R = limit(int(kHeld2R * kRange), 0, kRange - 1)
	kChord3R = limit(int(kHeld3R * kRange), 0, kRange - 1)
	kChord4R = limit(int(kHeld4R * kRange), 0, kRange - 1)
	
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
	
	; Convert to frequency
	kFreq1L = cpsmidinn(kNote1L)
	kFreq2L = cpsmidinn(kNote2L)
	kFreq3L = cpsmidinn(kNote3L)
	kFreq4L = cpsmidinn(kNote4L)
	
	kFreq1R = cpsmidinn(kNote1R)
	kFreq2R = cpsmidinn(kNote2R)
	kFreq3R = cpsmidinn(kNote3R)
	kFreq4R = cpsmidinn(kNote4R)
	
	if gkPrintToggle == 1 && changed(kChord1L + kChord2L*10 + kChord3L*100 + kChord4L*1000 + gkBandSelect*10000) == 1 then
		printks "\n>>> STATE harmonyBand=%s mode=Absolute progression=%d range=%d voicing=%s\n", 0, (gkBandSelect == 0 ? "Delta" : (gkBandSelect == 1 ? "Theta" : (gkBandSelect == 2 ? "Alpha" : "Beta"))), gkCurrentProgression, kRange, (gkAlternateVoicing == 0 ? "Standard close/SATB" : "Open Jazz")
		printks "    Rates Hz: V1 %.3f | V2 %.3f | V3 %.3f | V4 %.3f | scale %.3f\n", 0, kEffSpeed1, kEffSpeed2, kEffSpeed3, kEffSpeed4, gkMetroScale
		printks "    CC Modes: V1 %s | V2 %s | V3 %s | V4 %s | Vol %.3f\n", 0, (gkSensor1Mode == 0 ? "METRO" : "VOLUME"), (gkSensor2Mode == 0 ? "METRO" : "VOLUME"), (gkSensor3Mode == 0 ? "METRO" : "VOLUME"), (gkSensor4Mode == 0 ? "METRO" : "VOLUME"), gkGlobalVolume
		printks "    EEG raw L: %.3f %.3f %.3f %.3f | norm: %.3f %.3f %.3f %.3f\n", 0, kRaw1L, kRaw2L, kRaw3L, kRaw4L, kHeld1L, kHeld2L, kHeld3L, kHeld4L
		printks "    Chord slots L: V1 %d | V2 %d | V3 %d | V4 %d\n", 0, kChord1L, kChord2L, kChord3L, kChord4L
		printks "    MIDI notes L: %.0f %.0f %.0f %.0f | Hz: %.1f %.1f %.1f %.1f\n", 0, kNote1L, kNote2L, kNote3L, kNote4L, kFreq1L, kFreq2L, kFreq3L, kFreq4L
	endif
	
	icps cpsmidi
	
	; Vibrato
	kvibrato oscili 0.003, 5.2
	kdetune = 1 + kvibrato
	
	; LEFT oscillators with FIXED sensor volumes
	; Voice 1 = Delta volume
	aout1L_a oscili 0.3 * gkSensor1Vol, kFreq1L * (icps/440) * kdetune
	aout1L_b oscili 0.3 * gkSensor1Vol, kFreq1L * (icps/440) * 1.002
	aout1L = aout1L_a + aout1L_b
	
	; Voice 2 = Theta volume
	aout2L oscili 0.4 * gkSensor2Vol, kFreq2L * (icps/440) * kdetune
	
	; Voice 3 = Alpha volume
	aout3L oscili 0.4 * gkSensor3Vol, kFreq3L * (icps/440) * kdetune
	
	; Voice 4 = Beta volume
	aout4L oscili 0.4 * gkSensor4Vol, kFreq4L * (icps/440) * kdetune
	
	; RIGHT oscillators
	aout1R_a oscili 0.3 * gkSensor1Vol, kFreq1R * (icps/440) * kdetune
	aout1R_b oscili 0.3 * gkSensor1Vol, kFreq1R * (icps/440) * 0.999
	aout1R = aout1R_a + aout1R_b
	
	aout2R oscili 0.4 * gkSensor2Vol, kFreq2R * (icps/440) * kdetune
	aout3R oscili 0.4 * gkSensor3Vol, kFreq3R * (icps/440) * kdetune
	aout4R oscili 0.4 * gkSensor4Vol, kFreq4R * (icps/440) * kdetune
	
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
	gadelL += aoutL * 0.5
	gadelR += aoutR * 0.5
	gachorusL += aoutL * 0.4
	gachorusR += aoutR * 0.4
	
	outs aoutL * 0.3, aoutR * 0.3
	
endin


instr 6  ; Safe melodic generator (controlled by Gamma) - uses schedkwhen

	; Skip if melody is off
	if gkMelodyOn == 0 goto skip
	
	; Wait a bit for initialization
	kInitTime timeinsts
	if kInitTime < 0.2 goto skip
	
	; Gamma absolute power controls melody rate/activity.
	kGammaMean = (gkGammaAbs1 + gkGammaAbs2 + gkGammaAbs3 + gkGammaAbs4) / 4
	kGammaActivity = limit((kGammaMean + 2.5) / 4.0, 0, 1)
	gkMelodyActivity = portk(kGammaActivity, 0.25)
	kRate = 0.08 + (gkMelodyActivity * 1.2)
	kRate = limit(kRate, 0.05, 2.0)
	
	ktrig metro kRate
	
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
			gkPhraseRest = gkPhraseLength
		endif
		goto skip
	endif
	
	; Safe table lookup with bounds checking
	kProgIdx = limit(gkCurrentProgression - 1, 0, 9)
	kChordIdx = limit(gkCurrentChord, 0, 7)
	
	; Get root note
	kTableIdx = kChordIdx * 4
	kTableIdx = limit(kTableIdx, 0, 31)
	kRootNote tablekt kTableIdx, gi_prog1 + kProgIdx
	
	; Simple scale degree
	kDegree random 0, 7
	kDegree = int(kDegree)
	kDegree = limit(kDegree, 0, 7)
	kInterval tablekt kDegree, gi_dorian_scale
	
	kOctave = 12 + int(random(0, 2)) * 12
	kMelodyNote = kRootNote + kInterval + kOctave
	kMelodyNote = limit(kMelodyNote, 36, 96)  ; Limit to reasonable MIDI range
	
	kDur = 0.25 + (1 - gkMelodyActivity) * 0.75
	kVel = 0.12 + gkMelodyActivity * 0.28
	
	; Use schedkwhen instead of event (safer in Csound 6)
	schedkwhen ktrig, 0, 0, 7, 0, kDur, kMelodyNote, kVel
	
	if ktrig == 1 then
		gkPhraseLength = gkPhraseLength - 1
	endif
	
skip:
endin


instr 7  ; Melody voice

	iNote = p4
	iVel = p5
	
	kenv madsr 0.05, 0.2, 0.6, 0.3
	aout oscili iVel, cpsmidinn(iNote)
	aout = aout * kenv
	
	garvbL += aout * 0.4
	garvbR += aout * 0.4
	
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
	adelL delay gadelL + (adelL * 0.5), 0.375
	adelR delay gadelR + (adelR * 0.5), 0.5
	adelL butterlp adelL, 3000
	adelR butterlp adelR, 3000
	outs adelL * 0.3, adelR * 0.3
	clear gadelL, gadelR
endin


instr 8  ; Global chorus
	denorm gachorusL, gachorusR
	klfo1 oscili 0.003, 0.7
	klfo2 oscili 0.004, 0.9
	adel1L vdelay gachorusL, 10 + klfo1*5, 20
	adel2L vdelay gachorusL, 15 + klfo2*5, 20
	adel1R vdelay gachorusR, 12 + klfo2*5, 20
	adel2R vdelay gachorusR, 17 + klfo1*5, 20
	aoutL = gachorusL * 0.5 + adel1L * 0.25 + adel2L * 0.25
	aoutR = gachorusR * 0.5 + adel1R * 0.25 + adel2R * 0.25
	outs aoutL * 0.4, aoutR * 0.4
	clear gachorusL, gachorusR
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
