/*
 * js99'er - TI-99/4A emulator written in JavaScript
 *
 * Created 2014 by Rasmus Moustgaard <rasmus.moustgaard@gmail.com>
 *
 * TMS9900 disassembler
 *
 */

'use strict';

var Disassembler = (function() {

    var Disassembler = function(memory) {
        this.memory = memory;
        this.addr = null;
    };

    Disassembler.prototype.setMemory = function(memory) {
        this.memory = memory;
    };

    Disassembler.prototype.disassemble = function(start, length, maxInstructions, anchorAddr) {
        this.addr = start || 0;
        var end = length ? start + length : 0x10000;
        maxInstructions = maxInstructions || 0x10000;
        var decoderTable = new Decoder().getDecoderTable();
        var disassembly = "";
        var anchorLine = null;
        var ts, td, s, d, b, c, w, disp, imm, word;
        for (var i = 0; i < maxInstructions && this.addr < end; i++) {
            var addr = this.addr;
            disassembly += (anchorAddr && anchorLine == null && addr >= anchorAddr) ? "\u27a8 " : "  ";
            var instr = this.memory.getWord(this.addr);
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
                        src = ga(ts, s, this);
                        dst = ga(td, d, this);
                        break;
                    case 2:
                        // Jump and CRU bit
                        disp = (instr & 0x00ff);
                        if ((disp & 0x80) != 0) {
                            disp = 128 - (disp & 0x7f);
                            disp = this.addr + 2 - 2 * disp;
                        } else {
                            disp = this.addr + 2 + 2 * disp;
                        }
                        src = disp.toHexWord();
                        break;
                    case 3:
                        // Logical
                        d = (instr & 0x03c0) >> 6;
                        ts = (instr & 0x0030) >> 4;
                        s = (instr & 0x000f);
                        src = ga(ts, s, this);
                        dst = r(d);
                        break;
                    case 4:
                        // CRU multi bit
                        c = (instr & 0x03c0) >> 6;
                        ts = (instr & 0x0030) >> 4;
                        s = (instr & 0x000f);
                        b = (c > 8 ? 0 : 1);
                        src = ga(ts, s, this);
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
                        src = ga(ts, s, this);
                        break;
                    case 7:
                        // Control (no arguments)
                        break;
                    case 8:
                        // Immediate
                        if (opcode.id == "STST" || opcode.id == "STWP") {
                            w = (instr & 0x000f);
                            src = r(w);
                        }
                        else {
                            w = (instr & 0x000f); // 0 for LIMI and LWPI
                            this.addr += 2;
                            imm = this.memory.getWord(this.addr);
                            if (opcode.id != "LIMI" && opcode.id != "LWPI") {
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
                        src = ga(ts, s, this);
                        dst = r(d);
                        break;
                    default:
                        break;
                }
                // Output disassembly
                disassembly += addr.toHexWord() + " ";
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
                disassembly += this.addr.toHexWord() + " ";
                disassembly += instr.toHexWord() + " ";
                disassembly += "DATA " + instr.toHexWord();
            }
            this.addr += 2;
            disassembly += "\n";
            if (anchorAddr && anchorLine == null && addr >= anchorAddr) {
                anchorLine = i;
            }
        }
        return {text: disassembly, anchorLine: anchorLine};
    };

    function ga(type, val, disassembler) {
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
                disassembler.addr += 2;
                var word = disassembler.memory.getWord(disassembler.addr);
                if (val == 0) {
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
    }

    function r(val) {
        return "R" + val;
    }

    return Disassembler;
})();