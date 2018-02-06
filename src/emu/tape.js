/*
 * js99'er - TI-99/4A emulator written in JavaScript
 *
 * Created 2014 by Rasmus Moustgaard <rasmus.moustgaard@gmail.com>
 */

'use strict';

function Tape() {
    this.audioContext = null;
    if (window.AudioContext) {
        this.audioContext = new AudioContext();
    }
    else if (window.webkitAudioContext) {
        this.audioContext = new webkitAudioContext();
    }
    this.log = Log.getLog();
    this.reset();
}

Tape.LEVEL_CHANGE_FREQUENCY = 1379;
Tape.LEVEL_CHANGE_DURATION = 1 / Tape.LEVEL_CHANGE_FREQUENCY;

Tape.prototype.reset = function () {
    if (this.audioSource) {
        this.audioSource.stop();
    }
    this.recordPressed = false;
    this.playPressed = false;
    this.motorOn = false;
    this.recording = false;
    this.playing = false;
    this.sampleBuffer = null;
    this.samplesPerLevelChange = 0;
    this.sampleBufferOffset = 0;
    this.sampleBufferAudioOffset = 0;
    this.resetRecodingBuffer();
};

Tape.prototype.resetRecodingBuffer = function () {
    this.recordingBuffer = [];
    this.recordingBufferWriteOffset = 0;
    this.recordingBufferReadOffset = 0;
};

Tape.prototype.loadTapeFile = function (fileBuffer, callback) {
    var tape = this;
    if (this.audioContext) {
        this.audioContext.decodeAudioData(fileBuffer).then(
            function (audioBuffer) {
                tape.audioBuffer = audioBuffer;
                tape.log.info("Wav file sample rate: " + audioBuffer.sampleRate + " Hz");
                tape.log.info("Wav file duration: " + audioBuffer.duration + " s");
                tape.log.info("Number of channels: " + audioBuffer.numberOfChannels);
                tape.log.info("Number of samples: " + audioBuffer.length);
                var sampleBuffer = new Float32Array(audioBuffer.length);
                audioBuffer.copyFromChannel(sampleBuffer, 0);
                tape.sampleBuffer = sampleBuffer;
                tape.samplesPerLevelChange = 4; // Math.floor(Tape.LEVEL_CHANGE_DURATION * audioBuffer.sampleRate);
                tape.log.info("samplesPerLevelChange=" + tape.samplesPerLevelChange);
                tape.log.info("samplesBufferLength=" + tape.sampleBuffer.length);
                tape.sampleBufferOffset = 0;
                tape.sampleBufferAudioOffset = 0;
                callback();
            },
            function (e) {
                this.log.error("Error decoding audio data" + e.err);
            }
        );
    }
};

Tape.prototype.isTapeLoaded = function () {
    return this.audioBuffer != null;
};

Tape.prototype.record = function () {
    this.recordPressed = true;
    this.recording = this.motorOn;
};

Tape.prototype.play = function () {
    this.playPressed = true;
    this.playing = this.motorOn;
};

Tape.prototype.rewind = function () {
    this.sampleBufferAudioOffset = 0;
};

Tape.prototype.stop = function () {
    this.recordPressed = false;
    this.playPressed = false;
    this.recording = false;
    this.playing = false;
};

Tape.prototype.setMotorOn = function (value) {
    this.log.info("Cassette motor " + (value ? "on" : "off"));
    this.motorOn = value;
    this.recording = this.recordPressed;
    this.playing = this.playPressed;
};

Tape.prototype.updateSoundBuffer = function (buffer) {
    var i;
    if (this.playing && this.sampleBuffer) {
        var j = this.sampleBufferAudioOffset;
        for (i = 0; i < buffer.length; i++) {
            buffer[i] = j < this.sampleBuffer.length ? this.sampleBuffer[j++] : 0;
        }
        this.sampleBufferAudioOffset = j;
    }
    else if (this.recording) {
        var level;
        for (i = 0; i < buffer.length; i++) {
            if (i % 16 === 0) {
                level = this.recordingBufferReadOffset < this.recordingBuffer.length ? this.recordingBuffer[this.recordingBufferReadOffset] : false;
            }
            buffer[i] = level ? 1 : -1;
        }
    }
    else {
        for (i = 0; i < buffer.length; i++) {
            buffer[i] = 0;
        }
    }
};

Tape.prototype.read = function ()  {
    var value = 0;
    if (this.sampleBuffer && this.sampleBufferOffset + this.samplesPerLevelChange < this.sampleBuffer.length) {
        var sum = 0;
        for (var i = this.sampleBufferOffset; i < this.sampleBufferOffset + this.samplesPerLevelChange; i++) {
            sum += this.sampleBuffer[i];
        }
        this.sampleBufferOffset += this.samplesPerLevelChange;
        value = sum > 0 ? 1 : 0;
    }
    // this.log.info(value);
    return value;
};

Tape.prototype.write = function (value)  {
    this.recordingBuffer[this.recordingBufferWriteOffset++] = value;
};