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

Tape.prototype.record = function () {
    this.recordPressed = true;
    this.recording = this.motorOn;
};

Tape.prototype.play = function () {
    this.playPressed = true;
    this.playing = this.motorOn;
};

Tape.prototype.rewind = function () {
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
    var i;
    if (this.playing && this.loadBuffer) {
        var j = this.loadBufferAudioOffset;
        for (i = 0; i < buffer.length; i++) {
            buffer[i] = j < this.loadBuffer.length ? this.loadBuffer[j++] : 0;
        }
        this.loadBufferAudioOffset = j;
    }
    else if (this.saveBufferReadOffset < this.saveBuffer.length) {
        var value;
        for (i = 0; i < buffer.length; i++) {
            if (i % 18 === 0) {
                value = this.saveBufferReadOffset < this.saveBuffer.length ? this.saveBuffer[this.saveBufferReadOffset++] : !value;
            }
            buffer[i] = value ? 0.75 : -0.75;
        }
        if (this.saveBufferReadOffset === this.saveBuffer.length) {
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
Tape.prototype.read = function (reRead, time, pc)  {
    if (!reRead) {
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
                // console.log(this.outByte.toHexByte());
                this.out += this.outByte.toHexByte().substring(1);
                this.outByteCount = 8;
                this.outByte = 0;
            }
            // console.log(bit + " " + pc.toHexWord());
        }
        this.readFirst = !this.readFirst;
        this.lastSign = sign;

        // if (sign !== this.lastSign) {
        //     this.readValue = this.readValue === 0 ? 1 : 0;
        // }
        // this.lastSign = sign;
        this.readValue = sign > 0 ? 1 : 0;

        // Debug only
        if (this.out.length >= 32 || offset === this.loadBuffer.length && this.out.length > 0) {
            this.log.info(this.out);
            this.out = "";
        }
    } else {
        console.log("re-read");
    }
    console.log(this.readValue + " " + pc.toHexWord());
    return this.readValue;
};

Tape.prototype.write = function (value, time)  {
    if (this.lastWriteTime !== -1) {
        for (var i = 0; i < (time - this.lastWriteTime) / 17; i++) {
            this.saveBuffer[this.saveBufferWriteOffset++] = value;
            // this.out += value ? 1 : 0;
            // if (this.out.length === 32) {
            //     console.log(this.out);
            //     this.out = "";
            // }
        }
    }
    this.lastWriteTime = time;
};