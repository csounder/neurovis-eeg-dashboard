<CsoundSynthesizer>
<CsOptions>
-odac -Ma -d
</CsOptions>
<CsInstruments>

/*
====================================================================
MUSE BRAINWAVE JAZZ CHORD PROGRESSION INSTRUMENT
====================================================================

OVERVIEW:
This instrument receives OSC data from the Muse EEG headband and maps
brainwave data to jazz chord progressions using SATB voicing.

CHORD MAPPING:
- Each sensor selects from SATB (Soprano, Alto, Tenor, Bass) voices
- Sensor 1: Bass, Sensor 2: Tenor, Sensor 3: Alto, Sensor 4: Soprano
- Brainwave values select which chord in the progression to play

KEYBOARD CONTROLS:
===================

CHORD PROGRESSION SELECTION (numbers):
- 1 = ii-V-I-vi (Dm7-G7-CMaj7-Am7)
- 2 = I-vi-ii-V (CMaj7-Am7-Dm7-G7)
- 3 = iii-vi-ii-V (Em7-Am7-Dm7-G7)
- 4 = I-IV-iii-vi (CMaj7-FMaj7-Em7-Am7)
- 5 = ii-V-iii-vi (Dm7-G7-Em7-Am7)
- 6 = IVMaj7-V7-iii-vi (FMaj7-G7-Em7-Am7)
- 7 = vi-ii-V-I (Am7-Dm7-G7-CMaj7)
- 8 = I-I7-IV-iv (CMaj7-C7-FMaj7-Fm7)
- 9 = ii-bII7-I-vi (Dm7-Db7-CMaj7-Am7)
- 0 = I-bVII-IV-I (CMaj7-BbMaj7-FMaj7-CMaj7)

BAND SELECTION (lowercase):
- d = Delta band
- t = Theta band
- a = Alpha band
- b = Beta band
- g = Gamma band

PLAYBACK MODE (UPPERCASE):
- R = Relative mode (both L+R channels play relative values)
- A = Absolute mode (both L+R channels play absolute values)
- B = Both mode (L=absolute, R=relative for A/B comparison)

DISPLAY:
- P = Toggle printout of incoming values on/off

MIDI CONTROL:
- CC 21,22,23,24: Sample-and-hold rates for 4 EEG sensors
- CC 25: Chord range (1-8 chords accessible from progression)
- CC 27: Global metro scaling (0.01 to 3, default 1.0)
- CC 28: Global volume (0 to 1, default 0.618)

====================================================================
*/

sr = 44100
ksmps = 100
nchnls = 2
0dbfs = 1.0

schedule 1, 0, -1
schedule 2, 0, -1
schedule 3, 0, -1
schedule 4, 0, -1

garvbL init 0
garvbR init 0

gadelL init 0
gadelR init 0

massign 1, 5

; ============================================================
; JAZZ CHORD PROGRESSION TABLES (SATB voicing in MIDI notes)
; Each table has 8 chords x 4 voices = 32 values
; Format: B1,T1,A1,S1, B2,T2,A2,S2, ... B8,T8,A8,S8
; ============================================================

; Progression 1: ii-V-I-vi-iii-VI-ii-V (Dm7-G7-CMaj7-Am7-Em7-AMaj7-Dm7-G7)
gi_prog1 ftgen 0, 0, 32, -2, \
    50,62,65,69,  43,59,62,65,  48,60,64,67,  45,57,60,64, \
    52,59,64,67,  45,57,61,64,  50,62,65,69,  43,59,62,65

; Progression 2: I-vi-ii-V-iii-vi-IV-V (CMaj7-Am7-Dm7-G7-Em7-Am7-FMaj7-G7)
gi_prog2 ftgen 0, 0, 32, -2, \
    48,60,64,67,  45,57,60,64,  50,62,65,69,  43,59,62,65, \
    52,59,64,67,  45,57,60,64,  53,60,65,69,  43,59,62,65

; Progression 3: iii-vi-ii-V-I-IV-vii-iii (Em7-Am7-Dm7-G7-CMaj7-FMaj7-Bm7b5-Em7)
gi_prog3 ftgen 0, 0, 32, -2, \
    52,59,64,67,  45,57,60,64,  50,62,65,69,  43,59,62,65, \
    48,60,64,67,  53,60,65,69,  47,59,62,65,  52,59,64,67

