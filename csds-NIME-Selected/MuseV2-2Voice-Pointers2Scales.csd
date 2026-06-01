=======================
MuseV2-simplified
======================= 
Frequency Ranges
      
+ delta_absolute  1-4Hz
DELTA WAVES (.5 TO 3 HZ)
Delta Waves, the slowest but loudest brainwaves
	Delta brainwaves are slow, loud brainwaves (low frequency and deeply penetrating, like a drum beat). They are generated in deepest meditation and dreamless sleep. Delta waves suspend external awareness and are the source of empathy. Healing and regeneration are stimulated in this state, and that is why deep restorative sleep is so essential to the healing process.
  
+ theta_absolute  4-8Hz  
THETA WAVES (3 TO 8 HZ)
Theta brainwaves, occur in sleep and are also dominant in deep meditation.
	Theta brainwaves occur most often in sleep but are also dominant in deep meditation. Theta is our gateway to learning, memory, and intuition. In theta, our senses are withdrawn from the external world and focused on signals originating from within. It is that twilight state which we normally only experience fleetingly as we wake or drift off to sleep. In theta we are in a dream, vivid imagery, intuition and information beyond our normal conscious awareness. It’s where we hold our ‘stuff’, our fears, troubled history, and nightmares.
   
+ alpha_absolute  7.5-13Hz   
ALPHA WAVES (8 TO 12 HZ)
Alpha brainwaves occur during quietly flowing thoughts, but not quite meditation.
	Alpha brainwaves are dominant during quietly flowing thoughts, and in some meditative states. Alpha is ‘the power of now’, being here, in the present. Alpha is the resting state for the brain. Alpha waves aid overall mental coordination, calmness, alertness, mind/body integration and learning.
  
+ beta_absolute 13-30Hz  
BETA WAVES (12 TO 38 HZ)
Beta brainwaves are present in our normal waking state of consciousness.
	Beta brainwaves dominate our normal waking state of consciousness when attention is directed towards cognitive tasks and the outside world. Beta is a ‘fast’ activity, present when we are alert, attentive, engaged in problem solving, judgment, decision making, or focused mental activity.
	Beta brainwaves are further divided into three bands: Lo-Beta (Beta1, 12-15Hz) can be thought of as a 'fast idle', or musing. Beta (Beta2, 15-22Hz) is high engagement or actively figuring something out. Hi-Beta (Beta3, 22-38Hz) is highly complex thought, integrating new experiences, high anxiety, or excitement. Continual high frequency processing is not a very efficient way to run the brain, as it takes a tremendous amount of energy. 
  
+ gamma_absolute  30-44Hz
GAMMA WAVES (38 TO 42 HZ)
Gamma brainwaves are the fastest of brain waves and relate to simultaneous processing of information from different brain areas
	Gamma brainwaves are the fastest of brain waves (high frequency, like a flute), and relate to simultaneous processing of information from different brain areas. Gamma brainwaves pass information rapidly and quietly. The most subtle of the brainwave frequencies, the mind has to be quiet to access gamma. 
	Gamma was dismissed as 'spare brain noise' until researchers discovered it was highly active when in states of universal love, altruism, and the ‘higher virtues’. Gamma is also above the frequency of neuronal firing, so how it is generated remains a mystery. It is speculated that gamma rhythms modulate perception and consciousness, and that a greater presence of gamma relates to expanded consciousness and spiritual emergence.

<CsoundSynthesizer>
<CsOptions>
-odac -Ma -d
</CsOptions>
<CsInstruments>

; The Csound Header
sr     = 44100  ; compute at the SAMPLE RATE (in this case it is 44.1k)
ksmps  = 100    ; size of kotrol block (44100/441) (every 100 samples we get another k-value)
nchnls = 2      ; stereo
0dbfs  = 1.6    ; default max loudness

; turns on our EEG listener and our reverb instrument forever
schedule "EEGlisten", 0, -1
schedule "revsc", 0, -1

