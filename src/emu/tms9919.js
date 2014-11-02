/*
 * js99'er - TI-99/4A emulator written in JavaScript
 *
 * Created 2014 by Rasmus Moustgaard <rasmus.moustgaard@gmail.com>
 */

'use strict';

function TMS9919(enabled) {

    this.psgdev = new SN76489();
    this.bufferSize = 1024;
    this.buffer = new Int8Array(this.bufferSize);
    this.log = Log.getLog();
    if (TMS9919.audioContext == null) {
        if (window.AudioContext) {
            TMS9919.audioContext = new AudioContext();
        }
        else if (window.webkitAudioContext) {
            TMS9919.audioContext = new webkitAudioContext();
        }
    }
    if (TMS9919.audioContext != null) {
        this.log.info("Web Audio API detected");
        this.sampleRate = TMS9919.audioContext.sampleRate;
        this.log.info('AudioContext: sample rate is ' + this.sampleRate);
        this.scriptProcessor = TMS9919.audioContext.createScriptProcessor(this.bufferSize, 2, 2);
        this.scriptProcessor.connect(TMS9919.audioContext.destination);
        this.setSoundEnabled(enabled);
    }
    else {
        this.log.warn("Web Audio API not supported by this browser.");
    }
}

TMS9919.audioContext = null;

TMS9919.prototype = {

    reset: function() {
        this.mute();
        this.psgdev.init(SN76489.CLOCK_3_58MHZ, SN76489.SAMPLE_FREQUENCY);
    },

    writeData: function(b) {
        this.psgdev.write(b);
    },

    onAudioProcess: function(event) {
        // Get Float32Array output buffer.
        var lOut = event.outputBuffer.getChannelData(0);
        var rOut = event.outputBuffer.getChannelData(1);

        // Get Int8Array input buffer.
        this.psgdev.update(this.buffer, 0, this.bufferSize);

        // Process buffer conversion.
        for (var i = 0; i < this.bufferSize; i++) {
            var sample = this.buffer[i] / 256.0;
            lOut[i] = sample;
            rOut[i] = sample;
        }
    },

    mute: function() {
        this.writeData(0x9F);
        this.writeData(0xBF);
        this.writeData(0xDF);
        this.writeData(0xFF);
    },

    setSoundEnabled: function(enabled) {
        if (enabled) {
            var that = this;
            this.scriptProcessor.onaudioprocess = function(event) { that.onAudioProcess(event); };
        }
        else {
            this.mute();
            this.scriptProcessor.onaudioprocess = null;
        }
    },

    setGROMClock: function(gromClock) {
        this.log.info("GROM clock set to " + gromClock.toHexByte());
        var divider;
        if (gromClock == 0xD6) {
            divider = 1;
        }
        else {
            divider = gromClock / 112;
        }
        this.psgdev.init(SN76489.CLOCK_3_58MHZ / divider, SN76489.SAMPLE_FREQUENCY);
    }
};