; Progression 4: I-IV-iii-vi-ii-V-I-V7 (CMaj7-FMaj7-Em7-Am7-Dm7-G7-CMaj7-G7)
gi_prog4 ftgen 0, 0, 32, -2, \
    48,60,64,67,  53,60,65,69,  52,59,64,67,  45,57,60,64, \
    50,62,65,69,  43,59,62,65,  48,60,64,67,  43,59,62,65

; Progression 5: ii-V-iii-vi-IV-vii-iii-vi (Dm7-G7-Em7-Am7-FMaj7-Bm7b5-Em7-Am7)
gi_prog5 ftgen 0, 0, 32, -2, \
    50,62,65,69,  43,59,62,65,  52,59,64,67,  45,57,60,64, \
    53,60,65,69,  47,59,62,65,  52,59,64,67,  45,57,60,64

; Progression 6: IVMaj7-V7-iii-vi-ii-V-I-vi (FMaj7-G7-Em7-Am7-Dm7-G7-CMaj7-Am7)
gi_prog6 ftgen 0, 0, 32, -2, \
    53,60,65,69,  43,59,62,65,  52,59,64,67,  45,57,60,64, \
    50,62,65,69,  43,59,62,65,  48,60,64,67,  45,57,60,64

; Progression 7: vi-ii-V-I-IV-I-ii-V (Am7-Dm7-G7-CMaj7-FMaj7-CMaj7-Dm7-G7)
gi_prog7 ftgen 0, 0, 32, -2, \
    45,57,60,64,  50,62,65,69,  43,59,62,65,  48,60,64,67, \
    53,60,65,69,  48,60,64,67,  50,62,65,69,  43,59,62,65

; Progression 8: I-I7-IV-iv-I-vi-ii-V (CMaj7-C7-FMaj7-Fm7-CMaj7-Am7-Dm7-G7)
gi_prog8 ftgen 0, 0, 32, -2, \
    48,60,64,67,  48,58,64,66,  53,60,65,69,  53,60,65,68, \
    48,60,64,67,  45,57,60,64,  50,62,65,69,  43,59,62,65

; Progression 9: ii-bII7-I-vi-ii-V-iii-vi (Dm7-Db7-CMaj7-Am7-Dm7-G7-Em7-Am7)
gi_prog9 ftgen 0, 0, 32, -2, \
    50,62,65,69,  49,61,64,67,  48,60,64,67,  45,57,60,64, \
    50,62,65,69,  43,59,62,65,  52,59,64,67,  45,57,60,64

; Progression 10: I-bVII-IV-I-ii-V-I-I (CMaj7-BbMaj7-FMaj7-CMaj7-Dm7-G7-CMaj7-CMaj7)
gi_prog10 ftgen 0, 0, 32, -2, \
    48,60,64,67,  46,58,62,65,  53,60,65,69,  48,60,64,67, \
    50,62,65,69,  43,59,62,65,  48,60,64,67,  48,60,64,67

; ============================================================
; Global variables
; ============================================================
gkCurrentProgression init 1  ; Which chord progression table (1-10)
gkChordRange init 8          ; How many chords accessible (1-8)

; ============================================================
; ABSOLUTE brainwave bands (received via OSC)
; ============================================================
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

; ============================================================
; CALCULATED RELATIVE brainwave bands (derived from absolute)
; ============================================================
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

; ============================================================
; Active outputs for LEFT and RIGHT channels
; ============================================================
gkf1L init 0
gkf2L init 0
gkf3L init 0
gkf4L init 0

gkf1R init 0
gkf2R init 0
gkf3R init 0
gkf4R init 0

; ============================================================
; User selections (k-rate for real-time changes)
; ============================================================
gkBandSelect init 2      ; Current band: 0=delta, 1=theta, 2=alpha, 3=beta, 4=gamma
gkPlaybackMode init 2    ; Playback mode: 0=relative, 1=absolute, 2=both(L/R)
gkPrintToggle init 0     ; Print toggle: 0=off, 1=on (k-rate for runtime toggle)

; ============================================================
; Global controls (set defaults here)
; ============================================================
gkGlobalVolume init 0.618   ; Global volume (0 to 1)
gkMetroScale init 1.0       ; Metro scaling (0.01 to 3)


