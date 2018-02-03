/*
 * js99'er - TI-99/4A emulator written in JavaScript
 *
 * Created 2014 by Rasmus Moustgaard <rasmus.moustgaard@gmail.com>
 *
 * TMS9918A VDP emulation.
 *
 */

'use strict';

TMS9918A.MODE_GRAPHICS = 0;
TMS9918A.MODE_TEXT = 1;
TMS9918A.MODE_BITMAP = 2;
TMS9918A.MODE_MULTICOLOR = 3;
TMS9918A.MODE_BITMAP_TEXT = 4;
TMS9918A.MODE_BITMAP_MULTICOLOR = 5;
TMS9918A.MODE_ILLEGAL = 6;

/**
 * @constructor
 */
function TMS9918A(canvas, cru, enableFlicker) {

    this.canvas = canvas;
    this.cru = cru;
    this.enableflicker = enableFlicker;

    this.ram = new Uint8Array(16384); // VDP RAM
    this.registers = new Uint8Array(8);
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

    this.latch = null;
    this.prefetchByte = null;

    this.displayOn = null;
    this.interruptsOn = null;
    this.screenMode = null;
    this.bitmapMode = null;
    this.textMode = null;
    this.colorTable = null;
    this.nameTable = null;
    this.charPatternTable = null;
    this.spriteAttributeTable = null;
    this.spritePatternTable = null;
    this.colorTableMask = null;
    this.patternTableMask = null;
    this.ramMask = null;
    this.fgColor = null;
    this.bgColor = null;

    this.flicker = null;
    this.redrawRequired = null;

    this.canvasContext = this.canvas.getContext("2d");
    this.imageData = null;

    this.log = Log.getLog();

    this.reset();
}

