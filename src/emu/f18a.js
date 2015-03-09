/*
 * js99'er - TI-99/4A emulator written in JavaScript
 *
 * Created 2014 by Rasmus Moustgaard <rasmus.moustgaard@gmail.com>
 *
 * F18A VDP emulation.
 *
 */

'use strict';

F18A.VERSION = 0x16;

F18A.MAX_SCANLINE_SPRITES_JUMPER = true;
F18A.SCANLINES_JUMPER = false;


F18A.MODE_GRAPHICS = 0;
F18A.MODE_TEXT = 1;
F18A.MODE_TEXT_80 = 2;
F18A.MODE_BITMAP = 3;
F18A.MODE_MULTICOLOR = 4;

F18A.COLOR_MODE_NORMAL = 0;
F18A.COLOR_MODE_ECM_1 = 1;
F18A.COLOR_MODE_ECM_2 = 2;
F18A.COLOR_MODE_ECM_3 = 3;

F18A.PALETTE = [
// Palette 0, original 9918A NTSC color approximations
"000", //  0 Transparent
"000", //  1 Black
"2C3", //  2 Medium Green
"5D6", //  3 Light Green
"54F", //  4 Dark Blue
"76F", //  5 Light Blue
"D54", //  6 Dark Red
"4EF", //  7 Cyan
"F54", //  8 Medium Red
"F76", //  9 Light Red
"DC3", // 10 Dark Yellow
"ED6", // 11 Light Yellow
"2B2", // 12 Dark Green
"C5C", // 13 Magenta
"CCC", // 14 Gray
"FFF", // 15 White
// Palette 1, ECM1 (0 index is always 000) version of palette 0
"000", //  0 Black
"2C3", //  1 Medium Green
"000", //  2 Black
"54F", //  3 Dark Blue
"000", //  4 Black
"D54", //  5 Dark Red
"000", //  6 Black
"4EF", //  7 Cyan
"000", //  8 Black
"CCC", //  9 Gray
"000", // 10 Black
"DC3", // 11 Dark Yellow
"000", // 12 Black
"C5C", // 13 Magenta
"000", // 14 Black
"FFF", // 15 White
// Palette 2, CGA colors
"000", //  0 >000000 (  0   0   0) black
"00A", //  1 >0000AA (  0   0 170) blue
"0A0", //  2 >00AA00 (  0 170   0) green
"0AA", //  3 >00AAAA (  0 170 170) cyan
"A00", //  4 >AA0000 (170   0   0) red
"A0A", //  5 >AA00AA (170   0 170) magenta
"A50", //  6 >AA5500 (170  85   0) brown
"AAA", //  7 >AAAAAA (170 170 170) light gray
"555", //  8 >555555 ( 85  85  85) gray
"55F", //  9 >5555FF ( 85  85 255) light blue
"5F5", // 10 >55FF55 ( 85 255  85) light green
"5FF", // 11 >55FFFF ( 85 255 255) light cyan
"F55", // 12 >FF5555 (255  85  85) light red
"F5F", // 13 >FF55FF (255  85 255) light magenta
"FF5", // 14 >FFFF55 (255 255  85) yellow
"FFF", // 15 >FFFFFF (255 255 255) white
// Palette 3, ECM1 (0 index is always 000) version of palette 2
"000", //  0 >000000 (  0   0   0) black
"555", //  1 >555555 ( 85  85  85) gray
"000", //  2 >000000 (  0   0   0) black
"00A", //  3 >0000AA (  0   0 170) blue
"000", //  4 >000000 (  0   0   0) black
"0A0", //  5 >00AA00 (  0 170   0) green
"000", //  6 >000000 (  0   0   0) black
"0AA", //  7 >00AAAA (  0 170 170) cyan
"000", //  8 >000000 (  0   0   0) black
"A00", //  9 >AA0000 (170   0   0) red
"000", // 10 >000000 (  0   0   0) black
"A0A", // 11 >AA00AA (170   0 170) magenta
"000", // 12 >000000 (  0   0   0) black
"A50", // 13 >AA5500 (170  85   0) brown
"000", // 14 >000000 (  0   0   0) black
"FFF"  // 15 >FFFFFF (255 255 255) white
];

function F18A(canvas, cru, tms9919) {
    this.canvas = canvas;
    this.cru = cru;
    this.tms9919 = tms9919;

    // Allocate full 64K, but actually only using 16K VDP RAM + 2K VDP GRAM
    // + 32 bytes for GPU registers
    this.ram = new Uint8Array(0x10000);
    this.registers = new Uint8Array(64);
    this.addressRegister = null;
    this.statusRegister = null;
    this.palette = null;

    this.latchByte = null;
    this.latch = null;
    this.prefetchByte = null;
    this.addressIncrement = null;

    this.unlocked = null;
    this.statusRegisterNo = null;
    this.dataPortMode = null;
    this.autoIncPaletteReg = null;
    this.paletteRegisterNo = null;
    this.paletteRegisterData = null;
    this.gpuAddressLatch = null;
    this.currentScanline = null;
    this.fakeScanline = null;

    this.displayOn = null;
    this.interruptsOn = null;
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
	this.spriteSize = null;
	this.spriteMag = null;

    this.tileColorMode = null;
    this.tilePaletteSelect = null;
    this.tilePaletteSelect2 = null;
    this.spriteColorMode = null;
    this.spritePaletteSelect = null;
    this.realSpriteYCoord = null;
    this.colorTable2 = null;
    this.nameTable2 = null;
    this.tileLayer1Enabled = null;
    this.tileLayer2Enabled = null;
    this.row30Enabled = null;
    this.spriteLinkingEnabled = null;
    this.hScroll1 = null;
    this.vScroll1 = null;
    this.hScroll2 = null;
    this.vScroll2 = null;
    this.hPageSize1 = null;
    this.vPageSize1 = null;
    this.hPageSize2 = null;
    this.vPageSize2 = null;
    this.bitmapEnable = null;
    this.bitmapPriority = null;
    this.bitmapTransparent = null;
    this.bitmapFat = null;
    this.bitmapPaletteSelect = null;
    this.bitmapBaseAddr = null;
    this.bitmapX = null;
    this.bitmapY = null;
    this.bitmapWidth = null;
    this.bitmapHeight = null;
    this.interruptScanline = null;
    this.maxScanlineSprites = null;
    this.maxSprites = null;
    this.tileMap2AlwaysOnTop = null;
    this.ecmPositionAttributes = null;
    this.reportMax = null;
    this.scanLines = null;
    this.gpuHsyncTrigger = null;
    this.gpuVsyncTrigger = null;

    this.sprites = null;
    this.collision = null;

    this.redrawRequired = null;
    this.redrawBorder = null;

    this.width = null;
    this.height = null;
    this.leftBorder = null;
    this.topBorder = null;
    this.canvasContext = canvas.getContext("2d");
    this.imagedata = null;
    this.imagedataAddr = null;
    this.imagedataData = null;
    this.frameCounter = null;
    this.lastTime = null;

    this.gpu = new F18AGPU(this);
    this.gpuRuns = 0;

    this.log = Log.getLog();
    this.log.info("F18A emulation enabled");

    this.reset();
}

