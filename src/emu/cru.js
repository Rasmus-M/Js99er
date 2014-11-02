/*
 * js99'er - TI-99/4A emulator written in JavaScript
 *
 * Created 2014 by Rasmus Moustgaard <rasmus.moustgaard@gmail.com>
 */

'use strict';

function CRU(keyboard) {
    this.keyboard = keyboard;
    this.cru = [];
    this.log = Log.getLog();
    this.reset();
}

CRU.prototype = {

    reset: function() {
        for (var i = 0; i < 4096; i++) {
            this.cru[i] = true;
        }
    },

    readBit: function(addr) {
        // Keyboard
        if (addr >= 3 && addr <= 10) {
            var col = (this.cru[0x12] ? 1 : 0) | (this. cru[0x13] ? 2 : 0) | (this.cru[0x14] ? 4 : 0);
            if (addr == 7 && !this.cru[0x15]) {
                return !this.keyboard.isAlphaLockDown();
            }
            else {
                return !(this.keyboard.isKeyDown(col, addr));
            }
        }
        return this.cru[addr];
    },

    writeBit: function(addr, bit) {

        if (addr >= 0x800) {
            // DSR space
            addr <<= 1; // Convert to R12 space i.e. >= >1000
            if ((addr & 0xff) == 0) {
                // Enable DSR ROM
                var dsr = (addr >> 8) & 0xf; // 256
                // this.log.info("DSR ROM " + dsr + " " + (bit ? "enabled" : "disabled") + ".");
                this.memory.togglePeripheralROM(dsr, bit);
            }
        }
        else {
            this.cru[addr] = bit;
        }
    },

    setMemory: function(memory) {
        this.memory = memory;
    },

    isVDPInterrupt: function() {
        return !this.cru[2];
    }
};
