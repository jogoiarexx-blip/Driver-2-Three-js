        /**
         * ============================================================================
         * MÓDULO 1: SINTETIZADOR DE ÁUDIO RETRÔ (WEB AUDIO API)
         * Ronco V8, Burnout, derrapagem, buzina, sirene policial e calota quicando
         * ============================================================================
         */
        class RetroSynthAudio {
            constructor() {
                this.ctx = null;
                this.enabled = true;
                this.initialized = false;
                this.engineOsc = null;
                this.engineGain = null;
                this.skidGain = null;
                this.sirenOsc = null;
                this.sirenGain = null;
                this.sirenPhase = 0;
                this.musicClock=0;
                this.musicBeat=0;
                this.dispatcherCooldown=0;
                this.lastSiren=false;
            }

            init() {
                if (this.initialized) return;
                try {
                    const AudioCtx = window.AudioContext || window.webkitAudioContext;
                    this.ctx = new AudioCtx();

                    // 1. Motor V8 (Oscilador Sawtooth + Sub Square)
                    this.engineOsc = this.ctx.createOscillator();
                    const subOsc = this.ctx.createOscillator();
                    this.engineOsc.type = 'sawtooth';
                    subOsc.type = 'square';
                    this.engineOsc.frequency.value = 55;
                    subOsc.frequency.value = 27.5;

                    const filter = this.ctx.createBiquadFilter();
                    filter.type = 'lowpass';
                    filter.frequency.value = 280;

                    this.engineGain = this.ctx.createGain();
                    this.engineGain.gain.value = 0.0;

                    this.engineOsc.connect(filter);
                    subOsc.connect(filter);
                    filter.connect(this.engineGain);
                    this.engineGain.connect(this.ctx.destination);
                    this.engineOsc.start();
                    subOsc.start();
                    this.subOsc = subOsc;

                    // 2. Ruído de Pneu Cantando (Skid / Drift / Burnout)
                    const bufferSize = this.ctx.sampleRate * 1.5;
                    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
                    const output = noiseBuffer.getChannelData(0);
                    for (let i = 0; i < bufferSize; i++) {
                        output[i] = Math.random() * 2 - 1;
                    }
                    const whiteNoise = this.ctx.createBufferSource();
                    whiteNoise.buffer = noiseBuffer;
                    whiteNoise.loop = true;

                    const bandpass = this.ctx.createBiquadFilter();
                    bandpass.type = 'bandpass';
                    bandpass.frequency.value = 1200;
                    bandpass.Q.value = 3.8;

                    this.skidGain = this.ctx.createGain();
                    this.skidGain.gain.value = 0.0;

                    whiteNoise.connect(bandpass);
                    bandpass.connect(this.skidGain);
                    this.skidGain.connect(this.ctx.destination);
                    whiteNoise.start();

                    // 3. Sirene Policial Wail/Yelp
                    this.sirenOsc = this.ctx.createOscillator();
                    this.sirenOsc.type = 'triangle';
                    this.sirenOsc.frequency.value = 600;
                    this.sirenGain = this.ctx.createGain();
                    this.sirenGain.gain.value = 0.0;
                    this.sirenOsc.connect(this.sirenGain);
                    this.sirenGain.connect(this.ctx.destination);
                    this.sirenOsc.start();

                    this.initialized = true;
                } catch (e) {
                    console.warn('Web Audio API aguardando interação:', e);
                }
            }

            update(dt, inVehicle, speedKmh, isSkidding, isBurnout, sirenPlaying, slipAngle=0) {
                if (!this.initialized || !this.enabled || !this.ctx) return;
                if (this.ctx.state === 'suspended') this.ctx.resume();

                if (inVehicle) {
                    const rpmRatio = isBurnout ? 0.92 : Math.min(1, Math.abs(speedKmh) / 165);
                    const gearMod = (rpmRatio * 4) % 1;
                    const baseFreq = 46 + rpmRatio * 98 + gearMod * 42;
                    this.engineOsc.frequency.setTargetAtTime(baseFreq, this.ctx.currentTime, 0.04);
                    this.subOsc.frequency.setTargetAtTime(baseFreq * 0.5, this.ctx.currentTime, 0.04);
                    this.engineGain.gain.setTargetAtTime(0.08 + rpmRatio * 0.08, this.ctx.currentTime, 0.07);
                } else {
                    this.engineGain.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.1);
                }

                // Continuous tire sound proportional to actual slip,
                // not just a binary drifting flag.
                const slip=Math.max(0,Math.min(1,Math.abs(Number(slipAngle)||0)/.52));
                const targetSkid=inVehicle?
                    Math.min(.17,Math.max((isSkidding||isBurnout)? .13:0,
                        slip*.15)*(Math.min(1,Math.abs(speedKmh)/25))):0;
                this.skidGain.gain.setTargetAtTime(targetSkid, this.ctx.currentTime, 0.05);

                // Original procedural funk/jazz: bass + drum one-shots,
                // with higher BPM under pursuit. No external recordings.
                this.updateRetroScore(dt,inVehicle,sirenPlaying);
                this.dispatcherCooldown=Math.max(0,
                    this.dispatcherCooldown-Math.max(0,dt));
                if(sirenPlaying&&!this.lastSiren&&
                    this.dispatcherCooldown<=0){
                    this.playPoliceDispatcher();
                    this.dispatcherCooldown=18;
                }
                this.lastSiren=!!sirenPlaying;
                if (sirenPlaying) {
                    this.sirenPhase += dt * 4.8;
                    const freq = 690 + Math.sin(this.sirenPhase) * 250;
                    this.sirenOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.04);
                    this.sirenGain.gain.setTargetAtTime(0.055, this.ctx.currentTime, 0.08);
                } else {
                    this.sirenGain.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.12);
                }
            }

            playBridgeBell() {
                // Duas badaladas sintetizadas, sem áudio externo ou samples.
                if(!this.initialized || !this.enabled || !this.ctx)return;
                try {
                    const t=this.ctx.currentTime;
                    for(let i=0;i<2;i++){
                        const start=t+i*.34;
                        const osc=this.ctx.createOscillator();
                        const gain=this.ctx.createGain();
                        osc.type='triangle';
                        osc.frequency.setValueAtTime(880,start);
                        osc.frequency.exponentialRampToValueAtTime(680,start+.25);
                        gain.gain.setValueAtTime(.001,start);
                        gain.gain.linearRampToValueAtTime(.065,start+.02);
                        gain.gain.exponentialRampToValueAtTime(.001,start+.29);
                        osc.connect(gain);gain.connect(this.ctx.destination);
                        osc.start(start);osc.stop(start+.30);
                    }
                } catch(e) {}
            }

            playHorn() {
                if (!this.initialized || !this.enabled || !this.ctx) return;
                try {
                    const osc1 = this.ctx.createOscillator();
                    const osc2 = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    osc1.type = 'sawtooth';
                    osc2.type = 'sawtooth';
                    osc1.frequency.setValueAtTime(340, this.ctx.currentTime);
                    osc2.frequency.setValueAtTime(425, this.ctx.currentTime);
                    gain.gain.setValueAtTime(0.10, this.ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);
                    osc1.connect(gain);
                    osc2.connect(gain);
                    gain.connect(this.ctx.destination);
                    osc1.start();
                    osc2.start();
                    osc1.stop(this.ctx.currentTime + 0.35);
                    osc2.stop(this.ctx.currentTime + 0.35);
                } catch (e) {}
            }

            playHubcapPing() {
                if (!this.initialized || !this.enabled || !this.ctx) return;
                try {
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(1950, this.ctx.currentTime);
                    osc.frequency.exponentialRampToValueAtTime(680, this.ctx.currentTime + 0.18);
                    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.18);
                    osc.connect(gain);
                    gain.connect(this.ctx.destination);
                    osc.start();
                    osc.stop(this.ctx.currentTime + 0.18);
                } catch (e) {}
            }

            playCrash(intensity = 1.0) {
                if (!this.initialized || !this.enabled || !this.ctx) return;
                try {
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(115, this.ctx.currentTime);
                    osc.frequency.exponentialRampToValueAtTime(26, this.ctx.currentTime + 0.28);

                    gain.gain.setValueAtTime(Math.min(0.3, 0.16 * intensity), this.ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);

                    osc.connect(gain);
                    gain.connect(this.ctx.destination);
                    osc.start();
                    osc.stop(this.ctx.currentTime + 0.3);
                } catch (e) {}
            }

            playPedestrianDodgeVoice() {
                if (!this.initialized || !this.enabled || !this.ctx) return;
                try {
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(520, this.ctx.currentTime);
                    osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.12);
                    osc.frequency.exponentialRampToValueAtTime(390, this.ctx.currentTime + 0.26);
                    gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.28);
                    osc.connect(gain);
                    gain.connect(this.ctx.destination);
                    osc.start();
                    osc.stop(this.ctx.currentTime + 0.28);
                } catch (e) {}
            }

            playC4Beep(urgent = false) {
                if (!this.initialized || !this.enabled || !this.ctx) return;
                try {
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    osc.type = 'square';
                    osc.frequency.setValueAtTime(urgent ? 1850 : 1250, this.ctx.currentTime);
                    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.09);
                    osc.connect(gain);
                    gain.connect(this.ctx.destination);
                    osc.start();
                    osc.stop(this.ctx.currentTime + 0.09);
                } catch (e) {}
            }

            playBigExplosion() {
                if (!this.initialized || !this.enabled || !this.ctx) return;
                try {
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(95, this.ctx.currentTime);
                    osc.frequency.exponentialRampToValueAtTime(18, this.ctx.currentTime + 1.1);
                    gain.gain.setValueAtTime(0.38, this.ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.15);
                    osc.connect(gain);
                    gain.connect(this.ctx.destination);
                    osc.start();
                    osc.stop(this.ctx.currentTime + 1.15);
                } catch (e) {}
            }

            playRetroNote(freq,duration=.19,volume=.04,type='triangle'){
                if(!this.enabled||!this.initialized||!this.ctx)return;
                const t=this.ctx.currentTime;
                const osc=this.ctx.createOscillator(),gain=this.ctx.createGain();
                osc.type=type;
                osc.frequency.setValueAtTime(freq,t);
                gain.gain.setValueAtTime(Math.max(.0001,volume),t);
                gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
                osc.connect(gain);gain.connect(this.ctx.destination);
                osc.start(t);osc.stop(t+duration+.01);
            }

            updateRetroScore(dt,inVehicle,pursuit){
                if(!inVehicle||!this.enabled||!this.ctx)return;
                const bpm=pursuit?128:86;
                const beat=60/bpm/2;
                this.musicClock+=Math.min(.05,Math.max(0,dt));
                if(this.musicClock<beat)return;
                this.musicClock%=beat;
                const step=this.musicBeat++%16;
                // New composition: minor pentatonic, syncopated bass.
                const notes=[55,0,82.41,0,65.41,0,73.42,82.41,
                    55,0,65.41,0,73.42,0,82.41,65.41];
                if(notes[step]){
                    this.playRetroNote(notes[step],pursuit?.24:.33,
                        pursuit?.046:.027,'triangle');
                }
                // Kick and metallic snare as short synthetic envelopes.
                if(step%4===0)this.playRetroNote(pursuit?65:58,
                    .10,pursuit?.08:.047,'sine');
                if(pursuit&&step%4===2)this.playRetroNote(170,
                    .068,.028,'square');
                if(pursuit&&step%2===1)this.playRetroNote(940,
                    .021,.007,'square');
            }

            playPoliceDispatcher(){
                if(!this.initialized||!this.enabled||!this.ctx)return;
                // Two-tone 10-31 dispatch chirp, passed through bandpass,
                // accompanied by a short, noise-based static burst.
                try{
                    const ctx=this.ctx,t=ctx.currentTime;
                    const band=ctx.createBiquadFilter();
                    band.type='bandpass';band.frequency.value=1650;
                    band.Q.value=1.2;
                    const gain=ctx.createGain();
                    gain.gain.setValueAtTime(.0001,t);
                    gain.gain.linearRampToValueAtTime(.046,t+.03);
                    gain.gain.setValueAtTime(.032,t+.12);
                    gain.gain.exponentialRampToValueAtTime(.0001,t+.35);
                    band.connect(gain);gain.connect(ctx.destination);
                    const chirp=ctx.createOscillator();
                    chirp.type='square';
                    chirp.frequency.setValueAtTime(780,t);
                    chirp.frequency.setValueAtTime(1110,t+.13);
                    chirp.connect(band);chirp.start(t);chirp.stop(t+.35);
                    const noise=ctx.createBuffer(1,
                        Math.max(1,Math.floor(ctx.sampleRate*.17)),
                        ctx.sampleRate);
                    const channel=noise.getChannelData(0);
                    for(let i=0;i<channel.length;i++)
                        channel[i]=(Math.random()*2-1)*.3;
                    const burst=ctx.createBufferSource();
                    burst.buffer=noise;
                    burst.connect(band);burst.start(t);burst.stop(t+.16);
                    // TTS is optional (browser/locale dependent); do not
                    // autoplay spoken audio when speech synthesis is absent.
                    if(typeof speechSynthesis!=='undefined' &&
                        typeof SpeechSynthesisUtterance!=='undefined' &&
                        !speechSynthesis.speaking){
                        const line=new SpeechSynthesisUtterance(
                            'All units, ten thirty one in progress.');
                        line.lang='en-US';line.rate=1.1;line.volume=.35;
                        speechSynthesis.speak(line);
                    }
                }catch(_){}
            }

            toggleMute() {
                this.enabled = !this.enabled;
                if (!this.enabled && this.initialized) {
                    this.engineGain.gain.value = 0;
                    this.skidGain.gain.value = 0;
                    this.sirenGain.gain.value = 0;
                }
                return this.enabled;
            }
        }

