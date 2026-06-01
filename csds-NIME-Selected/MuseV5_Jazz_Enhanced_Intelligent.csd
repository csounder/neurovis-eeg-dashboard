<CsoundSynthesizer>
<CsOptions>
-odac -Ma -d
</CsOptions>
<CsInstruments>

/*
====================================================================
MUSE BRAINWAVE JAZZ - INTELLIGENT MELODIC SYSTEM
====================================================================

OVERVIEW:
Advanced jazz harmony system with Markov/Brownian melodic intelligence,
phrase-based generation, and warm expressive sound design.

MELODIC INTELLIGENCE:
- Markov chains for note selection based on jazz harmony
- Brownian motion for smooth melodic contours
- Automatic phrasing with musical silences
- CC1 controls melodic density (chill to frenetic)

KEYBOARD CONTROLS:
===================

CHORD PROGRESSION (numbers 1-0):
Select from 10 jazz progressions

VOICING & MELODY:
- x = Toggle alternate chord voicings
- M = Toggle melodic line on/off  
- w = Toggle Markov/Brownian mode

BAND SELECTION (lowercase):
- d/t/a/b/g = Delta/Theta/Alpha/Beta/Gamma

PLAYBACK MODE (UPPERCASE):
- R/A/B = Relative/Absolute/Both

MIDI CONTROL:
- CC 1: Melodic activity (chill to frenetic)
- CC 21-24: Sample-and-hold rates
- CC 25: Melody rate multiplier
- CC 26: Chord range (1-8)
- CC 27: Global metro scaling
- CC 28: Global volume

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
schedule 6, 0, -1  ; Melody generator
schedule 8, 0, -1  ; Global chorus

garvbL init 0
garvbR init 0
gadelL init 0
gadelR init 0
gachorusL init 0
gachorusR init 0

massign 1, 5

; ============================================================
; JAZZ CHORD PROGRESSION TABLES
; ============================================================

; Standard voicings
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

; Alternate open voicings
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

; ============================================================
; MARKOV TRANSITION TABLES FOR MELODIC INTELLIGENCE
; Probability of next scale degree given current degree
; ============================================================
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
; Global variables
; ============================================================
gkCurrentProgression init 1
gkChordRange init 8
gkAlternateVoicing init 0
gkMelodyOn init 0
gkMelodyMode init 0         ; 0=Markov, 1=Brownian
gkMelodyActivity init 0.3   ; CC1 controlled
gkCurrentChord init 0
gkLastScaleDegree init 0
gkPhraseLength init 0
gkPhraseRest init 0

; Brainwave bands
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

gkf1L init 0
gkf2L init 0
gkf3L init 0
gkf4L init 0

gkf1R init 0
gkf2R init 0
gkf3R init 0
gkf4R init 0

gkBandSelect init 2
gkPlaybackMode init 2
gkPrintToggle init 0

gkGlobalVolume init 0.618
gkMetroScale init 1.0


instr 1  ; OSC listener and relative value calculator

	gihandle OSCinit 7400

	kk1 OSClisten gihandle, "/muse/elements/delta_absolute", "ffff", gkDeltaAbs1, gkDeltaAbs2, gkDeltaAbs3, gkDeltaAbs4
	kk2 OSClisten gihandle, "/muse/elements/theta_absolute", "ffff", gkThetaAbs1, gkThetaAbs2, gkThetaAbs3, gkThetaAbs4
	kk3 OSClisten gihandle, "/muse/elements/alpha_absolute", "ffff", gkAlphaAbs1, gkAlphaAbs2, gkAlphaAbs3, gkAlphaAbs4
	kk4 OSClisten gihandle, "/muse/elements/beta_absolute", "ffff", gkBetaAbs1, gkBetaAbs2, gkBetaAbs3, gkBetaAbs4
	kk5 OSClisten gihandle, "/muse/elements/gamma_absolute", "ffff", gkGammaAbs1, gkGammaAbs2, gkGammaAbs3, gkGammaAbs4

	; Calculate RELATIVE values
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


instr 2  ; ASCII key switcher and routing

	kKey, kKeyDown sensekey
	
	; Number keys for progression selection
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
		printks ">>> Voicing: %s\n", 0, (gkAlternateVoicing == 0 ? "Standard" : "Open")
	endif
	
	; M = Toggle melody
	if kKeyDown == 1 && kKey == 77 then
		gkMelodyOn = (gkMelodyOn == 0 ? 1 : 0)
		printks ">>> Melody: %s\n", 0, (gkMelodyOn == 0 ? "OFF" : "ON")
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
	
	; R/A/B = Playback modes
	if kKeyDown == 1 && kKey == 82 then
		gkPlaybackMode = 0
		printks ">>> Mode: RELATIVE\n", 0
	endif
	if kKeyDown == 1 && kKey == 65 then
		gkPlaybackMode = 1
		printks ">>> Mode: ABSOLUTE\n", 0
	endif
	if kKeyDown == 1 && kKey == 66 then
		gkPlaybackMode = 2
		printks ">>> Mode: BOTH (L=Abs, R=Rel)\n", 0
	endif
	
	; Band selection (d/t/a/b/g)
	if kKeyDown == 1 && kKey == 100 then
		gkBandSelect = 0
		printks ">>> DELTA\n", 0
	endif
	if kKeyDown == 1 && kKey == 116 then
		gkBandSelect = 1
		printks ">>> THETA\n", 0
	endif
	if kKeyDown == 1 && kKey == 97 then
		gkBandSelect = 2
		printks ">>> ALPHA\n", 0
	endif
	if kKeyDown == 1 && kKey == 98 then
		gkBandSelect = 3
		printks ">>> BETA\n", 0
	endif
	if kKeyDown == 1 && kKey == 103 then
		gkBandSelect = 4
		printks ">>> GAMMA\n", 0
	endif
	
	; Route band data to outputs
	if gkBandSelect == 0 then
		kAbs1 = gkDeltaAbs1
		kAbs2 = gkDeltaAbs2
		kAbs3 = gkDeltaAbs3
		kAbs4 = gkDeltaAbs4
		kRel1 = gkDeltaRel1
		kRel2 = gkDeltaRel2
		kRel3 = gkDeltaRel3
		kRel4 = gkDeltaRel4
	elseif gkBandSelect == 1 then
		kAbs1 = gkThetaAbs1
		kAbs2 = gkThetaAbs2
		kAbs3 = gkThetaAbs3
		kAbs4 = gkThetaAbs4
		kRel1 = gkThetaRel1
		kRel2 = gkThetaRel2
		kRel3 = gkThetaRel3
		kRel4 = gkThetaRel4
	elseif gkBandSelect == 2 then
		kAbs1 = gkAlphaAbs1
		kAbs2 = gkAlphaAbs2
		kAbs3 = gkAlphaAbs3
		kAbs4 = gkAlphaAbs4
		kRel1 = gkAlphaRel1
		kRel2 = gkAlphaRel2
		kRel3 = gkAlphaRel3
		kRel4 = gkAlphaRel4
	elseif gkBandSelect == 3 then
		kAbs1 = gkBetaAbs1
		kAbs2 = gkBetaAbs2
		kAbs3 = gkBetaAbs3
		kAbs4 = gkBetaAbs4
		kRel1 = gkBetaRel1
		kRel2 = gkBetaRel2
		kRel3 = gkBetaRel3
		kRel4 = gkBetaRel4
	elseif gkBandSelect == 4 then
		kAbs1 = gkGammaAbs1
		kAbs2 = gkGammaAbs2
		kAbs3 = gkGammaAbs3
		kAbs4 = gkGammaAbs4
		kRel1 = gkGammaRel1
		kRel2 = gkGammaRel2
		kRel3 = gkGammaRel3
		kRel4 = gkGammaRel4
	endif
	
	if gkPlaybackMode == 0 then
		gkf1L = kRel1
		gkf2L = kRel2
		gkf3L = kRel3
		gkf4L = kRel4
		gkf1R = kRel1
		gkf2R = kRel2
		gkf3R = kRel3
		gkf4R = kRel4
	elseif gkPlaybackMode == 1 then
		gkf1L = kAbs1
		gkf2L = kAbs2
		gkf3L = kAbs3
		gkf4L = kAbs4
		gkf1R = kAbs1
		gkf2R = kAbs2
		gkf3R = kAbs3
		gkf4R = kAbs4
	elseif gkPlaybackMode == 2 then
		gkf1L = kAbs1
		gkf2L = kAbs2
		gkf3L = kAbs3
		gkf4L = kAbs4
		gkf1R = kRel1
		gkf2R = kRel2
		gkf3R = kRel3
		gkf4R = kRel4
	endif

endin


instr 5  ; Warm jazz chord synth with expression

	; Read MIDI CCs
	kspeed1 midic7 21, .01, 40
	kspeed2 midic7 22, .01, 50
	kspeed3 midic7 23, .01, 100
	kspeed4 midic7 24, .01, 10
	
	; CC1 for melody activity
	kActivityCC midic7 1, 0, 1
	if changed(kActivityCC) == 1 then
		gkMelodyActivity = kActivityCC
		printks ">>> CC1 Melody Activity: %.2f\n", 0, gkMelodyActivity
	endif
	
	; CC25 melody rate multiplier  
	kMelodyMult midic7 25, 0.1, 2
	
	; CC26 chord range
	kRangeCC midic7 26, 1, 8
	if changed(kRangeCC) == 1 then
		gkChordRange = int(kRangeCC)
		printks ">>> CC26 Chord Range: %d\n", 0, gkChordRange
	endif
	
	; CC28 volume
	kVolCC midic7 28, 0, 1
	if changed(kVolCC) == 1 then
		gkGlobalVolume = kVolCC
	endif
	
	; CC27 metro scale
	kMetroCC midic7 27, 0.01, 3
	if changed(kMetroCC) == 1 then
		gkMetroScale = kMetroCC
	endif
	
	; Apply metro scaling
	ktrig1 metro kspeed1 * gkMetroScale
	ktrig2 metro kspeed2 * gkMetroScale
	ktrig3 metro kspeed3 * gkMetroScale
	ktrig4 metro kspeed4 * gkMetroScale
	
	; Sample brainwave values
	kVal1L samphold gkf1L, ktrig1
	kVal2L samphold gkf2L, ktrig2
	kVal3L samphold gkf3L, ktrig3
	kVal4L samphold gkf4L, ktrig4
	
	kVal1R samphold gkf1R, ktrig1
	kVal2R samphold gkf2R, ktrig2
	kVal3R samphold gkf3R, ktrig3
	kVal4R samphold gkf4R, ktrig4
	
	; Map to chord selection
	kChord1L = int(kVal1L * gkChordRange)
	kChord2L = int(kVal2L * gkChordRange)
	kChord3L = int(kVal3L * gkChordRange)
	kChord4L = int(kVal4L * gkChordRange)
	
	kChord1R = int(kVal1R * gkChordRange)
	kChord2R = int(kVal2R * gkChordRange)
	kChord3R = int(kVal3R * gkChordRange)
	kChord4R = int(kVal4R * gkChordRange)
	
	; Limit range
	kChord1L = limit(kChord1L, 0, 7)
	kChord2L = limit(kChord2L, 0, 7)
	kChord3L = limit(kChord3L, 0, 7)
	kChord4L = limit(kChord4L, 0, 7)
	
	kChord1R = limit(kChord1R, 0, 7)
	kChord2R = limit(kChord2R, 0, 7)
	kChord3R = limit(kChord3R, 0, 7)
	kChord4R = limit(kChord4R, 0, 7)
	
	gkCurrentChord = int((kChord1L + kChord2L + kChord3L + kChord4L) / 4)
	
	; Select table
	if gkAlternateVoicing == 0 then
		iProgTable = gi_prog1 + (i(gkCurrentProgression) - 1)
	else
		iProgTable = gi_prog1_alt + (i(gkCurrentProgression) - 1)
	endif
	
	; Get notes
	kNote1L table kChord1L*4 + 0, iProgTable
	kNote2L table kChord2L*4 + 1, iProgTable
	kNote3L table kChord3L*4 + 2, iProgTable
	kNote4L table kChord4L*4 + 3, iProgTable
	
	kNote1R table kChord1R*4 + 0, iProgTable
	kNote2R table kChord2R*4 + 1, iProgTable
	kNote3R table kChord3R*4 + 2, iProgTable
	kNote4R table kChord4R*4 + 3, iProgTable
	
	; Convert to frequency
	kFreq1L = cpsmidinn(kNote1L)
	kFreq2L = cpsmidinn(kNote2L)
	kFreq3L = cpsmidinn(kNote3L)
	kFreq4L = cpsmidinn(kNote4L)
	
	kFreq1R = cpsmidinn(kNote1R)
	kFreq2R = cpsmidinn(kNote2R)
	kFreq3R = cpsmidinn(kNote3R)
	kFreq4R = cpsmidinn(kNote4R)
	
	icps cpsmidi
	
	; Warm oscillators with detuning and vibrato
	kvibrato oscili 0.003, 5.2
	kdetune = 1 + kvibrato
	
	; LEFT - Multiple detuned oscillators per voice for warmth
	aout1L_a oscili 0.3, kFreq1L * (icps/440) * kdetune
	aout1L_b oscili 0.3, kFreq1L * (icps/440) * 1.002
	aout1L_c oscili 0.3, kFreq1L * (icps/440) * 0.998
	aout1L = aout1L_a + aout1L_b + aout1L_c
	
	aout2L_a oscili 0.3, kFreq2L * (icps/440) * kdetune
	aout2L_b oscili 0.3, kFreq2L * (icps/440) * 1.003
	aout2L = aout2L_a + aout2L_b
	
	aout3L_a oscili 0.3, kFreq3L * (icps/440) * kdetune
	aout3L_b oscili 0.3, kFreq3L * (icps/440) * 0.997
	aout3L = aout3L_a + aout3L_b
	
	aout4L oscili 0.4, kFreq4L * (icps/440) * kdetune
	
	; RIGHT - Similar detuning
	aout1R_a oscili 0.3, kFreq1R * (icps/440) * kdetune
	aout1R_b oscili 0.3, kFreq1R * (icps/440) * 1.001
	aout1R_c oscili 0.3, kFreq1R * (icps/440) * 0.999
	aout1R = aout1R_a + aout1R_b + aout1R_c
	
	aout2R_a oscili 0.3, kFreq2R * (icps/440) * kdetune
	aout2R_b oscili 0.3, kFreq2R * (icps/440) * 1.004
	aout2R = aout2R_a + aout2R_b
	
	aout3R_a oscili 0.3, kFreq3R * (icps/440) * kdetune
	aout3R_b oscili 0.3, kFreq3R * (icps/440) * 0.996
	aout3R = aout3R_a + aout3R_b
	
	aout4R oscili 0.4, kFreq4R * (icps/440) * kdetune
	
	; Smooth envelope
	aadsr madsr 1.5, 0.8, 0.75, 1.2
	
	; Mix voices
	aoutL = (aout1L + aout2L + aout3L + aout4L) * 0.15 * aadsr * gkGlobalVolume
	aoutR = (aout1R + aout2R + aout3R + aout4R) * 0.15 * aadsr * gkGlobalVolume
	
	; Send to effects
	garvbL += aoutL * 0.7
	garvbR += aoutR * 0.7
	gadelL += aoutL * 0.5
	gadelR += aoutR * 0.5
	gachorusL += aoutL * 0.4
	gachorusR += aoutR * 0.4
	
	outs aoutL * 0.3, aoutR * 0.3
	
endin


instr 6  ; Intelligent melodic generator with phrasing

	if gkMelodyOn == 0 goto skip
	
	; Activity-based timing (CC1 controls density)
	; Low activity = slow, long notes; High = fast, short
	kBaseRate = 0.5 + (gkMelodyActivity * 4)  ; 0.5-4.5 Hz base
	kMelodyMult midic7 25, 0.1, 2
	kRate = kBaseRate * kMelodyMult
	
	ktrig metro kRate
	
	if ktrig == 1 then
		; Check if in rest period
		if gkPhraseRest > 0 then
			gkPhraseRest = gkPhraseRest - 1
			goto skip
		endif
		
		; If phrase complete, create rest
		if gkPhraseLength <= 0 then
			; New phrase length based on activity
			if gkMelodyActivity < 0.3 then
				; Chill: longer phrases (4-8 notes)
				gkPhraseLength random 4, 8
			elseif gkMelodyActivity < 0.7 then
				; Medium: medium phrases (3-6 notes)
				gkPhraseLength random 3, 6
			else
				; Frenetic: short phrases (2-4 notes)
				gkPhraseLength random 2, 4
			endif
			gkPhraseLength = int(gkPhraseLength)
			
			; Rest equals phrase length for balanced phrasing
			gkPhraseRest = gkPhraseLength
			goto skip
		endif
		
		; Get chord root
		iProgTable = gi_prog1 + (i(gkCurrentProgression) - 1)
		kRootNote table i(gkCurrentChord)*4, iProgTable
		
		; Choose next note based on mode
		if gkMelodyMode == 0 then
			; MARKOV mode - intelligent transitions
			kProb random 0, 1
			kAccum = 0
			kNextDegree = 0
			kIndex = 0
			
			; Simple Markov selection
			while kIndex < 8 do
				kTransProb table gkLastScaleDegree*8 + kIndex, gi_markov
				kAccum = kAccum + kTransProb
				if kProb <= kAccum then
					kNextDegree = kIndex
					kIndex = 8
				endif
				kIndex = kIndex + 1
			od
			
			gkLastScaleDegree = kNextDegree
			
		else
			; BROWNIAN mode - smooth contours
			kStep random -2, 2
			kNextDegree = gkLastScaleDegree + kStep
			kNextDegree = abs(kNextDegree % 8)
			gkLastScaleDegree = kNextDegree
		endif
		
		; Get interval from scale
		kInterval table kNextDegree, gi_dorian_scale
		
		; Octave based on activity
		if gkMelodyActivity < 0.3 then
			kOctave = 12  ; Chill: lower octave
		elseif gkMelodyActivity < 0.7 then
			kOctave random 12, 24
		else
			kOctave random 12, 36  ; Frenetic: wider range
		endif
		
		kMelodyNote = kRootNote + kInterval + int(kOctave)
		
		; Duration based on activity
		if gkMelodyActivity < 0.3 then
			kDur = 2.0 / kRate  ; Long notes
		elseif gkMelodyActivity < 0.7 then
			kDur = 1.0 / kRate
		else
			kDur = 0.5 / kRate  ; Short notes
		endif
		
		; Velocity based on position in phrase
		kVel = 0.3 + (0.3 * (1 - gkPhraseLength/8))
		
		; Trigger note
		event "i", 7, 0, kDur, kMelodyNote, kVel
		
		gkPhraseLength = gkPhraseLength - 1
	endif
	
skip:
endin


instr 7  ; Expressive melody voice

	iNote = p4
	iVel = p5
	
	; Smooth envelope for expression
	kenv madsr 0.05, 0.2, 0.6, 0.3
	
	; Vibrato
	kvib oscili 0.004, 5.5
	kfreq = cpsmidinn(iNote) * (1 + kvib)
	
	; Warm tone with multiple oscillators
	aout1 oscili iVel * 0.4, kfreq
	aout2 oscili iVel * 0.3, kfreq * 1.001
	aout3 oscili iVel * 0.3, kfreq * 0.999
	
	aout = (aout1 + aout2 + aout3) * kenv
	
	; Light chorus effect
	adelL delay aout, 0.011
	adelR delay aout, 0.013
	
	aoutL = aout * 0.7 + adelL * 0.3
	aoutR = aout * 0.7 + adelR * 0.3
	
	; Send to effects and output
	garvbL += aoutL * 0.6
	garvbR += aoutR * 0.6
	gachorusL += aoutL * 0.3
	gachorusR += aoutR * 0.3
	
	outs aoutL * 0.5, aoutR * 0.5
	
endin


instr 3  ; Global warm reverb

	denorm garvbL, garvbR
	
	; Rich reverb
	aL, aR reverbsc garvbL, garvbR, 0.88, 9000
	
	; Add warmth with gentle highpass
	aL butterhp aL, 80
	aR butterhp aR, 80
	
	outs aL * 0.5, aR * 0.5
	
	clear garvbL, garvbR
	
endin


instr 4  ; Global stereo delay

	adelL init 0
	adelR init 0
	
	denorm gadelL, gadelR
	
	; Feedback delays
	adelL delay gadelL + (adelL * 0.5), 0.375
	adelR delay gadelR + (adelR * 0.5), 0.5
	
	; Warm filtering
	adelL butterlp adelL, 3000
	adelR butterlp adelR, 3000
	
	outs adelL * 0.3, adelR * 0.3
	
	clear gadelL, gadelR
	
endin


instr 8  ; Global stereo chorus

	denorm gachorusL, gachorusR
	
	; LFO for chorus
	klfo1 oscili 0.003, 0.7
	klfo2 oscili 0.004, 0.9
	
	; Variable delays
	adel1L vdelay gachorusL, 10 + klfo1*5, 20
	adel2L vdelay gachorusL, 15 + klfo2*5, 20
	adel1R vdelay gachorusR, 12 + klfo2*5, 20
	adel2R vdelay gachorusR, 17 + klfo1*5, 20
	
	; Mix
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
