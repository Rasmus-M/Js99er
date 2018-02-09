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
    this.readValue = 0;
    this.lastSign = 1;
    this.readFirst = true;
    this.lastReadTime = -1;
    this.sampleBufferOffset = 0;
    this.sampleBufferAudioOffset = 0;
    this.out = "";
    this.outByte = 0;
    this.outByteCount = 8;
    this.resetRecordingBuffer();
};

Tape.prototype.resetRecordingBuffer = function () {
    this.recordingBuffer = [];
    this.recordingBufferWriteOffset = 0;
    this.recordingBufferReadOffset = 0;
    this.lastWriteTime = -1;
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
                tape.samplesPerLevelChange = Math.floor(Tape.LEVEL_CHANGE_DURATION * audioBuffer.sampleRate);
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
    else if (this.recordingBufferReadOffset < this.recordingBuffer.length) {
        var value;
        for (i = 0; i < buffer.length; i++) {
            if (i % 18 === 0) {
                value = this.recordingBufferReadOffset < this.recordingBuffer.length ? this.recordingBuffer[this.recordingBufferReadOffset++] : !value;
            }
            buffer[i] = value ? 0.75 : -0.75;
        }
        if (this.recordingBufferReadOffset === this.recordingBuffer.length) {
            this.log.warn("Tape sound buffer depleted.");
        }
    }
    else {
        for (i = 0; i < buffer.length; i++) {
            buffer[i] = 0;
        }
    }
};

Tape.prototype.read = function (time)  {
    if (this.sampleBuffer && this.sampleBufferOffset + this.samplesPerLevelChange < this.sampleBuffer.length) { //  && (this.lastReadTime === -1 || time - this.lastReadTime >= 8)
        var offset = this.sampleBufferOffset;
        var sign = Math.sign(this.sampleBuffer[offset++]);
        var runLength = 1;
        while (offset < this.sampleBuffer.length && Math.sign(this.sampleBuffer[offset++]) === sign) {
            runLength++;
        }
        if (Math.abs(this.samplesPerLevelChange - runLength) <= 2) {
            this.sampleBufferOffset += runLength - Math.floor(this.samplesPerLevelChange / 2);
        }
        else {
            this.sampleBufferOffset += runLength;
        }
        if (!this.readFirst) {
            this.outByte <<= 1;
            if (sign !== this.lastSign) {
                this.outByte |= 1;
            }
            this.outByteCount--;
            if (this.outByteCount === 0) {
                this.out += this.outByte.toHexByte().substring(1);
                this.outByteCount = 8;
                this.outByte = 0;
            }
        }
        if (sign !== this.lastSign) {
            this.readValue = this.readValue === 0 ? 1 : 0;
        }
        this.lastSign = sign;
        this.readFirst = !this.readFirst;
        this.lastReadTime = time;
        if (this.out.length >= 32) {
            this.log.info(this.out);
            this.out = "";
        }
    } else {
        this.log.info("End of tape file");
        if (this.out.length >= 0) {
            this.log.info(this.out);
            this.out = "";
        }
    }
    return this.readValue;
};

Tape.prototype.write = function (value, time)  {
    if (this.lastWriteTime !== -1) {
        for (var i = 0; i < (time - this.lastWriteTime) / 17; i++) {
            this.recordingBuffer[this.recordingBufferWriteOffset++] = value;
            // this.out += value ? 1 : 0;
            // if (this.out.length === 32) {
            //     console.log(this.out);
            //     this.out = "";
            // }
        }
    }
    this.lastWriteTime = time;
};