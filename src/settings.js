/*
 * js99'er - TI-99/4A emulator written in JavaScript
 *
 * Created 2014 by Rasmus Moustgaard <rasmus.moustgaard@gmail.com>
 */

'use strict';

function Settings(persistent) {
    this.persistent = persistent;
    this.enableSound = true;
    this.enableSpeech = false;
    this.enable32KRAM = true;
    this.enableF18A = false;
    this.enableFlicker = false;
    this.enablePCKeyboard = false;
    this.enableGoogleDrive = false;
    this.enableAMS = false;
    if (persistent && window.localStorage) {
        this.storage = window.localStorage;
        if (this.storage.getItem("enableSound") != null) {
            this.enableSound = this.storage.getItem("enableSound") == "true";
        }
        if (this.storage.getItem("enableSpeech") != null) {
            this.enableSpeech = this.storage.getItem("enableSpeech") == "true";
        }
        if (this.storage.getItem("enable32KRAM") != null) {
            this.enable32KRAM = this.storage.getItem("enable32KRAM") == "true";
        }
        if (this.storage.getItem("enableF18A") != null) {
            this.enableF18A = this.storage.getItem("enableF18A") == "true";
        }
        if (this.storage.getItem("enableFlicker") != null) {
            this.enableFlicker = this.storage.getItem("enableFlicker") == "true";
        }
        if (this.storage.getItem("enablePCKeyboard") != null) {
            this.enablePCKeyboard = this.storage.getItem("enablePCKeyboard") == "true";
        }
        if (this.storage.getItem("enableGoogleDrive") != null) {
            this.enableGoogleDrive = this.storage.getItem("enableGoogleDrive") == "true";
        }
        if (this.storage.getItem("enableAMS") != null) {
            this.enableAMS = this.storage.getItem("enableAMS") == "true";
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

    isSpeechEnabled: function() {
        return this.enableSpeech;
    },

    setSpeechEnabled: function(enabled) {
        this.enableSpeech = enabled;
        if (this.persistent && this.storage) {
            this.storage.setItem("enableSpeech", enabled);
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
    },

    isFlickerEnabled: function() {
        return this.enableFlicker;
    },

    setFlickerEnabled: function(enabled) {
        this.enableFlicker = enabled;
        if (this.persistent && this.storage) {
            this.storage.setItem("enableFlicker", enabled);
        }
    },

    isPCKeyboardEnabled: function() {
        return this.enablePCKeyboard;
    },

    setPCKeyboardEnabled: function(enabled) {
        this.enablePCKeyboard = enabled;
        if (this.persistent && this.storage) {
            this.storage.setItem("enablePCKeyboard", enabled);
        }
    },

    isGoogleDriveEnabled: function() {
        return this.enableGoogleDrive;
    },

    setGoogleDriveEnabled: function(enabled) {
        this.enableGoogleDrive = enabled;
        if (this.persistent && this.storage) {
            this.storage.setItem("enableGoogleDrive", enabled);
        }
    },

    isAMSEnabled: function() {
        return this.enableAMS;
    },

    setAMSEnabled: function(enabled) {
        this.enableAMS = enabled;
        if (this.persistent && this.storage) {
            this.storage.setItem("enableAMS", enabled);
        }
    }
};