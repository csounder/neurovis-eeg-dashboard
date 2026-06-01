========================================
Muse V2 Chords + Melody
- for Amy - 12.01.25
======================================= 
+ theta_absolute  4-8Hz  
=======================
THETA WAVES (3 TO 8 HZ)
Theta brainwaves, occur in sleep and are also dominant in deep meditation.

Theta brainwaves occur most often in sleep but are also dominant in deep meditation. Theta is our gateway to learning, memory, and intuition. In theta, our senses are withdrawn from the external world and focused on signals originating from within. It is that twilight state which we normally only experience fleetingly as we wake or drift off to sleep. In theta we are in a dream vivid imagery, intuition and information beyond our normal conscious awareness. It’s where we hold our ‘stuff’, our fears, troubled history, and nightmares.

<CsoundSynthesizer>
<CsOptions>
-odac -Ma -d
</CsOptions>
<CsInstruments>

; Header Section - 
sr     = 44100  ; audio or sample rate - CD rate
ksmps  = 100    ; kontrol rate 
nchnls = 2      ; number of channels
0dbfs  = 1.6    ; max amp

; "Secret" Instrument 0 - for setup, initialiation, scheduling events, ...

; turns on these two instruments forever
schedule 1, 0, -1  ; start instrument 1 at time 0 and play forever "-1"
schedule "revsc", 0, -1 ; in Csound, p1, p2, p3 are always...

; waveforms defined with GEN10 - Fourier Additive (Amps of Harmonics)
giSine   ftgen 1,0,16384,10, 1 ; 1 partial = a sine wave
giSquare ftgen 2,0,16384,10, 1,0,.33,0,.2,0,.14,0,.11,0,.09 ; 11 partials
giSaw    ftgen 3,0,16384,10, 1,.5,.3,.2,.1,.06,.04,.028,.010
giFour   ftgen 4,0,16384,10, 1,.2,0,.4,0,.6,0,.8,0,1,0,.8,0,.6,0,.4,0,.2
giFive   ftgen 5,0,16384,10, 1,0,0,.6,0,0,.5,0,0,.4,0,0,.3,0,0,.2,0,0,.1 
giAmy    ftgen 6,0,16384,10, 7,23,11,10,9,5,8,12,26,14 

; clears out memory for reverb to sound 'clean'
gaRvbL init 0
gaRvbR init 0

; maps - MIDI channel 1 from keyboard to "instrument #2"
massign  1, 2
maxalloc 2, 2

; initialize our global controls - letter g defines it as "global"
; a "k" in before the name means its a "kontrol" control-rate update
gkF1 init 0
gkF2 init 0
gkF3 init 0
gkF4 init 0

; in MIDI - Musical Instrument Digital Interface
; in MIDI - the range of numbers is 0 to 127 (e.g. Middle C = NN 60)
; Controllers also use the same range of values - 0 - 127
; MIDI is 8-bit protocol (8 bits represent 128 values - 2 to the 8th)

; set up a preset - initialize knob settings of our controllers
; Chords
ctrlinit 1, 21,90, 22,15, 23,127 ; voice1 - CC21=90, CC1=15, CC23=127
; Melody
ctrlinit 1, 25,100, 26,30, 27,32 ; voice1 - CC21=90, CC1=15, CC23=127

; In Csound, when a variable name starts with the letter "i" it means update this value at "init" time, i.e. load in that value "once" when the instrument or score is "run"  it is a "constant" If the variable starts with "gi" it is a "global constant"
; We use Gen2 which lets you create a table of arbitrary numbers
; We use "-2" to tell Csound "not" to "normalize" the list of number

; "gi"name opcode number loadTime size genRoutine MIDI noteNumbers (8)
;                                                C5,D5,C5,E5,C5,G5,C5,C6 
; giscale1 ftgen 111,   0,       8,   -2,        72,74,72,76,72,79,72,84 

; SATB CHORD TABLE (Gen2 - we have 4 pitches instead of 8 as above)
giSoprano ftgen 111,0,4,-2, 62,60,55,71
giAlto    ftgen 112,0,4,-2, 59,57,60,62
giTenor   ftgen 113,0,4,-2, 52,52,55,59
giBass    ftgen 114,0,4,-2, 36,41,40,43

