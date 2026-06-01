<CsoundSynthesizer>
<CsOptions>
-odac -Ma -d
</CsOptions>
<CsInstruments>

/*
====================================================================
MUSE BRAINWAVE 5-BAND AVERAGED SONIFICATION INSTRUMENT - QUANTIZED v2
====================================================================

PITCH QUANTIZATION:
  Q (capital) = Toggle quantizer ON/OFF (starts OFF)
  
  SCALE SELECTION (number keys 0-9):
    1 = Chromatic (12-TET, all semitones)
    2 = Major scale (Ionian: 0,2,4,5,7,9,11)
    3 = Melodic minor (0,2,3,5,7,9,11)
    4 = Harmonic minor (0,2,3,5,7,8,11)
    5 = Blues scale (0,3,5,6,7,10)
    6 = Whole tone (0,2,4,6,8,10)
    7 = Pentatonic major (0,2,4,7,9)
    8 = Fibonacci (semitones: 0,1,2,3,5,8)
    9 = Bohlen-Pierce (13-TET: limited to 0-11 semitones)
    0 = Quarter-tone (24-TET, half semitones)
    
    ASCII d, t, a, b, g - toggle between band level and band metro
    
    P - toggles print mode
    
    CC28 - global volume
    CC27 - global metro
    CC21=delta, CC22=Theta, CC23=Alpha, CC24=Beta, CC25=Gamma 
    
*/

sr = 44100
ksmps = 100
nchnls = 2
0dbfs = 1.0

massign 1, 5

initc7 1, 27, 0.165
initc7 1, 21, 0.5
initc7 1, 22, 0.5
initc7 1, 23, 0.5
initc7 1, 24, 0.5
initc7 1, 25, 0.5
initc7 1, 28, 0.618

schedule 1, 0, -1
schedule 2, 0, -1
schedule 3, 0, -1
schedule 20, 0, -1
schedule 21, 0, -1

garvbL init 0
garvbR init 0
gadelL init 0
gadelR init 0

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

gkDeltaAbsAvg init 0
gkThetaAbsAvg init 0
gkAlphaAbsAvg init 0
gkBetaAbsAvg init 0
gkGammaAbsAvg init 0

gkDeltaRelAvg init 0
gkThetaRelAvg init 0
gkAlphaRelAvg init 0
gkBetaRelAvg init 0
gkGammaRelAvg init 0

gkGlobalVolume init 0.618
gkGlobalMetro init 1.0

gkPlaybackMode init 1
gkPrintToggle init 0
gkLevelDisplay init 1
gkQuantizeOn init 0
gkScaleMode init 1

gkDeltaCCMode init 1
gkThetaCCMode init 1
gkAlphaCCMode init 1
gkBetaCCMode init 1
gkGammaCCMode init 1

gihandle init -1