TMS9918A.prototype = {

    reset: function () {

        var i;
        for (i = 0; i < this.ram.length; i++) {
            this.ram[i] = 0;
        }
        for (i = 0; i < this.registers.length; i++) {
            this.registers[i] = 0;
        }
        this.addressRegister = 0;
        this.statusRegister = 0;

        this.prefetchByte = 0;
        this.latch = false;

        this.displayOn = false;
        this.interruptsOn = false;
        this.screenMode = TMS9918A.MODE_GRAPHICS;
        this.bitmapMode = false;
        this.textMode = false;
        this.colorTable = 0;
        this.nameTable = 0;
        this.charPatternTable = 0;
        this.spriteAttributeTable = 0;
        this.spritePatternTable = 0;
        this.colorTableMask = 0x3FFF;
        this.patternTableMask = 0x3FFF;
        this.ramMask = 0x3FFF;
        this.fgColor = 0;
        this.bgColor = 0;

        this.flicker = this.enableflicker;
        this.redrawRequired = true;

        this.canvas.width = 304;
        this.canvas.height = 240;
        this.canvasContext.fillStyle = 'rgba(' + this.palette[7].join(',') + ',1.0)';
        this.canvasContext.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Build the array containing the canvas bitmap (256 * 192 * 4 bytes (r,g,b,a) format each pixel)
        this.imageData = this.canvasContext.getImageData(0, 0, this.canvas.width, this.canvas.height);
        this.width = this.canvas.width;
        this.height = this.canvas.height;
    },

    drawFrame: function (timestamp) {
        if (this.redrawRequired) {
            for (var y = 0; y < this.height; y++) {
                this.drawScanline(y);
            }
            this.updateCanvas();
            this.redrawRequired = false;
        }
    },

    initFrame: function (timestamp) {
    },

    drawScanline: function (y) {
        var imageData = this.imageData.data,
            width = this.width,
            imageDataAddr = (y * width) << 2,
            screenMode = this.screenMode,
            textMode = this.textMode,
            bitmapMode = this.bitmapMode,
            drawWidth = !textMode ? 256 : 240,
            drawHeight = 192,
            hBorder = (width - drawWidth) >> 1,
            vBorder = (this.height - drawHeight) >> 1,
            fgColor = this.fgColor,
            bgColor = this.bgColor,
            ram = this.ram,
            nameTable = this.nameTable,
            colorTable = this.colorTable,
            charPatternTable = this.charPatternTable,
            colorTableMask = this.colorTableMask,
            patternTableMask = this.patternTableMask,
            spriteAttributeTable = this.spriteAttributeTable,
            spritePatternTable = this.spritePatternTable,
            spriteSize = (this.registers[1] & 0x2) !== 0,
            spriteMagnify = this.registers[1] & 0x1,
            spriteDimension = (spriteSize ? 16 : 8) << (spriteMagnify ? 1 : 0),
            maxSpritesOnLine = this.flicker ? 4 : 32,
            palette = this.palette,
            collision = false, fifthSprite = false, fifthSpriteIndex = 31,
            x, color, rgbColor, name, tableOffset, colorByte, patternByte;
        if (y >= vBorder && y < vBorder + drawHeight && this.displayOn) {
            var y1 = y - vBorder;
            // Pre-process sprites
            if (!textMode) {
                var spriteBuffer = new Uint8Array(drawWidth);
                var spritesOnLine = 0;
                var endMarkerFound = false;
                var spriteAttributeAddr = spriteAttributeTable;
                var s;
                for (s = 0; s < 32 && spritesOnLine <= maxSpritesOnLine && !endMarkerFound; s++) {
                    var sy = ram[spriteAttributeAddr];
                    if (sy !== 0xD0) {
                        if (sy > 0xD0) {
                            sy -= 256;
                        }
                        sy++;
                        var sy1 = sy + spriteDimension;
                        var y2 = -1;
                        if (s < 8 || !bitmapMode) {
                            if (y1 >= sy && y1 < sy1) {
                                y2 = y1;
                            }
                        }
                        else {
                            // Emulate sprite duplication bug
                            var yMasked = y1 & (((this.registers[4] & 0x03) << 6) | 0x3F);
                            if (yMasked >= sy && yMasked < sy1) {
                                y2 = yMasked;
                            }
                            else if (y1 >= 64 && y1 < 128 && y1 >= sy && y1 < sy1) {
                                y2 = y1;
                            }
                        }
                        if (y2 !== -1) {
                            if (spritesOnLine < maxSpritesOnLine) {
                                var sx = ram[spriteAttributeAddr + 1];
                                var sPatternNo = ram[spriteAttributeAddr + 2] & (spriteSize ? 0xFC : 0xFF);
                                var sColor = ram[spriteAttributeAddr + 3] & 0x0F;
                                if ((ram[spriteAttributeAddr + 3] & 0x80) !== 0) {
                                    sx -= 32;
                                }
                                var sLine = (y2 - sy) >> spriteMagnify;
                                var sPatternBase = spritePatternTable + (sPatternNo << 3) + sLine;
                                for (var sx1 = 0; sx1 < spriteDimension; sx1++) {
                                    var sx2 = sx + sx1;
                                    if (sx2 >= 0 && sx2 < drawWidth) {
                                        var sx3 = sx1 >> spriteMagnify;
                                        var sPatternByte = ram[sPatternBase + (sx3 >= 8 ? 16 : 0)];
                                        if ((sPatternByte & (0x80 >> (sx3 & 0x07))) !== 0) {
                                            if (spriteBuffer[sx2] === 0) {
                                                spriteBuffer[sx2] = sColor + 1;
                                            }
                                            else {
                                                collision = true;
                                            }
                                        }
                                    }
                                }
                            }
                            spritesOnLine++;
                        }
                        spriteAttributeAddr += 4;
                    }
                    else {
                        endMarkerFound = true;
                    }
                }
                if (spritesOnLine > 4) {
                    fifthSprite = true;
                    fifthSpriteIndex = s;
                }
            }
            // Draw
            var rowOffset = !textMode ? (y1 >> 3) << 5 : (y1 >> 3) * 40;
            var lineOffset = y1 & 7;
            for (x = 0; x < width; x++) {
                if (x >= hBorder && x < hBorder + drawWidth) {
                    var x1 = x - hBorder;
                    // Tiles
                    switch (screenMode) {
                        case TMS9918A.MODE_GRAPHICS:
                            name = ram[nameTable + rowOffset + (x1 >> 3)];
                            colorByte = ram[colorTable + (name >> 3)];
                            patternByte = ram[charPatternTable + (name << 3) + lineOffset];
                            color = (patternByte & (0x80 >> (x1 & 7))) !== 0 ? (colorByte & 0xF0) >> 4 : colorByte & 0x0F;
                            break;
                        case TMS9918A.MODE_BITMAP:
                            name = ram[nameTable + rowOffset + (x1 >> 3)];
                            tableOffset = ((y1 & 0xC0) << 5) + (name << 3);
                            colorByte = ram[colorTable + (tableOffset & colorTableMask) + lineOffset];
                            patternByte = ram[charPatternTable + (tableOffset & patternTableMask) + lineOffset];
                            color = (patternByte & (0x80 >> (x1 & 7))) !== 0 ? (colorByte & 0xF0) >> 4 : colorByte & 0x0F;
                            break;
                        case TMS9918A.MODE_MULTICOLOR:
                            name = ram[nameTable + rowOffset + (x1 >> 3)];
                            lineOffset = (y1 & 0x1C) >> 2;
                            patternByte = ram[charPatternTable + (name << 3) + lineOffset];
                            color = (x1 & 4) === 0 ? (patternByte & 0xF0) >> 4 : patternByte & 0x0F;
                            break;
                        case TMS9918A.MODE_TEXT:
                            name = ram[nameTable + rowOffset + Math.floor(x1 / 6)];
                            patternByte = ram[charPatternTable + (name << 3) + lineOffset];
                            color = (patternByte & (0x80 >> (x1 % 6))) !== 0 ? fgColor : bgColor;
                            break;
                        case TMS9918A.MODE_BITMAP_TEXT:
                            name = ram[nameTable + rowOffset + Math.floor(x1 / 6)];
                            tableOffset = ((y1 & 0xC0) << 5) + (name << 3);
                            patternByte = ram[charPatternTable + (tableOffset & patternTableMask) + lineOffset];
                            color = (patternByte & (0x80 >> (x1 % 6))) !== 0 ? fgColor : bgColor;
                            break;
                        case TMS9918A.MODE_BITMAP_MULTICOLOR:
                            name = ram[nameTable + rowOffset + (x1 >> 3)];
                            lineOffset = (y1 & 0x1C) >> 2;
                            tableOffset = ((y1 & 0xC0) << 5) + (name << 3);
                            patternByte = ram[charPatternTable + (tableOffset & patternTableMask) + lineOffset];
                            color = (x1 & 4) === 0 ? (patternByte & 0xF0) >> 4 : patternByte & 0x0F;
                            break;
                        case TMS9918A.MODE_ILLEGAL:
                            color = (x1 & 4) === 0 ? fgColor : bgColor;
                            break;
                    }
                    if (color === 0) {
                        color = bgColor;
                    }
                    // Sprites
                    if (!textMode) {
                        var spriteColor = spriteBuffer[x1] - 1;
                        if (spriteColor > 0) {
                            color = spriteColor;
                        }
                    }
                }
                else {
                    color = bgColor;
                }
                rgbColor = palette[color];
                imageData[imageDataAddr++] = rgbColor[0]; // R
                imageData[imageDataAddr++] = rgbColor[1]; // G
                imageData[imageDataAddr++] = rgbColor[2]; // B
                imageDataAddr++; // Skip alpha
            }
        }
        // Top/bottom border
        else {
            rgbColor = palette[bgColor];
            for (x = 0; x < width; x++) {
                imageData[imageDataAddr++] = rgbColor[0]; // R
                imageData[imageDataAddr++] = rgbColor[1]; // G
                imageData[imageDataAddr++] = rgbColor[2]; // B
                imageDataAddr++; // Skip alpha
            }
        }
        if (y === vBorder + drawHeight) {
            this.statusRegister |= 0x80;
            if (this.interruptsOn) {
                this.cru.setVDPInterrupt(true);
            }
        }
        if (collision) {
            this.statusRegister |= 0x20;
        }
        if ((this.statusRegister & 0x40) === 0) {
            this.statusRegister |= fifthSpriteIndex;
        }
        if (fifthSprite) {
            this.statusRegister |= 0x40;
        }
    },

    updateCanvas: function () {
        this.canvasContext.putImageData(this.imageData, 0, 0);
    },

    writeAddress: function (i) {
        if (!this.latch) {
            this.addressRegister = (this.addressRegister & 0xFF00) | i;
        }
        else {
            switch ((i & 0xc0) >> 6) {
                // Set read address
                case 0:
                    this.addressRegister = ((i & 0x3f) << 8) | (this.addressRegister & 0x00FF);
                    this.prefetchByte = this.ram[this.addressRegister++];
                    this.addressRegister &= 0x3FFF;
                    break;
                // Set write address
                case 1:
                    this.addressRegister = ((i & 0x3f) << 8) | (this.addressRegister & 0x00FF);
                    break;
                // Write register
                case 2:
                case 3:
                    this.registers[i & 0x7] = this.addressRegister & 0x00FF;
                    switch (i & 0x7) {
                        // Mode
                        case 0:
                            this.updateMode(this.registers[0], this.registers[1]);
                            break;
                        case 1:
                            this.ramMask = (this.registers[1] & 0x80) !== 0 ? 0x3FFF : 0x1FFF;
                            this.displayOn = (this.registers[1] & 0x40) !== 0;
                            this.interruptsOn = (this.registers[1] & 0x20) !== 0;
                            this.updateMode(this.registers[0], this.registers[1]);
                            break;
                        // Name table
                        case 2:
                            this.nameTable = (this.registers[2] & 0xf) << 10;
                            break;
                        // Color table
                        case 3:
                            if (this.bitmapMode) {
                                this.colorTable = (this.registers[3] & 0x80) << 6;
                            }
                            else {
                                this.colorTable = this.registers[3] << 6;
                            }
                            this.updateTableMasks();
                            break;
                        // Pattern table
                        case 4:
                            if (this.bitmapMode) {
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
                            break;
                    }
                    // this.logRegisters();
                    // this.log.info("Name table: " + this.nameTable.toHexWord());
                    // this.log.info("Pattern table: " + this.charPatternTable.toHexWord());
                    break;
            }
            this.redrawRequired = true;
        }
        this.latch = !this.latch;
    },

    updateMode: function (reg0, reg1) {
        this.bitmapMode = (reg0 & 0x02) !== 0;
        this.textMode = (reg1 & 0x10) !== 0;
        // Check bitmap mode bit, not text or multicolor
        if (this.bitmapMode) {
            switch ((reg1 & 0x18) >> 3) {
                case 0:
                    // Bitmap mode
                    this.screenMode = TMS9918A.MODE_BITMAP;
                    break;
                case 1:
                    // Multicolor mode
                    this.screenMode = TMS9918A.MODE_BITMAP_MULTICOLOR;
                    break;
                case 2:
                    // Text mode
                    this.screenMode = TMS9918A.MODE_BITMAP_TEXT;
                    break;
                case 3:
                    // Illegal
                    this.screenMode = TMS9918A.MODE_ILLEGAL;
                    break;
            }
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
                case 3:
                    // Illegal
                    this.screenMode = TMS9918A.MODE_ILLEGAL;
                    break;
            }
        }
        if (this.bitmapMode) {
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

    updateTableMasks: function () {
        if (this.screenMode === TMS9918A.MODE_BITMAP) {
            this.colorTableMask = ((this.registers[3] & 0x7F) << 6) | 0x3F; // 000CCCCCCC111111
            this.patternTableMask  = ((this.registers[4] & 0x03) << 11) | (this.colorTableMask & 0x7FF); // 000PPCCCCC111111
            // this.log.info("colorTableMask:" + this.colorTableMask);
            // this.log.info("patternTableMask:" + this.patternTableMask);
        }
        else if (this.screenMode === TMS9918A.MODE_BITMAP_TEXT || this.screenMode === TMS9918A.MODE_BITMAP_MULTICOLOR) {
            this.colorTableMask = this.ramMask;
            this.patternTableMask  = ((this.registers[4] & 0x03) << 11) | 0x7FF; // 000PP11111111111
        }
        else {
            this.colorTableMask = this.ramMask;
            this.patternTableMask = this.ramMask;
        }
    },

    writeData: function (i) {
        this.ram[this.addressRegister++] = i;
        this.addressRegister &= this.ramMask;
        this.redrawRequired = true;
    },

    readStatus: function () {
        var i = this.statusRegister;
        this.statusRegister = 0x1F;
        if (this.interruptsOn) {
            this.cru.setVDPInterrupt(false);
        }
        this.latch = false;
        return i;
    },

    readData: function () {
        var i = this.prefetchByte;
        this.prefetchByte = this.ram[this.addressRegister++];
        this.addressRegister &= this.ramMask;
        return i;
    },

    getRAM: function () {
        return this.ram;
    },

    colorTableSize: function () {
        if (this.screenMode === TMS9918A.MODE_GRAPHICS) {
            return 0x20;
        }
        else if (this.screenMode === TMS9918A.MODE_BITMAP) {
            return Math.min(this.colorTableMask + 1, 0x1800);
        }
        else {
            return 0;
        }
    },

    patternTableSize: function () {
        if (this.bitmapMode) {
            return Math.min(this.patternTableMask + 1, 0x1800);
        }
        else {
            return 0x800;
        }
    },

    getRegsString: function () {
        var s = "";
        for (var i = 0; i < this.registers.length; i++) {
            s += "VR" + i + ":" + this.registers[i].toHexByte() + " ";
        }
        s += "\nSIT:" + this.nameTable.toHexWord() + " PDT:" + this.charPatternTable.toHexWord() + " (" + this.patternTableSize().toHexWord() + ")" +
             " CT:" + this.colorTable.toHexWord() + " (" + this.colorTableSize().toHexWord() + ") SDT:" + this.spritePatternTable.toHexWord() +
             " SAL:" + this.spriteAttributeTable.toHexWord() + "\nVDP: " + this.addressRegister.toHexWord();
        return s;
    },

    hexView: function (start, length, anchorAddr) {
        var text = "";
        var anchorLine = null;
        var addr = start;
        var line = 0;
        for (var i = 0; i < length && addr < 0x4000; addr++, i++) {
            if ((i & 0x000F) === 0) {
                text += "\n" + addr.toHexWord() + ":";
                line++;
            }
            text += " ";
            if (anchorAddr && anchorAddr === addr) {
                anchorLine = line;
            }
            var hex = this.ram[addr].toString(16).toUpperCase();
            if (hex.length === 1) {
                text += "0";
            }
            text += hex;
        }
        return {text: text.substr(1), lineCount: line, anchorLine: anchorLine - 1};
    },

    getWord: function (addr) {
        return addr < 0x4000 ? this.ram[addr] << 8 | this.ram[addr+1] : 0;
    },

    getCharAt: function (x, y) {
        x -= 24;
        y -= 24;
        if (!this.textMode) {
            return this.ram[this.nameTable + Math.floor(x / 8) + Math.floor(y / 8)  * 32];
        }
        else {
            return this.ram[this.nameTable + Math.floor((x - 8) / 6) + Math.floor(y / 8)  * 40];
        }
    },

    setFlicker: function (value) {
        this.flicker = value;
        this.enableflicker = value;
    }
};