; waveforms defined with GEN10 - Fourier Additive (Amps of Partials)
giSine   ftgen 1,0,16384,10, 1                                                           ; 1 partial = a sine wave
giSquare ftgen 2,0,16384,10, 1,  0, .3333,   0, .2,    0, .1429,    0, .1111,  0, .0909  ; Square-ish
giSaw    ftgen 3,0,16384,10, 1, .5, .3333, .25, .2, .166,  .142, .125,  .111, .1, .0909  ; Saw-ish
giFour   ftgen 4,0,16384,10, 1, .5,     0,  .3,  0,   .2,     0,    0,    .1,  0,   .06
giFive   ftgen 5,0,16384,10, 1,  0,     0,  .6,  0,    0,    .5,    0,     0, .4,     0

; clears out memory for reverb to sound 'clean'
gaRvbL init 0
gaRvbR init 0

; maps - MIDI channel 1 from keyboard to assigned to play instr "EEGplayer"
massign 1, "EEGplay"

; initialize our global controls - letter g defines it as "global"
; a "k" in before the name means its a "kontrol" control-rate update
gkSensor1TP9  init  0
gkSensor2AF7  init  0
gkSensor3AF8  init  0
gkSensor4TP10 init  0

; in MIDI - Musical Instrument Digital Interface
; in MIDI - the range of numbers is 0 to 127 (e.g. Middle C = NN 60)
; Controllers also use the same range of values - 0 - 127
; MIDI is 8-bit protocol (8 bits represent 128 values - 2 to the 8th)

; set up a preset - initialize knob settings of our controllers
ctrlinit 1, 21,100, 22,60, 23,127, 24,100, 25,60, 26,127 ; voice1 - CC21=0, CC1=60, CC23=127

; In Csound, when a variable name starts with the letter "i" it means update this value at "init" time, i.e. load in that value "once" when the instrument or score is "run"  it is a "constant" If the variable starts with "gi" it is a "global constant"

; "gi"name opcode number loadTime size genRoutine MIDI noteNumbers (8)
;                                                        C5,D5,C5,E5,C5,G5,C5,C6 
;giEightNoteScale1 ftgen 111,   0,       8,   -2,        72,74,72,76,72,79,72,84
;                                                        C4,D4,C4,E4,C4,G4,C4,A4
;giEightNoteScale2 ftgen 112,   0,       8,   -2,        60,62,60,64,60,67,60,69 

; CHROMATIC SCALE TABLE (we have 12 pitches instead of 8 as above)
; giChromaticScale ftgen 111, 0, 12, -2, 60,61,62,63,64,65,66,67,68,69,70,71
giChromaticScale ftgen 111, 0, 12, -2, 60,62,69,67,64,64,69,64,62,69,71,72


; OSC "Open Sound Control", a protocol for real-time communication between computers and multimedia devices

instr EEGlisten ; This instrument reads the EEG stream
; g is for global variable
; i is for init time (read it only once when the intrument is loaded)
; brainwave stream - 4 floating point channels of data - ffff
; read the user-defined OSC path to the data stream - /muse/elements/theta.... or delta... or beta... or ...

;giDelta	 OSCinit 5000 ; The User Defined OSC Input and Output Port
;kStream OSClisten giDelta, "/muse/elements/Delta_absolute", "ffff", gkSensor1TP9,gkSensor2AF7,gkSensor3AF8,gkSensor4TP10

;giTheta OSCinit 5000 ; The User Defined OSC Input and Output Port
;kStream OSClisten giTheta, "/muse/elements/Theta_absolute", "ffff", gkSensor1TP9,gkSensor2AF7,gkSensor3AF8,gkSensor4TP10

;giBeta	 OSCinit 5000 ; The User Defined OSC Input and Output Port
;kStream OSClisten giBeta, "/muse/elements/Beta_absolute", "ffff", gkSensor1TP9,gkSensor2AF7,gkSensor3AF8,gkSensor4TP10

;giGamma	 OSCinit 5000 ; The User Defined OSC Input and Output Port
;kStream OSClisten giGamma, "/muse/elements/Gamma_absolute", "ffff", gkSensor1TP9,gkSensor2AF7,gkSensor3AF8,gkSensor4TP10

giAlpha	 OSCinit 7400 ; The User Defined OSC Input and Output Port
kStream OSClisten giAlpha, "/muse/elements/Alpha_absolute", "ffff", gkSensor1TP9,gkSensor2AF7,gkSensor3AF8,gkSensor4TP10

; k is a kontrol-rate variable

endin

