=======================
MuseV2simplified - with Amy - 11.16.25
======================= 
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

sr = 44100
ksmps = 100
nchnls = 2
0dbfs = 1.6

; turns on our three instruments forever
schedule 1, 0, -1
schedule "revsc", 0, -1
schedule "del", 0, -1

; waveforms defined with GEN10 - Fourier Additive (Amps of Partials)
gisine   ftgen 1,0,16384,10, 1 ; 1 partial = a sine wave
gisquare ftgen 2,0,16384,10, 1,0,.33,0,.2,0,.14,0,.11,0,.09 ; 11 partials
gisaw    ftgen 3,0,16384,10, 1,.2,0,.4,0,.6,0,.8,0,1,0,.8,0,.6,0,.4,0,.2
gifour   ftgen 4,0,16384,10, 1,.5,.3,.2,.1,.06,.04,.028,.010
gifive   ftgen 5,0,16384,10, 1,0,0,.6,0,0,.5,0,0,.4,0,0,.3,0,0,.2,0,0,.1 

; clears out memory for reverb to sound 'clean'
garvbL init 0
garvbR init 0

; maps - MIDI channel 1 from keyboard to "instrument #2"
massign 1, 2

; initialize our global controls - letter g defines it as "global"
; a "k" in before the name means its a "kontrol" control-rate update
gkf1 init 0
gkf2 init 0
gkf3 init 0
gkf4 init 0

; in MIDI - Musical Instrument Digital Interface
; in MIDI - the range of numbers is 0 to 127 (e.g. Middle C = NN 60)
; Controllers also use the same range of values - 0 - 127
; MIDI is 8-bit protocol (8 bits represent 128 values - 2 to the 8th)

; set up a preset - initialize knob settings of our controllers
ctrlinit 1, 21,60, 22,60, 23,127 ; voice1 - CC21=0, CC1=60, CC23=127

; In Csound, when a variable name starts with the letter "i" it means update this value at "init" time, i.e. load in that value "once" when the instrument or score is "run"  it is a "constant" If the variable starts with "gi" it is a "global constant"

; "gi"name opcode number loadTime size genRoutine MIDI noteNumbers (8)
;                                                C5,D5,C5,E5,C5,G5,C5,C6 
; giscale1 ftgen 111,   0,       8,   -2,        72,74,72,76,72,79,72,84 

; CHROMATIC SCALE TABLE (we have 12 pitches instead of 8 as above)
giChromaticScale ftgen 111,0,12,-2, 60,61,62,63,64,65,66,67,68,69,70,71

; OSC "Open Sound Control", a protocol for real-time communication between computers and multimedia devices

instr 1 ; This instrument reads the stream
gihandle	 OSCinit 7400 ; The User Defined OSC Input and Output Port
; brainwave stream - 4 floating point channels of data - ffff
; read the user-defined OSC path to the data stream - /muse/elements/theta....
kk OSClisten gihandle, "/muse/elements/theta_absolute", "ffff", gkf1,gkf2,gkf3,gkf4
endin

instr 2
kgain1 midic7 21, 0, 1   ; MIDI controller 21 sets "volume" range 0-1
kspeed1 midic7 22, .1, 8 ; Controller 22 sets "speed" range .1-8 (Hz)
printk2 kspeed1          ; print the speed in the console
ktrig1 metro kspeed1     ; metronome clicks at the user set speed
ksize1 midic7 23, 0, 11  ; read from 1 to 12 notes in the pitch table
printk2 ksize1           ; print the range of pitches to choose from
  
kf1 samphold gkf1, ktrig1

kndx1 randomh 0,(ksize1)+kf1, kspeed1
kpitch1 table int(abs(kndx1)), giChromaticScale
 
iNum notnum
print iNum 
iTrans = (exp(log(2.0)*((iNum)-69.0)/12.0))
print iTrans

; the timbre of the oscillator can be any of the gi waveforms from above
 aout1 = oscili(0.4*kgain1, (iTrans)*cpsmidinn(kpitch1), gifour, -1)
; envelop
 agate1 triglinseg ktrig1, 0,.1,.3,.1,.2,.2,0   
 aadsr1 madsr .1, 0.4, 0.8, 1.5

aoutL = aout1*agate1*aadsr1
aoutR = aout1*agate1*aadsr1

 garvbL += aoutL * 0.45
 garvbR += aoutR * 0.45
 
 outs aoutL, aoutR
 endin

instr revsc
    denorm garvbL
    denorm garvbR
    aout1, aout2 reverbsc garvbL, garvbR, 0.8, 8000
    outs aout1, aout2
    clear garvbL
    clear garvbR
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
