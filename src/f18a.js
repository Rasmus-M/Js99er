/*
 * js99'er - TI-99/4A emulator written in JavaScript
 *
 * Created 2014 by Rasmus Moustgaard <rasmus.moustgaard@gmail.com>
 *
 * F18A VDP emulation.
 *
 */

'use strict';

F18A.MODE_GRAPHICS = 0;
F18A.MODE_TEXT = 1;
F18A.MODE_BITMAP = 2;
F18A.MODE_MULTICOLOR = 3;
F18A.MODE_TEXT_80 = 4;

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

    this.ram = new Uint8Array(0x4820); // 16K VDP RAM
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
	this.spriteSize = null;
	this.spriteMag = null;

    this.tileColorMode = null;
    this.tilePaletteSelect = null;
    this.spriteColorMode = null;
    this.spritePaletteSelect = null;
    this.realSpriteYCoord = null;
    this.nameTable2 = null;
    this.tileMap2Enabled = null;
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
    this.bitmapPaletteSelect = null;
    this.bitmapBaseAddr = null;
    this.bitmapX = null;
    this.bitmapY = null;
    this.bitmapWidth = null;
    this.bitmapHeight = null;
    this.interruptScanline = null;
    this.maxSprites = null;

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
    this.currentScanline = null;
    this.frameCounter = null;
    this.interlaced = null;

    this.gpu = new F18AGPU(this);
    this.gpuPaused = null;

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

        this.displayOn = true;
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

        this.tileColorMode = F18A.COLOR_MODE_NORMAL;
        this.tilePaletteSelect = 0;
        this.spriteColorMode = F18A.COLOR_MODE_NORMAL;
        this.spritePaletteSelect = 0;
        this.realSpriteYCoord = false;
        this.nameTable2 = 0;
        this.tileMap2Enabled = false;
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
        this.bitmapPriority = true;
        this.bitmapTransparent = false;
        this.bitmapPaletteSelect = 0;
        this.bitmapBaseAddr = 0;
        this.bitmapX = 0;
        this.bitmapY = 0;
        this.bitmapWidth = 0;
        this.bitmapHeight = 0;
        this.interruptScanline = 0;
        this.maxSprites = 32;

        this.sprites = [];
        this.collision = false;

        this.redrawRequired = true;
        this.redrawBorder = false;

        this.setDimensions();
        this.imagedataAddr = 0;
        this.currentScanline = 0;
        this.frameCounter = 0;
        this.interlaced = false;

        this.gpu.reset();
        this.gpuPaused = false;
    },

    setDimensions: function() {
        this.canvas.width = this.screenMode == F18A.MODE_TEXT_80 ? 608 : 304;
        this.canvas.height = this.screenMode == F18A.MODE_TEXT_80 ? 480 : 240;
        this.width = this.screenMode == F18A.MODE_TEXT_80 ? 512 : 256;
        this.height = this.screenMode == F18A.MODE_TEXT_80 ? (this.row30Enabled ? 480 : 384) :(this.row30Enabled ? 240 : 192);
        this.leftBorder = Math.floor((this.canvas.width - this.width) >> 1);
        this.topBorder = Math.floor((this.canvas.height - this.height) >> 1);
        this.fillCanvas(this.bgColor);
        this.imagedata = this.canvasContext.getImageData(this.leftBorder, this.topBorder, this.width, this.height);
        this.imagedataData = this.imagedata.data;
    },

    drawFrame: function() {
        // this.log.info("Draw frame");
        if (this.redrawRequired || this.interlaced) {
            // this.log.info("Redraw " + this.frameCounter);
            if (this.displayOn) {
                if (this.redrawBorder) {
                    // this.log.info("Redraw border");
                    this.fillCanvas(this.bgColor);
                    this.redrawBorder = false;
                }
                if (this.screenMode != F18A.MODE_TEXT && this.screenMode != F18A.MODE_TEXT_80) {
                    this.prepareSprites();
                }
                this.collision = false;
                // Draw scanlines
                var y;
                if (!this.interlaced) {
                    this.imagedataAddr = 0;
                    for (y = 0; y < this.height; y++) {
                        this.drawScanLine(y);
                    }
                }
                else {
                    this.imagedataAddr = (this.frameCounter & 1) << 10;
                    for (y = this.frameCounter & 1; y < this.height; y += 2) {
                        this.drawScanLine(y);
                        this.imagedataAddr += this.width << 2;
                    }
                }
                this.canvasContext.putImageData(this.imagedata, this.leftBorder, this.topBorder);
            }
            else {
                this.fillCanvas(this.bgColor);
            }
            this.redrawRequired = false;
        }
        this.statusRegister = 0x80;
        this.cru.writeBit(2, false);
        if (this.collision) {
            this.statusRegister |= 0x20;
        }
        this.frameCounter++;
    },

    fillCanvas: function(color) {
        this.canvasContext.fillStyle = 'rgba(' + this.palette[color].join(',') + ',1.0)';
        this.canvasContext.fillRect(0, 0, this.canvas.width, this.canvas.height);
    },

    prepareSprites: function() {
        this.sprites = [];
        var grids = {};
        var stopByte = this.row30Enabled ? 0xF8 : 0xD0;
        var outOfScreenY = this.row30Enabled ? 0xF0 : 0xC0;
        var negativeScreenY = this.row30Enabled ? 0xF0 : 0xD0;
        for (var spriteAttrAddr = this.spriteAttributeTable; this.ram[spriteAttrAddr] != stopByte && spriteAttrAddr < this.spriteAttributeTable + 0x80; spriteAttrAddr += 4) {
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
                var spriteSize = this.spriteColorMode == F18A.COLOR_MODE_NORMAL || (spriteAttr & 0x10) == 0 ? this.spriteSize : 1;
                var patternNo = (this.ram[spriteAttrAddr + 2] & (spriteSize != 0 ? 0xFC : 0xFF));
                var key = ((spriteAttr & 0x7F) << 8) | patternNo;
                var empty = true;
                var grid = grids[key];
                if (grid == null) {
                    grid = [];
                    var spriteFlipY = this.spriteColorMode != F18A.COLOR_MODE_NORMAL && (spriteAttr & 0x20) != 0;
                    var spriteFlipX = this.spriteColorMode != F18A.COLOR_MODE_NORMAL && (spriteAttr & 0x40) != 0;
                    var spriteMag = this.spriteMag;
                    var spriteWidth = 8 << spriteSize;
                    var spriteDimension = spriteWidth << spriteMag;
                    var baseColor = spriteAttr & 0x0F;
                    var patternAddr = this.spritePatternTable + (patternNo << 3);
                    for (var y = 0; y < spriteDimension; y++) {
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
                                    row[spriteDimension - (x + spriteBitShift1) - 1] = sprColor;
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
                            grid[spriteDimension - y - 1] = row;
                        }
                        else {
                            grid[y] = row;
                        }
                    }
                    if (spriteMag) {
                        for (y = 0; y < spriteDimension; y++) {
                            row = grid[y];
                            for (x = spriteDimension - 1; x >= 0; x--) {
                                row[x] = row[x >> 1];
                            }
                        }
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
                        width: spriteDimension,
                        height: spriteDimension,
                        grid: grid,
                        paletteBaseIndex : sprPaletteBaseIndex
                    });
                }

            }
        }
        // this.sprites.sort(function(s1, s2) {return s1.y - s2.y});
    },

    drawScanLine: function(y) {
        if (this.screenMode == F18A.MODE_TEXT_80) {
            y >>= 1; // Double scan lines in 80 column mode
        }
        var nameTableBaseAddr = this.nameTable;
        var y1 = y + this.vScroll1;
        if (y1 >= this.height) {
            y1 -= this.height;
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
        var rowOffset2, nameTable2BaseAddr, lineOffset2;
        if (this.screenMode == F18A.MODE_GRAPHICS && this.tileMap2Enabled) {
            nameTable2BaseAddr = this.nameTable2;
            var y12 = y + this.vScroll2;
            if (y12 >= this.height) {
                y12 -= this.height;
                nameTable2BaseAddr ^= this.vPageSize2;
            }
            rowOffset2 = (y12 >> 3) << 5;
            lineOffset2 = y12 & 7;
        }
        for (var x = 0; x < this.width; x++) {
            var color = this.bgColor;
            var paletteBaseIndex = 0;
            // Tile layer 1
            var nameTableAddr = nameTableBaseAddr;
            var x1 = x + this.hScroll1;
            if (x1 >= this.width) {
                x1 -= this.width;
                nameTableAddr ^= this.hPageSize1;
            }
            var charNo;
            var bitShift;
            var bit;
            var patternAddr;
            var patternByte;
            var tileColor;
            var tilePriority;
            switch (this.screenMode) {
                case F18A.MODE_GRAPHICS:
                    charNo = this.ram[nameTableAddr + (x1 >> 3) + rowOffset];
                    bitShift = x1 & 7;
                    var tileAttributeByte;
                    var transparentColor0;
                    var tilePaletteBaseIndex;
                    var lineOffset1 = lineOffset;
                    if (this.tileColorMode != F18A.COLOR_MODE_NORMAL) {
                        tileAttributeByte = this.ram[this.colorTable + charNo];
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
                    if (x >= 8 && x < (256 - 8)) {
                        x1 -= 8;
                        charNo = this.ram[nameTableAddr + Math.floor(x1 / 6) + rowOffset];
                        bitShift = x1 % 6;
                        bit = 0x80 >> bitShift;
                        patternByte = this.ram[this.charPatternTable + (charNo << 3) + lineOffset];
                        color = (patternByte & bit) != 0 ? this.fgColor : this.bgColor;
                    }
                    else {
                        color = this.bgColor;
                    }
                    break;
                case F18A.MODE_TEXT_80:
                    if (x >= 16 && x < (512 - 16)) {
                        x1 -= 16;
                        charNo = this.ram[nameTableAddr + Math.floor(x1 / 6) + rowOffset];
                        bitShift = x1 % 6;
                        bit = 0x80 >> bitShift;
                        patternByte = this.ram[this.charPatternTable + (charNo << 3) + lineOffset];
                        color = (patternByte & bit) != 0 ? this.fgColor : this.bgColor;
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
            // Bitmap layer
            if (this.bitmapEnable) {
                if (x >= this.bitmapX && x < this.bitmapX + this.bitmapWidth && y >= this.bitmapY && y < this.bitmapY + this.bitmapHeight) {
                    var bitmapX1 = x - this.bitmapX;
                    var bitmapY1 = y - this.bitmapY;
                    var bitmapByte = this.ram[this.bitmapBaseAddr + ((bitmapX1 + bitmapY1 * this.bitmapWidth) >> 2)];
                    var bitmapBitShift = (bitmapX1 & 3) << 1;
                    var bitmapColor = (bitmapByte & (0xC0 >> bitmapBitShift)) >> (6 - bitmapBitShift);
                    if ((bitmapColor > 0 || !this.bitmapTransparent) && (color == this.bgColor || this.bitmapPriority)) {
                        color = bitmapColor;
                        paletteBaseIndex = this.bitmapPaletteSelect;
                    }
                }
            }
            // Sprite layer
            var spriteColor = null;
            if (this.screenMode != F18A.MODE_TEXT && this.screenMode != F18A.MODE_TEXT_80 && (!tilePriority || color == this.bgColor)) {
                var spritePaletteBaseIndex = 0;
                var dy = 0;
                for (var spr = 0; spr < this.sprites.length && (spriteColor == null || !this.collision); spr++) { // && dy >= 0
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
            if (this.screenMode == F18A.MODE_GRAPHICS && this.tileMap2Enabled) {
                var nameTable2Addr = nameTable2BaseAddr;
                var x12 = x + this.hScroll2;
                if (x12 >= this.width) {
                    x12 -= this.width;
                    nameTable2Addr ^= this.hPageSize2;
                }
                var charNo2 = this.ram[nameTable2Addr + (x12 >> 3) + rowOffset2];
                var bitShift2 = x12 & 7;
                var tileColor2;
                var tileAttributeByte2;
                var tilePriority2;
                var transparentColor02;
                var tilePaletteBaseIndex2;
                var lineOffset3 = lineOffset2;
                if (this.tileColorMode != F18A.COLOR_MODE_NORMAL) {
                    tileAttributeByte2 = this.ram[this.colorTable + charNo2];
                    tilePriority2 = (tileAttributeByte2 & 0x80) != 0;
                    if ((tileAttributeByte2 & 0x40) != 0) {
                        // Flip X
                        bitShift2 = 7 - bitShift2;
                    }
                    if ((tileAttributeByte2 & 0x20) != 0) {
                        // Flip y
                        lineOffset3 = 7 - lineOffset3;
                    }
                    transparentColor02 = (tileAttributeByte2 & 0x10) != 0;
                }
                var bit2 = 0x80 >> bitShift2;
                var patternAddr2 = this.charPatternTable + (charNo2 << 3) + lineOffset3;
                var patternByte2 = this.ram[patternAddr2];
                switch (this.tileColorMode) {
                    case F18A.COLOR_MODE_NORMAL:
                        var colorSet2 = this.ram[this.colorTable + (charNo2 >> 3)];
                        tileColor2 = (patternByte2 & bit2) != 0 ? (colorSet2 & 0xF0) >> 4 : colorSet2 & 0x0F;
                        tilePaletteBaseIndex2 = this.tilePaletteSelect;
                        transparentColor02 = true;
                        break;
                    case F18A.COLOR_MODE_ECM_1:
                        tileColor2 = ((patternByte2 & bit2) >> (7 - bitShift2));
                        tilePaletteBaseIndex2 = (this.tilePaletteSelect & 0x20) | ((tileAttributeByte2 & 0x0f) << 1);
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
                // TODO: priority
                if ((tileColor2 > 0 || !transparentColor02) && (tilePriority2 || spriteColor == null)) {
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
    },

    writeAddress: function (i) {
        if (!this.latch) {
            this.latchByte = i;
            this.latch = !this.latch;
        }
        else {
            switch ((i & 0xc0) >> 6) {
                // Set read address
                case 0:
                    this.addressRegister = (i & 0x3f) * 256 + this.latchByte;
                    this.prefetchByte = this.ram[this.addressRegister];
                    this.addressRegister += this.addressIncrement;
                    this.addressRegister &= 0x3FFF;
                    break;
                // Set write address
                case 1:
                    this.addressRegister = (i & 0x3f) * 256 + this.latchByte;
                    break;
                // Write register
                case 2:
                    var reg = i & 0x3f;
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
                this.spriteSize = (this.registers[1] & 0x02) >> 1;
                this.spriteMag = this.registers[1] & 0x01;
                this.updateMode(this.registers[0], this.registers[1]);
                break;
            // Name table
            case 2:
                this.nameTable = (this.registers[2] & (this.screenMode != F18A.MODE_TEXT_80 ? 0xf : 0xc)) << 10;
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
                this.nameTable2 = (this.registers[10] % 0x0f) << 10;
                break;
            // Status register select
            case 15:
                this.statusRegisterNo = this.registers[15] & 0x0f;
                this.log.info("F18A status register " + this.statusRegisterNo + " selected.");
                break;
            // Horz interrupt scan line, 0 to disable
            case 19:
                this.interruptScanline = this.registers[19];
                break;
            // Palette select
            case 24:
                this.spritePaletteSelect = this.registers[24] & 0x30;
                this.tilePaletteSelect = (this.registers[24] & 0x03) << 4; // Shift into position
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
            case 30:
                this.maxSprites = this.registers[30] == 0 ? 32 : this.registers[30] + 1;
                break;
            // Bitmap control
            case 31:
                this.bitmapEnable = (this.registers[31] & 0x80) != 0;
                this.bitmapPriority = (this.registers[31] & 0x40) != 0;
                this.bitmapTransparent = (this.registers[31] & 0x20) != 0;
                this.bitmapPaletteSelect = (this.registers[31] & 0x0F) << 2; // Shift into position
                break;
            // Bitmap base address
            case 32:
                this.bitmapBaseAddr = this.registers[32] << 6;
                this.log.info("Bitmap layer base set to " + this.bitmapBaseAddr.toHexWord());
                break;
            // Bitmap x
            case 33:
                this.bitmapX = this.registers[33];
                break;
            // Bitmap y
            case 34:
                this.bitmapY = this.registers[34];
                break;
            // Bitmap width
            case 35:
                this.bitmapWidth = this.registers[35];
                break;
            // Bitmap height
            case 36:
                this.bitmapHeight = this.registers[36];
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
                this.tileMap2Enabled = (this.registers[49] & 0x80) != 0;
                var oldRow30 = this.row30Enabled;
                this.row30Enabled = (this.registers[49] & 0x40) != 0;
                if (oldRow30 != this.row30Enabled) {
                    this.setDimensions();
                    this.log.info("30 rows mode " + (this.row30Enabled ? "enabled" : "disabled") + ".");
                }
                this.tileColorMode = (this.registers[49] & 0x30) >> 4;
                // this.log.info("F18A Enhanced Color Mode " + this.tileColorMode + " selected for tiles.");
                this.realSpriteYCoord = (this.registers[49] & 0x08) != 0;
                // this.log.info("Real Y: " + this.realSpriteYCoord);
                this.spriteLinkingEnabled = (this.registers[49] & 0x04) != 0;
                this.spriteColorMode = this.registers[49] & 0x03;
                // this.log.info("F18A Enhanced Color Mode " + this.spriteColorMode + " selected for sprites.");
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
                break;
            case 57:
                if (!this.unlocked) {
                    if ((oldValue & 0x1c) == 0x1c && (this.registers[57] & 0x1c) == 0x1c) {
                        this.unlocked = true;
                        this.log.info("F18A unlocked");
                    }
                }
                else {
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

    runGPU: function(gpuAddress) {
        this.log.info("F18A GPU triggered at " + gpuAddress.toHexWord() + ".");
        this.gpu.setPC(gpuAddress); // Set the PC, which also triggers the GPU
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
        } else {
            switch ((reg1 & 0x18) >> 3) {
                case 0:
                    // Graphics mode 0
                    this.screenMode = F18A.MODE_GRAPHICS;
                    break;
                case 1:
                    // Multicolor mode
                    this.screenMode = F18A.MODE_MULTICOLOR;
                    break;
                case 2:
                    // Text mode
                    if ((reg0 & 0x4) == 0) {
                        this.screenMode = F18A.MODE_TEXT;
                    }
                    else {
                        this.screenMode = F18A.MODE_TEXT_80;
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
                var i = this.statusRegister;
                this.statusRegister = 0;
                this.cru.writeBit(2, true);
                return i;
            case 1:
                // ID
                return 0xe0;
            case 2:
                // GPU status
                return this.gpu.isIdle() ? 0 : 0x80;
            case 14:
                // Version
                return 0x16;
            case 15:
                return this.statusRegisterNo; // TODO: check with Matthew
        }
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

    getCurrentScanline: function() {
        this.currentScanline++;
        if (this.currentScanline == 240) {
            this.currentScanline = 0;
        }
        return this.currentScanline;
    },

    logRegisters: function() {
        this.log.info(this.getRegsString());
    },

    getRegsString: function() {
        var s = "";
        for (var i = 0; i < 8; i++) {
            s += "VR" + i + "=" + this.registers[i].toHexByte() + (i == 3 ? "\n     " : " ");
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
        if (this.screenMode == F18A.MODE_TEXT_80) {
            x *= 2;
        }
        x -= this.leftBorder;
        y -= this.topBorder;
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