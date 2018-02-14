/*
 * js99'er - TI-99/4A emulator written in JavaScript
 *
 * Created 2014 by Rasmus Moustgaard <rasmus.moustgaard@gmail.com>
 *
 */

'use strict';

Sound.USE_SPEECH_SAMPLE_INTERPOLATION = true;

function Sound(enabled, psgDev, speechDev, tape) {
    this.psgDev = psgDev;
    this.speechDev = speechDev;
    this.tape = tape;
    this.log = Log.getLog();
    if (Sound.audioContext == null) {
        if (window.AudioContext) {
            Sound.audioContext = new AudioContext();
        }
        else if (window.webkitAudioContext) {
            Sound.audioContext = new webkitAudioContext();
        }
    }
    if (Sound.audioContext != null) {
        this.log.info("Web Audio API detected");
        this.sampleRate = Sound.audioContext.sampleRate;
        this.log.info('AudioContext: sample rate is ' + this.sampleRate);
		this.bufferSize = 1024;
        var that = this;
        if (psgDev) {
            psgDev.setSampleRate(this.sampleRate);
            this.vdpSampleBuffer = new Int8Array(this.bufferSize);
            this.vdpScriptProcessor = Sound.audioContext.createScriptProcessor(this.bufferSize, 0, 1);
            this.vdpScriptProcessor.onaudioprocess = function (event) { that.onVDPAudioProcess(event); }
        }
        if (speechDev) {
			var speechSampleRate = TMS5220.SAMPLE_RATE;
			this.speechScale = this.sampleRate / speechSampleRate;
            this.speechSampleBuffer = new Int16Array(Math.floor(this.bufferSize / this.speechScale) + 1);
            this.speechScriptProcessor = Sound.audioContext.createScriptProcessor(this.bufferSize, 0, 1);
            this.speechScriptProcessor.onaudioprocess = function (event) { that.onSpeechAudioProcess(event); };
            this.speechFilter = Sound.audioContext.createBiquadFilter();
            this.speechFilter.type = "lowpass";
            this.speechFilter.frequency.value = speechSampleRate / 2;
        }
        if (tape) {
            this.tapeSampleBuffer = new Float32Array(this.bufferSize);
            this.tapeScriptProcessor = Sound.audioContext.createScriptProcessor(this.bufferSize, 0, 1);
            this.tapeScriptProcessor.onaudioprocess = function (event) { that.onTapeAudioProcess(event); };
            this.tapeFilter = Sound.audioContext.createBiquadFilter();
            this.tapeFilter.type = "lowpass";
            this.tapeFilter.frequency.value = 4000;
        }
        this.setSoundEnabled(enabled);
        this.iOSLoadInitSound();
    }
    else {
        this.log.warn("Web Audio API not supported by this browser.");
    }
}

Sound.audioContext = null;

Sound.prototype = {

    onVDPAudioProcess: function (event) {
        // Get Float32Array output buffer
        var out = event.outputBuffer.getChannelData(0);
        // Get Int8Array input buffer
        this.psgDev.update(this.vdpSampleBuffer, this.bufferSize);
        // Process buffer conversion
        for (var i = 0; i < this.bufferSize; i++) {
            out[i] = this.vdpSampleBuffer[i] / 256.0;
        }
    },

    onSpeechAudioProcess: function (event) {
        // Get Float32Array output buffer
        var out = event.outputBuffer.getChannelData(0);
        // Get Int16Array input buffer
        this.speechDev.update(this.speechSampleBuffer, this.speechSampleBuffer.length);
        // Process buffer conversion
        var s = 0;
        var r = 0;
        for (var i = 0; i < this.speechSampleBuffer.length; i++) {
			r += this.speechScale;
            var sample = this.speechSampleBuffer[i] / 32768.0;
			var step = 0;
			if (Sound.USE_SPEECH_SAMPLE_INTERPOLATION) {
				var nextSample = i < this.speechSampleBuffer.length - 1 ? this.speechSampleBuffer[i + 1] / 32768.0 : sample;
				step = (nextSample - sample) / r;
			}
			while (r >= 1) {
				out[s++] = sample;
				sample += step;
				r--;
			}
        }
    },

    onTapeAudioProcess: function (event) {
        var out = event.outputBuffer.getChannelData(0);
        this.tape.updateSoundBuffer(this.tapeSampleBuffer, this.tapeSampleBuffer.length);
        for (var i = 0; i < this.bufferSize; i++) {
            out[i] = this.tapeSampleBuffer[i];
        }
    },

    setSoundEnabled: function (enabled) {
        if (Sound.audioContext) {
            if (enabled) {
                if (this.vdpScriptProcessor) {
                    this.vdpScriptProcessor.connect(Sound.audioContext.destination);
                }
                if (this.speechScriptProcessor) {
                    this.speechScriptProcessor.connect(this.speechFilter);
                    this.speechFilter.connect(Sound.audioContext.destination);
                }
                if (this.tapeScriptProcessor) {
                    this.tapeScriptProcessor.connect(this.tapeFilter);
                    this.tapeFilter.connect(Sound.audioContext.destination);
                }
            }
            else {
                if (this.vdpScriptProcessor) {
                    this.vdpScriptProcessor.disconnect();
                }
                if (this.speechScriptProcessor) {
                    this.speechScriptProcessor.disconnect();
                    this.speechFilter.disconnect();
                }
                if (this.tapeScriptProcessor) {
                    this.tapeScriptProcessor.disconnect();
                }
            }
        }
    },

    iOSLoadInitSound: function() {
        this.ios_sound_init_ok = false;
        this.ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        if (this.ios) {
            var rq = new XMLHttpRequest();
            rq.open("GET", "sound/click.mp3");
            rq.responseType="arraybuffer";
            var ac = Sound.audioContext;
            var that = this;
            rq.onload = function() {
                ac.decodeAudioData(rq.response,
                    function(buf) {
                        that.init_sound = buf;
                    },
                    function () {
                        that.log.error("decode error " + e.file);
                    }
                );
            };
            rq.send();
        }
    },

    iOSUserTriggeredSound: function() {
        if (!this.ios_sound_init_ok) {
            if (!this.ios) {
                this.ios_sound_init_ok = true;
            }
            else if (this.init_sound) {
                this.ios_sound_init_ok = true;
                var ac = Sound.audioContext;
                var src = ac.createBufferSource();
                src.buffer = this.init_sound;
                var g = ac.createGain();
                src.connect(g);
                g.connect(ac.destination);
                g.gain.value = 0;
                if (src.start) {
                    src.start(0);
                }
                else src.noteOn(0);
            }
        }
    }
};

