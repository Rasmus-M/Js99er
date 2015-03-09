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
        this.cru[24] = false; // Audio gate
        this.cru[25] = false; // Output to cassette mike jack
    },

    readBit: function(addr) {
        // Keyboard
        if (addr >= 3 && addr <= 10) {
            var col = (this.cru[18] ? 1 : 0) | (this.cru[19] ? 2 : 0) | (this.cru[20] ? 4 : 0);
            // this.log.info("Addr: " + addr + " Col: " + col + " Down: " + this.keyboard.isKeyDown(col, addr));
            if (addr == 7 && !this.cru[21]) {
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
                this.memory.setPeripheralROM(dsr, bit);
            }
            // AMS
            if (addr >= 0x1e00 && addr < 0x1f00 && this.memory.enableAMS) {
                var bitNo = (addr & 0x000e) >> 1;
                if (bitNo == 0) {
                    // Controls access to mapping registers
                    this.memory.ams.setRegisterAccess(bit);
                }
                else if (bitNo == 1) {
                    // Toggles between mapping mode and transparent mode
                    this.memory.ams.setMode(bit ? AMS.MAPPING_MODE : AMS.TRANSPARENT_MODE);
                }
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