; Quantize UDO - hardcoded logic without arrays
opcode Quantize, k, kk
	kpitch, kscale xin
	
	koct = int(kpitch)
	kchrom = frac(kpitch) * 12
	
	if kchrom >= 12 then
		kchrom = kchrom - 12
		koct = koct + 1
	endif
	
	kbestNote = 0
	
	; Hardcoded quantization for each scale
	if kscale == 1 then
		; Chromatic - round to nearest semitone
		kbestNote = int(kchrom + 0.5)
	elseif kscale == 2 then
		; Major: 0,2,4,5,7,9,11
		if kchrom < 1 then
			kbestNote = 0
		elseif kchrom < 3 then
			kbestNote = 2
		elseif kchrom < 4.5 then
			kbestNote = 4
		elseif kchrom < 6 then
			kbestNote = 5
		elseif kchrom < 8 then
			kbestNote = 7
		elseif kchrom < 10 then
			kbestNote = 9
		else
			kbestNote = 11
		endif
	elseif kscale == 3 then
		; Melodic minor: 0,2,3,5,7,9,11
		if kchrom < 1 then
			kbestNote = 0
		elseif kchrom < 2.5 then
			kbestNote = 2
		elseif kchrom < 4 then
			kbestNote = 3
		elseif kchrom < 6 then
			kbestNote = 5
		elseif kchrom < 8 then
			kbestNote = 7
		elseif kchrom < 10 then
			kbestNote = 9
		else
			kbestNote = 11
		endif
	elseif kscale == 4 then
		; Harmonic minor: 0,2,3,5,7,8,11
		if kchrom < 1 then
			kbestNote = 0
		elseif kchrom < 2.5 then
			kbestNote = 2
		elseif kchrom < 4 then
			kbestNote = 3
		elseif kchrom < 6 then
			kbestNote = 5
		elseif kchrom < 7.5 then
			kbestNote = 7
		elseif kchrom < 9.5 then
			kbestNote = 8
		else
			kbestNote = 11
		endif
	elseif kscale == 5 then
		; Blues: 0,3,5,6,7,10
		if kchrom < 1.5 then
			kbestNote = 0
		elseif kchrom < 4 then
			kbestNote = 3
		elseif kchrom < 5.5 then
			kbestNote = 5
		elseif kchrom < 6.5 then
			kbestNote = 6
		elseif kchrom < 8.5 then
			kbestNote = 7
		else
			kbestNote = 10
		endif
	elseif kscale == 6 then
		; Whole tone: 0,2,4,6,8,10
		kbestNote = int(kchrom / 2 + 0.5) * 2
	elseif kscale == 7 then
		; Pentatonic: 0,2,4,7,9
		if kchrom < 1 then
			kbestNote = 0
		elseif kchrom < 3 then
			kbestNote = 2
		elseif kchrom < 5.5 then
			kbestNote = 4
		elseif kchrom < 8 then
			kbestNote = 7
		else
			kbestNote = 9
		endif
	elseif kscale == 8 then
		; Fibonacci: 0,1,2,3,5,8
		if kchrom < 0.5 then
			kbestNote = 0
		elseif kchrom < 1.5 then
			kbestNote = 1
		elseif kchrom < 2.5 then
			kbestNote = 2
		elseif kchrom < 4 then
			kbestNote = 3
		elseif kchrom < 6.5 then
			kbestNote = 5
		else
			kbestNote = 8
		endif
	elseif kscale == 9 then
		; Bohlen-Pierce (simplified to 12-tone)
		kbestNote = int(kchrom + 0.5)
	else
		; Quarter-tone (scale 0)
		kbestNote = int(kchrom * 2 + 0.5) / 2
	endif
	
	kquantized = koct + (kbestNote / 12)
	xout kquantized
endop


instr 1
	if gihandle == -1 then
		gihandle OSCinit 7400
		prints "OSC initialized on port 7400\n"
	endif

	kk1 OSClisten gihandle, "/muse/elements/delta_absolute", "ffff", gkDeltaAbs1, gkDeltaAbs2, gkDeltaAbs3, gkDeltaAbs4
	kk2 OSClisten gihandle, "/muse/elements/theta_absolute", "ffff", gkThetaAbs1, gkThetaAbs2, gkThetaAbs3, gkThetaAbs4
	kk3 OSClisten gihandle, "/muse/elements/alpha_absolute", "ffff", gkAlphaAbs1, gkAlphaAbs2, gkAlphaAbs3, gkAlphaAbs4
	kk4 OSClisten gihandle, "/muse/elements/beta_absolute", "ffff", gkBetaAbs1, gkBetaAbs2, gkBetaAbs3, gkBetaAbs4
	kk5 OSClisten gihandle, "/muse/elements/gamma_absolute", "ffff", gkGammaAbs1, gkGammaAbs2, gkGammaAbs3, gkGammaAbs4

	gkDeltaAbsAvg = (gkDeltaAbs1 + gkDeltaAbs2 + gkDeltaAbs3 + gkDeltaAbs4) / 4
	gkThetaAbsAvg = (gkThetaAbs1 + gkThetaAbs2 + gkThetaAbs3 + gkThetaAbs4) / 4
	gkAlphaAbsAvg = (gkAlphaAbs1 + gkAlphaAbs2 + gkAlphaAbs3 + gkAlphaAbs4) / 4
	gkBetaAbsAvg = (gkBetaAbs1 + gkBetaAbs2 + gkBetaAbs3 + gkBetaAbs4) / 4
	gkGammaAbsAvg = (gkGammaAbs1 + gkGammaAbs2 + gkGammaAbs3 + gkGammaAbs4) / 4

	kDeltaLin = pow(10, gkDeltaAbsAvg)
	kThetaLin = pow(10, gkThetaAbsAvg)
	kAlphaLin = pow(10, gkAlphaAbsAvg)
	kBetaLin = pow(10, gkBetaAbsAvg)
	kGammaLin = pow(10, gkGammaAbsAvg)
	kSum = kDeltaLin + kThetaLin + kAlphaLin + kBetaLin + kGammaLin + 0.0001
	
	gkDeltaRelAvg = kDeltaLin / kSum
	gkThetaRelAvg = kThetaLin / kSum
	gkAlphaRelAvg = kAlphaLin / kSum
	gkBetaRelAvg = kBetaLin / kSum
	gkGammaRelAvg = kGammaLin / kSum

	if gkPrintToggle == 1 then
		printks "D:%.2f T:%.2f A:%.2f B:%.2f G:%.2f\n", 0.5, gkDeltaAbsAvg, gkThetaAbsAvg, gkAlphaAbsAvg, gkBetaAbsAvg, gkGammaAbsAvg
	endif
