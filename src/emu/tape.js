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

Tape.ZERO = [
    0.03125, 0.07031, 0.10938, 0.10938, 0.10938, 0.10938, 0.10938, 0.10938,
    0.10938, 0.10938, 0.10938, 0.10938, 0.10938, 0.10938, 0.10938, 0.10938,
    0.10938, 0.10938, 0.10938, 0.11719, 0.13281, 0.14063, 0.16406, 0.20313,
    0.26563, 0.37500, 0.51563, 0.64844, 0.70313, 0.59375, 0.35938, 0.07813
];

Tape.ONE = [
    -0.11719, -0.18750, -0.17188, -0.13281, -0.12500, -0.15625, -0.20313, -0.25000,
    -0.32031, -0.41406, -0.53906, -0.65625, -0.67188, -0.53906, -0.29688, -0.06250,
    0.11719, 0.18750, 0.17188, 0.13281, 0.12500, 0.15625, 0.20313, 0.25000,
    0.32031, 0.41406, 0.53906, 0.65625, 0.67188, 0.53906, 0.29688, 0.06250
];

Tape.prototype.reset = function () {
    if (this.audioSource) {
        this.audioSource.stop();
    }
    this.recordPressed = false;
    this.playPressed = false;
    this.motorOn = false;
    this.recording = false;
    this.playing = false;
    this.resetLoadBuffer();
    this.resetSaveBuffer();
};

Tape.prototype.resetLoadBuffer = function () {
    this.samplesPerLevelChange = 0;
    this.loadBuffer = null;
    this.loadBufferOffset = 0;
    this.loadBufferAudioOffset = 0;
    this.readValue = 0;
    this.lastSign = 1;
    this.readFirst = true;
    this.out = "";
    this.outByte = 0;
    this.outByteCount = 8;
};

Tape.prototype.resetSaveBuffer = function () {
    this.saveBuffer = [];
    this.saveBufferWriteOffset = 0;
    this.saveBufferReadOffset = 0;
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
                tape.resetLoadBuffer();
                var sampleBuffer = new Float32Array(audioBuffer.length);
                audioBuffer.copyFromChannel(sampleBuffer, 0);
                tape.loadBuffer = sampleBuffer;
                tape.samplesPerLevelChange = Math.floor(Tape.LEVEL_CHANGE_DURATION * audioBuffer.sampleRate);
                tape.log.info("samplesPerLevelChange=" + tape.samplesPerLevelChange);
                tape.log.info("samplesBufferLength=" + tape.loadBuffer.length);
                tape.loadBufferOffset = 0;
                tape.loadBufferAudioOffset = 0;
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

Tape.prototype.isRecordingAvailable = function () {
    return this.saveBuffer && this.saveBuffer.length;
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
    this.loadBufferOffset = 0;
    this.loadBufferAudioOffset = 0;
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
    var i, j;
    if (this.playing && this.loadBuffer) {
        j = this.loadBufferAudioOffset;
        for (i = 0; i < buffer.length; i++) {
            buffer[i] = j < this.loadBuffer.length ? this.loadBuffer[j++] : 0;
        }
        this.loadBufferAudioOffset = j;
    }
    else if (this.saveBuffer.length > 256 && this.saveBufferReadOffset < this.saveBuffer.length - 1) {
        this.log.info(this.saveBuffer.length - this.saveBufferReadOffset);
        var sign, samples;
        var scale = 2;
        for (i = 0; i < buffer.length; i++) {
            if (i % (32 * scale) === 0) {
                sign = this.saveBuffer[this.saveBufferReadOffset] ? 1 : -1;
                samples = this.saveBuffer[this.saveBufferReadOffset] === this.saveBuffer[this.saveBufferReadOffset + 1] ? Tape.ZERO : Tape.ONE;
                this.saveBufferReadOffset += 2;
            }
            buffer[i] = sign * samples[Math.floor((i % (32 * scale)) / scale)];
        }
        if (this.saveBufferReadOffset >= this.saveBuffer.length - 1) {
            this.log.warn("Tape sound buffer depleted.");
        }
    }
    else {
        for (i = 0; i < buffer.length; i++) {
            buffer[i] = 0;
        }
    }
};

/*
The reader routine is expected to work like this:
function readBit() {
  var sign = 0;
  while (more data to read) {
    [wait for 5/8 period]
    var newSign = read();
    var bit;
    if (newSign != sign) {
      bit = 1;
    } else {
      bit = 0;
    }
    sign = newSign;
    while (sign == newSign) {
      sign = read();
    }
    return bit;
  }
}
*/
Tape.prototype.read = function ()  {
    if (this.playing && this.loadBuffer) {
        var offset = this.loadBufferOffset;
        var sign = offset < this.loadBuffer.length ? Math.sign(this.loadBuffer[offset++]) : 0;
        var runLength = 1;
        while (offset < this.loadBuffer.length && Math.sign(this.loadBuffer[offset++]) === sign) {
            runLength++;
        }
        if (Math.abs(this.samplesPerLevelChange - runLength) <= 2) {
            // It's a full run, i.e. a zero. Advance half way through.
            this.loadBufferOffset += runLength - Math.floor(this.samplesPerLevelChange / 2);
        }
        else {
            // It a half run, i.e. part of a one or 2nd half of a zero
            this.loadBufferOffset += runLength;
        }

        // Debug only
        if (!this.readFirst) {
            var bit = sign !== this.lastSign ? 1 : 0;
            this.outByte = (this.outByte << 1) | bit;
            this.outByteCount--;
            if (this.outByteCount === 0) {
                this.out += this.outByte.toHexByte().substring(1);
                this.outByteCount = 8;
                this.outByte = 0;
            }
            // console.log(bit + " " + pc.toHexWord());
        }
        this.readFirst = !this.readFirst;
        this.lastSign = sign;
        if (this.out.length >= 32 || offset === this.loadBuffer.length && this.out.length > 0) {
            this.log.info(this.out);
            this.out = "";
        }
        // ... Debug only

        this.readValue = sign > 0 ? 1 : 0;
    }
    return this.readValue;
};

// 1: 1/0, 0/1, next
// 0: 1/0, ---, next

Tape.prototype.write = function (value, time)  {
    var interval = this.lastWriteTime === -1 ? 1 : time - this.lastWriteTime;
    var i;
    if (interval === 2) {
        // Finish zero by writing last last value again
        this.saveBuffer[this.saveBufferWriteOffset++] = this.saveBuffer[this.saveBufferWriteOffset - 2];
    }
    if (interval === 1 || interval === 2) {
        // Write new value
        this.saveBuffer[this.saveBufferWriteOffset++] = value;
    }
    else {
        this.log.warn("Unsupported write interval: " + interval);
    }
    this.lastWriteTime = time;
};

Tape.prototype.getRecording = function () {
    var samplesPerHalfBit = 16;
    var array = new Float32Array(this.saveBuffer.length * samplesPerHalfBit);
    var n = 0;
    for (var i = 0; i < this.saveBuffer.length; i++) {
        var value = this.saveBuffer[i];
        var sample = value ? 0.75 : -0.75;
        for (var j = 0; j < samplesPerHalfBit; j++) {
            array[n++] = sample;
        }
    }
    var audioBuffer = this.audioContext.createBuffer(1, array.length, 44100);
    audioBuffer.copyToChannel(array, 0);
    return audioBufferToWav(audioBuffer, { float32: true });
};