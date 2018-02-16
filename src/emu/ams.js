/*
 * js99'er - TI-99/4A emulator written in JavaScript
 *
 * Created 2014 by Rasmus Moustgaard <rasmus.moustgaard@gmail.com>
 */

'use strict';

var AMS = (function () {

    var AMS = function (size) {
        this.size = size;
        this.pages = size >> 2;
        this.log = Log.getLog();
        this.reset();
    };

    AMS.prototype.reset = function () {
        this.registerAccess = false;
        this.ram = new Uint8Array(this.size * 1024);
        this.transparentMap = [
            null, null, 2, 3, null, null, null, null, null, null, 10, 11, 12, 13,  14, 15
        ];
        this.registerMap = [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
        ];
        this.map = null;
        this.setMode(AMS.TRANSPARENT_MODE);
    };

    AMS.prototype.hasRegisterAccess = function () {
        return this.registerAccess;
    };

    AMS.prototype.setRegisterAccess = function (enabled) {
        this.log.info("AMS mapping register access " + (enabled ? "on" : "off"));
        this.registerAccess = enabled;
    };

    AMS.prototype.setMode = function (mode) {
        this.log.info("AMS " + (mode == AMS.MAPPING_MODE ? "mapping" : "transparent") + " mode set");
        this.map = mode == AMS.TRANSPARENT_MODE ? this.transparentMap : this.registerMap;

    };

    AMS.prototype.readRegister = function (regNo) {
        return this.registerAccess ? this.registerMap[regNo & 0xF] : 0;
    };

    AMS.prototype.writeRegister = function (regNo, page) {
        if (this.registerAccess) {
            this.log.info("Write " + page.toHexWord() + " to AMS register " + regNo.toHexByte());
            this.registerMap[regNo & 0xF] = page;
        }
    };

    AMS.prototype.readWord = function (addr) {
        var regNo = (addr & 0xF000) >> 12;
        if (this.transparentMap[regNo] != null) {
            var amsAddr = ((this.map[regNo] & (this.pages - 1)) << 12) | (addr & 0x0FFF);
            return this.ram[amsAddr] << 8 | this.ram[amsAddr + 1];
        }
        return 0;
    };

    AMS.prototype.writeWord = function (addr, w) {
        var regNo = (addr & 0xF000) >> 12;
        if (this.transparentMap[regNo] != null) {
            var amsAddr = ((this.map[regNo] & (this.pages - 1)) << 12) | (addr & 0x0FFF);
            this.ram[amsAddr] = (w & 0xFF00) >> 8;
            this.ram[amsAddr + 1] = w & 0xFF;
        }
    };

    AMS.prototype.getByte = function (addr) {
        var page = this.map[(addr & 0xF000) >> 12];
        if (page != null) {
            var amsAddr = (page & (this.pages - 1)) << 12 | (addr & 0x0FFF);
            return this.ram[amsAddr];
        }
        return 0;
    };

    AMS.prototype.setByte = function (addr, b) {
        var regNo = (addr & 0xF000) >> 12;
        if (this.transparentMap[regNo] != null) {
            var amsAddr = ((this.map[regNo] & (this.pages - 1)) << 12) | (addr & 0x0FFF);
            this.ram[amsAddr] = b;
        }
    };

    AMS.prototype.getStatusString = function () {
        var s = "";
        for (var regNo = 0; regNo < this.transparentMap.length; regNo++) {
            if (this.transparentMap[regNo] != null) {
               s += (this.map[regNo] & (this.pages - 1)).toHex12Bit() + " ";
            }
        }
        return s;
    };

    AMS.prototype.getState = function () {
        return {
            size: this.size,
            pages: this.pages,
            registerAccess: this.registerAccess,
            ram: this.ram,
            transparentMap: this.transparentMap,
            registerMap: this.registerMap,
            map: this.map
        };
    };

    AMS.prototype.restoreState =  function (state) {
        this.size = state.size;
        this.pages = state.pages;
        this.registerAccess = state.registerAccess;
        this.ram = state.ram;
        this.transparentMap = state.transparentMap;
        this.registerMap = state.registerMap;
        this.map = state.map;
    };

    return AMS;
})();

AMS.TRANSPARENT_MODE = 0;
AMS.MAPPING_MODE = 1;