instr EEGplay
kGain1 midic7 21, 0, 1             ; MIDI controller 21 sets "volume" range 0-1
kSpeed1 midic7 22, .1, 8           ; Controller 22 sets "speed" range .1-8 (Hz)
printk2 kSpeed1                    ; print the speed in the console
kTrig1 metro kSpeed1               ; metronome clicks at the user set speed

;kEightNoteSize1 midic7 23, 0, 7   ; read from 1 to 8 notes in the Scale1 pitch table
;kEightNoteSize1 = int(kEightNoteSize1)
;printk2 kEightNoteSize1           ; print the range of pitches to choose from

kChromaticSize1 midic7 23, 0, 11   ; read from 1 to 12 notes in the Chromatic pitch table
kChromaticSize1 = int(kChromaticSize1)
printk2 kChromaticSize1            ; print the range of pitches to choose from

kGain2 midic7 24, 0, 1             ; MIDI controller 26 sets "volume" range 0-1
kSpeed2 midic7 25, .1, 8           ; Controller 22 sets "speed" range .1-8 (Hz)
printk2 kSpeed2                    ; print the speed in the console
kTrig2 metro kSpeed2               ; metronome clicks at the user set speed

;kEightNoteSize2 midic7 26, 0, 7   ; read from 1 to 8 notes in the Scale2 pitch table
;kEightNoteSize2 = int(kEightNoteSize2)
;printk2 kEightNoteSize2           ; print the range of pitches to choose from

kChromaticSize2 midic7 26, 0, 11   ; read from 1 to 12 notes in the pitch table
kChromaticSize2 = int(kChromaticSize2)
printk2 kChromaticSize2

;These are the two sensors that are being read for the two voices (2AF7 and 3AF8)
kF1 samphold gkSensor2AF7, kTrig1
kF2 samphold gkSensor3AF8, kTrig2

;These are the two sensors that are being read for the two voices (1TP9 and 4TP10)
;kF1 samphold gkSensor1TP9, kTrig1
;kF2 samphold gkSensor4TP10, kTrig2

;kNdx1 randomh 0,(kEightNoteSize1)+kF1, kSpeed1
;kPitch1 table int(abs(kNdx1)), giEightNoteScale1

kNdx1 randomh 0,(kChromaticSize1)+kF1, kSpeed1
kPitch1 table int(abs(kNdx1)), giChromaticScale

;kNdx2 randomh 0,(kEightNoteSize2)+kF2, kSpeed2
;kPitch2 table int(abs(kNdx2)), giEightNoteScale2

kNdx2 randomh 0,(kChromaticSize2)+kF2, kSpeed2
kPitch2 table int(abs(kNdx2)), giChromaticScale

; the realtime MIDI keyboard note input section to transponse the sequences or play chords
iNum notnum
print iNum 
iTrans = (exp(log(2.0)*((iNum)-69.0)/12.0))
print iTrans

; the timbre of the oscillator can be any of the gi waveforms from above
 aOut1 = oscili(0.4*kGain1, (iTrans)*cpsmidinn(kPitch1), giSaw, -1)
; trigger and envelope
 aGate1 triglinseg kTrig1, 0,.1,.3,.1,.2,.2,0   
 aAdsr1 madsr .1, 0.4, 0.8, 1.5
; apllying the envelope to the oscillator
 aOut1 = aOut1*aGate1*aAdsr1

 aOut2 = oscili(0.4*kGain2, (iTrans)*cpsmidinn(kPitch2), giSquare, -1)
 aGate2 triglinseg kTrig2, 0,.1,.3,.1,.2,.2,0   
 aAdsr2 madsr .1, 0.4, 0.8, 1.5
 aOut2 = aOut2*aGate2*aAdsr2

gaRvbL += aOut1 * 0.5
gaRvbR += aOut2 * 0.5
 
outs aOut1, aOut2
endin

instr revsc
             denorm   gaRvbL
             denorm   gaRvbR
aOut1, aOut2 reverbsc gaRvbL, gaRvbR, 0.8, 8000
             outs     aOut1, aOut2
             clear    gaRvbL
             clear    gaRvbR
endin

</CsInstruments>
<CsScore>
</CsScore>
</CsoundSynthesizer>












<bsbPanel>
 <label>Widgets</label>
 <objectName/>
 <x>100</x>
 <y>100</y>
 <width>320</width>
 <height>240</height>
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
