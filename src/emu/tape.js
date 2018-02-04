/*
 * js99'er - TI-99/4A emulator written in JavaScript
 *
 * Created 2014 by Rasmus Moustgaard <rasmus.moustgaard@gmail.com>
 */

'use strict';

function Tape() {
    this.fileBuffer = null;
    this.playing = false;
    this.audioContext = null;
    if (window.AudioContext) {
        this.audioContext = new AudioContext();
    }
    else if (window.webkitAudioContext) {
        this.audioContext = new webkitAudioContext();
    }
    this.source = null;
    this.log = Log.getLog();
}

Tape.prototype.loadTapeFile = function (fileBuffer) {
    this.fileBuffer = fileBuffer;
    var tape = this;
    var audioContext = this.audioContext;
    if (audioContext) {
        audioContext.decodeAudioData(fileBuffer,
            function (buffer) {
                var source = audioContext.createBufferSource();
                source.buffer = buffer;
                source.connect(audioContext.destination);
                source.loop = false;
                tape.source = source;
            },
            function (e) {
                this.log.error("Error decoding audio data" + e.err);
            }
        )
    }
};

Tape.prototype.isTapeLoaded = function () {
    return this.fileBuffer != null;
};

Tape.prototype.play = function () {
    this.playing = true;
    if (this.source) {
        this.source.start(0);
    }
};

Tape.prototype.stop = function () {
    this.playing = false;
    if (this.source) {
        this.source.stop();
    }
};