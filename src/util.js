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

String.prototype.parseHexWord = function() {
    var val = this;
    if (val != null) {
        val = val.trim();
        if (val.charAt(0) == ">") {
            val = val.substr(1);
        }
        val = parseInt(val, 16);
        if (!isNaN(val) && val >= 0 && val < 0x10000) {
            return val;
        }
    }
    return null;
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
