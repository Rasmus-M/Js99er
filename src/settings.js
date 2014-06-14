/*
 * js99'er - TI-99/4A emulator written in JavaScript
 *
 * Created 2014 by Rasmus Moustgaard <rasmus.moustgaard@gmail.com>
 */

'use strict';

function Settings(persistent) {
    this.persistent = persistent;
    this.enableSound = true;
    this.enable32KRAM = true;
    this.enableF18A = false;
    if (persistent && window.localStorage) {
        this.storage = window.localStorage;
        if (this.storage.getItem("enableSound") != null) {
            this.enableSound = this.storage.getItem("enableSound") == "true";
        }
        if (this.storage.getItem("enable32KRAM") != null) {
            this.enable32KRAM = this.storage.getItem("enable32KRAM") == "true";
        }
        if (this.storage.getItem("enableF18A") != null) {
            this.enableF18A = this.storage.getItem("enableF18A") == "true";
        }
    }
}

Settings.prototype =  {

    isSoundEnabled: function() {
        return this.enableSound;
    },

    setSoundEnabled: function(enabled) {
        this.enableSound = enabled;
        if (this.persistent && this.storage) {
            this.storage.setItem("enableSound", enabled);
        }
    },

    is32KRAMEnabled: function() {
        return this.enable32KRAM;
    },

    set32KRAMEnabled: function(enabled) {
        this.enable32KRAM = enabled;
        if (this.persistent && this.storage) {
            this.storage.setItem("enable32KRAM", enabled);
        }
    },

    isF18AEnabled: function() {
        return this.enableF18A;
    },

    setF18AEnabled: function(enabled) {
        this.enableF18A = enabled;
        if (this.persistent && this.storage) {
            this.storage.setItem("enableF18A", enabled);
        }
    }
};