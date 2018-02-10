/*
 * js99'er - TI-99/4A emulator written in JavaScript
 *
 * Created 2014 by Rasmus Moustgaard <rasmus.moustgaard@gmail.com>
 */

'use strict';

function CRU(keyboard, tape) {
    this.keyboard = keyboard;
    this.tape = tape;
    this.cru = [];
    this.log = Log.getLog();
    this.reset();
}

CRU.TIMER_DECREMENT_PER_FRAME = 781; // 50000 / 64;
CRU.TIMER_DECREMENT_PER_SCANLINE = 2.8503;

CRU.prototype = {

    setMemory: function (memory) {
        this.memory = memory;
    },

    // For debugging
    setTMS9900: function (tms9900) {
        this.tms9900 = tms9900;
    },

    reset: function () {
        this.vdpInterrupt = false;
        this.timerMode = false;
        this.clockRegister = 0;
        this.readRegister = 0;
        this.decrementer = 0;
        this.timerInterrupt = false;
        this.time = 0;
        for (var i = 0; i < 4096; i++) {
            this.cru[i] = true;
        }
        this.cru[24] = false; // Audio gate
        this.cru[25] = false; // Output to cassette mike jack

        this.count = 0;
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
                var value = this.tape.read(this.time);
                // console.log((value ? "1" : "0") + " " + this.tms9900.getPC().toHexWord());
                return value;
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
            // Cassette
            else if (addr === 27) {
                var value = this.tape.read(this.time);
                // console.log((value ? "1" : "0") + " " + this.tms9900.getPC().toHexWord());
                return value;
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
                    var bit  = 1 << (addr - 1);
                    if (value) {
                        this.clockRegister |= bit;
                    }
                    else {
                        this.clockRegister &= ~bit;
                    }
                    // If any bit between 1 and 14 is written to while in timer mode, the decrementer will be reinitialized with the current value of the Clock register
                    if (this.clockRegister !== 0) {
                        this.decrementer = this.clockRegister;
                    }
                    // Do not set cru bit
                    return;
                }
                else if (addr === 15 && !value) {
                    // TODO: Should be a soft reset
                    this.log.info("Reset 9901");
                    // this.reset();
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
                    this.tape.setMotorOn(value);
                }
                else if (addr === 25) {
                    this.tape.write(value, this.time);
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
        if (value) {
            // this.log.info("9901 timer mode");
            this.timerMode = true;
            if (this.clockRegister !== 0) {
                this.readRegister = this.decrementer;
            }
            else {
                this.readRegister = 0;
            }
        }
        else {
            // this.log.info("9901 timer mode off");
            this.timerMode = false;
        }
    },

    decrementTimer: function (value) {
        if (this.clockRegister !== 0) {
            this.decrementer -= value;
            if (this.decrementer <= 0) {
                this.decrementer = this.clockRegister;
                // this.log.info("Timer interrupt");
                this.timerInterrupt = true;
            }
        }
        this.time += value;
    },

    isVDPInterrupt: function () {
        return this.vdpInterrupt && this.cru[2];
    },

    isTimerInterrupt: function () {
        return this.timerInterrupt && this.cru[3];
    },

    getStatusString: function () {
        return "CRU: " + (this.cru[0] ? "0" : "1") + (this.cru[1] ? "0" : "1") + (this.cru[2] ? "0" : "1") + (this.cru[3] ? "0" : "1") + " " +
            "Timer: " + Math.floor(this.decrementer).toHexWord() + " " +
            (this.isTimerInterrupt() ? "Tint " : "    ")  + (this.isVDPInterrupt() ? "Vint" : "   ");
    }
};
