/*
 * js99'er - TI-99/4A emulator written in JavaScript
 *
 * Created 2014 by Rasmus Moustgaard <rasmus.moustgaard@gmail.com>
 *
 * This file is based on code borrowed from JSMSX - MSX Emulator in Javascript
 * Copyright (c) 2006 Marcus Granado <mrc.gran(@)gmail.com>
 *
 * TMS9918A VDP emulation.
 *
 * Not implemented:
 * - Sprite flicker
 * - 5th sprite status bits
 * - Bitmap-text mode
 * - Bitmap-multicolor mode
 */

'use strict';

TMS9918A.MODE_GRAPHICS = 0;
TMS9918A.MODE_TEXT = 1;
TMS9918A.MODE_BITMAP = 2;
TMS9918A.MODE_MULTICOLOR = 3;

/**
 * @constructor
 */
function TMS9918A(canvas, cru) {
    this.canvas = canvas;
    this.cru = cru;

    this.ram = new Uint8Array(16384); // VDP RAM
    this.registers = new Array(8);
    this.addressRegister = null;
    this.statusRegister = null;

    this.palette = [
        [0, 0, 0],
        [0, 0, 0],
        [33, 200, 66],
        [94, 220, 120],
        [84, 85, 237],
        [125, 118, 252],
        [212, 82, 77],
        [66, 235, 245],
        [252, 85, 84],
        [255, 121, 120],
        [212, 193, 84],
        [230, 206, 128],
        [33, 176, 59],
        [201, 91, 186],
        [204, 204, 204],
        [255, 255, 255]
    ];

    this.latchByte = null;
    this.latch = null;
    this.prefetchByte = null;

    this.displayOn = null;
    this.screenMode = null;
    this.colorTable = null;
    this.nameTable = null;
    this.charPatternTable = null;
    this.spriteAttributeTable = null;
    this.spritePatternTable = null;
    this.colorTableMask = null;
    this.patternTableMask = null;
    this.fgColor = null;
    this.bgColor = null;

    this.collisionTable = null;
    this.collision = null;
    this.redrawRequired = null;
    this.redrawBorder = null;

    this.canvasContext = this.canvas.getContext("2d");
    this.imagedata = null;

    this.log = Log.getLog();

    this.reset();
}

