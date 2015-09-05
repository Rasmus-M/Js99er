/*
 * js99'er - TI-99/4A emulator written in JavaScript
 *
 * Created 2014 by Rasmus Moustgaard <rasmus.moustgaard@gmail.com>
 */

'use strict';

var AMS = (function() {

    var AMS = function(size) {
        this.size = size;
        this.pages = size >> 2;
        this.log = Log.getLog();
        this.reset();
    };

    AMS.prototype.reset = function() {
        this.registerAccess = false;
        this.ram = new Uint8Array(this.size * 1024);
        this.transparentMap = [
            null, null, 2, 3, null, null, null, null, null, null, 10, 11, 12, 13,  14, 15
        ];
        this.registerMap = [
            0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15
        ];
        this.map = null;
        this.setMode(AMS.TRANSPARENT_MODE);
    };

    AMS.prototype.hasRegisterAccess = function() {
        return this.registerAccess;
    };

    AMS.prototype.setRegisterAccess = function(enabled) {
        this.log.info("AMS mapping register access " + (enabled ? "on" : "off"));
        this.registerAccess = enabled;
    };

    AMS.prototype.setMode = function(mode) {
        this.log.info("AMS " + (mode ? " mapping " : "transparent") + " mode set");
        this.map = mode == AMS.TRANSPARENT_MODE ? this.transparentMap : this.registerMap;

    };

    AMS.prototype.readRegister = function(regNo) {
        return this.registerAccess ? this.registerMap[regNo & 0xF] : 0;
    };

    AMS.prototype.writeRegister = function(regNo, page) {
        if (this.registerAccess) {
            this.log.info("Write " + page.toHexWord() + " to AMS register " + regNo.toHexByte());
            this.registerMap[regNo & 0xF] = page;
        }
    };

    AMS.prototype.readWord = function(addr) {
        var regNo = (addr & 0xF000) >> 12;
        if (this.transparentMap[regNo] != null) {
            var asmAddr = ((this.map[regNo] & (this.pages - 1)) << 12) | (addr & 0x0FFF);
            return this.ram[asmAddr] << 8 | this.ram[asmAddr + 1];
        }
        return 0;
    };

    AMS.prototype.writeWord = function(addr, w) {
        var regNo = (addr & 0xF000) >> 12;
        if (this.transparentMap[regNo] != null) {
            var asmAddr = ((this.map[regNo] & (this.pages - 1)) << 12) | (addr & 0x0FFF);
            this.ram[asmAddr] = (w & 0xFF00) >> 8;
            this.ram[asmAddr + 1] = w & 0xFF;
        }
    };

    AMS.prototype.getByte = function(addr) {
        var page = this.map[(addr & 0xF000) >> 12];
        if (page != null) {
            var asmAddr = (page & (this.pages - 1)) << 12 | (addr & 0x0FFF);
            return this.ram[asmAddr];
        }
        return 0;
    };

    AMS.prototype.setByte = function(addr, b) {
        var regNo = (addr & 0xF000) >> 12;
        if (this.transparentMap[regNo] != null) {
            var asmAddr = ((this.map[regNo] & (this.pages - 1)) << 12) | (addr & 0x0FFF);
            this.ram[asmAddr] = b;
        }
    };

    return AMS;
})();

AMS.TRANSPARENT_MODE = 0;
AMS.MAPPING_MODE = 1;

