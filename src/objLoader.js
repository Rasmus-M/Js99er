/*
 * js99'er - TI-99/4A emulator written in JavaScript
 *
 * Created 2014 by Rasmus Moustgaard <rasmus.moustgaard@gmail.com>
 */

"use strict";

var ObjLoader = (function () {

    var Action  = {
        EA5: {},
        JS99ER_MEMORY_DUMP: {},
        CARTRIDGE: {}
    };

    var ObjLoader = function () {
    };

    function FileReader(file) {
        this.file = file;
        this.pos = 0;
    }

    FileReader.prototype.readLine = function () {
        var line = "";
        if (this.pos < this.file.length) {
            var char = this.file.charAt(this.pos);
            while (char != '\n'&& char != '\r' && this.pos < this.file.length && line.length < 80) {
                line += char;
                this.pos++;
                if (this.pos < this.file.length) {
                    char = this.file.charAt(this.pos);
                }
            }
            while ((char == '\n'|| char == '\r') && this.pos < this.file.length) {
                this.pos++;
                if (this.pos < this.file.length) {
                    char = this.file.charAt(this.pos);
                }
            }
            console.log(line);
            return line;
        }
        else {
            return null;
        }
    };

    function LineReader(line) {
        this.line = line;
        this.pos = 0;
    }

    LineReader.prototype.read = function () {
        if (this.pos < this.line.length) {
            var char = this.line.charAt(this.pos);
            this.pos++;
            return char;
        }
        else {
            return "";
        }
    };

    LineReader.prototype.readString = function (len) {
        if (this.pos + len < this.line.length) {
            var str = this.line.substr(this.pos, len);
            this.pos += len;
            return str;
        }
        else {
            return "";
        }
    };

    LineReader.prototype.readWord = function () {
        if (this.pos + 4 < this.line.length) {
            var word = parseInt(this.line.substr(this.pos, 4), 16);
            this.pos += 4;
            return word;
        }
        else {
            return -1;
        }
    };

    ObjLoader.prototype.loadObjFile = function (objFile) {
        var action = Action.EA5;
        var ram = new Uint8Array(0x10000);
        var psegOffset = 0xA000;
        var loadAddress = psegOffset;
        var autoStartAddress = loadAddress;
        var lowRAMStartAddress = 0x10000;
        var lowRAMEndAddress = 0;
        var highRAMStartAddress = 0x10000;
        var highRAMEndAddress = 0;
        var rom = new Uint8Array(0x10000);
        var romBank = -1;
        var eof = false;
        var fileReader = new FileReader(objFile);
        var line = fileReader.readLine();
        var lineNumber = 1;
        while (line != null && !eof) {
            var lineReader = new LineReader(line);
            var eol = false;
            var tag = lineReader.read();
            var tagNumber = 1;
            var address, offset;
            var label;
            while (tag != '' && !eol && !eof) {
                switch (tag) {
                    // Start of PSEG
                    case '0':
                        var size = lineReader.readWord();
                        var name = lineReader.readString(8).trim();
                        console.log("Name: " + (name.length > 0 ? name : "n/a"));
                        console.log("Size: " + size);
                        break;
                    // Auto start in AORG
                    case '1':
                        autoStartAddress = lineReader.readWord();
                        console.log("Auto start address set to: " + autoStartAddress.toHexWord());
                        break;
                    // Auto start in PSEG
                    case '2':
                        offset = lineReader.readWord();
                        autoStartAddress = psegOffset + offset;
                        console.log("Auto start address set to offset " + offset.toHexWord() + ": " + autoStartAddress.toHexWord());
                        break;
                    // REF label in PSEG
                    case '3':
                        offset = lineReader.readWord();
                        label = lineReader.readString(6).trim();
                        console.log("REF " + label + " offset " + offset.toHexWord() + ": " + (psegOffset + offset).toHexWord());
                        break;
                    // REF label in AORG
                    case '4':
                        address = lineReader.readWord();
                        label = lineReader.readString(6).trim();
                        console.log("REF " + label + ": " + address.toHexWord());
                        break;
                    // DEF label in PSEG
                    case '5':
                        offset = lineReader.readWord();
                        label = lineReader.readString(6).trim();
                        console.log("DEF " + label + " offset " + offset.toHexWord() + ": " + (psegOffset + offset).toHexWord());
                        break;
                    // DEF label in AORG
                    case '6':
                        address = lineReader.readWord();
                        label = lineReader.readString(6).trim();
                        console.log("DEF " + label + ": " + address.toHexWord());
                        break;
                    // Checksum
                    case '7':
                        var checksum = lineReader.readWord();
                        break;
                    // Ignored checksum
                    case '8':
                        checksum = lineReader.readWord();
                        break;
                    // Set load address in AORG
                    case '9':
                        loadAddress = lineReader.readWord();
                        if (loadAddress != -1) {
                            if (action === Action.CARTRIDGE) {
                                if (loadAddress >= 0xA000 && loadAddress < 0xC000) {
                                    loadAddress -= 0x3F00;
                                }
                                else if (loadAddress >= 0xC000 && loadAddress < 0x10000) {
                                    loadAddress -= 0x5F00;
                                }
                            }
                            console.log("Load address set to: " + loadAddress.toHexWord());
                        }
                        else {
                            throw "Invalid load address at line " + lineNumber + " position " + tagNumber + ".";
                        }
                        break;
                    // Set load address offset in PSEG
                    case 'A':
                        offset = lineReader.readWord();
                        loadAddress = psegOffset + offset;
                        if (loadAddress != -1) {
                            console.log("Load address set to offset " + offset.toHexWord() + ": " + loadAddress.toHexWord());
                        }
                        else {
                            throw "Invalid load address at line " + lineNumber + " position " + tagNumber + ".";
                        }
                        break;
                    // Load word into memory
                    case 'B':
                        var word = lineReader.readWord();
                        if (word != -1) {
                            if (loadAddress >= 0x2000 && loadAddress < 0x4000 || loadAddress >= 0xA000 && loadAddress < 0x10000) {
                                if (loadAddress >= 0x2000 && loadAddress < 0x4000) {
                                    // Low RAM
                                    if (loadAddress < lowRAMStartAddress) {
                                        console.log("Low ram start set to " + loadAddress.toHexWord());
                                        lowRAMStartAddress = loadAddress;
                                    }
                                    if (loadAddress > lowRAMEndAddress) {
                                        lowRAMEndAddress = loadAddress;
                                    }

                                }
                                else {
                                    // High RAM
                                    if (loadAddress < highRAMStartAddress) {
                                        console.log("High ram start set to " + loadAddress.toHexWord());
                                        highRAMStartAddress = loadAddress;
                                    }
                                    if (loadAddress > highRAMEndAddress) {
                                        highRAMEndAddress = loadAddress;
                                    }
                                }
                                ram[loadAddress] = (word & 0xFF00) >> 8;
                                ram[loadAddress + 1] = word & 0x00FF;
                            }
                            else if (loadAddress >= 0x6000 && loadAddress < 0x8000) {
                                var romAddress = (romBank << 13) + (loadAddress - 0x6000);
                                rom[romAddress] = (word & 0xFF00) >> 8;
                                rom[romAddress + 1] = word & 0x00FF;
                            }
                            loadAddress = (loadAddress + 2) & 0xFFFF;
                        }
                        else {
                            throw "Invalid word at line " + lineNumber + " position " + tagNumber + ".";
                        }
                        break;
                    // Add PSEG offset to word and load it in memory
                    case 'C':
                        word = lineReader.readWord();
                        if (word != -1) {
                            console.log("PSEG word offset " + word.toHexWord()  + ": " + (psegOffset + word).toHexWord());
                            word = (psegOffset + word) & 0xFFFF;
                            ram[loadAddress] = (word & 0xFF00) >> 8;
                            ram[loadAddress + 1] = word & 0x00FF;
                            loadAddress = (loadAddress + 2) & 0xFFFF;
                        }
                        else {
                            throw "Invalid word at line " + lineNumber + " position " + tagNumber + ".";
                        }
                        break;
                    // End of record
                    case 'F':
                        eol = true;
                        break;
                    // CSEG
                    case 'P':
                        offset = lineReader.readWord();
                        console.log("CSEG: " + offset.toHexWord());
                        action = Action.CARTRIDGE;
                        if (action === Action.CARTRIDGE) {
                            romBank++;
                            console.log("ROM bank is now " + romBank);
                        }
                        break;
                    // End of file
                    case ':':
                        eof = true;
                        break;
                    // Other
                    default:
                        console.log("Unknown tag '" + tag + "' at line " + lineNumber + " position " + tagNumber + ".");
                }
                tag = lineReader.read();
                tagNumber++;
            }
            line = fileReader.readLine();
            lineNumber++;
        }
        this.lowRAMStartAddress = lowRAMStartAddress;
        this.lowRAMEndAddress = lowRAMEndAddress;
        this.highRAMStartAddress = highRAMStartAddress;
        this.highRAMEndAddress = highRAMEndAddress;
        this.autoStartAddress = autoStartAddress;
        this.ram = ram;
        this.rom = rom;
        this.action = action;
    };

    ObjLoader.prototype.getRAMBlock = function (start, length) {
        var ramBlock = new Uint8Array(length);
        for (var i = 0; i < length; i++) {
            ramBlock[i] = this.ram[start + i];
        }
        return ramBlock;
    };

    ObjLoader.prototype.getUpperMemory = function () {
        return this.getRAMBlock(0xa000, 0x6000);
    };

    ObjLoader.prototype.getLowerMemory = function () {
        return this.getRAMBlock(0x2000, 0x2000);
    };

    ObjLoader.prototype.getAutoStartAddress = function () {
        return this.autoStartAddress;
    };

    ObjLoader.prototype.getSoftware = function () {
        var sw = {};
        if (this.action == Action.EA5) {
            sw.memoryBlocks = [];
            sw.startAddress = this.autoStartAddress;
            var highRAMLength = this.highRAMEndAddress - this.highRAMStartAddress + 2;
            if (highRAMLength > 0) {
                sw.memoryBlocks.push({
                    address: this.highRAMStartAddress,
                    data: this.getRAMBlock(this.highRAMStartAddress, highRAMLength)
                });
            }
            var lowRAMLength = this.lowRAMEndAddress - this.lowRAMStartAddress + 2;
            if (lowRAMLength > 0) {
                sw.memoryBlocks.push({
                    address: this.lowRAMStartAddress,
                    data: this.getRAMBlock(this.lowRAMStartAddress, lowRAMLength)
                });
            }
        }
        else {
            sw.rom = this.rom;
            sw.type = Software.TYPE_INVERTED_CART;
        }
        return sw;
    };


    return ObjLoader;
})();