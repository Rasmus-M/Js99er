/*
 * js99'er - TI-99/4A emulator written in JavaScript
 *
 * Created 2014 by Rasmus Moustgaard <rasmus.moustgaard@gmail.com>
 *
 * TMS9900 disassembler
 *
 */

'use strict';

var Disassembler = (function () {

    var Disassembler = function (memory) {
        this.memory = memory;
    };

    Disassembler.prototype.setMemory = function (memory) {
        this.memory = memory;
    };

    Disassembler.prototype.disassemble = function (start, length, maxInstructions, anchorAddr) {
        this.start = start || 0;
        this.length = length || 0x10000;
        this.maxInstructions = maxInstructions || 0x10000;
        this.anchorAddr = anchorAddr || this.start;
        // Start by disassembling from the anchor address to ensure correct alignment
        var result = this.disassembleRange(this.anchorAddr, this.length - this.anchorAddr, this.maxInstructions, this.anchorAddr);
        // Then prepend the disassembly before, which may be misaligned
        if (this.start < this.anchorAddr) {
            var result2 = this.disassembleRange(this.start, this.anchorAddr - this.start, this.maxInstructions - result.lineCount, null);
            result.text = result2.text + result.text;
            result.lineCount += result2.lineCount;
            result.anchorLine += result2.lineCount;
        }
        return result;
    };

    Disassembler.prototype.disassembleRange = function (start, length, maxInstructions, anchorAddr) {
        console.log("start=" + start.toHexWord());
        this.addr = start;
        var end = start + length;
        var decoderTable = new Decoder().getDecoderTable();
        var disassembly = "";
        var lineCount = 0;
        var anchorLine = null;
        var ts, td, s, d, b, c, w, disp, imm, word;
        for (var i = 0; i < maxInstructions && this.addr < end; i++) {
            var instrAddr = this.addr; // Start address for current instruction
            disassembly += (anchorAddr && anchorLine == null && instrAddr >= anchorAddr) ? "\u27a8 " : "  ";
            var instr = this.memory.getWord(instrAddr);
            var opcode = decoderTable[instr];
            if (opcode != null) {
                // Decode instruction
                var src = null;
                var dst = null;
                switch (opcode.format) {
                    case 1:
                        // Two general addresses
                        b = (instr & 0x1000) >> 12;
                        td = (instr & 0x0c00) >> 10;
                        d = (instr & 0x03c0) >> 6;
                        ts = (instr & 0x0030) >> 4;
                        s = (instr & 0x000f);
                        src = this.ga(ts, s);
                        dst = this.ga(td, d);
                        break;
                    case 2:
                        // Jump and CRU bit
                        disp = (instr & 0x00ff);
                        if (opcode.id !== "TB" && opcode.id !== "SBO" && opcode.id !== "SBZ") {
                            if ((disp & 0x80) !== 0) {
                                disp = 128 - (disp & 0x7f);
                                disp = this.addr + 2 - 2 * disp;
                            } else {
                                disp = this.addr + 2 + 2 * disp;
                            }
                            src = disp.toHexWord();
                        }
                        else {
                            src = (disp & 0x80) === 0 ? disp : disp - 256;
                        }
                        break;
                    case 3:
                        // Logical
                        d = (instr & 0x03c0) >> 6;
                        ts = (instr & 0x0030) >> 4;
                        s = (instr & 0x000f);
                        src = this.ga(ts, s);
                        dst = r(d);
                        break;
                    case 4:
                        // CRU multi bit
                        c = (instr & 0x03c0) >> 6;
                        ts = (instr & 0x0030) >> 4;
                        s = (instr & 0x000f);
                        b = (c > 8 ? 0 : 1);
                        src = this.ga(ts, s);
                        dst = c;
                        break;
                    case 5:
                        // Register shift
                        c = (instr & 0x00f0) >> 4;
                        w = (instr & 0x000f);
                        src = r(w);
                        dst = c;
                        break;
                    case 6:
                        // Single address
                        ts = (instr & 0x0030) >> 4;
                        s = instr & 0x000f;
                        src = this.ga(ts, s);
                        break;
                    case 7:
                        // Control (no arguments)
                        break;
                    case 8:
                        // Immediate
                        if (opcode.id === "STST" || opcode.id === "STWP") {
                            w = (instr & 0x000f);
                            src = r(w);
                        }
                        else {
                            w = (instr & 0x000f); // 0 for LIMI and LWPI
                            this.addr += 2;
                            imm = this.memory.getWord(this.addr);
                            if (opcode.id !== "LIMI" && opcode.id !== "LWPI") {
                                src = r(w);
                            }
                            dst = imm.toHexWord();
                        }
                        break;
                    case 9:
                        // Multiply, divide, XOP
                        d = (instr & 0x03c0) >> 6;
                        ts = (instr & 0x0030) >> 4;
                        s = (instr & 0x000f);
                        src = this.ga(ts, s);
                        dst = r(d);
                        break;
                    default:
                        break;
                }
                // Output disassembly
                disassembly += instrAddr.toHexWord() + " ";
                disassembly += instr.toHexWord() + " ";
                disassembly += opcode.id.padr(" ", 4);
                if (src != null || dst != null) {
                    disassembly += " ";
                    if (src != null) {
                        disassembly += src;
                    }
                    if (src != null && dst != null) {
                        disassembly += ","
                    }
                    if (dst != null) {
                        disassembly += dst;
                    }
                }
            }
            else {
                // Illegal
                disassembly += instrAddr.toHexWord() + " ";
                disassembly += instr.toHexWord() + " ";
                disassembly += "DATA " + instr.toHexWord();
            }
            disassembly += "\n";
            lineCount++;
            if (anchorLine === null && anchorAddr && instrAddr >= anchorAddr) {
                anchorLine = i;
            }
            this.addr += 2;
        }
        return {text: disassembly, lineCount: lineCount, anchorLine: anchorLine};
    };

    Disassembler.prototype.ga = function (type, val) {
        var ret;
        switch (type) {
            case 0:
                // Register (R1)
                ret = r(val);
                break;
            case 1:
                // Register indirect (*R1)
                ret = "*" + r(val);
                break;
            case 2:
                // Symbolic or indexed
                this.addr += 2;
                var word = this.memory.getWord(this.addr);
                if (val === 0) {
                    // Symbolic	(@>1000)
                    ret = "@" + word.toHexWord();
                }
                else {
                    // Indexed (@>1000(R1))
                    ret = "@" + word.toHexWord() + "(" + r(val)  + ")";
                }
                break;
            case 3:
                // Post increment (*R1+)
                ret = "*" + r(val) + "+";
                break;
        }
        return ret;
    };

    function r(val) {
        return "R" + val;
    }

    return Disassembler;
})();