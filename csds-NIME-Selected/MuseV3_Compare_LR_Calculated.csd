<CsoundSynthesizer>
<CsOptions>
-odac -Ma -d
</CsOptions>
<CsInstruments>

/*
====================================================================
MUSE BRAINWAVE COMPARISON INSTRUMENT
====================================================================

OVERVIEW:
This instrument receives OSC data from the Muse EEG headband and allows
real-time comparison between ABSOLUTE and RELATIVE brainwave measurements.

ABSOLUTE vs RELATIVE:
- ABSOLUTE: Log-scale dB values of raw brainwave power in each frequency band
- RELATIVE: Percentage of total power (0-1 range), calculated as:
  relative = (10^absolute) / sum(10^all_bands)
  
BRAINWAVE BANDS:
- Delta (1-4 Hz):   Deep meditation, dreamless sleep
- Theta (4-8 Hz):   Deep meditation, learning, intuition
- Alpha (7.5-13 Hz): Present moment awareness, relaxed focus
- Beta (13-30 Hz):  Normal waking consciousness, problem solving
- Gamma (30-44 Hz): Rapid processing, peak awareness

KEYBOARD CONTROLS:
===================

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
- CC 21,22,23,24 on MIDI channel 1 control sample-and-hold rates
  for the 4 EEG sensors
- CC 28: Global volume (0 to 1, default 0.618)
- CC 27: Global metro scaling (0.01 to 3, default 1.0)

SIGNAL FLOW:
1. Instr 1: Receives OSC absolute values, calculates relative values
2. Instr 2: Keyboard control and value routing
3. Instr 5: MIDI synth - generates audio from brainwave data
4. Instr 3: Reverb
5. Instr 4: Delay

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
Handles keyboard input for:
1. Band selection (d/t/a/b/g lowercase for Delta/Theta/Alpha/Beta/Gamma)
2. Playback mode (R/A/B UPPERCASE for Relative/Absolute/Both)
3. Print toggle (P)

Routes selected values to L/R channels based on playback mode
*/

	kKey, kKeyDown sensekey
	
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
		
		if gkPrintToggle == 1 then
			printks "ABS: %.3f %.3f %.3f %.3f | REL: %.3f %.3f %.3f %.3f\n", 0.5, gkDeltaAbs1, gkDeltaAbs2, gkDeltaAbs3, gkDeltaAbs4, gkDeltaRel1, gkDeltaRel2, gkDeltaRel3, gkDeltaRel4
		endif
		
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
		
		if gkPrintToggle == 1 then
			printks "ABS: %.3f %.3f %.3f %.3f | REL: %.3f %.3f %.3f %.3f\n", 0.5, gkThetaAbs1, gkThetaAbs2, gkThetaAbs3, gkThetaAbs4, gkThetaRel1, gkThetaRel2, gkThetaRel3, gkThetaRel4
		endif
		
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
		
		if gkPrintToggle == 1 then
			printks "ABS: %.3f %.3f %.3f %.3f | REL: %.3f %.3f %.3f %.3f\n", 0.5, gkAlphaAbs1, gkAlphaAbs2, gkAlphaAbs3, gkAlphaAbs4, gkAlphaRel1, gkAlphaRel2, gkAlphaRel3, gkAlphaRel4
		endif
		
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
		
		if gkPrintToggle == 1 then
			printks "ABS: %.3f %.3f %.3f %.3f | REL: %.3f %.3f %.3f %.3f\n", 0.5, gkBetaAbs1, gkBetaAbs2, gkBetaAbs3, gkBetaAbs4, gkBetaRel1, gkBetaRel2, gkBetaRel3, gkBetaRel4
		endif
		
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
		
		if gkPrintToggle == 1 then
			printks "ABS: %.3f %.3f %.3f %.3f | REL: %.3f %.3f %.3f %.3f\n", 0.5, gkGammaAbs1, gkGammaAbs2, gkGammaAbs3, gkGammaAbs4, gkGammaRel1, gkGammaRel2, gkGammaRel3, gkGammaRel4
		endif
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