giMelody  ftgen 115,0,8,-2, 83,81,72,77,79,74,76,84

; OSC "Open Sound Control", a protocol for real-time communication between computers and multimedia devices

instr 1   ; THE STREAM READER             
; Read MIND MONITOR Brainwave DATA via OSC 192.168.1.16:5003 (check these)
giHandle	 OSCinit 7400 ; The User Defined OSC Input and Output Port
; Brainwave stream - 4 floating point channels of data - ffff
; Read user-defined OSC data stream from "/muse/elements/theta_absolute"
; 4 floating-point streams "ffff" named gkF1,gkF2,gkF3,gkF4
kk OSClisten giHandle, "/muse/elements/theta_absolute", "ffff", gkF1,gkF2,gkF3,gkF4
endin

instr 2 ; THE CHORD & MELODY PLAYER

; Set Up Keyboard Transposition of Mapped DATA
iNum notnum
; print iNum 
iTrans = (exp(log(2.0)*((iNum)-69.0)/12.0))
; print iTrans

; Assign and Map the Controllers for Chords
kGainC  midic7 21, 0,1    ; MIDI controller 21 sets "volume" range 0-1
kSpeedC midic7 22, .05,3  ; Controller 22 sets "speed" range .05-1 (Hz)
; printk2 kSpeedC         ; print the speed in the console
kTrigC  metro kSpeedC     ; metronome clicks at the user set speed
kSizeC  midic7 23, 1,4    ; read from 1 to 4 chords in the pitch tables
; printk2 kSizeC          ; print the range of pitches to choose from

; Assign and Map the Controllers for Melody
kGainM  midic7 25, 0,1    ; MIDI controller 21 sets "volume" range 0-1
kSpeedM midic7 26, .1,.7  ; Controller 22 sets "speed" range .05-1 (Hz)
; printk2 kSpeedM         ; print the speed in the console
kTrigM  metro kSpeedM     ; metronome clicks at the user set speed
kSizeM  midic7 27, 1,8    ; read from 1 to 4 chords in the pitch tables
; printk2 kSizeM          ; print the range of pitches to choose from
	
; Map Brainwave DATA for Chords to Tables  
kFvalC samphold gkF2, kTrigC ; takes snapshot from a continuous stream
kFvalC = kFvalC * 10000 ; Scales it
; printk2 kFvalC 
kIndexC = int(abs(kFvalC)) % kSizeC ; Mod Operator to size of table
; printk2 kIndexC
kPitch1 table kIndexC, giSoprano ; selects the pitches
kPitch2 table kIndexC, giAlto
kPitch3 table kIndexC, giTenor
kPitch4 table kIndexC, giBass

; Map Brainwave DATA for Melody to Tables  
kFvalM samphold gkF2, kTrigM ; takes snapshot from a continuous stream
kFvalM = kFvalM * 10000 ; Scales it
; printk2 kFvalM 
kIndexM = int(abs(kFvalM)) % kSizeM ; Mod Operator to size of table
; printk2 kIndexM

kPitch5 table kIndexM, giMelody

; Synthesize the Sound
; the timbre of the oscillator can be any of the gi waveforms from above
; SATB Chord Voices
aOut1 = oscili(0.3*kGainC, (iTrans)*cpsmidinn(kPitch1),   giAmy,    -1)
aOut2 = oscili(0.4*kGainC, (iTrans)*cpsmidinn(kPitch2),   giSquare, -1)
aOut3 = oscili(0.5*kGainC, (iTrans)*cpsmidinn(kPitch3),   giFour,   -1)
aOut4 = oscili(0.6*kGainC, (iTrans/2)*cpsmidinn(kPitch4), giSaw,    -1)

; Envelope the Gate from the Chord Metro
iAtkC = .6
iDecC = .4
iRelC = 1.3
aGateC triglinseg kTrigC, 0, iAtkC, 1, iDecC, .7, iRelC, 0 
; Envelope the Gate from the Keyboard  
aAdsrC madsr iAtkC, iDecC, 0.8, iRelC*2