TMS9918A.prototype = {

    reset: function() {

        var i;
        for (i = 0; i < this.ram.length; i++) {
            this.ram[i] = 0;
        }
        for (i = 0; i < this.registers.length; i++) {
            this.registers[i] = 0;
        }
        this.addressRegister = 0;
        this.statusRegister = 0;

        this.latchByte = 0;
        this.prefetchByte = 0;
        this.latch = false;

        this.displayOn = false;
        this.screenMode = 0;
        this.colorTable = 0;
        this.nameTable = 0;
        this.charPatternTable = 0;
        this.spriteAttributeTable = 0;
        this.spritePatternTable = 0;
        this.colorTableMask = 0x3FFF;
        this.patternTableMask = 0x3FFF;
        this.fgColor = 0;
        this.bgColor = 0;

        this.collisionTable = null;
        this.collision = false;
        this.redrawRequired = true;
        this.redrawBorder = false;

        this.canvas.width = 304;
        this.canvas.height = 240;
        this.canvasContext.fillStyle = 'rgba(' + this.palette[7].join(',') + ',1.0)';
        this.canvasContext.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Build the array containing the canvas bitmap (256 * 192 * 4 bytes (r,g,b,a) format each pixel)
        this.imagedata = this.canvasContext.getImageData(24, 24, 256, 192);
    },

    start: function() {
    },

    stop: function() {
    },

    drawFrame: function() {
        if (this.redrawRequired) {
            if (this.displayOn) {
                if (this.redrawBorder) {
                    this.fillCanvas();
                    this.redrawBorder = false;
                }
                this.drawTiles();
                if (this.screenMode != TMS9918A.MODE_TEXT) {
                    this.drawSprites();
                }
                this.canvasContext.putImageData(this.imagedata, 24, 24);
            }
            else {
                this.fillCanvas();
            }
            this.redrawRequired = false;
        }
        this.statusRegister |= 0x80;
        if ((this.registers[1] & 0x20) != 0) {
            this.cru.writeBit(2, false);
        }
    },

    fillCanvas: function() {
        this.canvasContext.fillStyle = 'rgb(' + this.palette[this.bgColor].join(',') + ')';
        this.canvasContext.fillRect(0, 0, this.canvas.width, this.canvas.height);
    },

    drawTiles: function() {
        var imageData = this.imagedata.data;
        if (this.screenMode != TMS9918A.MODE_MULTICOLOR) {
            // Text, graphics and bitmap modes
            var screenColumns = this.screenMode == TMS9918A.MODE_TEXT ? 40 : 32;
            var charPixelWidth = this.screenMode == TMS9918A.MODE_TEXT ? 6 : 8;
            var nameTableLength = this.screenMode == TMS9918A.MODE_TEXT ? 960 : 768;
            var hMargin = this.screenMode == TMS9918A.MODE_TEXT ? 8 : 0;
            var ch, row, charNo, imageDataAddr, color;
            for (ch = 0; ch < nameTableLength; ch++) {
                row = Math.floor(ch / screenColumns);
                imageDataAddr = (hMargin + (ch % screenColumns) * charPixelWidth + (row << 11)) << 2;
                var charSetOffset = this.screenMode == TMS9918A.MODE_BITMAP ? ((ch >> 8) << 11) : 0;
                charNo = this.ram[this.nameTable + ch];
                var patternAddr = this.charPatternTable + ((charSetOffset + (charNo << 3)) & this.patternTableMask);
                var colorAddr = this.screenMode == TMS9918A.MODE_BITMAP ? this.colorTable + ((charSetOffset + (charNo << 3)) & this.colorTableMask) : this.colorTable + (charNo >> 3);
                for (var charRow = 0; charRow < 8; charRow++) {
                    var charByte = this.ram[patternAddr + charRow];
                    for (var pix = 0; pix < charPixelWidth; pix++) {
                        color = 0;
                        if (((charByte & (0x80 >> pix)) != 0)) {
                            // Pixel set
                            switch (this.screenMode) {
                                case TMS9918A.MODE_TEXT:
                                    color = this.fgColor;
                                    break;
                                case TMS9918A.MODE_GRAPHICS:
                                    color = (this.ram[colorAddr] & 0xf0) >>> 4;
                                    break;
                                case TMS9918A.MODE_BITMAP:
                                    color = ((this.ram[colorAddr + charRow] & 0xf0) >>> 4);
                                    break;
                            }
                        } else {
                            // Pixel not set
                            switch (this.screenMode) {
                                case TMS9918A.MODE_TEXT:
                                    color = this.bgColor;
                                    break;
                                case TMS9918A.MODE_GRAPHICS:
                                    color = this.ram[colorAddr] & 0xf;
                                    break;
                                case TMS9918A.MODE_BITMAP:
                                    color = this.ram[colorAddr + charRow] & 0xf;
                                    break;
                            }
                        }
                        if (color == 0) {
                            color = this.bgColor;
                        }
                        var rgbColor = this.palette[color];
                        imageData[imageDataAddr++] = rgbColor[0]; // R
                        imageData[imageDataAddr++] = rgbColor[1]; // G
                        imageData[imageDataAddr++] = rgbColor[2]; // B
                        imageDataAddr++; // Skip alpha
                    }
                    imageDataAddr += (256 - charPixelWidth) << 2;
                }
            }
            if (this.screenMode == TMS9918A.MODE_TEXT) {
                imageDataAddr = 0;
                var rgbBGColor = this.palette[this.bgColor];
                for (var y = 0; y < 192; y++) {
                    for (var x1 = 0; x1 < 8; x1++) {
                        imageData[imageDataAddr++] = rgbBGColor[0]; //R
                        imageData[imageDataAddr++] = rgbBGColor[1]; //G
                        imageData[imageDataAddr++] = rgbBGColor[2]; //B
                        imageDataAddr++;
                    }
                    imageDataAddr += 30 * 8 * 4;
                    for (var x2 = 0; x2 < 8; x2++) {
                        imageData[imageDataAddr++] = rgbBGColor[0]; //R
                        imageData[imageDataAddr++] = rgbBGColor[1]; //G
                        imageData[imageDataAddr++] = rgbBGColor[2]; //B
                        imageDataAddr++;
                    }
                }
            }
        }
        else {
            // Multicolor mode
            imageDataAddr = 0;
            for (ch = 0; ch < 768; ch++) {
                charNo = this.ram[this.nameTable + ch];
                row = Math.floor(ch / 32);
                var patternOffset = charNo * 8;
                var patternByteOffset = (row % 4) * 2;
                var topByte = this.ram[this.charPatternTable + patternOffset + patternByteOffset];
                color = (topByte & 0xF0) >> 4;
                this.drawMulticolorPixel(imageDataAddr, this.palette[color == 0 ? this.bgColor : color]);
                color = topByte & 0x0F;
                this.drawMulticolorPixel(imageDataAddr + 16, this.palette[color == 0 ? this.bgColor : color]);
                var bottomByte = this.ram[this.charPatternTable + patternOffset + patternByteOffset + 1];
                color = (bottomByte & 0xF0) >> 4;
                this.drawMulticolorPixel(imageDataAddr + 4 * 256 * 4, this.palette[color == 0 ? this.bgColor : color]);
                color = bottomByte & 0x0F;
                this.drawMulticolorPixel(imageDataAddr + 4 * 256 * 4 + 16, this.palette[color == 0 ? this.bgColor : color]);
                imageDataAddr += 8 * 4;
                if ((ch % 32) == 31) {
                    imageDataAddr += 7 * 256 * 4;
                }
            }
        }
    },

    drawMulticolorPixel: function(imageDataAddr, rgbColor) {
        var imageData = this.imagedata.data;
        for (var y = 0; y < 4; y++) {
            for (var x = 0; x < 4; x++) {
                imageData[imageDataAddr++] = rgbColor[0]; //R
                imageData[imageDataAddr++] = rgbColor[1]; //G
                imageData[imageDataAddr++] = rgbColor[2]; //B
                imageDataAddr++;
            }
            imageDataAddr += (256 - 4) * 4;
        }
    },

    drawSprites: function() {
        var size = (this.registers[1] & 0x2) != 0 ? 4 : 1;
        var magnify = (this.registers[1] & 0x1) != 0 ? 2 : 1;
        var addr;
        // Find the last active sprite
        for (addr = this.spriteAttributeTable; this.ram[addr] != 0xD0 && addr < this.spriteAttributeTable + 128; addr += 4);
        if (addr > this.spriteAttributeTable) {
            // Iterate through sprites in reverse order
            this.collisionTable = new Uint8Array(256 * 192);
            this.collision = false;
            for (addr -= 4; addr >= this.spriteAttributeTable; addr -= 4) {
                var earlyClockOffset = (this.ram[addr + 3] & 0x80) != 0 ? -32 : 0;
                var x0 = this.ram[addr + 1];
                var y0 = this.ram[addr];
                if (y0 < 0xC0 || y0 >= 0xD0) {
                    if (y0 > 0xD0) {
                        y0 = y0 - 256;
                    }
                    y0++;
                    var charAddr = (this.ram[addr] + 1) >> 3;
                    charAddr = (charAddr << 5) + ((this.ram[addr + 1] + earlyClockOffset) >> 3);
                    var color = this.ram[addr + 3] & 0xf;
                    for (var quarter = 0; quarter < size; quarter++) {
                        var patBaseAddr = this.spritePatternTable + ((this.ram[addr + 2] & (size == 4 ? 0xFC : 0xFF)) << 3) + (quarter << 3);
                        var x1 = x0 + earlyClockOffset + (quarter == 2 || quarter == 3 ? 8 * magnify : 0);
                        var y1 = y0 + (quarter == 1 || quarter == 3 ? 8 * magnify : 0);
                        var imageDataAddr = (x1 + (y1 << 8)) << 2;
                        var y = y1;
                        for (var row = 0; row < 8; row++) {
                            var x = x1;
                            for (var pix = 0; pix < 8; pix++) {
                                if ((this.ram[patBaseAddr + row] & (0x80 >> pix)) != 0) { // If pattern pixel is set
                                    this.drawSpritePixel(x, y, color, imageDataAddr);
                                    if (magnify == 2) {
                                        this.drawSpritePixel(x + 1, y, color, imageDataAddr + 4);
                                        this.drawSpritePixel(x, y + 1, color, imageDataAddr + 1024);
                                        this.drawSpritePixel(x + 1, y + 1, color, imageDataAddr + 4 + 1024);
                                    }
                                }
                                x += magnify;
                                imageDataAddr += (magnify << 2);
                            }
                            y += magnify;
                            imageDataAddr += (256 - 8) * (magnify << 2);
                        }
                    }
                }
            }
        }
    },

    drawSpritePixel: function(x, y, color, imageDataAddr) {
        if (x >= 0 && x < 256 && y >= 0 && y < 192) {
            if (color != 0) {
                var imagedata = this.imagedata.data;
                imagedata[imageDataAddr] = this.palette[color][0];     // R
                imagedata[imageDataAddr + 1] = this.palette[color][1]; // G
                imagedata[imageDataAddr + 2] = this.palette[color][2]; // B
            }
            if (!this.collision) {
                if (this.collisionTable[x + y << 8] != 0) {
                    this.collision = true;
                    this.statusRegister |= 0x20;
                }
                else {
                    this.collisionTable[x + y << 8] = 1;
                }
            }
        }
    },

    writeAddress: function(i) {
        if (!this.latch) {
            this.latchByte = i;
            this.latch = !this.latch;
        }
        else {
            switch ((i & 0xc0) >> 6) {
                // Set read address
                case 0:
                    this.addressRegister = (i & 0x3f) * 256 + this.latchByte;
                    this.prefetchByte = this.ram[this.addressRegister++];
                    this.addressRegister %= 16384;
                    break;
                // Set write address
                case 1:
                    this.addressRegister = (i & 0x3f) * 256 + this.latchByte;
                    break;
                // Write register
                case 2:
                    this.registers[i & 0x7] = this.latchByte;
                    switch (i & 0x7) {
                        // Mode
                        case 0:
                            this.updateMode(this.latchByte, this.registers[1]);
                            break;
                        case 1:
                            this.displayOn = (this.registers[1] & 0x40) != 0;
                            this.updateMode(this.registers[0], this.latchByte);
                            break;
                        // Name table
                        case 2:
                            this.nameTable = (this.registers[2] & 0xf) << 10;
                            break;
                        // Color table
                        case 3:
                            if (this.screenMode == TMS9918A.MODE_BITMAP) {
                                this.colorTable = (this.registers[3] & 0x80) << 6;
                            }
                            else {
                                this.colorTable = this.registers[3] << 6;
                            }
                            this.updateTableMasks();
                            break;
                        // Pattern table
                        case 4:
                            if (this.screenMode == TMS9918A.MODE_BITMAP) {
                                this.charPatternTable = (this.registers[4] & 0x4) << 11;
                            }
                            else {
                                this.charPatternTable = (this.registers[4] & 0x7) << 11;
                            }
                            this.updateTableMasks();
                            break;
                        // Sprite attribute table
                        case 5:
                            this.spriteAttributeTable = (this.registers[5] & 0x7f) << 7;
                            break;
                        // Sprite pattern table
                        case 6:
                            this.spritePatternTable = (this.registers[6] & 0x7) << 11;
                            break;
                        // Background
                        case 7:
                            this.fgColor = (this.registers[7] & 0xf0) >> 4;
                            this.bgColor = this.registers[7] & 0x0f;
                            this.redrawBorder = true;
                            break;
                    }
                    // this.logRegisters();
                    // this.log.info("Name table: " + this.nameTable.toHexWord());
                    // this.log.info("Pattern table: " + this.charPatternTable.toHexWord());
                    break;
            }
            this.latch = !this.latch;
            this.redrawRequired = true;
        }
    },

    updateMode: function(reg0, reg1) {
        // Check bitmap mode bit, not text or multicolor
        if ((reg0 & 0x2) != 0 && (reg1 & 0x18) == 0) {
            // Bitmap mode
            this.screenMode = TMS9918A.MODE_BITMAP;
        } else {
            switch ((reg1 & 0x18) >> 3) {
                case 0:
                    // Graphics mode 0
                    this.screenMode = TMS9918A.MODE_GRAPHICS;
                    break;
                case 1:
                    // Multicolor mode
                    this.screenMode = TMS9918A.MODE_MULTICOLOR;
                    break;
                case 2:
                    // Text mode
                    this.screenMode = TMS9918A.MODE_TEXT;
                    break;
            }
        }
        if (this.screenMode == TMS9918A.MODE_BITMAP) {
            this.colorTable = (this.registers[3] & 0x80) << 6;
            this.charPatternTable = (this.registers[4] & 0x4) << 11;
            this.updateTableMasks();
        } else {
            this.colorTable = this.registers[3] << 6;
            this.charPatternTable = (this.registers[4] & 0x7) << 11;
        }
        this.nameTable = (this.registers[2] & 0xf) << 10;
        this.spriteAttributeTable = (this.registers[5] & 0x7f) << 7;
        this.spritePatternTable = (this.registers[6] & 0x7) << 11;
    },

    updateTableMasks: function() {
        if (this.screenMode == TMS9918A.MODE_BITMAP) {
            this.colorTableMask = ((this.registers[3] & 0x7F) << 6) | 0x3F;
            this.patternTableMask  = ((this.registers[4] & 0x03) << 11) | (this.colorTableMask & 0x7FF);
            // this.log.info("colorTableMask:" + this.colorTableMask);
            // this.log.info("patternTableMask:" + this.patternTableMask);
        }
        else {
            this.colorTableMask = 0x3FFF;
            this.patternTableMask = 0x3FFF;
        }
    },

    writeData: function(i) {
        this.ram[this.addressRegister++] = i;
        this.addressRegister %= 16384;
        this.redrawRequired = true;
    },

    readStatus: function() {
        var i = this.statusRegister;
        this.statusRegister = 0;
        this.cru.writeBit(2, true);
        return i;
    },

    readData: function() {
        var i = this.prefetchByte;
        this.prefetchByte = this.ram[this.addressRegister++];
        this.addressRegister %= 16384;
        return i;
    },

    getRAM: function() {
        return this.ram;
    },

    logRegisters: function() {
        this.log.info(this.getRegsString());
    },

    getRegsString: function() {
        var s = "";
        for (var i = 0; i < this.registers.length; i++) {
            s += "VR" + i + "=" + this.registers[i].toHexByte() + " ";
        }
        return s;
    },

    logMemory: function(start, length) {
        this.log.info("Video memory dump: " + start.toHexWord());
        var buffer = "";
        for (var i = 0; i < length; i += 2) {
            var addr = start + i;
            if ((i % 16) == 0) {
                buffer += addr.toHexWord() + ": ";
            }
            buffer += (this.ram[addr] << 8 | this.ram[addr + 1]).toHexWord();
            if ((i % 16) < 14) {
                buffer += ", ";
            }
            else {
                this.log.info(buffer);
                buffer = "";
            }
        }
    },

    getCharAt: function(x, y) {
        x -= 24;
        y -= 24;
        if (this.screenMode != TMS9918A.MODE_TEXT) {
            return this.ram[this.nameTable + Math.floor(x / 8) + Math.floor(y / 8)  * 32];
        }
        else {
            return this.ram[this.nameTable + Math.floor((x - 8) / 6) + Math.floor(y / 8)  * 40];
        }
    }
};
