/*
 * js99'er - TI-99/4A emulator written in JavaScript
 *
 * Created 2014 by Rasmus Moustgaard <rasmus.moustgaard@gmail.com>
 */

'use strict';

function Tape() {
    this.fileBuffer = null;
    this.playing = false;
    this.motorOn = false;
    this.audioContext = null;
    if (window.AudioContext) {
        this.audioContext = new AudioContext();
    }
    else if (window.webkitAudioContext) {
        this.audioContext = new webkitAudioContext();
    }
    this.audioBuffer = null;
    this.audioSource = null;
    this.audioStartTime = 0;
    this.audioSuspendTime = 0;
    this.cassetteInput = false;
    this.log = Log.getLog();
}

Tape.prototype.loadTapeFile = function (fileBuffer) {
    this.fileBuffer = fileBuffer;
    var tape = this;
    if (this.audioContext) {
        this.audioContext.decodeAudioData(fileBuffer).then(
            function (audioBuffer) {
                tape.audioBuffer = audioBuffer;
                tape.audioSource = null;
                tape.audioSuspendTime = 0;
            },
            function (e) {
                this.log.error("Error decoding audio data" + e.err);
            }
        );
    }
};

Tape.prototype.isTapeLoaded = function () {
    return this.fileBuffer != null;
};

Tape.prototype.play = function () {
    this.playing = true;
    this.toggleAudio();
};

Tape.prototype.stop = function () {
    this.playing = false;
    this.toggleAudio();
};

Tape.prototype.setMotorOn = function (value) {
    this.log.info("Cassette motor " + (value ? "on" : "off"));
    this.motorOn = value;
    this.toggleAudio();
};

Tape.prototype.toggleAudio = function () {
    if (this.motorOn && this.playing) {
        if (this.audioContext && this.audioBuffer) {
            var source = this.audioContext.createBufferSource();
            source.buffer = this.audioBuffer;
            source.connect(this.audioContext.destination);
            source.start(0, this.audioSuspendTime / 1000);
            this.audioSource = source;
            this.audioStartTime = new Date().getTime();
        }
    }
    else {
        if (this.audioSource) {
            this.audioSource.stop();
            this.audioSuspendTime += new Date().getTime() - this.audioStartTime;
        }
    }
};

Tape.prototype.getBit = function ()  {
    this.cassetteInput = !this.cassetteInput;
    return this.cassetteInput;
};