instr 1  ; OSC listener and relative value calculator
/*
Receives absolute brainwave values via OSC from Muse headband
Calculates relative values using the formula:
  relative = (10^absolute) / sum(10^all_bands)
*/

	gihandle OSCinit 7400

	; Listen to ABSOLUTE bands from Muse OSC stream
	kk1 OSClisten gihandle, "/muse/elements/delta_absolute", "ffff", gkDeltaAbs1, gkDeltaAbs2, gkDeltaAbs3, gkDeltaAbs4
	kk2 OSClisten gihandle, "/muse/elements/theta_absolute", "ffff", gkThetaAbs1, gkThetaAbs2, gkThetaAbs3, gkThetaAbs4
	kk3 OSClisten gihandle, "/muse/elements/alpha_absolute", "ffff", gkAlphaAbs1, gkAlphaAbs2, gkAlphaAbs3, gkAlphaAbs4
	kk4 OSClisten gihandle, "/muse/elements/beta_absolute", "ffff", gkBetaAbs1, gkBetaAbs2, gkBetaAbs3, gkBetaAbs4
	kk5 OSClisten gihandle, "/muse/elements/gamma_absolute", "ffff", gkGammaAbs1, gkGammaAbs2, gkGammaAbs3, gkGammaAbs4

	; Calculate RELATIVE values from absolute (sensor 1)
	; Convert log-scale to linear, then normalize as percentage
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

	; Sensor 2
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

	; Sensor 3
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

	; Sensor 4
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
/*
Handles keyboard input for band selection, playback mode, chord progression
*/

	kKey, kKeyDown sensekey
	
	; ============================================================
	; CHORD PROGRESSION SELECTION (number keys)
	; ============================================================
	if kKeyDown == 1 && kKey == 49 then  ; 1
		gkCurrentProgression = 1
		printks ">>> Progression 1: ii-V-I-vi (Dm7-G7-CMaj7-Am7...)\n", 0
	endif
	if kKeyDown == 1 && kKey == 50 then  ; 2
		gkCurrentProgression = 2
		printks ">>> Progression 2: I-vi-ii-V (CMaj7-Am7-Dm7-G7...)\n", 0
	endif
	if kKeyDown == 1 && kKey == 51 then  ; 3
		gkCurrentProgression = 3
		printks ">>> Progression 3: iii-vi-ii-V (Em7-Am7-Dm7-G7...)\n", 0
	endif
	if kKeyDown == 1 && kKey == 52 then  ; 4
		gkCurrentProgression = 4
		printks ">>> Progression 4: I-IV-iii-vi (CMaj7-FMaj7-Em7-Am7...)\n", 0
	endif
	if kKeyDown == 1 && kKey == 53 then  ; 5
		gkCurrentProgression = 5
		printks ">>> Progression 5: ii-V-iii-vi (Dm7-G7-Em7-Am7...)\n", 0
	endif
	if kKeyDown == 1 && kKey == 54 then  ; 6
		gkCurrentProgression = 6
		printks ">>> Progression 6: IVMaj7-V7-iii-vi (FMaj7-G7-Em7-Am7...)\n", 0
	endif
	if kKeyDown == 1 && kKey == 55 then  ; 7
		gkCurrentProgression = 7
		printks ">>> Progression 7: vi-ii-V-I (Am7-Dm7-G7-CMaj7...)\n", 0
	endif
	if kKeyDown == 1 && kKey == 56 then  ; 8
		gkCurrentProgression = 8
		printks ">>> Progression 8: I-I7-IV-iv (CMaj7-C7-FMaj7-Fm7...)\n", 0
	endif
	if kKeyDown == 1 && kKey == 57 then  ; 9
		gkCurrentProgression = 9
		printks ">>> Progression 9: ii-bII7-I-vi (Dm7-Db7-CMaj7-Am7...)\n", 0
	endif
	if kKeyDown == 1 && kKey == 48 then  ; 0
		gkCurrentProgression = 10
		printks ">>> Progression 10: I-bVII-IV-I (CMaj7-BbMaj7-FMaj7-CMaj7...)\n", 0
	endif
	
	; ============================================================
	; PRINT TOGGLE
	; ============================================================
	; P = 112 (lowercase) or 80 (uppercase) - Toggle print
	if kKeyDown == 1 && (kKey == 112 || kKey == 80) then
		gkPrintToggle = (gkPrintToggle == 0 ? 1 : 0)
		if gkPrintToggle == 1 then
			printks ">>> PRINT ON\n", 0
		else
			printks ">>> PRINT OFF\n", 0
		endif
	endif
	
	; ============================================================
	; PLAYBACK MODE SELECTION (UPPERCASE)
	; ============================================================
	; R = 82 (Relative mode - both channels)
	if kKeyDown == 1 && kKey == 82 then
		gkPlaybackMode = 0
		printks ">>> PLAYBACK MODE: RELATIVE (both channels)\n", 0
	endif
	
	; A = 65 (Absolute mode - both channels)
	if kKeyDown == 1 && kKey == 65 then
		gkPlaybackMode = 1
		printks ">>> PLAYBACK MODE: ABSOLUTE (both channels)\n", 0
	endif
	
	; B = 66 (Both mode - L=absolute, R=relative)
	if kKeyDown == 1 && kKey == 66 then
		gkPlaybackMode = 2
		printks ">>> PLAYBACK MODE: BOTH (L=Absolute, R=Relative)\n", 0
	endif
	
	; ============================================================
	; BAND SELECTION (lowercase)
	; ============================================================
	; d = 100 (Delta)
	if kKeyDown == 1 && kKey == 100 then
		gkBandSelect = 0
		printks ">>> DELTA selected (1-4 Hz)\n", 0
	endif
	
	; t = 116 (Theta)
	if kKeyDown == 1 && kKey == 116 then
		gkBandSelect = 1
		printks ">>> THETA selected (4-8 Hz)\n", 0
	endif
	
	; a = 97 (Alpha)
	if kKeyDown == 1 && kKey == 97 then
		gkBandSelect = 2
		printks ">>> ALPHA selected (7.5-13 Hz)\n", 0
	endif
	
	; b = 98 (Beta)
	if kKeyDown == 1 && kKey == 98 then
		gkBandSelect = 3
		printks ">>> BETA selected (13-30 Hz)\n", 0
	endif
	
	; g = 103 (Gamma)
	if kKeyDown == 1 && kKey == 103 then
		gkBandSelect = 4
		printks ">>> GAMMA selected (30-44 Hz)\n", 0
	endif
	
	; ============================================================
	; ROUTING: Select band and route to L/R based on playback mode
	; ============================================================
	
	; First, select the active band
	if gkBandSelect == 0 then
		; === DELTA ===
		kAbs1 = gkDeltaAbs1
		kAbs2 = gkDeltaAbs2
		kAbs3 = gkDeltaAbs3
		kAbs4 = gkDeltaAbs4
		kRel1 = gkDeltaRel1
		kRel2 = gkDeltaRel2
		kRel3 = gkDeltaRel3
		kRel4 = gkDeltaRel4
		
	elseif gkBandSelect == 1 then
		; === THETA ===
		kAbs1 = gkThetaAbs1
		kAbs2 = gkThetaAbs2
		kAbs3 = gkThetaAbs3
		kAbs4 = gkThetaAbs4
		kRel1 = gkThetaRel1
		kRel2 = gkThetaRel2
		kRel3 = gkThetaRel3
		kRel4 = gkThetaRel4
		
	elseif gkBandSelect == 2 then
		; === ALPHA ===
		kAbs1 = gkAlphaAbs1
		kAbs2 = gkAlphaAbs2
		kAbs3 = gkAlphaAbs3
		kAbs4 = gkAlphaAbs4
		kRel1 = gkAlphaRel1
		kRel2 = gkAlphaRel2
		kRel3 = gkAlphaRel3
		kRel4 = gkAlphaRel4
		
	elseif gkBandSelect == 3 then
		; === BETA ===
		kAbs1 = gkBetaAbs1
		kAbs2 = gkBetaAbs2
		kAbs3 = gkBetaAbs3
		kAbs4 = gkBetaAbs4
		kRel1 = gkBetaRel1
		kRel2 = gkBetaRel2
		kRel3 = gkBetaRel3
		kRel4 = gkBetaRel4
		
	elseif gkBandSelect == 4 then
		; === GAMMA ===
		kAbs1 = gkGammaAbs1
		kAbs2 = gkGammaAbs2
		kAbs3 = gkGammaAbs3
		kAbs4 = gkGammaAbs4
		kRel1 = gkGammaRel1
		kRel2 = gkGammaRel2
		kRel3 = gkGammaRel3
		kRel4 = gkGammaRel4
	endif
	
	; Now route to L/R based on playback mode
	if gkPlaybackMode == 0 then
		; RELATIVE mode - both channels play relative
		gkf1L = kRel1
		gkf2L = kRel2
		gkf3L = kRel3
		gkf4L = kRel4
		gkf1R = kRel1
		gkf2R = kRel2
		gkf3R = kRel3
		gkf4R = kRel4
		
	elseif gkPlaybackMode == 1 then
		; ABSOLUTE mode - both channels play absolute
		gkf1L = kAbs1
		gkf2L = kAbs2
		gkf3L = kAbs3
		gkf4L = kAbs4
		gkf1R = kAbs1
		gkf2R = kAbs2
		gkf3R = kAbs3
		gkf4R = kAbs4
		
	elseif gkPlaybackMode == 2 then
		; BOTH mode - L=absolute, R=relative
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


