/*
 * js99'er - TI-99/4A emulator written in JavaScript
 *
 * Created 2014 by Rasmus Moustgaard <rasmus.moustgaard@gmail.com>
 */

'use strict';

String.prototype.padl = function(ch, len) {
    var s = this;
    while (s.length < len) {
        s = ch + s;
    }
    return s;
};

String.prototype.padr = function(ch, len) {
    var s = this;
    while (s.length < len) {
        s = s + ch;
    }
    return s;
};

Number.prototype.toHexWord = function() {
    var s = this.toString(16).toUpperCase();
    while (s.length < 4) {
        s = "0" + s;
    }
    return ">" + s;
};

Number.prototype.toHexByte = function() {
    var s = this.toString(16).toUpperCase();
    if (s.length == 1) {
        s = "0" + s;
    }
    return ">" + s;
};

Number.prototype.toHexByteShort = function() {
    var s = this.toString(16).toUpperCase();
    if (s.length == 1) {
        s = "0" + s;
    }
    return s;
};