instr 5  ; MIDI synth - STEREO output based on playback mode
/*
Generates audio from brainwave data using MIDI notes.
- 4 oscillators per channel, detuned by brainwave sensor values
- Sample-and-hold controlled by MIDI CC 21-24
- Scaling: Absolute *3, Relative *15 to match pitch range
*/
 
	; Read MIDI CC controllers
	kspeed1 midic7 21, .01, 40
	kspeed2 midic7 22, .01, 50
	kspeed3 midic7 23, .01, 100
	kspeed4 midic7 24, .01, 10
	
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
		printks "    M1: %.2fHz -> %.2fHz | M2: %.2fHz -> %.2fHz\n", 0, kspeed1, kspeed1*gkMetroScale, kspeed2, kspeed2*gkMetroScale
		printks "    M3: %.2fHz -> %.2fHz | M4: %.2fHz -> %.2fHz\n", 0, kspeed3, kspeed3*gkMetroScale, kspeed4, kspeed4*gkMetroScale
	endif
	
	; Display controller settings on first note
	kFirstNote init 1
	if kFirstNote == 1 then
		printks ">>> MIDI CC SETTINGS AT START:\n", 0
		printks "    CC28 GlobalVolume = %.3f\n", 0, gkGlobalVolume
		printks "    CC27 MetroScale = %.3f (x%d%%)\n", 0, gkMetroScale, gkMetroScale*100
		printks "    CC21 Metro1: %.2fHz (scaled: %.2fHz)\n", 0, kspeed1, kspeed1*gkMetroScale
		printks "    CC22 Metro2: %.2fHz (scaled: %.2fHz)\n", 0, kspeed2, kspeed2*gkMetroScale
		printks "    CC23 Metro3: %.2fHz (scaled: %.2fHz)\n", 0, kspeed3, kspeed3*gkMetroScale
		printks "    CC24 Metro4: %.2fHz (scaled: %.2fHz)\n", 0, kspeed4, kspeed4*gkMetroScale
		kFirstNote = 0
	endif
	
	; Monitor individual metro CC changes
	if changed(kspeed1) == 1 then
		printks ">>> CC21 Metro1 changed: %.2fHz (scaled: %.2fHz)\n", 0, kspeed1, kspeed1*gkMetroScale
	endif
	if changed(kspeed2) == 1 then
		printks ">>> CC22 Metro2 changed: %.2fHz (scaled: %.2fHz)\n", 0, kspeed2, kspeed2*gkMetroScale
	endif
	if changed(kspeed3) == 1 then
		printks ">>> CC23 Metro3 changed: %.2fHz (scaled: %.2fHz)\n", 0, kspeed3, kspeed3*gkMetroScale
	endif
	if changed(kspeed4) == 1 then
		printks ">>> CC24 Metro4 changed: %.2fHz (scaled: %.2fHz)\n", 0, kspeed4, kspeed4*gkMetroScale
	endif
	
	; Apply global metro scaling
	ktrig1 metro kspeed1 * gkMetroScale
	ktrig2 metro kspeed2 * gkMetroScale
	ktrig3 metro kspeed3 * gkMetroScale
	ktrig4 metro kspeed4 * gkMetroScale
	
	; LEFT CHANNEL - scale based on playback mode
	; If absolute (mode 1,2): multiply by 3
	; If relative (mode 0): multiply by 15
	kScaleL = (gkPlaybackMode == 0 ? 15 : 3)
	kf1L samphold gkf1L * kScaleL, ktrig1
	kf2L samphold gkf2L * kScaleL, ktrig2
	kf3L samphold gkf3L * kScaleL, ktrig3
	kf4L samphold gkf4L * kScaleL, ktrig4
	
	; RIGHT CHANNEL - scale based on playback mode
	; If absolute (mode 1): multiply by 3
	; If relative (mode 0,2): multiply by 15
	kScaleR = ((gkPlaybackMode == 0 || gkPlaybackMode == 2) ? 15 : 3)
	kf1R samphold gkf1R * kScaleR, ktrig1
	kf2R samphold gkf2R * kScaleR, ktrig2
	kf3R samphold gkf3R * kScaleR, ktrig3
	kf4R samphold gkf4R * kScaleR, ktrig4
	
	icps cpsmidi
	
	; LEFT CHANNEL oscillators
	aout1L = oscili(0.5, icps+cpspch((kf1L+2)))
	aout2L = oscili(0.5, icps+cpspch((kf2L+2)))
	aout3L = oscili(0.5, icps+cpspch((kf3L+2)))
	aout4L = oscili(0.5, icps+cpspch((kf4L+2)))
	
	; RIGHT CHANNEL oscillators
	aout1R = oscili(0.5, icps+cpspch((kf1R+2)))
	aout2R = oscili(0.5, icps+cpspch((kf2R+2)))
	aout3R = oscili(0.5, icps+cpspch((kf3R+2)))
	aout4R = oscili(0.5, icps+cpspch((kf4R+2)))
	
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
