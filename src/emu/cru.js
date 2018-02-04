/*
 * js99'er - TI-99/4A emulator written in JavaScript
 *
 * Created 2014 by Rasmus Moustgaard <rasmus.moustgaard@gmail.com>
 */

'use strict';

function CRU(keyboard) {
    this.keyboard = keyboard;
    this.cru = [];
    this.vdpInterrupt = false;
    this.timerMode = false;
    this.clockRegister = 0;
    this.readRegister = 0;
    this.decrementer = 0;
    this.timerInterrupt = false;
    this.timerInterruptScheduled = false;
    this.cassetteInput = true;
    this.log = Log.getLog();
    this.reset();
}

CRU.TIMER_DECREMENT_PER_FRAME = 781; // 50000 / 64;
CRU.TIMER_DECREMENT_PER_SCANLINE = 2.85;

CRU.prototype = {

    setMemory: function (memory) {
        this.memory = memory;
    },

    reset: function () {
        for (var i = 0; i < 4096; i++) {
            this.cru[i] = true;
        }
        this.cru[24] = false; // Audio gate
        this.cru[25] = false; // Output to cassette mike jack
    },

    readBit: function (addr) {
        if (!this.timerMode) {
            // VDP interrupt
            if (addr === 2) {
                return !this.vdpInterrupt;
            }
            // Keyboard
            else if (addr >= 3 && addr <= 10) {
                var col = (this.cru[18] ? 1 : 0) | (this.cru[19] ? 2 : 0) | (this.cru[20] ? 4 : 0);
                // this.log.info("Addr: " + addr + " Col: " + col + " Down: " + this.keyboard.isKeyDown(col, addr));
                if (addr === 7 && !this.cru[21]) {
                    return !this.keyboard.isAlphaLockDown();
                }
                else {
                    return !(this.keyboard.isKeyDown(col, addr));
                }
            }
            // Cassette
            else if (addr === 27) {
                this.cassetteInput = !this.cassetteInput;
                return this.cassetteInput;
            }
        }
        else {
            // Timer
            if (addr === 0) {
                return this.timerMode;
            }
            else if (addr > 0 && addr < 15) {
                return (this.readRegister & (1 << (addr - 1))) !== 0;
            }
            else if (addr === 15) {
                this.log.info("Read timer interrupt status");
                return this.timerInterrupt;
            }
        }
        return this.cru[addr];
    },

    writeBit: function (addr, value) {
        if (addr >= 0x800) {
            // DSR space
            addr <<= 1; // Convert to R12 space i.e. >= >1000
            if ((addr & 0xff) === 0) {
                // Enable DSR ROM
                var dsr = (addr >> 8) & 0xf; // 256
                // this.log.info("DSR ROM " + dsr + " " + (bit ? "enabled" : "disabled") + ".");
                this.memory.setPeripheralROM(dsr, value);
            }
            // AMS
            if (addr >= 0x1e00 && addr < 0x1f00 && this.memory.enableAMS) {
                var bitNo = (addr & 0x000e) >> 1;
                if (bitNo === 0) {
                    // Controls access to mapping registers
                    this.memory.ams.setRegisterAccess(value);
                }
                else if (bitNo === 1) {
                    // Toggles between mapping mode and transparent mode
                    this.memory.ams.setMode(value ? AMS.MAPPING_MODE : AMS.TRANSPARENT_MODE);
                }
            }
        }
        else {
            // Timer
            if (addr === 0) {
                this.setTimerMode(value);
            }
            else if (this.timerMode) {
                if (addr > 0 && addr < 15) {
                    // Write to clock register
                    if (value) {
                        this.clockRegister |= (value << (addr - 1));
                    }
                    else {
                        this.clockRegister &= ~(value << (addr - 1));
                    }
                    // If any bit between 1 and 14 is written to while in timer mode, the decrementer will be reinitialized with the current value of the Clock register
                    this.decrementer = this.clockRegister;
                }
                else if (addr === 15 && !value) {
                    this.log.info("Reset 9901");
                    this.reset();
                }
                else if (addr >= 16) {
                    this.setTimerMode(false);
                }
            }
            else {
                if (addr === 3) {
                    this.timerInterrupt = false;
                }
                else if (addr === 22) {
                    this.log.info("Cassette motor " + (value ? "on" : "off"));
                }
            }
            // this.log.info("Write CRU address " + addr.toHexWord() + ": " + bit);
            this.cru[addr] = value;
        }
    },

    setVDPInterrupt: function (value) {
        this.vdpInterrupt = value;
    },

    setTimerMode: function (value) {
        if (value && !this.timerMode) {
            // this.log.info("9901 timer mode");
            this.timerMode = true;
        }
        else if (!value && this.timerMode) {
            if (this.clockRegister > 0) {
                this.decrementer = this.clockRegister;
                this.timerInterruptScheduled = true;
                this.log.info("Timer started at " + this.decrementer.toHexWord());
            }
            this.timerMode = false;
            // this.log.info("9901 timer mode off");
        }
        this.cru[0] = value;
    },

    decrementTimer: function (value) {
        if (this.clockRegister > 0) {
            this.decrementer -= value;
            if (this.decrementer < 0) {
                this.decrementer = this.clockRegister; // Reload decrementer
                if (this.timerInterruptScheduled) {
                    // this.log.info("Timer interrupt");
                    this.timerInterrupt = true;
                    this.timerInterruptScheduled = false;
                }
            }
            if (!this.timerMode) {
                // Read register is frozen in timer mode
                this.readRegister = this.decrementer;
            }
        }
    },

    isVDPInterrupt: function () {
        return this.vdpInterrupt && this.cru[2];
    },

    isTimerInterrupt: function () {
        return this.timerInterrupt && this.cru[3];
    }
};