endin


instr 2
	kKey, kKeyDown sensekey
	
	if kKeyDown == 1 && kKey == 81 then
		gkQuantizeOn = 1 - gkQuantizeOn
		if gkQuantizeOn == 1 then
			gkScaleMode = 1
			printks ">>> QUANTIZER ON (SCALE 1: Chromatic)\n", 0
		else
			printks ">>> QUANTIZER OFF\n", 0
		endif
	endif
	
	if kKeyDown == 1 && kKey >= 48 && kKey <= 57 then
		gkScaleMode = kKey - 48
		if gkScaleMode == 0 then
			printks ">>> SCALE 0: Quarter-tone\n", 0
		elseif gkScaleMode == 1 then
			printks ">>> SCALE 1: Chromatic\n", 0
		elseif gkScaleMode == 2 then
			printks ">>> SCALE 2: Major\n", 0
		elseif gkScaleMode == 3 then
			printks ">>> SCALE 3: Melodic minor\n", 0
		elseif gkScaleMode == 4 then
			printks ">>> SCALE 4: Harmonic minor\n", 0
		elseif gkScaleMode == 5 then
			printks ">>> SCALE 5: Blues\n", 0
		elseif gkScaleMode == 6 then
			printks ">>> SCALE 6: Whole tone\n", 0
		elseif gkScaleMode == 7 then
			printks ">>> SCALE 7: Pentatonic\n", 0
		elseif gkScaleMode == 8 then
			printks ">>> SCALE 8: Fibonacci\n", 0
		else
			printks ">>> SCALE 9: Bohlen-Pierce\n", 0
		endif
	endif
	
	if kKeyDown == 1 && (kKey == 112 || kKey == 80) then
		gkPrintToggle = 1 - gkPrintToggle
		printks (gkPrintToggle == 1 ? ">>> PRINT ON\n" : ">>> PRINT OFF\n"), 0
	endif
	
	if kKeyDown == 1 && kKey == 76 then
		gkLevelDisplay = 1 - gkLevelDisplay
		printks (gkLevelDisplay == 1 ? ">>> LEVEL DISPLAY ON\n" : ">>> LEVEL DISPLAY OFF\n"), 0
	endif
	
	if kKeyDown == 1 && kKey == 82 then
		gkPlaybackMode = 0
		printks ">>> RELATIVE\n", 0
	endif
	
	if kKeyDown == 1 && kKey == 65 then
		gkPlaybackMode = 1
		printks ">>> ABSOLUTE\n", 0
	endif
	
	if kKeyDown == 1 && kKey == 66 then
		gkPlaybackMode = 2
		printks ">>> BOTH\n", 0
	endif
	
	if kKeyDown == 1 && kKey == 100 then
		gkDeltaCCMode = 1 - gkDeltaCCMode
		printks (gkDeltaCCMode == 0 ? ">>> DELTA: CC21 = METRO\n" : ">>> DELTA: CC21 = VOLUME\n"), 0
	endif
	
	if kKeyDown == 1 && kKey == 116 then
		gkThetaCCMode = 1 - gkThetaCCMode
		printks (gkThetaCCMode == 0 ? ">>> THETA: CC22 = METRO\n" : ">>> THETA: CC22 = VOLUME\n"), 0
	endif
	
	if kKeyDown == 1 && kKey == 97 then
		gkAlphaCCMode = 1 - gkAlphaCCMode
		printks (gkAlphaCCMode == 0 ? ">>> ALPHA: CC23 = METRO\n" : ">>> ALPHA: CC23 = VOLUME\n"), 0
	endif
	
	if kKeyDown == 1 && kKey == 98 then
		gkBetaCCMode = 1 - gkBetaCCMode
		printks (gkBetaCCMode == 0 ? ">>> BETA: CC24 = METRO\n" : ">>> BETA: CC24 = VOLUME\n"), 0
	endif
	
	if kKeyDown == 1 && kKey == 103 then
		gkGammaCCMode = 1 - gkGammaCCMode
		printks (gkGammaCCMode == 0 ? ">>> GAMMA: CC25 = METRO\n" : ">>> GAMMA: CC25 = VOLUME\n"), 0
	endif
