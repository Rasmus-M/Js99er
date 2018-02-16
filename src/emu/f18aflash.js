/*
 * js99'er - TI-99/4A emulator written in JavaScript
 *
 * Created 2014 by Rasmus Moustgaard <rasmus.moustgaard@gmail.com>
 */

'use strict';

var F18AFlash = (function () {

    var F18AFlash = function (callback) {
        this.flashRAM = null;
        this.updated = false;
        this.log = Log.getLog();
        this.reset();
        var that = this;
        this.database = new Database( function (success) {
            if (success) {
                that.restore(callback);
            }
            else if (callback) {
                callback(false);
            }
        });
    };

    F18AFlash.prototype.reset = function () {
        this.writeEnabled = false;
        this.intReset();
        if (this.updated) {
            this.updated = false;
            this.save();
        }
    };

    F18AFlash.prototype.intReset = function () {
        this.enabled = false;
        this.address = 0;
        this.command = 0;
        this.addressByte = -1;
        this.prefetchByte = 0;
        this.writeInProgress = false;
        this.writeBuffer = [];
    };

    F18AFlash.prototype.enable = function () {
        this.log.info("SPI EN - Enable line to SPI flash ROM");
        if (this.flashRAM == null) {
            this.flashRAM = new Uint8Array(0x100000);
        }
        this.intReset();
        this.enabled = true;
    };

    F18AFlash.prototype.disable = function () {
        this.log.info("SPI DS - Disable line to SPI flash ROM");
        var i;
        if (this.command == F18AFlash.PAGE_PROGRAM) {
            this.log.info("Writing " + Math.min(this.writeBuffer.length, 256) + " bytes to " + this.address.toHexWord());
            var baseAddress = this.address & 0xfff00;
            var offset = this.address & 0x000ff;
            for (i = Math.max(this.writeBuffer.length - 256, 0); i < this.writeBuffer.length; i++) {
                this.flashRAM[baseAddress + offset] = this.writeBuffer[i];
                offset = (offset + 1) & 0xff;
            }
            this.updated = true;
        }
        if (this.command == F18AFlash.SECTOR_ERASE) {
            this.log.info("Erasing sector " + this.address.toHexWord());
            this.address &= 0xf0000;
            for (i = 0; i < 0x10000; i++) {
                this.flashRAM[this.address++] = 0xff;
            }
            this.address &= 0xfffff;
            this.command = 0;
        }
        this.intReset();
    };

    F18AFlash.prototype.writeByte = function (b) {
        this.log.debug("Write byte to SPI: " + b.toHexByte());
        if (this.enabled) {
            if (this.addressByte == -1) {
                if (this.command == 0) {
                    // New command
                    this.command = b;
                    switch (this.command) {
                        case F18AFlash.PAGE_PROGRAM:
                            this.log.info("SPI Page Program command");
                            if (this.writeEnabled) {
                                this.address = 0;
                                this.addressByte = 2;
                                this.writeBuffer = [];
                            }
                            else {
                                this.log.info("Write not enabled");
                                this.command = 0;
                            }
                            break;
                        case F18AFlash.WRITE_DISABLE:
                            this.log.info("SPI Write Disable command");
                            this.writeEnabled = false;
                            this.command = 0;
                            break;
                        case F18AFlash.READ_STATUS_REGISTER:
                            this.log.info("SPI Read Status Register command");
                            break;
                        case F18AFlash.WRITE_ENABLE:
                            this.log.info("SPI Write Enable command");
                            this.writeEnabled = true;
                            this.command = 0;
                            break;
                        case F18AFlash.FAST_READ:
                            this.log.info("SPI Fast-Read command");
                            if (!this.writeInProgress) {
                                this.address = 0;
                                this.addressByte = 2;
                                this.prefetchByte = 0;
                            }
                            break;
                        case F18AFlash.SECTOR_ERASE:
                            this.log.info("SPI Sector Erase command");
                            if (this.writeEnabled) {
                                this.address = 0;
                                this.addressByte = 2;
                            }
                            else {
                                this.log.info("Write not enabled");
                                this.command = 0;
                            }
                            break;
                    }
                }
                else {
                    // Write data
                    if (this.command == F18AFlash.PAGE_PROGRAM) {
                        this.writeInProgress = true;
                        this.writeBuffer.push(b);
                    }
                }
            }
            else {
                // Setup address
                this.address = ((this.address << 8) | b) & 0xfffff;
                this.addressByte--;
            }
        }
        else {
            this.log.info("Line not enabled");
        }
    };

    F18AFlash.prototype.readByte = function () {
        if (this.enabled) {
            var b = 0;
            switch (this.command) {
                case F18AFlash.READ_STATUS_REGISTER:
                    b = (this.writeEnabled ? 0x02 : 0) | (this.writeInProgress ? 0x01 : 0);
                    break;
                case F18AFlash.FAST_READ:
                    b = this.prefetchByte;
                    this.prefetchByte = this.flashRAM[this.address];
                    this.address = (this.address + 1) & 0xfffff;
                    break;
            }
            this.log.debug("Read byte from SPI: " + b.toHexByte());
            return b;
        }
        else {
            this.log.info("Read byte from SPI, but line not enabled");
            return 0;
        }
    };

    F18AFlash.prototype.save = function () {
        if (this.database.isSupported() && this.flashRAM) {
            var that = this;
            this.database.putBinaryFile(F18AFlash.FILE_NAME, this.flashRAM, function (success) {
                if (success) {
                    that.log.info("F18A flash RAM saved");
                }
            });
        }
    };

    F18AFlash.prototype.restore = function (callback) {
        if (this.database.isSupported()) {
            var that = this;
            this.database.getBinaryFile(F18AFlash.FILE_NAME, function (file) {
                if (file) {
                    that.flashRAM = new Uint8Array(0x100000);
                    for (var i = 0; i < file.length; i++) {
                        that.flashRAM[i] = file[i];
                    }
                    that.log.info("F18A flash RAM restored");
                }
                else {
                    that.log.debug("F18A flash RAM restore failed");
                }
                if (callback) callback(file != null);
            });
        }
    };

    F18AFlash.prototype.getState = function () {
        return {
            updated: this.updated,
            writeEnabled: this.writeEnabled,
            enabled: this.enabled,
            address: this.address,
            command: this.command,
            addressByte: this.addressByte,
            prefetchByte: this.prefetchByte,
            writeInProgress: this.writeInProgress,
            writeBuffer: this.writeBuffer
        };
    };

    F18AFlash.prototype.restoreState = function (state) {
        this.updated = state.updated;
        this.writeEnabled = state.writeEnabled;
        this.enabled = state.enabled;
        this.address = state.address;
        this.command = state.command;
        this.addressByte = state.addressByte;
        this.prefetchByte = state.prefetchByte;
        this.writeInProgress = state.writeInProgress;
        this.writeBuffer = state.writeBuffer;
    };

    return F18AFlash;
})();

F18AFlash.FILE_NAME = "f18aflash";
F18AFlash.PAGE_PROGRAM = 0x02;
F18AFlash.WRITE_DISABLE = 0x04;
F18AFlash.READ_STATUS_REGISTER = 0x05;
F18AFlash.WRITE_ENABLE = 0x06;
F18AFlash.FAST_READ = 0x0b;
F18AFlash.SECTOR_ERASE = 0xd8;
