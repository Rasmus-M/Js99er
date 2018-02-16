/*
 * js99'er - TI-99/4A emulator written in JavaScript
 *
 * Created 2014 by Rasmus Moustgaard <rasmus.moustgaard@gmail.com>
 *
 */

'use strict';

function TMS9919() {
    this.sn76489 = new SN76489();
    this.log = Log.getLog();
    this.sampleRate = SN76489.SAMPLE_FREQUENCY;
}

TMS9919.prototype = {

    reset: function () {
        this.mute();
        this.sn76489.init(SN76489.CLOCK_3_58MHZ, this.sampleRate);
    },

    setSampleRate: function (sampleRate) {
        this.sampleRate = sampleRate;
        this.reset();
    },

    writeData: function (b) {
        this.sn76489.write(b);
    },

    mute: function () {
        this.writeData(0x9F);
        this.writeData(0xBF);
        this.writeData(0xDF);
        this.writeData(0xFF);
    },

    setGROMClock: function (gromClock) {
        this.log.info("GROM clock set to " + gromClock.toHexByte());
        var divider;
        if (gromClock == 0xD6) {
            divider = 1;
        }
        else {
            divider = gromClock / 112;
        }
        this.sn76489.init(SN76489.CLOCK_3_58MHZ / divider, this.sampleRate);
    } ,

    update: function (buffer, length){
        this.sn76489.update(buffer, 0, length);
    },

    getState: function () {
        return {};
    },

    restoreState: function (state) {

    }
};

