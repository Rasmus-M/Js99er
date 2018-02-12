/*
 * js99'er - TI-99/4A emulator written in JavaScript
 *
 * Created 2014 by Rasmus Moustgaard <rasmus.moustgaard@gmail.com>
 */

'use strict';

function Tape() {
    this.audioContext = new AudioContext() || new webkitAudioContext();
    this.sampleRate = this.audioContext ? this.audioContext.sampleRate : 0;
    this.samplesPerLevelChange = Math.floor(Tape.LEVEL_CHANGE_DURATION * this.sampleRate);
    this.log = Log.getLog();
    this.reset();
}

Tape.LEVEL_CHANGE_FREQUENCY = 1379;
Tape.LEVEL_CHANGE_DURATION = 1 / Tape.LEVEL_CHANGE_FREQUENCY;

Tape.ZERO = [
    0.02942, 0.06662, 0.10464, 0.11216, 0.10729, 0.11098, 0.10819, 0.11016,
    0.10898, 0.10942, 0.10964, 0.10886, 0.11006, 0.10859, 0.11016, 0.10868,
    0.10990, 0.10909, 0.10938, 0.10956, 0.11001, 0.12289, 0.13377, 0.14345,
    0.16464, 0.20270, 0.25574, 0.35052, 0.47641, 0.60378, 0.69818, 0.66828,
    0.51514, 0.26288, 0.03446, 0.00001
];

Tape.ONE = [
    0.10538, 0.18196, 0.18171, 0.14378, 0.12331, 0.13664, 0.17567, 0.21852,
    0.26456, 0.33587, 0.42363, 0.54129, 0.65023, 0.67852, 0.58335, 0.37611,
    0.15033, -0.04245, -0.16285, -0.18843, -0.16048, -0.12770, -0.12698, -0.15790,
    -0.20117, -0.24331, -0.30351, -0.38475, -0.48914, -0.61134, -0.67988, -0.63930,
    -0.47039, -0.24116, -0.03194, -0.00001
];

Tape.prototype.reset = function () {
    if (this.sampleRate !== 0 && this.sampleRate !== 48000) {
        // TODO: Resample ZERO and ONE
    }
    if (this.audioSource) {
        this.audioSource.stop();
    }
    this.recordPressed = false;
    this.playPressed = false;
    this.motorOn = false;
    this.playing = false;
    this.recording = false;
    this.sampleBuffer = [];
    this.resetSampleBuffer();
};

Tape.prototype.resetSampleBuffer = function () {
    this.sampleBufferOffset = 0;
    this.sampleBufferAudioOffset = 0;
    this.lastWriteValue = null;
    this.lastWriteTime = -1;
};

Tape.prototype.loadTapeFile = function (fileBuffer, callback) {
    var tape = this;
    if (this.audioContext) {
        this.audioContext.decodeAudioData(fileBuffer).then(
            function (audioBuffer) {
                tape.audioBuffer = audioBuffer;
                var sampleBuffer = new Float32Array(audioBuffer.length);
                audioBuffer.copyFromChannel(sampleBuffer, 0);
                tape.sampleBuffer = sampleBuffer;
                tape.resetSampleBuffer();
                callback();
            },
            function (e) {
                this.log.error("Error decoding audio data" + e.err);
            }
        );
    }
};

Tape.prototype.isPlayEnabled = function () {
    return this.sampleBufferOffset < this.sampleBuffer.length;
};

Tape.prototype.isRewindEnabled = function () {
    return this.sampleBufferOffset > 0 || this.sampleBufferAudioOffset > 0;
};

Tape.prototype.isRecordingAvailable = function () {
    return this.sampleBufferAudioOffset > 0;
};

Tape.prototype.record = function () {
    this.recordPressed = true;
    this.recording = this.motorOn;
    if (this.recording) {
        this.resetSampleBuffer();
    }
};

Tape.prototype.play = function () {
    this.playPressed = true;
    this.playing = this.motorOn;
};

Tape.prototype.rewind = function () {
    this.sampleBufferOffset = 0;
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
    if (this.playing) {
        for (i = 0; i < buffer.length; i++) {
            buffer[i] = this.sampleBufferAudioOffset < this.sampleBuffer.length ? this.sampleBuffer[this.sampleBufferAudioOffset++] : 0;
        }
    }
    else if (this.recording && this.sampleBufferAudioOffset < this.sampleBuffer.length - buffer.length) {
        for (i = 0; i < buffer.length; i++) {
            buffer[i] = this.sampleBuffer[this.sampleBufferAudioOffset++];
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
    if (this.playing && this.sampleBuffer) {
        var offset = this.sampleBufferOffset;
        var sign = offset < this.sampleBuffer.length ? Math.sign(this.sampleBuffer[offset++]) : 0;
        var runLength = 1;
        while (offset < this.sampleBuffer.length && Math.sign(this.sampleBuffer[offset++]) === sign) {
            runLength++;
        }
        if (Math.abs(this.samplesPerLevelChange - runLength) <= 2) {
            // It's a full run, i.e. a zero. Advance half way through.
            this.sampleBufferOffset += runLength - Math.floor(this.samplesPerLevelChange / 2);
        }
        else {
            // It a half run, i.e. part of a one or 2nd half of a zero
            this.sampleBufferOffset += runLength;
        }
        return sign > 0 ? 1 : 0;
    }
    else {
        return 0;
    }
};

// 1: 1/0, 0/1, next
// 0: 1/0, ---, next

Tape.prototype.write = function (value, time) {
    var interval = this.lastWriteTime === -1 ? 1 : time - this.lastWriteTime;
    var i;
    if (interval === 1) {
        if (this.lastWriteValue !== null) {
            for (i = 0; i < Tape.ONE.length; i++) {
                this.sampleBuffer[this.sampleBufferOffset++] = this.lastWriteValue ? Tape.ONE[i] : -Tape.ONE[i];
            }
            this.lastWriteValue = null;
        }
        else {
           this.lastWriteValue = value;
        }
    }
    else if (interval === 2) {
        for (i = 0; i < Tape.ZERO.length; i++) {
            this.sampleBuffer[this.sampleBufferOffset++] = this.lastWriteValue ? Tape.ZERO[i] : -Tape.ZERO[i];
        }
        this.lastWriteValue = value;
    }
    else {
        this.log.warn("Unsupported write interval: " + interval);
    }
    this.lastWriteTime = time;
};

Tape.prototype.getRecording = function () {
    if (this.lastWriteValue !== null) {
        for (i = 0; i < Tape.ZERO.length; i++) {
            this.sampleBuffer[this.sampleBufferOffset++] = this.lastWriteValue ? Tape.ZERO[i] : -Tape.ZERO[i];
        }
        this.lastWriteValue = null;
    }
    var array = new Float32Array(this.sampleBufferOffset);
    for (var i = 0; i < this.sampleBufferOffset; i++) {
        array[i] = this.sampleBuffer[i];
    }
    var audioBuffer = this.audioContext.createBuffer(1, array.length, this.sampleRate);
    audioBuffer.copyToChannel(array, 0);
    return audioBufferToWav(audioBuffer, { float32: true });
};