endin


instr 3
	kCC27 ctrl7 1, 27, 0.01, 6
	kCC28 ctrl7 1, 28, 0, 1
	
	kMetroChanged changed kCC27
	if kMetroChanged == 1 then
		printks ">>> GLOBAL METRO: %.2fx\n", 0, kCC27
	endif
	
	kVolChanged changed kCC28
	if kVolChanged == 1 then
		printks ">>> GLOBAL VOLUME: %.3f\n", 0, kCC28
	endif
	
	gkGlobalMetro = kCC27
	gkGlobalVolume = kCC28
endin


instr 5
	icps cpsmidi
	
	kCC21 ctrl7 1, 21, 0, 1
	kCC22 ctrl7 1, 22, 0, 1
	kCC23 ctrl7 1, 23, 0, 1
	kCC24 ctrl7 1, 24, 0, 1
	kCC25 ctrl7 1, 25, 0, 1
	
	if gkLevelDisplay == 1 then
		kCC21Changed changed kCC21
		if kCC21Changed == 1 then
			if gkDeltaCCMode == 1 then
				printks "DELTA volume: %.3f\n", 0, kCC21
			else
				printks "DELTA metro: %.2f Hz\n", 0, (kCC21 * 50 + 1) * gkGlobalMetro
			endif
		endif
		
		kCC22Changed changed kCC22
		if kCC22Changed == 1 then
			if gkThetaCCMode == 1 then
				printks "THETA volume: %.3f\n", 0, kCC22
			else
				printks "THETA metro: %.2f Hz\n", 0, (kCC22 * 50 + 1) * gkGlobalMetro
			endif
		endif
		
		kCC23Changed changed kCC23
		if kCC23Changed == 1 then
			if gkAlphaCCMode == 1 then
				printks "ALPHA volume: %.3f\n", 0, kCC23
			else
				printks "ALPHA metro: %.2f Hz\n", 0, (kCC23 * 50 + 1) * gkGlobalMetro
			endif
		endif
		
		kCC24Changed changed kCC24
		if kCC24Changed == 1 then
			if gkBetaCCMode == 1 then
				printks "BETA volume: %.3f\n", 0, kCC24
			else
				printks "BETA metro: %.2f Hz\n", 0, (kCC24 * 50 + 1) * gkGlobalMetro
			endif
		endif
		
		kCC25Changed changed kCC25
		if kCC25Changed == 1 then
			if gkGammaCCMode == 1 then
				printks "GAMMA volume: %.3f\n", 0, kCC25
			else
				printks "GAMMA metro: %.2f Hz\n", 0, (kCC25 * 50 + 1) * gkGlobalMetro
			endif
		endif
	endif
	
	kspeed1 = (gkDeltaCCMode == 0 ? (kCC21 * 50 + 1) * gkGlobalMetro : 0.5)
	kvol1 = (gkDeltaCCMode == 1 ? kCC21 : 1)
	ktrig1 metro kspeed1
	kVal1 = (gkPlaybackMode == 1 ? gkDeltaAbsAvg : gkDeltaRelAvg)
	kScale1 = (gkPlaybackMode == 0 ? 15 : 3)
	kf1raw samphold kVal1 * kScale1, ktrig1
	kf1 = (gkQuantizeOn == 1 ? Quantize(kf1raw, gkScaleMode) : kf1raw)
	aout1 oscili 0.2, icps + cpspch(kf1 + 2)
	
	kspeed2 = (gkThetaCCMode == 0 ? (kCC22 * 50 + 1) * gkGlobalMetro : 1)
	kvol2 = (gkThetaCCMode == 1 ? kCC22 : 1)
	ktrig2 metro kspeed2
	kVal2 = (gkPlaybackMode == 1 ? gkThetaAbsAvg : gkThetaRelAvg)
	kf2raw samphold kVal2 * kScale1, ktrig2
	kf2 = (gkQuantizeOn == 1 ? Quantize(kf2raw, gkScaleMode) : kf2raw)
	aout2 oscili 0.2, icps + cpspch(kf2 + 2)
	
	kspeed3 = (gkAlphaCCMode == 0 ? (kCC23 * 50 + 1) * gkGlobalMetro : 1.5)
	kvol3 = (gkAlphaCCMode == 1 ? kCC23 : 1)
	ktrig3 metro kspeed3
	kVal3 = (gkPlaybackMode == 1 ? gkAlphaAbsAvg : gkAlphaRelAvg)
	kf3raw samphold kVal3 * kScale1, ktrig3
	kf3 = (gkQuantizeOn == 1 ? Quantize(kf3raw, gkScaleMode) : kf3raw)
	aout3 oscili 0.2, icps + cpspch(kf3 + 2)
	
	kspeed4 = (gkBetaCCMode == 0 ? (kCC24 * 50 + 1) * gkGlobalMetro : 2)
	kvol4 = (gkBetaCCMode == 1 ? kCC24 : 1)
	ktrig4 metro kspeed4
	kVal4 = (gkPlaybackMode == 1 ? gkBetaAbsAvg : gkBetaRelAvg)
	kf4raw samphold kVal4 * kScale1, ktrig4
	kf4 = (gkQuantizeOn == 1 ? Quantize(kf4raw, gkScaleMode) : kf4raw)
	aout4 oscili 0.2, icps + cpspch(kf4 + 2)
	
	kspeed5 = (gkGammaCCMode == 0 ? (kCC25 * 50 + 1) * gkGlobalMetro : 3)
	kvol5 = (gkGammaCCMode == 1 ? kCC25 : 1)
	ktrig5 metro kspeed5
	kVal5 = (gkPlaybackMode == 1 ? gkGammaAbsAvg : gkGammaRelAvg)
	kf5raw samphold kVal5 * kScale1, ktrig5
	kf5 = (gkQuantizeOn == 1 ? Quantize(kf5raw, gkScaleMode) : kf5raw)
	aout5 oscili 0.2, icps + cpspch(kf5 + 2)
	
	aadsr madsr 0.01, 0.1, 0.8, 0.1
	aout = ((aout1*kvol1 + aout2*kvol2 + aout3*kvol3 + aout4*kvol4 + aout5*kvol5) / 5) * aadsr * gkGlobalVolume
	
	garvbL += aout * 0.8
	garvbR += aout * 0.8
	gadelL += aout * 0.8
	gadelR += aout * 0.8
	
	outs aout, aout
endin


instr 20
	denorm garvbL
	denorm garvbR
	aout1, aout2 reverbsc garvbL, garvbR, 0.8, 8000
	outs aout1, aout2
	clear garvbL
	clear garvbR
endin


instr 21
	adelL init 0
	adelR init 0
	denorm gadelL
	denorm gadelR
	adelL delay gadelL + (adelL * 0.72), .5
	adelR delay gadelR + (adelR * 0.7), .51
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
