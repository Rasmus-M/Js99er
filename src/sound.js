/*
 * js99'er - TI-99/4A emulator written in JavaScript
 *
 * Created 2014 by Rasmus Moustgaard <rasmus.moustgaard@gmail.com>
 *
 */

'use strict';

Sound.USE_SPEECH_SAMPLE_INTERPOLATION = true;

function Sound(enabled, psgDev, speechDev) {
    this.psgDev = psgDev;
    this.speechDev = speechDev;
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
        if (psgDev != null) {
            psgDev.setSampleRate(this.sampleRate);
            this.buffer1 = new Int8Array(this.bufferSize);
            this.scriptProcessor1 = Sound.audioContext.createScriptProcessor(this.bufferSize, 0, 1);
            this.scriptProcessor1.onaudioprocess = function (event) { that.onAudioProcess1(event); };
        }
        if (speechDev != null) {
			var speechSampleRate = TMS5220.SAMPLE_RATE;
			this.speechScale = this.sampleRate / speechSampleRate;
            // this.speechScale += 0.0125; // Attempt to avoid buffer depletion
            this.buffer2 = new Int16Array(Math.floor(this.bufferSize / this.speechScale) + 1);
            this.scriptProcessor2 = Sound.audioContext.createScriptProcessor(this.bufferSize, 0, 1);
            this.scriptProcessor2.onaudioprocess = function (event) { that.onAudioProcess2(event); };
            this.filter = Sound.audioContext.createBiquadFilter();
            this.filter.type = "lowpass";
            this.filter.frequency.value = speechSampleRate / 2;
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

    onAudioProcess1: function (event) {
        // Get Float32Array output buffer
        var out = event.outputBuffer.getChannelData(0);
        // Get Int8Array input buffer
        this.psgDev.update(this.buffer1, this.bufferSize);
        // Process buffer conversion
        for (var i = 0; i < this.bufferSize; i++) {
            out[i] = this.buffer1[i] / 256.0;
        }
    },

    onAudioProcess2: function (event) {
        // Get Float32Array output buffer
        var out = event.outputBuffer.getChannelData(0);
        // Get Int16Array input buffer
        this.speechDev.update(this.buffer2, this.buffer2.length);
        // Process buffer conversion
        var s = 0;
        var r = 0;
        for (var i = 0; i < this.buffer2.length; i++) {
			r += this.speechScale;
            var sample = this.buffer2[i] / 32768.0;
			var step = 0;
			if (Sound.USE_SPEECH_SAMPLE_INTERPOLATION) {
				var nextSample = i < this.buffer2.length - 1 ? this.buffer2[i + 1] / 32768.0 : sample;
				step = (nextSample - sample) / r;
			}
			while (r >= 1) {
				out[s++] = sample;
				sample += step;
				r--;
			}
        }
    },

    setSoundEnabled: function (enabled) {
        if (Sound.audioContext) {
            if (enabled) {
                if (this.scriptProcessor1) {
                    this.scriptProcessor1.connect(Sound.audioContext.destination);
                }
                if (this.scriptProcessor2) {
                    this.scriptProcessor2.connect(this.filter);
                    this.filter.connect(Sound.audioContext.destination);
                }
            }
            else {
                if (this.scriptProcessor1) {
                    this.scriptProcessor1.disconnect();
                }
                if (this.scriptProcessor2) {
                    this.scriptProcessor2.disconnect();
                    this.filter.disconnect();
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

