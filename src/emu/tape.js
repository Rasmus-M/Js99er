/*
 * js99'er - TI-99/4A emulator written in JavaScript
 *
 * Created 2014 by Rasmus Moustgaard <rasmus.moustgaard@gmail.com>
 */

'use strict';

function Tape() {
    this.fileBuffer = null;
    this.playing = false;
    this.log = Log.getLog();
}

Tape.prototype.loadTapeFile = function (fileBuffer) {
    this.fileBuffer = fileBuffer;
};

Tape.prototype.isTapeLoaded = function () {
    return this.fileBuffer != null;
};

Tape.prototype.play = function () {
    this.playing = true;
};

Tape.prototype.stop = function () {
    this.playing = false;
};