instr 5  ; MIDI synth - Jazz chord progressions
/*
Maps brainwave data to jazz chord progressions
Sensor 1: Bass, Sensor 2: Tenor, Sensor 3: Alto, Sensor 4: Soprano
*/
 
	; Read MIDI CC controllers
	kspeed1 midic7 21, .01, 40
	kspeed2 midic7 22, .01, 50
	kspeed3 midic7 23, .01, 100
	kspeed4 midic7 24, .01, 10
	
	; Read chord range CC25 (1-8 chords)
	kRangeCC midic7 25, 1, 8
	if changed(kRangeCC) == 1 then
		gkChordRange = int(kRangeCC)
		printks ">>> CC25 Chord Range changed to %d chords\n", 0, gkChordRange
	endif
	
	; Read global volume CC28
	kVolCC midic7 28, 0, 1
	if changed(kVolCC) == 1 then
		gkGlobalVolume = kVolCC
		printks ">>> CC28 Volume changed to %.3f\n", 0, gkGlobalVolume
	endif
	
	; Read metro scaling CC27 (0.01 to 3 range)
	kMetroCC midic7 27, 0.01, 3
	if changed(kMetroCC) == 1 then
		gkMetroScale = kMetroCC
		printks ">>> CC27 MetroScale changed to %.3f (x%d%%)\n", 0, gkMetroScale, gkMetroScale*100
	endif
	
	; Display controller settings on first note
	kFirstNote init 1
	if kFirstNote == 1 then
		printks ">>> JAZZ CHORD PROGRESSION MODE\n", 0
		printks "    Current Progression: %d\n", 0, gkCurrentProgression
		printks "    CC25 Chord Range: %d chords\n", 0, gkChordRange
		printks "    CC28 GlobalVolume = %.3f\n", 0, gkGlobalVolume
		printks "    CC27 MetroScale = %.3f\n", 0, gkMetroScale
		kFirstNote = 0
	endif
	
	; Apply global metro scaling
	ktrig1 metro kspeed1 * gkMetroScale
	ktrig2 metro kspeed2 * gkMetroScale
	ktrig3 metro kspeed3 * gkMetroScale
	ktrig4 metro kspeed4 * gkMetroScale
	
	; Sample and hold the brainwave values
	kVal1L samphold gkf1L, ktrig1
	kVal2L samphold gkf2L, ktrig2
	kVal3L samphold gkf3L, ktrig3
	kVal4L samphold gkf4L, ktrig4
	
	kVal1R samphold gkf1R, ktrig1
	kVal2R samphold gkf2R, ktrig2
	kVal3R samphold gkf3R, ktrig3
	kVal4R samphold gkf4R, ktrig4
	
	; Map brainwave values (0-1 for relative, variable for absolute) to chord selection
	; Scale to 0-ChordRange then select chord
	kChord1L = int(kVal1L * gkChordRange) 
	kChord2L = int(kVal2L * gkChordRange)
	kChord3L = int(kVal3L * gkChordRange)
	kChord4L = int(kVal4L * gkChordRange)
	
	kChord1R = int(kVal1R * gkChordRange)
	kChord2R = int(kVal2R * gkChordRange)
	kChord3R = int(kVal3R * gkChordRange)
	kChord4R = int(kVal4R * gkChordRange)
	
	; Limit to valid chord range (0 to 7)
	kChord1L = (kChord1L < 0 ? 0 : (kChord1L > 7 ? 7 : kChord1L))
	kChord2L = (kChord2L < 0 ? 0 : (kChord2L > 7 ? 7 : kChord2L))
	kChord3L = (kChord3L < 0 ? 0 : (kChord3L > 7 ? 7 : kChord3L))
	kChord4L = (kChord4L < 0 ? 0 : (kChord4L > 7 ? 7 : kChord4L))
	
	kChord1R = (kChord1R < 0 ? 0 : (kChord1R > 7 ? 7 : kChord1R))
	kChord2R = (kChord2R < 0 ? 0 : (kChord2R > 7 ? 7 : kChord2R))
	kChord3R = (kChord3R < 0 ? 0 : (kChord3R > 7 ? 7 : kChord3R))
	kChord4R = (kChord4R < 0 ? 0 : (kChord4R > 7 ? 7 : kChord4R))
	
	; Select the current progression table
	iProgTable = gi_prog1 + (i(gkCurrentProgression) - 1)
	
	; Look up MIDI notes from chord table for LEFT channel
	; Each chord has 4 notes (SATB), chord position = chord# * 4
	kNote1L table kChord1L*4 + 0, iProgTable  ; Bass
	kNote2L table kChord2L*4 + 1, iProgTable  ; Tenor  
	kNote3L table kChord3L*4 + 2, iProgTable  ; Alto
	kNote4L table kChord4L*4 + 3, iProgTable  ; Soprano
	
	; Look up MIDI notes for RIGHT channel
	kNote1R table kChord1R*4 + 0, iProgTable  ; Bass
	kNote2R table kChord2R*4 + 1, iProgTable  ; Tenor
	kNote3R table kChord3R*4 + 2, iProgTable  ; Alto
	kNote4R table kChord4R*4 + 3, iProgTable  ; Soprano
	
	; Convert MIDI to frequency
	kFreq1L = cpsmidinn(kNote1L)
	kFreq2L = cpsmidinn(kNote2L)
	kFreq3L = cpsmidinn(kNote3L)
	kFreq4L = cpsmidinn(kNote4L)
	
	kFreq1R = cpsmidinn(kNote1R)
	kFreq2R = cpsmidinn(kNote2R)
	kFreq3R = cpsmidinn(kNote3R)
	kFreq4R = cpsmidinn(kNote4R)
	
	; Get base MIDI note frequency for transposition
	icps cpsmidi
	
	; LEFT CHANNEL oscillators (transposed by MIDI note)
	aout1L = oscili(0.5, kFreq1L * (icps/440))
	aout2L = oscili(0.5, kFreq2L * (icps/440))
	aout3L = oscili(0.5, kFreq3L * (icps/440))
	aout4L = oscili(0.5, kFreq4L * (icps/440))
	
	; RIGHT CHANNEL oscillators
	aout1R = oscili(0.5, kFreq1R * (icps/440))
	aout2R = oscili(0.5, kFreq2R * (icps/440))
	aout3R = oscili(0.5, kFreq3R * (icps/440))
	aout4R = oscili(0.5, kFreq4R * (icps/440))
	
	aadsr madsr 1, 0.5, 0.8, .9
	
	aoutL = ((aout1L + aout2L + aout3L + aout4L)/8) * aadsr * gkGlobalVolume
	aoutR = ((aout1R + aout2R + aout3R + aout4R)/8) * aadsr * gkGlobalVolume
	
	garvbL += aoutL * 0.8
	garvbR += aoutR * 0.8
	gadelL += aoutL * 0.8
	gadelR += aoutR * 0.8
	
	outs aoutL, aoutR
	
endin


instr 3  ; Stereo reverb
	denorm garvbL
	denorm garvbR
	aout1, aout2 reverbsc garvbL, garvbR, 0.8, 8000
	outs aout1, aout2
	clear garvbL
	clear garvbR
endin


instr 4  ; Stereo delay with filtering
	adelL init 0
	adelR init 0
	denorm gadelL
	denorm gadelR
	adelL delay gadelL + (adelL * 0.72), 2
	adelR delay gadelR + (adelR * 0.7), 2
	adelOutL moogvcf adelL, 2000, 0.4
	adelOutR moogvcf adelR, 2000, 0.6
	outs adelOutL, adelOutR
	clear gadelL
	clear gadelR
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