F18A.prototype = {

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
        this.palette = [];
        for (i = 0; i < 64; i++) {
            var rgbColor = F18A.PALETTE[i];
            this.palette[i] = [
                parseInt(rgbColor.charAt(0), 16) * 17,
                parseInt(rgbColor.charAt(1), 16) * 17,
                parseInt(rgbColor.charAt(2), 16) * 17
            ];
        }

        this.latchByte = 0;
        this.prefetchByte = 0;
        this.latch = false;
        this.addressIncrement = 1;

        this.unlocked = false;
        this.statusRegisterNo = 0;
        this.dataPortMode = false;
        this.autoIncPaletteReg = false;
        this.paletteRegisterNo = 0;
        this.paletteRegisterData = -1;
        this.gpuAddressLatch = false;
        this.currentScanline = 0;
        this.fakeScanline = null;

        this.displayOn = true;
        this.interruptsOn = false;
		this.screenMode = F18A.MODE_GRAPHICS;
        this.colorTable = 0;
        this.nameTable = 0;
        this.charPatternTable = 0;
        this.spriteAttributeTable = 0;
        this.spritePatternTable = 0;
        this.colorTableMask = 0x3FFF;
        this.patternTableMask = 0x3FFF;
        this.fgColor = 0;
        this.bgColor = 7;
		this.spriteSize = 0;
		this.spriteMag = 0;

        this.tileColorMode = 0;
        this.tilePaletteSelect = 0;
        this.tilePaletteSelect2 = 0;
        this.spriteColorMode = 0;
        this.spritePaletteSelect = 0;
        this.realSpriteYCoord = 0;
        this.colorTable2 = 0;
        this.nameTable2 = 0;
        this.tileLayer1Enabled = true;
        this.tileLayer2Enabled = false;
        this.row30Enabled = false;
        this.spriteLinkingEnabled = false;
        this.hScroll1 = 0;
        this.vScroll1 = 0;
        this.hScroll2 = 0;
        this.vScroll2 = 0;
        this.hPageSize1 = 0;
        this.vPageSize1 = 0;
        this.hPageSize2 = 0;
        this.vPageSize2 = 0;
        this.bitmapEnable = false;
        this.bitmapPriority = false;
        this.bitmapTransparent = false;
        this.bitmapFat = false;
        this.bitmapPaletteSelect = 0;
        this.bitmapBaseAddr = 0;
        this.bitmapX = 0;
        this.bitmapY = 0;
        this.bitmapWidth = 0;
        this.bitmapHeight = 0;
        this.interruptScanline = 0;
        this.maxScanlineSprites = F18A.MAX_SCANLINE_SPRITES_JUMPER ? 32 : 4;
        this.maxSprites = 32;
        this.tileMap2AlwaysOnTop = true;
        this.ecmPositionAttributes = false;
        this.reportMax = false;
        this.scanLines = F18A.SCANLINES_JUMPER;
        this.gpuHsyncTrigger = false;
        this.gpuVsyncTrigger = false;
        this.resetRegs();

        this.sprites = [];
        this.collision = false;

        this.redrawRequired = true;
        this.redrawBorder = false;

        this.setDimensions();
        this.imagedataAddr = 0;
        this.frameCounter = 0;
        this.lastTime = 0;

        this.gpu.reset();
    },

    resetRegs: function() {
        this.log.info("F18A reset");
        this.log.setMinLevel(Log.LEVEL_NONE);
        this.writeRegister(0, 0);
        this.writeRegister(1, 0x40);
        this.writeRegister(2, 0);
        this.writeRegister(3, 0x10);
        this.writeRegister(4, 0x01);
        this.writeRegister(5, 0x0A);
        this.writeRegister(6, 0x02);
        this.writeRegister(7, 0xF2);
        this.writeRegister(10, 0);
        this.writeRegister(11, 0);
        this.writeRegister(15, 0);
        this.writeRegister(19, 0);
        this.writeRegister(24, 0);
        this.writeRegister(25, 0);
        this.writeRegister(26, 0);
        this.writeRegister(27, 0);
        this.writeRegister(28, 0);
        this.writeRegister(29, 0);
        this.writeRegister(30, 0);
        this.writeRegister(31, 0);
        this.writeRegister(47, 0);
        this.writeRegister(48, 1);
        this.writeRegister(49, 0);
        this.writeRegister(50, 0);
        this.writeRegister(51, 32);
        this.writeRegister(54, 0x40);
        this.writeRegister(57, 0);
        this.writeRegister(58, 6);
        this.log.setMinLevel(Log.LEVEL_INFO);
    },

    setDimensions: function() {
        this.canvas.width = this.screenMode == F18A.MODE_TEXT_80 ? 608 : 304;
        this.canvas.height = this.screenMode == F18A.MODE_TEXT_80 ? 480 : 240;
        this.width = this.screenMode == F18A.MODE_TEXT_80 ? 512 : 256;
        this.height = this.screenMode == F18A.MODE_TEXT_80 ? (this.row30Enabled ? 480 : 384) : (this.row30Enabled ? 240 : 192);
        this.leftBorder = Math.floor((this.canvas.width - this.width) >> 1);
        this.topBorder = Math.floor((this.canvas.height - this.height) >> 1);
        this.fillCanvas(this.bgColor);
        this.imagedata = this.canvasContext.getImageData(this.leftBorder, this.topBorder, this.width, this.height);
        this.imagedataData = this.imagedata.data;
    },

    drawFrame: function(timestamp) {
        this.lastTime = timestamp;
        // this.log.info("Draw frame");
        if (this.redrawRequired) {
            // this.log.info("Redraw " + this.frameCounter);
            if (this.displayOn) {
                if (this.redrawBorder) {
                    // this.log.info("Redraw border");
                    this.fillCanvas(this.bgColor);
                    this.redrawBorder = false;
                }
                if (this.unlocked || (this.screenMode != F18A.MODE_TEXT && this.screenMode != F18A.MODE_TEXT_80)) {
                    this.prepareSprites();
                }
                this.collision = false;
                // Draw scanlines
                this.imagedataAddr = 0;
                this.fakeScanline = null;
                for (var y = 0; y < this.height; y++) {
                    this.drawScanLine(y);
                    if (this.gpuHsyncTrigger) {
                        this.currentScanline = y;
                        this.runGPU(this.gpu.getPC());
                    }
                }
                this.canvasContext.putImageData(this.imagedata, this.leftBorder, this.topBorder);
                this.currentScanline = null;
            }
            else {
                this.fillCanvas(this.bgColor);
            }
            this.redrawRequired = false;
        }
        this.statusRegister = 0x80;
        if (this.interruptsOn) {
            this.cru.writeBit(2, false);
        }
        if (this.collision) {
            this.statusRegister |= 0x20;
        }
        this.statusRegister |= (this.reportMax ? this.registers[30] : 0x1F);
        if (this.gpuHsyncTrigger) {
            this.redrawRequired = true;
        }
        if (this.gpuVsyncTrigger) {
            this.currentScanline = y;
            this.runGPU(this.gpu.getPC());
        }
        this.frameCounter++;
    },

    fillCanvas: function(color) {
        // this.log.info("Width: " + this.canvas.width + ", Height: " + this.canvas.height);
        this.canvasContext.fillStyle = 'rgba(' + this.palette[color].join(',') + ',1.0)';
        this.canvasContext.fillRect(0, 0, this.canvas.width, this.canvas.height - 1); // In Chrome the image sometimes turns white if we don't subtract 1
    },

    prepareSprites: function() {
        this.sprites = [];
        var grids = {};
        var outOfScreenY = this.row30Enabled ? 0xF0 : 0xC0;
        var negativeScreenY = this.row30Enabled ? 0xF0 : 0xD0;
        var maxSpriteAttrAddr = this.spriteAttributeTable + (this.maxSprites << 2);
        for (var spriteAttrAddr = this.spriteAttributeTable; (this.row30Enabled || this.ram[spriteAttrAddr] != 0xd0) && spriteAttrAddr < maxSpriteAttrAddr; spriteAttrAddr += 4) {
            var parentSpriteAttrAddr = null;
            if (this.spriteLinkingEnabled) {
                var spriteLinkingAttr = this.ram[this.spriteAttributeTable + 0x80 + ((spriteAttrAddr - this.spriteAttributeTable) >> 2)];
                if ((spriteLinkingAttr & 0x20) != 0) {
                    parentSpriteAttrAddr = this.spriteAttributeTable + ((spriteLinkingAttr & 0x1F) << 2);
                }
            }
            var spriteY = this.ram[spriteAttrAddr];
            if (parentSpriteAttrAddr != null) {
                spriteY = (spriteY + this.ram[parentSpriteAttrAddr]) & 0xFF;
            }
            if (spriteY < outOfScreenY || spriteY > negativeScreenY) {
                if (spriteY > negativeScreenY) {
                    spriteY -= 256;
                }
                if (!this.realSpriteYCoord) {
                    spriteY++;
                }
                var spriteAttr = this.ram[spriteAttrAddr + 3];
                var spriteX = this.ram[spriteAttrAddr + 1];
                if (parentSpriteAttrAddr == null) {
                    if ((spriteAttr & 0x80) != 0) {
                        spriteX -= 32; // Early clock
                    }
                }
                else {
                    spriteX = (spriteX + this.ram[parentSpriteAttrAddr + 1]) & 0xFF;
                    if ((this.ram[parentSpriteAttrAddr + 3] & 0x80) != 0) {
                        spriteX -= 32; // Early clock of parent
                    }
                }
                var spriteSize = !this.unlocked || (spriteAttr & 0x10) == 0 ? this.spriteSize : 1;
                var patternNo = (this.ram[spriteAttrAddr + 2] & (spriteSize != 0 ? 0xFC : 0xFF));
                var key = ((spriteAttr & 0x7F) << 8) | patternNo;
                var empty = true;
                var grid = grids[key];
                if (grid == null) {
                    grid = [];
                    var spriteFlipY = this.unlocked && (spriteAttr & 0x20) != 0;
                    var spriteFlipX = this.unlocked && (spriteAttr & 0x40) != 0;
                    var spriteMag = this.spriteMag;
                    var spriteWidth = 8 << spriteSize;
                    var spriteDimensionY = spriteWidth << spriteMag;
                    //noinspection JSSuspiciousNameCombination
                    var spriteDimensionX = spriteDimensionY;
                    var baseColor = spriteAttr & 0x0F;
                    var patternAddr = this.spritePatternTable + (patternNo << 3);
                    for (var y = 0; y < spriteDimensionY; y++) {
                        var row = [];
                        var dy = y >> spriteMag;
                        for (var x = 0; x < spriteWidth; x += 8) {
                            var spritePatternAddr = patternAddr + dy + (x << 1);
                            var spritePatternByte0 = this.ram[spritePatternAddr];
                            var spritePatternByte1 = this.ram[spritePatternAddr + 0x0800];
                            var spritePatternByte2 = this.ram[spritePatternAddr + 0x1000];
                            var spriteBit = 0x80;
                            var spriteBitShift2 = 7;
                            for (var spriteBitShift1 = 0; spriteBitShift1 < 8; spriteBitShift1++) {
                                var sprColor;
                                switch (this.spriteColorMode) {
                                    case F18A.COLOR_MODE_NORMAL:
                                        sprColor = (spritePatternByte0 & spriteBit) != 0 ? baseColor : 0;
                                        break;
                                    case F18A.COLOR_MODE_ECM_1:
                                        sprColor = (spritePatternByte0 & spriteBit) >> spriteBitShift2;
                                        break;
                                    case F18A.COLOR_MODE_ECM_2:
                                        sprColor =
                                            ((spritePatternByte0 & spriteBit) >> spriteBitShift2) |
                                            (((spritePatternByte1 & spriteBit) >> spriteBitShift2) << 1);
                                        break;
                                    case F18A.COLOR_MODE_ECM_3:
                                        sprColor =
                                            ((spritePatternByte0 & spriteBit) >> spriteBitShift2) |
                                            (((spritePatternByte1 & spriteBit) >> spriteBitShift2) << 1) |
                                            (((spritePatternByte2 & spriteBit) >> spriteBitShift2) << 2);
                                        break;
                                }
                                if (spriteFlipX) {
                                    row[spriteDimensionY - (x + spriteBitShift1) - 1] = sprColor;
                                }
                                else {
                                    row[x + spriteBitShift1] = sprColor;
                                }
                                if (sprColor != 0) {
                                    empty = false;
                                }
                                spriteBit >>= 1;
                                spriteBitShift2--;
                            }
                        }
                        if (spriteFlipY) {
                            grid[spriteDimensionY - y - 1] = row;
                        }
                        else {
                            grid[y] = row;
                        }
                    }
                    if (spriteMag) {
                        for (y = 0; y < spriteDimensionY; y++) {
                            row = grid[y];
                            for (x = spriteDimensionX - 1; x >= 0; x--) {
                                row[x] = row[x >> 1];
                            }
                        }
                    }
                    if (this.screenMode == F18A.MODE_TEXT_80) {
                        // Double width in 80 column mode
                        spriteDimensionX <<= 1;
                        for (y = 0; y < spriteDimensionY; y++) {
                            row = grid[y];
                            for (x = spriteDimensionX - 1; x >= 0; x--) {
                                row[x] = row[x >> 1];
                            }
                        }
                        spriteX <<= 1;
                    }
                    if (empty) {
                        grids[key] = [];
                    }
                    else {
                        grids[key] = grid;
                    }
                }
                else if (grid.length > 0) {
                    empty = false;
                }
                if (!empty) {
                    var sprPaletteBaseIndex = 0;
                    switch (this.spriteColorMode) {
                        case F18A.COLOR_MODE_NORMAL:
                            sprPaletteBaseIndex = this.spritePaletteSelect;
                            break;
                        case F18A.COLOR_MODE_ECM_1:
                            sprPaletteBaseIndex = (this.spritePaletteSelect & 0x20) | (baseColor << 1);
                            break;
                        case F18A.COLOR_MODE_ECM_2:
                            sprPaletteBaseIndex = (baseColor << 2);
                            break;
                        case F18A.COLOR_MODE_ECM_3:
                            sprPaletteBaseIndex = ((baseColor & 0x0e) << 2);
                            break;
                    }
                    this.sprites.push({
                        x: spriteX,
                        y: spriteY,
                        width: spriteDimensionX,
                        height: spriteDimensionY,
                        grid: grid,
                        paletteBaseIndex : sprPaletteBaseIndex
                    });
                }

            }
        }
    },

    drawScanLine: function(y) {
        var scrollWidth = this.width;
        var scrollHeight = this.height;
        if (this.screenMode == F18A.MODE_TEXT_80) {
            if ((y & 1) == 0) {
                y >>= 1;
                scrollHeight >>= 1;
            }
            else {
                // Duplicate last scan line
                var lineBytes = this.width << 2;
                var imagedataAddr2 = this.imagedataAddr - lineBytes;
                for (var i = 0; i < lineBytes; i++) {
                    this.imagedataData[this.imagedataAddr++] = this.imagedataData[imagedataAddr2++];
                }
                return;
            }
        }
        // Border in text modes
        var borderWidth = this.screenMode == F18A.MODE_TEXT ? 8 : (this.screenMode == F18A.MODE_TEXT_80 ? 16 : 0);
        scrollWidth -= (borderWidth << 1);
        // Prepare values for Tile layer 1
        var nameTableCanonicalBase = this.vPageSize1 ? this.nameTable & 0x3000 : (this.hPageSize1 ? this.nameTable & 0x3800 : this.nameTable);
        var nameTableBaseAddr = this.nameTable;
        var y1 = y + this.vScroll1;
        if (y1 >= scrollHeight) {
            y1 -= scrollHeight;
            nameTableBaseAddr ^= this.vPageSize1;
        }
        var rowOffset;
        switch (this.screenMode) {
            case F18A.MODE_GRAPHICS:
            case F18A.MODE_BITMAP:
            case F18A.MODE_MULTICOLOR:
                rowOffset = (y1 >> 3) << 5;
                break;
            case F18A.MODE_TEXT:
                rowOffset = (y1 >> 3) * 40;
                break;
            case F18A.MODE_TEXT_80:
                rowOffset = (y1 >> 3) * 80;
                break;
        }
        var lineOffset = y1 & 7;
        // Prepare values for Bitmap layer
        if (this.bitmapEnable) {
            var bitmapX2 = this.bitmapX + this.bitmapWidth;
            var bitmapY1 = y - this.bitmapY;
            var bitmapY2 = this.bitmapY + this.bitmapHeight;
            var bitmapOffset = bitmapY1 * this.bitmapWidth;
        }
        // Prepare values for Tile layer 2
        var rowOffset2, nameTableBaseAddr2, lineOffset2;
        if (this.tileLayer2Enabled) {
            var nameTableCanonicalBase2 = this.vPageSize2 ? this.nameTable2 & 0x3000 : (this.hPageSize2 ? this.nameTable2 & 0x3800 : this.nameTable2);
            nameTableBaseAddr2 = this.nameTable2;
            var y12 = y + this.vScroll2;
            if (y12 >= scrollHeight) {
                y12 -= scrollHeight;
                nameTableBaseAddr2 ^= this.vPageSize2;
            }
            switch (this.screenMode) {
                case F18A.MODE_GRAPHICS:
                case F18A.MODE_BITMAP:
                case F18A.MODE_MULTICOLOR:
                    rowOffset2 = (y12 >> 3) << 5;
                    break;
                case F18A.MODE_TEXT:
                    rowOffset2 = (y12 >> 3) * 40;
                    break;
                case F18A.MODE_TEXT_80:
                    rowOffset2 = (y12 >> 3) * 80;
                    break;
            }
            lineOffset2 = y12 & 7;
        }
        // Draw line
        for (var x = 0; x < this.width; x++) {
            // Draw pixel
            var color = this.bgColor;
            var paletteBaseIndex = 0;
            // Tile layer 1
            if (this.tileLayer1Enabled) {
                var nameTableAddr = nameTableBaseAddr;
                var x1 = x - borderWidth + (this.hScroll1 << (this.screenMode == F18A.MODE_TEXT_80 ? 1 : 0));
                if (x1 >= scrollWidth) {
                    x1 -= scrollWidth;
                    nameTableAddr ^= this.hPageSize1;
                }
                var charNo, bitShift, bit, patternAddr, patternByte;
                var tileColor, tilePriority, tileAttributeByte, transparentColor0;
                var tilePaletteBaseIndex, lineOffset1;
                switch (this.screenMode) {
                    case F18A.MODE_GRAPHICS:
                        nameTableAddr += (x1 >> 3) + rowOffset;
                        charNo = this.ram[nameTableAddr];
                        bitShift = x1 & 7;
                        lineOffset1 = lineOffset;
                        if (this.tileColorMode != F18A.COLOR_MODE_NORMAL) {
                            tileAttributeByte = this.ram[this.colorTable + (this.ecmPositionAttributes ? nameTableAddr - nameTableCanonicalBase : charNo)];
                            tilePriority = (tileAttributeByte & 0x80) != 0;
                            if ((tileAttributeByte & 0x40) != 0) {
                                // Flip X
                                bitShift = 7 - bitShift;
                            }
                            if ((tileAttributeByte & 0x20) != 0) {
                                // Flip y
                                lineOffset1 = 7 - lineOffset1;
                            }
                            transparentColor0 = (tileAttributeByte & 0x10) != 0;
                        }
                        bit = 0x80 >> bitShift;
                        patternAddr = this.charPatternTable + (charNo << 3) + lineOffset1;
                        patternByte = this.ram[patternAddr];
                        switch (this.tileColorMode) {
                            case F18A.COLOR_MODE_NORMAL:
                                var colorSet = this.ram[this.colorTable + (charNo >> 3)];
                                tileColor = (patternByte & bit) != 0 ? (colorSet & 0xF0) >> 4 : colorSet & 0x0F;
                                tilePaletteBaseIndex = this.tilePaletteSelect;
                                transparentColor0 = true;
                                tilePriority = false;
                                break;
                            case F18A.COLOR_MODE_ECM_1:
                                tileColor = ((patternByte & bit) >> (7 - bitShift));
                                tilePaletteBaseIndex = (this.tilePaletteSelect & 0x20) | ((tileAttributeByte & 0x0f) << 1);
                                break;
                            case F18A.COLOR_MODE_ECM_2:
                                tileColor =
                                    ((patternByte & bit) >> (7 - bitShift)) |
                                    (((this.ram[patternAddr + 0x0800] & bit) >> (7 - bitShift)) << 1);
                                tilePaletteBaseIndex = ((tileAttributeByte & 0x0f) << 2);
                                break;
                            case F18A.COLOR_MODE_ECM_3:
                                tileColor =
                                    ((patternByte & bit) >> (7 - bitShift)) |
                                    (((this.ram[patternAddr + 0x0800] & bit) >> (7 - bitShift)) << 1) |
                                    (((this.ram[patternAddr + 0x1000] & bit) >> (7 - bitShift)) << 2);
                                tilePaletteBaseIndex = ((tileAttributeByte & 0x0e) << 2);
                                break;
                        }
                        if (tileColor > 0 || !transparentColor0) {
                            color = tileColor;
                            paletteBaseIndex = tilePaletteBaseIndex;
                        }
                        break;
                    case F18A.MODE_BITMAP:
                        charNo = this.ram[nameTableAddr + (x1 >> 3) + rowOffset];
                        bitShift = x1 & 7;
                        bit = 0x80 >> bitShift;
                        var charSetOffset = (y & 0xC0) << 5;
                        patternByte = this.ram[this.charPatternTable + (((charNo << 3) + charSetOffset) & this.patternTableMask) + lineOffset];
                        var colorAddr = this.colorTable + (((charNo << 3) + charSetOffset) & this.colorTableMask) + lineOffset;
                        var colorByte = this.ram[colorAddr];
                        tileColor = (patternByte & bit) != 0 ? (colorByte & 0xF0) >> 4 : (colorByte & 0x0F);
                        if (tileColor > 0) {
                            color = tileColor;
                            paletteBaseIndex = this.tilePaletteSelect;
                        }
                        break;
                    case F18A.MODE_TEXT:
                    case F18A.MODE_TEXT_80:
                        if (x >= borderWidth && x < this.width - borderWidth) {
                            nameTableAddr += Math.floor(x1 / 6) + rowOffset;
                            charNo = this.ram[nameTableAddr];
                            bitShift = x1 % 6;
                            lineOffset1 = lineOffset;
                            if (this.tileColorMode != F18A.COLOR_MODE_NORMAL) {
                                tileAttributeByte = this.ram[this.colorTable + (this.ecmPositionAttributes ? nameTableAddr - nameTableCanonicalBase : charNo)];
                                tilePriority = (tileAttributeByte & 0x80) != 0;
                                if ((tileAttributeByte & 0x40) != 0) {
                                    // Flip X
                                    bitShift = 5 - bitShift;
                                }
                                if ((tileAttributeByte & 0x20) != 0) {
                                    // Flip y
                                    lineOffset1 = 7 - lineOffset1;
                                }
                                transparentColor0 = (tileAttributeByte & 0x10) != 0;
                            }
                            bit = 0x80 >> bitShift;
                            patternAddr = this.charPatternTable + (charNo << 3) + lineOffset1;
                            patternByte = this.ram[patternAddr];
                            switch (this.tileColorMode) {
                                case F18A.COLOR_MODE_NORMAL:
                                    if (this.unlocked && this.ecmPositionAttributes) {
                                        tileAttributeByte = this.ram[this.colorTable + nameTableAddr - nameTableCanonicalBase];
                                        tileColor = (patternByte & bit) != 0 ? tileAttributeByte >> 4 : tileAttributeByte & 0xF;
                                    }
                                    else {
                                        tileColor = (patternByte & bit) != 0 ? this.fgColor : this.bgColor;
                                    }
                                    tilePaletteBaseIndex = this.tilePaletteSelect;
                                    transparentColor0 = true;
                                    tilePriority = false;
                                    break;
                                case F18A.COLOR_MODE_ECM_1:
                                    tileColor = ((patternByte & bit) >> (7 - bitShift));
                                    tilePaletteBaseIndex = (this.tilePaletteSelect & 0x20) | ((tileAttributeByte & 0x0f) << 1);
                                    break;
                                case F18A.COLOR_MODE_ECM_2:
                                    tileColor =
                                        ((patternByte & bit) >> (7 - bitShift)) |
                                        (((this.ram[patternAddr + 0x0800] & bit) >> (7 - bitShift)) << 1);
                                    tilePaletteBaseIndex = ((tileAttributeByte & 0x0f) << 2);
                                    break;
                                case F18A.COLOR_MODE_ECM_3:
                                    tileColor =
                                        ((patternByte & bit) >> (7 - bitShift)) |
                                        (((this.ram[patternAddr + 0x0800] & bit) >> (7 - bitShift)) << 1) |
                                        (((this.ram[patternAddr + 0x1000] & bit) >> (7 - bitShift)) << 2);
                                    tilePaletteBaseIndex = ((tileAttributeByte & 0x0e) << 2);
                                    break;
                            }
                            if (tileColor > 0 || !transparentColor0) {
                                color = tileColor;
                                paletteBaseIndex = tilePaletteBaseIndex;
                            }
                        }
                        else {
                            color = this.bgColor;
                        }
                        break;
                    case F18A.MODE_MULTICOLOR:
                        charNo = this.ram[nameTableAddr + (x1 >> 3) + rowOffset];
                        colorByte = this.ram[this.charPatternTable + (charNo << 3) + ((y1 & 0x1c) >> 2)];
                        tileColor = (x1 & 4) == 0 ? (colorByte & 0xf0) >> 4 : (colorByte & 0x0f);
                        if (tileColor > 0) {
                            color = tileColor;
                            paletteBaseIndex = this.tilePaletteSelect;
                        }
                        break;
                }
            }
            // Bitmap layer
            if (this.bitmapEnable) {
                var bmpX = this.screenMode != F18A.MODE_TEXT_80 ? x : x >> 1;
                if (bmpX >= this.bitmapX && bmpX < bitmapX2 && y >= this.bitmapY && y < bitmapY2) {
                    var bitmapX1 = x - this.bitmapX;
                    var bitmapByte = this.ram[this.bitmapBaseAddr + ((bitmapX1 + bitmapOffset) >> 2)];
                    var bitmapBitShift,bitmapColor;
                    if (this.bitmapFat) {
                        // 16 color bitmap with fat pixels
                        bitmapBitShift = (2 - (bitmapX1 & 2)) << 1;
                        bitmapColor = (bitmapByte >> bitmapBitShift) & 0x0F;
                    }
                    else {
                        // 4 color bitmap
                        bitmapBitShift = (3 - (bitmapX1 & 3)) << 1;
                        bitmapColor = (bitmapByte >> bitmapBitShift) & 0x03;
                    }
                    if ((bitmapColor > 0 || !this.bitmapTransparent) && (color == this.bgColor || this.bitmapPriority)) {
                        color = bitmapColor;
                        paletteBaseIndex = this.bitmapPaletteSelect;
                    }
                }
            }
            // Sprite layer
            var spriteColor = null;
            if ((this.unlocked || (this.screenMode != F18A.MODE_TEXT && this.screenMode != F18A.MODE_TEXT_80)) && (!tilePriority || color == this.bgColor)) {
                var spritePaletteBaseIndex = 0;
                var dy = 0;
                for (var spr = 0; spr < this.sprites.length && (spriteColor == null || !this.collision); spr++) {
                    var sprite = this.sprites[spr];
                    dy = y - sprite.y;
                    if (dy >= 0 && dy < sprite.height) {
                        var dx = x - sprite.x;
                        if (dx >= 0 && dx < sprite.width) {
                            var sprColor = sprite.grid[dy][dx];
                            if (sprColor != 0) {
                                if (spriteColor) {
                                    this.collision = true;
                                }
                                else {
                                    spriteColor = sprColor;
                                    spritePaletteBaseIndex = sprite.paletteBaseIndex;
                                }
                            }
                        }
                    }
                }
                if (spriteColor) {
                    color = spriteColor;
                    paletteBaseIndex = spritePaletteBaseIndex;
                }
            }
            // Tile layer 2
            // The following is almost just a copy of the code from TL1, so this could be coded more elegantly
            if (this.tileLayer2Enabled) {
                var nameTableAddr2 = nameTableBaseAddr2;
                var x12 = x - borderWidth + (this.hScroll2 << (this.screenMode == F18A.MODE_TEXT_80 ? 1 : 0));
                if (x12 >= scrollWidth) {
                    x12 -= scrollWidth;
                    nameTableAddr2 ^= this.hPageSize2;
                }
                var charNo2, bitShift2, bit2, patternAddr2, patternByte2;
                var tileColor2, tilePriority2, tileAttributeByte2, transparentColor02;
                var tilePaletteBaseIndex2, lineOffset12;
                switch (this.screenMode) {
                    case F18A.MODE_GRAPHICS:
                        nameTableAddr2 += (x12 >> 3) + rowOffset2;
                        charNo2 = this.ram[nameTableAddr2];
                        bitShift2 = x12 & 7;
                        lineOffset12 = lineOffset2;
                        if (this.tileColorMode != F18A.COLOR_MODE_NORMAL) {
                            tileAttributeByte2 = this.ram[this.colorTable2 + (this.ecmPositionAttributes ? nameTableAddr2 - nameTableCanonicalBase2 : charNo2)];
                            tilePriority2 = (tileAttributeByte2 & 0x80) != 0;
                            if ((tileAttributeByte2 & 0x40) != 0) {
                                // Flip X
                                bitShift2 = 7 - bitShift2;
                            }
                            if ((tileAttributeByte2 & 0x20) != 0) {
                                // Flip y
                                lineOffset12 = 7 - lineOffset12;
                            }
                            transparentColor02 = (tileAttributeByte2 & 0x10) != 0;
                        }
                        bit2 = 0x80 >> bitShift2;
                        patternAddr2 = this.charPatternTable + (charNo2 << 3) + lineOffset12;
                        patternByte2 = this.ram[patternAddr2];
                        switch (this.tileColorMode) {
                            case F18A.COLOR_MODE_NORMAL:
                                var colorSet2 = this.ram[this.colorTable2 + (charNo2 >> 3)];
                                tileColor2 = (patternByte2 & bit2) != 0 ? (colorSet2 & 0xF0) >> 4 : colorSet2 & 0x0F;
                                tilePaletteBaseIndex2 = this.tilePaletteSelect2;
                                transparentColor02 = true;
                                tilePriority2 = false;
                                break;
                            case F18A.COLOR_MODE_ECM_1:
                                tileColor2 = ((patternByte2 & bit2) >> (7 - bitShift2));
                                tilePaletteBaseIndex2 = (this.tilePaletteSelect2 & 0x20) | ((tileAttributeByte2 & 0x0f) << 1);
                                break;
                            case F18A.COLOR_MODE_ECM_2:
                                tileColor2 =
                                    ((patternByte2 & bit2) >> (7 - bitShift2)) |
                                    (((this.ram[patternAddr2 + 0x0800] & bit2) >> (7 - bitShift2)) << 1);
                                tilePaletteBaseIndex2 = ((tileAttributeByte2 & 0x0f) << 2);
                                break;
                            case F18A.COLOR_MODE_ECM_3:
                                tileColor2 =
                                    ((patternByte2 & bit2) >> (7 - bitShift2)) |
                                    (((this.ram[patternAddr2 + 0x0800] & bit2) >> (7 - bitShift2)) << 1) |
                                    (((this.ram[patternAddr2 + 0x1000] & bit2) >> (7 - bitShift2)) << 2);
                                tilePaletteBaseIndex2 = ((tileAttributeByte2 & 0x0e) << 2);
                                break;
                        }
                        break;
                    case F18A.MODE_BITMAP:
                        charNo2 = this.ram[nameTableAddr2 + (x12 >> 3) + rowOffset2];
                        bitShift2 = x12 & 7;
                        bit2 = 0x80 >> bitShift2;
                        var charSetOffset2 = (y & 0xC0) << 5;
                        patternByte2 = this.ram[this.charPatternTable + (((charNo2 << 3) + charSetOffset2) & this.patternTableMask) + lineOffset2];
                        var colorAddr2 = this.colorTable2 + (((charNo2 << 3) + charSetOffset2) & this.colorTableMask) + lineOffset2;
                        var colorByte2 = this.ram[colorAddr2];
                        tileColor2 = (patternByte2 & bit2) != 0 ? (colorByte2 & 0xF0) >> 4 : (colorByte2 & 0x0F);
                        tilePaletteBaseIndex2 = this.tilePaletteSelect2;
                        transparentColor02 = true;
                        tilePriority2 = false;
                        break;
                    case F18A.MODE_TEXT:
                    case F18A.MODE_TEXT_80:
                        if (x >= borderWidth && x < this.width - borderWidth) {
                            nameTableAddr2 += Math.floor(x12 / 6) + rowOffset2;
                            charNo2 = this.ram[nameTableAddr2];
                            bitShift2 = x12 % 6;
                            lineOffset12 = lineOffset2;
                            if (this.tileColorMode != F18A.COLOR_MODE_NORMAL) {
                                tileAttributeByte2 = this.ram[this.colorTable2 + (this.ecmPositionAttributes ? nameTableAddr2 - nameTableCanonicalBase2 : charNo2)];
                                tilePriority2 = (tileAttributeByte2 & 0x80) != 0;
                                if ((tileAttributeByte2 & 0x40) != 0) {
                                    // Flip X
                                    bitShift2 = 5 - bitShift2;
                                }
                                if ((tileAttributeByte2 & 0x20) != 0) {
                                    // Flip y
                                    lineOffset12 = 7 - lineOffset12;
                                }
                                transparentColor02 = (tileAttributeByte2 & 0x10) != 0;
                            }
                            bit2 = 0x80 >> bitShift2;
                            patternAddr2 = this.charPatternTable + (charNo2 << 3) + lineOffset12;
                            patternByte2 = this.ram[patternAddr2];
                            switch (this.tileColorMode) {
                                case F18A.COLOR_MODE_NORMAL:
                                    if (this.unlocked && this.ecmPositionAttributes) {
                                        tileAttributeByte2 = this.ram[this.colorTable2 + nameTableAddr2 - nameTableCanonicalBase2];
                                        tileColor2 = (patternByte2 & bit2) != 0 ? tileAttributeByte2 >> 4 : tileAttributeByte2 & 0xF;
                                    }
                                    else {
                                        tileColor2 = (patternByte2 & bit2) != 0 ? this.fgColor : this.bgColor;
                                    }
                                    tilePaletteBaseIndex2 = this.tilePaletteSelect2;
                                    transparentColor02 = true;
                                    tilePriority2 = false;
                                    break;
                                case F18A.COLOR_MODE_ECM_1:
                                    tileColor2 = ((patternByte2 & bit2) >> (7 - bitShift2));
                                    tilePaletteBaseIndex2 = (this.tilePaletteSelect2 & 0x20) | ((tileAttributeByte2 & 0x0f) << 1);
                                    break;
                                case F18A.COLOR_MODE_ECM_2:
                                    tileColor2 =
                                        ((patternByte2 & bit2) >> (7 - bitShift2)) |
                                        (((this.ram[patternAddr2 + 0x0800] & bit2) >> (7 - bitShift2)) << 1);
                                    tilePaletteBaseIndex2 = ((tileAttributeByte2 & 0x0f) << 2);
                                    break;
                                case F18A.COLOR_MODE_ECM_3:
                                    tileColor2 =
                                        ((patternByte2 & bit2) >> (7 - bitShift2)) |
                                        (((this.ram[patternAddr2 + 0x0800] & bit2) >> (7 - bitShift2)) << 1) |
                                        (((this.ram[patternAddr2 + 0x1000] & bit2) >> (7 - bitShift2)) << 2);
                                    tilePaletteBaseIndex2 = ((tileAttributeByte2 & 0x0e) << 2);
                                    break;
                            }
                        }
                        else {
                            tileColor2 = 0;
                            transparentColor02 = true;
                            tilePriority2 = false;
                        }
                        break;
                    case F18A.MODE_MULTICOLOR:
                        charNo2 = this.ram[nameTableAddr2 + (x12 >> 3) + rowOffset2];
                        colorByte2 = this.ram[this.charPatternTable + (charNo2 << 3) + ((y12 & 0x1c) >> 2)];
                        tileColor2 = (x12 & 4) == 0 ? (colorByte2 & 0xf0) >> 4 : (colorByte2 & 0x0f);
                        tilePaletteBaseIndex2 = this.tilePaletteSelect2;
                        transparentColor02 = true;
                        tilePriority2 = false;
                        break;
                }
                if ((tileColor2 > 0 || !transparentColor02) && (this.tileMap2AlwaysOnTop || tilePriority2 || spriteColor == null)) {
                    color = tileColor2;
                    paletteBaseIndex = tilePaletteBaseIndex2;
                }
            }
            // Draw pixel
            var rgbColor = this.palette[color + paletteBaseIndex];
            this.imagedataData[this.imagedataAddr++] = rgbColor[0];
            this.imagedataData[this.imagedataAddr++] = rgbColor[1];
            this.imagedataData[this.imagedataAddr++] = rgbColor[2];
            this.imagedataAddr++;
        }
        if (this.scanLines && (y & 1) != 0) {
            // Dim last scan line
            imagedataAddr2 = this.imagedataAddr - (this.width << 2);
            for (x = 0; x < this.width; x++) {
                this.imagedataData[imagedataAddr2++] *= 0.75;
                this.imagedataData[imagedataAddr2++] *= 0.75;
                this.imagedataData[imagedataAddr2++] *= 0.75;
                imagedataAddr2++;
            }
        }
    },

    writeAddress: function (i) {
        if (!this.latch) {
            this.latchByte = i;
            this.latch = !this.latch;
        }
        else {
            var cmd = (i & 0xc0) >> 6;
            var msb = i & 0x3f;
            switch (cmd) {
                // Set read address
                case 0:
                    this.addressRegister = (msb << 8) + this.latchByte;
                    this.prefetchByte = this.ram[this.addressRegister];
                    this.addressRegister += this.addressIncrement;
                    this.addressRegister &= 0x3FFF;
                    this.registers[15] = this.registers[msb];
                    break;
                // Set write address
                case 1:
                    this.addressRegister = (msb << 8) + this.latchByte;
                    break;
                // Write register
                case 2:
                    var reg = msb;
                    if (this.unlocked || reg < 8 || reg == 57) {
                        this.writeRegister(reg, this.latchByte);
                    }
                    else {
                        this.log.info("Write " + this.latchByte.toHexByte() + " to F18A register " + reg + " (" + reg.toHexByte() + ") without unlocking.");
                    }
                    break;
            }
            this.latch = !this.latch;
        }
    },

    writeRegister: function(reg, value) {
        var oldValue = this.registers[reg];
        this.registers[reg] = value;
        switch (reg) {
            // Mode
            case 0:
                this.updateMode(this.registers[0], this.registers[1]);
                break;
            case 1:
                this.displayOn = (this.registers[1] & 0x40) != 0;
                this.interruptsOn = (this.registers[1] & 0x20) != 0;
                this.spriteSize = (this.registers[1] & 0x02) >> 1;
                this.spriteMag = this.registers[1] & 0x01;
                this.updateMode(this.registers[0], this.registers[1]);
                break;
            // Name table
            case 2:
                this.nameTable = (this.registers[2] & (this.screenMode != F18A.MODE_TEXT_80 || this.unlocked ? 0xf : 0xc)) << 10;
                break;
            // Color table
            case 3:
                if (this.screenMode == F18A.MODE_BITMAP) {
                    this.colorTable = (this.registers[3] & 0x80) << 6;
                }
                else {
                    this.colorTable = this.registers[3] << 6;
                }
                this.updateTableMasks();
                break;
            // Pattern table
            case 4:
                if (this.screenMode == F18A.MODE_BITMAP) {
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
            // Name table 2 base address
            case 10:
                this.nameTable2 = (this.registers[10] & 0x0f) << 10;
                break;
            // Color Table 2 Base Address, 64-byte boundaries
            case 11:
                this.colorTable2 = this.registers[11] << 6;
                break;
            // Status register select
            case 15:
                this.statusRegisterNo = this.registers[15] & 0x0f;
                this.log.info("F18A status register " + this.statusRegisterNo + " selected.");
                break;
            // Horz interrupt scan line, 0 to disable
            case 19:
                this.interruptScanline = this.registers[19];
                this.log.info("F18A interrupt scanline set to " + this.interruptScanline.toHexByte() + " (not implemented)");
                break;
            // Palette select
            case 24:
                this.spritePaletteSelect = this.registers[24] & 0x30;
                this.tilePaletteSelect = (this.registers[24] & 0x03) << 4; // Shift into position
                this.tilePaletteSelect2 = (this.registers[24] & 0x0C) << 2; // Shift into position
                break;
            // Horizontal scroll offset 2
            case 25:
                this.hScroll2 = this.registers[25];
                break;
            // Vertical scroll offset 2
            case 26:
                this.vScroll2 = this.registers[26];
                break;
            // Horizontal scroll offset 1
            case 27:
                this.log.debug("Horizontal scroll offset 1: " + this.registers[27].toHexByte());
                this.hScroll1 = this.registers[27];
                break;
            // Vertical scroll offset 1
            case 28:
                this.log.debug("Vertical scroll offset 1: " + this.registers[28].toHexByte());
                this.vScroll1 = this.registers[28];
                break;
            // Page size
            case 29:
                this.hPageSize1 = (this.registers[29] & 0x02) << 9;
                this.vPageSize1 = (this.registers[29] & 0x01) << 11;
                this.hPageSize2 = (this.registers[29] & 0x20) << 5;
                this.vPageSize2 = (this.registers[29] & 0x10) << 7;
                break;
            // Max displayable sprites on a scanline
            // Setting this to 0 restores the jumper value (4 or 32). Here assumed to be 32.
            // Setting this to 31 means all 32 sprites can be displayed.
            // You cannot choose to have 31 displayable sprites on a scanline.
            case 30:
                if (this.registers[30] == 0) {
                    this.registers[30] = F18A.MAX_SCANLINE_SPRITES_JUMPER ? 31 : 4;
                }
                this.maxScanlineSprites = this.registers[30];
                if (this.maxScanlineSprites == 31) {
                    this.maxScanlineSprites = 32;
                }
                break;
            // Bitmap control
            case 31:
                this.bitmapEnable = (this.registers[31] & 0x80) != 0;
                this.bitmapPriority = (this.registers[31] & 0x40) != 0;
                this.bitmapTransparent = (this.registers[31] & 0x20) != 0;
                this.bitmapFat = (this.registers[31] & 0x10) != 0;
                this.bitmapPaletteSelect = (this.registers[31] & (this.bitmapFat ? 0x0C : 0x0F)) << 2; // Shift into position
                break;
            // Bitmap base address
            case 32:
                this.bitmapBaseAddr = this.registers[32] << 6;
                this.log.info("Bitmap layer base set to " + this.bitmapBaseAddr.toHexWord());
                break;
            // Bitmap x
            case 33:
                this.bitmapX = this.registers[33];
                this.log.debug("Bitmap X set to " + this.bitmapX.toHexWord());
                break;
            // Bitmap y
            case 34:
                this.bitmapY = this.registers[34];
                this.log.debug("Bitmap Y set to " + this.bitmapY.toHexWord());
                break;
            // Bitmap width
            case 35:
                this.bitmapWidth = this.registers[35];
                if (this.bitmapWidth == 0) {
                    this.bitmapWidth = 256;
                }
                this.log.debug("Bitmap width set to " + this.bitmapWidth.toHexWord());
                break;
            // Bitmap height
            case 36:
                this.bitmapHeight = this.registers[36];
                this.log.debug("Bitmap height set to " + this.bitmapHeight.toHexWord());
                break;
            // Palette control
            case 47:
                this.dataPortMode = (this.registers[47] & 0x80) != 0;
                this.autoIncPaletteReg = (this.registers[47] & 0x40) != 0;
                this.paletteRegisterNo = this.registers[47] & 0x3f;
                this.paletteRegisterData = -1;
                if (this.dataPortMode) {
                    this.log.info("F18A Data port mode on.");
                }
                else {
                    this.log.info("F18A Data port mode off.");
                }
                break;
            // SIGNED two's-complement increment amount for VRAM address, defaults to 1
            case 48:
                this.addressIncrement = this.registers[48] < 128 ? this.registers[48] : this.registers[48] - 256;
                break;
            // Enhanced color mode
            case 49:
                this.tileLayer2Enabled = (this.registers[49] & 0x80) != 0;
                var oldRow30 = this.row30Enabled;
                this.row30Enabled = (this.registers[49] & 0x40) != 0;
                if (oldRow30 != this.row30Enabled) {
                    this.setDimensions();
                    this.log.info("30 rows mode " + (this.row30Enabled ? "enabled" : "disabled") + ".");
                }
                this.tileColorMode = (this.registers[49] & 0x30) >> 4;
                this.log.info("F18A Enhanced Color Mode " + this.tileColorMode + " selected for tiles.");
                this.realSpriteYCoord = (this.registers[49] & 0x08) != 0;
                // this.log.info("Real Y coord: " + this.realSpriteYCoord);
                this.spriteLinkingEnabled = (this.registers[49] & 0x04) != 0;
                this.spriteColorMode = this.registers[49] & 0x03;
                this.log.info("F18A Enhanced Color Mode " + this.spriteColorMode + " selected for sprites.");
                break;
            // Position vs name attributes, TL2 always on top
            case 50:
                // Write 1 to reset all VDP registers
                if ((this.registers[50] & 0x80) != 0) {
                    this.resetRegs();
                    this.unlocked = false;
                    return;
                }
                this.gpuHsyncTrigger = (this.registers[50] & 0x40) != 0;
                if (this.gpuHsyncTrigger != 0) {
                    this.log.info("F18A Hsync trigger set");
                }
                this.gpuVsyncTrigger = (this.registers[50] & 0x20) != 0;
                if (this.gpuVsyncTrigger != 0) {
                    this.log.info("F18A Vsync trigger set");
                }
                // 0 = normal, 1 = disable GM1, GM2, MCM, T40, T80
                this.tileLayer1Enabled = (this.registers[50] & 0x10) == 0;
                // Report sprite max vs 5th sprite
                this.reportMax = (this.registers[50] & 0x08) != 0;
                // Draw scan lines
                this.scanLines = (this.registers[50] & 0x04) != 0;
                // 0 = per name attributes in ECMs, 1 = per position attributes
                this.ecmPositionAttributes = (this.registers[50] & 0x02) != 0;
                // 0 = TL2 always on top, 1 = TL2 vs sprite priority is considered
                this.tileMap2AlwaysOnTop = (this.registers[50] & 0x01) == 0;
                break;
            // Stop Sprite (zero based) to limit the total number of sprites to process.
            // Defaults to 32, i.e. no stop sprite
            case 51:
                this.maxSprites = this.registers[51] & 0x3F;
                this.log.info("Max sprites set to " + this.maxSprites);
                break;
            // GPU address MSB
            case 54:
                this.gpuAddressLatch = true;
                break;
            // GPU address LSB
            case 55:
                if (this.gpuAddressLatch) {
                    this.gpuAddressLatch = false;
                    this.gpu.reset();
                    this.runGPU(this.registers[54] << 8 | this.registers[55]);
                }
                break;
            case 56:
                if ((this.registers[56] & 1) != 0) {
                    this.runGPU(this.gpu.getPC());
                }
                else {
                    this.gpu.setIdle(true);
                    this.log.info("F18A GPU stopped.");
                }
                break;
            case 57:
                if (!this.unlocked) {
                    if ((oldValue & 0x1c) == 0x1c && (this.registers[57] & 0x1c) == 0x1c) {
                        this.unlocked = true;
                        this.log.info("F18A unlocked");
                    }
                }
                else {
                    this.registers[57] = 0;
                    this.unlocked = false;
                    this.log.info("F18A locked");
                }
                break;
            case 58:
                var gromClock = this.registers[58] & 0x0F;
                if (gromClock < 7) {
                    gromClock = 6;
                }
                gromClock = (gromClock << 4) | 0x0F;
                this.tms9919.setGROMClock(gromClock);
                break;
            default:
                this.log.info("Write " + this.registers[reg].toHexByte() + " to F18A register " + reg + " (" + reg.toHexByte() + ").");
                break;
        }
        if (oldValue != value) {
            this.redrawRequired = true;
        }

    },

    readRegister: function(reg) {
        return this.registers[reg];
    },

    runGPU: function(gpuAddress) {
        this.log.info("F18A GPU triggered at " + gpuAddress.toHexWord());
        this.gpu.setPC(gpuAddress); // Set the PC, which also triggers the GPU
        if (this.gpu.atBreakpoint()) {
            this.log.info("Breakpoint ignored.");
            while (this.gpu.atBreakpoint() && !this.gpu.isIdle()) {
                this.gpu.resume();
            }
        }
        if (this.gpu.isIdle()) {
            this.log.info("F18A GPU idle.");
        }
    },

    updateMode: function(reg0, reg1) {
        var oldMode = this.screenMode;
        // Check bitmap mode bit, not text or multicolor
        if ((reg0 & 0x2) != 0 && (reg1 & 0x18) == 0) {
            // Bitmap mode
            this.screenMode = F18A.MODE_BITMAP;
            this.log.debug("Bitmap mode selected");
        } else {
            switch ((reg1 & 0x18) >> 3) {
                case 0:
                    // Graphics mode 0
                    this.screenMode = F18A.MODE_GRAPHICS;
                    // this.log.info("Graphics I mode selected");
                    break;
                case 1:
                    // Multicolor mode
                    this.screenMode = F18A.MODE_MULTICOLOR;
                    this.log.info("Multicolor mode selected");
                    break;
                case 2:
                    // Text mode
                    if ((reg0 & 0x4) == 0) {
                        this.screenMode = F18A.MODE_TEXT;
                        this.log.info("Text mode selected");
                    }
                    else {
                        this.screenMode = F18A.MODE_TEXT_80;
                        this.log.info("Text 80 mode selected");
                    }
                    break;
            }
        }
        if (this.screenMode == F18A.MODE_BITMAP) {
            this.colorTable = (this.registers[3] & 0x80) << 6;
            this.charPatternTable = (this.registers[4] & 0x4) << 11;
            this.updateTableMasks();
        } else {
            this.colorTable = this.registers[3] << 6;
            this.charPatternTable = (this.registers[4] & 0x7) << 11;
        }
        this.nameTable = (this.registers[2] & (this.screenMode != F18A.MODE_TEXT_80 ? 0xf: 0xc)) << 10;
        this.spriteAttributeTable = (this.registers[5] & 0x7f) << 7;
        this.spritePatternTable = (this.registers[6] & 0x7) << 11;
        if (oldMode != this.screenMode) {
            this.setDimensions();
        }
    },

    updateTableMasks: function() {
        if (this.screenMode == F18A.MODE_BITMAP) {
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

    writeData: function(b) {
        if (!this.dataPortMode) {
            var oldValue = this.ram[this.addressRegister];
            this.ram[this.addressRegister] = b;
            this.addressRegister += this.addressIncrement;
            this.addressRegister &= 0x3FFF;
            if (oldValue != b) {
                this.redrawRequired = true;
            }

        }
        else {
            // Write data to F18A palette registers
            if (this.paletteRegisterData == -1) {
                // Read first byte
                this.paletteRegisterData = b;
            }
            else {
                // Read second byte
                this.palette[this.paletteRegisterNo][0] = this.paletteRegisterData * 17;
                this.palette[this.paletteRegisterNo][1] = ((b & 0xf0) >> 4) * 17;
                this.palette[this.paletteRegisterNo][2] = (b & 0x0f) * 17;
                if (this.paletteRegisterNo == this.bgColor) {
                    this.redrawBorder = true;
                }
                // this.log.info("F18A palette register " + this.paletteRegisterNo.toHexByte() + " set to " + (this.paletteRegisterData << 8 | b).toHexWord());
                if (this.autoIncPaletteReg) {
                    this.paletteRegisterNo++;
                }
                // The F18A turns off DPM after each register is written if auto increment is off
                // or after writing to last register if auto increment in on
                if (!this.autoIncPaletteReg || this.paletteRegisterNo == 64) {
                    this.dataPortMode = false;
                    this.paletteRegisterNo = 0;
                    this.log.info("F18A Data port mode off (auto).");
                }
                this.paletteRegisterData = -1;
            }
            this.redrawRequired = true;
        }
    },

    readStatus: function() {
        switch (this.statusRegisterNo) {
            case 0:
                // Normal status
                var i = this.statusRegister;
                this.statusRegister = 0;
                this.cru.writeBit(2, true);
                return i;
            case 1:
                // ID
                return 0xe0;
            case 2:
                // GPU status
                return (this.gpu.isIdle() ? 0 : 0x80) | this.ram[0xB000];
            case 3:
                // Current scanline
                return this.getCurrentScanline();
            case 14:
                // Version
                return F18A.VERSION;
            case 15:
                // Status register number
                return this.registers[15];
        }
    },

    readData: function() {
        var i = this.prefetchByte;
        this.prefetchByte = this.ram[this.addressRegister++];
        this.addressRegister &= 0x3FFF;
        return i;
    },

    getRAM: function() {
        return this.ram;
    },

    getCurrentScanline: function() {
        if (this.currentScanline != null) {
            return this.currentScanline;
        }
        else {
            if (window.performance) {
                var now = window.performance.now();
                if ((now - this.lastTime) > 0.04) {
                    this.fakeScanline++;
                    this.lastTime = now;
                }
            }
            else {
                this.fakeScanline++;
            }
            if (this.fakeScanline == 240) {
                this.fakeScanline = 0;
            }
            return this.fakeScanline;
        }
    },

    colorTableSize: function() {
        if (this.screenMode == F18A.MODE_BITMAP) {
            return Math.min(this.patternTableMask + 1, 0x1800);
        }
        else {
            return 0x20;
        }
    },

    patternTableSize: function() {
        if (this.screenMode == F18A.MODE_BITMAP) {
            return Math.min(this.colorTableMask + 1, 0x1800);
        }
        else {
            return 0x800;
        }
    },

    getRegsString: function() {
        var s = "";
        for (var i = 0; i < 8; i++) {
            s += "VR" + i + ":" + this.registers[i].toHexByte() + " ";
        }
        s += "\nSIT:" + this.nameTable.toHexWord() + " PDT:" + this.charPatternTable.toHexWord() + " (" + this.patternTableSize().toHexWord() + ")" +
            " CT:" + this.colorTable.toHexWord() + " (" + this.colorTableSize().toHexWord() + ") SDT:" + this.spritePatternTable.toHexWord() +
            " SAL:" + this.spriteAttributeTable.toHexWord();
        return s;
    },

    hexView: function(start, length, anchorAddr) {
        var text = "";
        var anchorLine = null;
        var addr = start;
        var line = 0;
        for (var i = 0; i < length && addr < 0x4800; addr++, i++) {
            if ((i & 0x000F) == 0) {
                text += "\n" + addr.toHexWord() + ":";
                line++;
            }
            text += " ";
            if (anchorAddr && anchorAddr == addr) {
                anchorLine = line;
            }
            var hex = this.ram[addr].toString(16).toUpperCase();
            if (hex.length == 1) {
                text += "0";
            }
            text += hex;
        }
        return {text: text.substr(1), anchorLine: anchorLine - 1};
    },

    getWord: function(addr) {
        return addr < 0x4800 ? this.ram[addr] << 8 | this.ram[addr+1] : 0;
    },

    getCharAt: function(x, y) {
        if (this.screenMode == F18A.MODE_TEXT_80) {
            x *= 2;
        }
        x -= this.leftBorder;
        y -= this.topBorder / (this.screenMode == F18A.MODE_TEXT_80 ? 2 : 1);
        if (x < this.width && y < this.height) {
            switch (this.screenMode) {
                case F18A.MODE_GRAPHICS:
                case F18A.MODE_BITMAP:
                    return this.ram[this.nameTable + Math.floor(x / 8) + Math.floor(y / 8) * 32];
                case F18A.MODE_TEXT:
                    return this.ram[this.nameTable + Math.floor((x - 8) / 6) + Math.floor(y / 8) * 40];
                case F18A.MODE_TEXT_80:
                    return this.ram[this.nameTable + Math.floor((x - 16) / 6) + Math.floor(y / 8) * 80];
            }
        }
        return 0;
    }
};