; Mix & Gate Chord Voices 1+4 to Left and 2+3 to Right
aMixLC = (aOut1+aOut4)*(aGateC*aAdsrC)
aMixRC = (aOut2+aOut3)*(aGateC*aAdsrC)

; Melody Voice
aOut5 = oscili(0.8*kGainM, (iTrans)*cpsmidinn(kPitch5),    giAmy, -1)
aOut6 = oscili(0.8*kGainM, (iTrans*.5)*cpsmidinn(kPitch5), giAmy, -1)

; Envelope the Gate from the Melody Metro
iAtkM = .5
iDecM = .2
iRelM = 2
aGateM triglinseg kTrigM, 0, iAtkM, 1, iDecM, .7, iRelM, 0 
; Envelope the Gate from the Keyboard  
aAdsrM madsr iAtkM, iDecM, 0.9, iRelM

; Mix & Gate Melody Voices (in octaves) 5+6 to Left and Right
aMixLM = (aOut5)*(aGateM*aAdsrM)
aMixRM = (aOut6)*(aGateM*aAdsrM)

; Output the Dry Mixed and Enveloped Signals
aOutL = aMixLC+aMixLM
aOutR = aMixRC+aMixRM

outs aOutL, aOutR

; Send the Dry Enveloped Signal to the Global Reverb
gaRvbL += aMixLC * 0.4
gaRvbR += aMixRC * 0.4
gaRvbL += aMixLM * 0.64
gaRvbR += aMixRM * 0.64
endin

; THE REVERBERATOR
instr revsc
denorm gaRvbL, gaRvbR ; denormalize the global signals
; Reverberate the Signals
aOutL, aOutR reverbsc gaRvbL, gaRvbR, 0.8, 8000
; Output the Reverberated Signals
outs aOutL, aOutR
; Clear the Global Space
clear gaRvbL, gaRvbR
endin

</CsInstruments>
<CsScore>
</CsScore>
</CsoundSynthesizer>






<bsbPanel>
 <label>Widgets</label>
 <objectName/>
 <x>827</x>
 <y>442</y>
 <width>320</width>
 <height>240</height>
 <visible>true</visible>
 <uuid/>
 <bgcolor mode="background">
  <r>240</r>
  <g>240</g>
  <b>240</b>
 </bgcolor>
 <bsbObject version="2" type="BSBScope">
  <objectName/>
  <x>17</x>
  <y>17</y>
  <width>350</width>
  <height>150</height>
  <uuid>{51ea1021-0925-4f6f-9cd0-0449508e03d0}</uuid>
  <visible>true</visible>
  <midichan>0</midichan>
  <midicc>-3</midicc>
  <description/>
  <value>-255.00000000</value>
  <type>scope</type>
  <zoomx>2.00000000</zoomx>
  <zoomy>1.00000000</zoomy>
  <dispx>1.00000000</dispx>
  <dispy>1.00000000</dispy>
  <mode>0.00000000</mode>
  <triggermode>NoTrigger</triggermode>
 </bsbObject>
 <bsbObject version="2" type="BSBGraph">
  <objectName/>
  <x>16</x>
  <y>171</y>
  <width>350</width>
  <height>150</height>
  <uuid>{271044c3-ef21-414a-8826-1787626d2eff}</uuid>
  <visible>true</visible>
  <midichan>0</midichan>
  <midicc>-3</midicc>
  <description/>
  <value>0</value>
  <objectName2/>
  <zoomx>1.00000000</zoomx>
  <zoomy>1.00000000</zoomy>
  <dispx>1.00000000</dispx>
  <dispy>1.00000000</dispy>
  <modex>lin</modex>
  <modey>lin</modey>
  <showSelector>true</showSelector>
  <showGrid>true</showGrid>
  <showTableInfo>true</showTableInfo>
  <showScrollbars>true</showScrollbars>
  <enableTables>true</enableTables>
  <enableDisplays>true</enableDisplays>
  <all>true</all>
 </bsbObject>
</bsbPanel>
<bsbPresets>
</bsbPresets>
