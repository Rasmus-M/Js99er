/*
 * js99'er - TI-99/4A emulator written in JavaScript
 *
 * Created 2014 by Rasmus Moustgaard <rasmus.moustgaard@gmail.com>
 *
 * This file is based on code borrowed from the Classic99 emulator
 * Copyright (c) 2007 Mike Brent aka Tursi aka HarmlessLion.com
 *
 * TMS9900 CPU emulation
 */

'use strict';

TMS9900.CYCLES_PER_FRAME = 50000;
TMS9900.CYCLES_PER_SCANLINE = 183;
TMS9900.PROFILE = false;

function TMS9900(memory, cru, keyboard, diskDrives, googleDrives) {
    this.memory = memory;
    this.cru = cru;
    this.keyboard = keyboard;
    this.diskDrives = diskDrives;
    this.googleDrives = googleDrives;

    // Internal registers
    this.PC = 0;
    this.WP = 0;
    this.ST = 0;
    this.flagX = 0;

    // Operands
    this.Ts = 0;
    this.Td = 0;
    this.D = 0;
    this.S = 0;
    this.B = 0;
    this.nPostInc = [0, 0];

    // Counters
    this.cycles = 0;

    // Constants
    this.SRC             = 0;
    this.DST             = 1;
    this.POSTINC2        = 0x80;
    this.POSTINC1        = 0x40;
    this.BIT_LGT         = 0x8000;
    this.BIT_AGT         = 0x4000;
    this.BIT_EQ          = 0x2000;
    this.BIT_C           = 0x1000;
    this.BIT_OV          = 0x0800;
    this.BIT_OP          = 0x0400;
    this.BIT_X           = 0x0200;

    // Assignment masks
    // this.maskEQ_LGT            = this.BIT_EQ | this.BIT_LGT;
    this.maskLGT_AGT_EQ        = this.BIT_LGT | this.BIT_AGT | this.BIT_EQ;
    this.maskLGT_AGT_EQ_OP     = this.BIT_LGT | this.BIT_AGT | this.BIT_EQ | this.BIT_OP;
    this.maskLGT_AGT_EQ_OV     = this.BIT_LGT | this.BIT_AGT | this.BIT_EQ | this.BIT_OV;
    // carry here used for INC and NEG only
    this.maskLGT_AGT_EQ_OV_C  = this.BIT_LGT | this.BIT_AGT | this.BIT_EQ | this.BIT_OV | this.BIT_C;


    // Lookup tables
    this.decoderTable = new Decoder().getDecoderTable();
    this.wStatusLookup = this.buildWStatusLookupTable();
    this.bStatusLookup = this.buildBStatusLookupTable();

    // Misc
    this.suspended = false;
    this.breakpoint = null;
    this.otherBreakpoint = null;
    this.illegalCount = 0;
    this.profile = null;
    this.log = Log.getLog();
}

TMS9900.prototype = {

    reset: function () {
        this.PC = 0;
        this.WP = 0;
        this.ST = 0x01C0;
        this.flagX = 0;
        this.Ts = 0;
        this.Td = 0;
        this.D = 0;
        this.S = 0;
        this.B = 0;
        this.nPostInc = [0, 0];
        this.cycles = 0;
        this.illegalCount = 0;
        this.profile = new Uint32Array(0x10000);

        // Reset
        this.WP = this.readMemoryWord(0x0000);
        this.PC = this.readMemoryWord(0x0002);
        this.log.info("PC reset to " + this.PC.toHexWord());

        this.suspended = false;
        this.pasteToggle = false;
    },

    // Build the word status lookup table
    buildWStatusLookupTable: function () {
        var wStatusLookup = [];
        for (var i = 0; i < 0x10000; i++) {
            wStatusLookup[i] = 0;
            // LGT
            if (i > 0) wStatusLookup[i] |= this.BIT_LGT;
            // AGT
            if ((i > 0) && (i < 0x8000)) wStatusLookup[i] |= this.BIT_AGT;
            // EQ
            if (i === 0) wStatusLookup[i] |= this.BIT_EQ;
            // C
            if (i === 0) wStatusLookup[i] |= this.BIT_C;
            // OV
            if (i === 0x8000) wStatusLookup[i] |= this.BIT_OV;
        }
        return wStatusLookup;
    },

    // Build the byte status lookup table
    buildBStatusLookupTable: function () {
        var bStatusLookup = [];
        for (var i = 0; i < 0x100; i++) {
            var x = (i & 0xFF);
            bStatusLookup[i] = 0;
            // LGT
            if (i > 0) bStatusLookup[i] |= this.BIT_LGT;
            // AGT
            if ((i > 0) && (i < 0x80)) bStatusLookup[i] |= this.BIT_AGT;
            // EQ
            if (i === 0) bStatusLookup[i] |= this.BIT_EQ;
            // C
            if (i === 0) bStatusLookup[i] |= this.BIT_C;
            // OV
            if (i === 0x80) bStatusLookup[i] |= this.BIT_OV;
            // OP
            for (var z = 0; x !== 0; x = (x & (x - 1)) & 0xFF) z++;						// black magic?
            if ((z & 1) !== 0) bStatusLookup[i] |= this.BIT_OP;		    // set bit if an odd number
        }
        return bStatusLookup;
    },

    run: function (cyclesToRun) {
        var startPC = this.PC;
        var startCycles = this.cycles;
        var countStartPC = -1; // 0xA086;
        var countEndPC = -1; // 0xA0DA;
        while (this.cycles - startCycles < cyclesToRun && !this.suspended) {
            // Handle breakpoint
            var atBreakpoint = this.atBreakpoint();
            if (atBreakpoint) {
                this.log.info("At breakpoint " + this.breakpoint.toHexWord());
                cyclesToRun = -1;
            }
            if (!atBreakpoint || this.PC === startPC) {
                // Hook into disk DSR
                if (this.PC >= 0x4000 && this.PC < 0x6000) {
                    switch (this.memory.peripheralROMNumber) {
                        case 1:
                            if (this.PC >= DiskDrive.DSR_HOOK_START && this.PC <= DiskDrive.DSR_HOOK_END) {
                                DiskDrive.execute(this.PC, this.diskDrives, this.memory);
                            }
                            break;
                        case 2:
                            if (this.PC >= GoogleDrive.DSR_HOOK_START && this.PC <= GoogleDrive.DSR_HOOK_END) {
                                if (GoogleDrive.execute(this.PC, this.googleDrives, this.memory, function (success) {
                                    this.log.debug("CPU resumed");
                                    this.setSuspended(false);
                                }.bind(this))) {
                                    // Google drive is asynchronous - we cannot continue until after the callback
                                    this.log.debug("CPU suspended");
                                    this.setSuspended(true);
                                }
                            }
                            break;
                    }
                }
                // Keyboard pasting hook
                else if (this.PC === 0x478) {
                    // MOVB R0,@>8375
                    if (!this.pasteToggle) {
                        var charCode = this.keyboard.getPasteCharCode();
                        if (charCode !== -1) {
                            var keyboardDevice = this.memory.getPADByte(0x8374);
                            if (keyboardDevice === 0 || keyboardDevice === 5) {
                                this.writeMemoryByte(this.WP, charCode); // Set R0
                                this.writeMemoryByte(this.WP + 12, this.memory.getPADByte(0x837c) | 0x20); // Set R6 (status byte)
                                // Detect Extended BASIC
                                if (this.memory.groms && this.memory.groms.length) {
                                    var grom = this.memory.groms[0];
                                    if (grom[0x6343] === 0x45 && grom[0x6344] === 0x58 && grom[0x6345] === 0x54) {
                                        this.memory.setPADByte(0x835F, 0x5d); // Max length for BASIC continuously set
                                    }
                                }
                            }
                            this.memory.setPADByte(0x837c, this.memory.getPADByte(0x837c) | 0x20);
                        }
                    }
                    this.pasteToggle = !this.pasteToggle;
                }
                var instruction = this.readMemoryWord(this.PC);
                this.inctPC();
                this.addCycles(this.execute(instruction));
                // Execute interrupt routine
                if (this.getInterruptMask() >= 1 && (this.cru.isVDPInterrupt() || this.cru.isTimerInterrupt())) {
                    // if (this.cru.isTimerInterrupt()) {
                    //     console.log("PC timer int");
                    // }
                    this.addCycles(this.doInterrupt(4));
                }
            }
            if (this.PC === countStartPC) {
                this.countStart = this.cycles;
            }
            else if (this.PC === countEndPC) {
                var count = this.cycles - this.countStart;
                if (!this.maxCount || count > this.maxCount) {
                    this.maxCount = count;
                }
                this.log.info("Cycle count: " + count + " max: " + this.maxCount);
            }
        }
        return (this.cycles - startCycles) - cyclesToRun;
    },

    execute: function (instruction) {
        var opcode = this.decoderTable[instruction];
        if (opcode && opcode.original) {
            var cycles = this.decodeOperands(opcode, instruction);
            var cycles2 = this[opcode.id.toLowerCase()].call(this);
            if (cycles2 !== null) {
                cycles += cycles2;
            }
            else {
                this.log.info(((this.PC - 2) & 0xFFFF).toHexWord() + " " + instruction.toHexWord() + " " + opcode.id + ": Not implemented");
            }
            if (TMS9900.PROFILE) {
                this.profile[(this.PC - 2) & 0xFFFF] += cycles;
            }
            return cycles;
        }
        else {
            if (this.illegalCount < 256) {
                this.log.info(((this.PC - 2) & 0xFFFF).toHexWord() + " " + instruction.toHexWord() + ": Illegal" + (this.illegalCount === 255 ? " (suppressing further messages)" : ""));
            }
            this.illegalCount++;
            return 10;
        }
    },

    getPC: function () {
        return this.PC;
    },

    setPC: function (value) {
        if ((value & 1) !== 0) {
            this.log.warn("Setting odd PC from " + this.PC.toHexWord());
        }
        this.PC = value & 0xFFFE;
        if ((this.PC & 0xfc00) === 0x8000) {
            this.PC |= 0x300;
        }
    },

    inctPC: function () {
        this.setPC(this.PC + 2);
    },

    addPC: function (value) {
        this.setPC(this.PC + value)
    },

    getWP: function () {
        return this.WP;
    },

    setWP: function (value) {
        this.WP = value & 0xFFFE;
    },

    getST: function () {
        return this.ST;
    },

    getInterruptMask: function () {
        return this.ST & 0x000F;
    },

    addCycles: function (value) {
        this.cycles += value;
    },

    decodeOperands: function (opcode, instr) {
        var cycles = 0;
        switch (opcode.format) {
            case 1:
                this.Td = (instr & 0x0c00) >> 10;
                this.Ts = (instr & 0x0030) >> 4;
                this.D = (instr & 0x03c0) >> 6;
                this.S = (instr & 0x000f);
                this.B = (instr & 0x1000) >> 12;
                cycles += this.fixS();
                break;
            case 2:
                this.D = (instr & 0x00ff);
                break;
            case 3:
                this.Td = 0;
                this.Ts = (instr & 0x0030) >> 4;
                this.D = (instr & 0x03c0) >> 6;
                this.S = (instr & 0x000f);
                this.B = 0;
                cycles += this.fixS();
                break;
            case 4:
                // No destination (CRU ops)
                this.D = (instr & 0x03c0) >> 6;
                this.Ts = (instr & 0x0030) >> 4;
                this.S = (instr & 0x000f);
                this.B = (this.D > 8 ? 0 : 1);
                cycles += this.fixS();
                break;
            case 5:
                this.D = (instr & 0x00f0) >> 4;
                this.S = (instr & 0x000f);
                this.S = this.WP + (this.S << 1);
                break;
            case 6:
                // No destination (single argument instructions)
                this.Ts = (instr & 0x0030) >> 4;
                this.S = instr & 0x000f;
                this.B = 0;
                cycles += this.fixS();
                break;
            case 7:
                // no argument
                break;
            case 8:
                if (opcode.id === "STST" || opcode.id === "STWP") {
                    this.D = (instr & 0x000f);
                    this.D = this.WP + (this.D << 1);
                }
                else {
                    this.D = (instr & 0x000f);
                    this.D = this.WP + (this.D << 1);
                    this.S = this.readMemoryWord(this.PC);
                    this.inctPC();
                }
                break;
            case 9:
                // No destination here (dest calc'd after call) (DIV, MUL, XOP)
                this.D = (instr & 0x03c0) >> 6;
                this.Ts = (instr & 0x0030) >> 4;
                this.S = (instr & 0x000f);
                this.B = 0;
                cycles += this.fixS();
                break;
            default:
                break;
        }
        return cycles;
    },

    //////////////////////////////////////////////////////////////////////////
    // Get addresses for the destination and source arguments
    // Note: the format code letters are the official notation from Texas
    // instruments. See their TMS9900 documentation for details.
    // (Td, Ts, D, S, B, etc)
    // Note that some format codes set the destination type (Td) to
    // '4' in order to skip unneeded processing of the Destination address
    //////////////////////////////////////////////////////////////////////////

    fixS: function () {
        var cycles = 0;
        var temp, t2;
        // source type
        switch (this.Ts) {
            case 0:
                // register	(R1) Address is the address of the register
                this.S = this.WP + (this.S << 1);
                break;
            case 1:
                // register indirect (*R1) Address is the contents of the register
                this.S = this.readMemoryWord(this.WP + (this.S << 1));
                cycles += 4;
                break;
            case 2:
                if (this.S !== 0) {
                    // indexed (@>1000(R1))	Address is the contents of the argument plus the contents of the register
                    this.S = this.readMemoryWord(this.PC) + this.readMemoryWord(this.WP + (this.S << 1));
                }
                else {
                    // symbolic	 (@>1000) Address is the contents of the argument
                    this.S = this.readMemoryWord(this.PC);
                }
                this.inctPC();
                cycles += 8;
                break;
            case 3:
                // do the increment after the opcode is done with the source
                this.nPostInc[this.SRC] = this.S | (this.B === 1 ? this.POSTINC1 : this.POSTINC2);
                t2 = this.WP + (this.S << 1);
                temp = this.readMemoryWord(t2);
                this.S = temp;
                // (add 1 if byte, 2 if word) (*R1+) Address is the contents of the register, which
                // register indirect autoincrement is incremented by 1 for byte or 2 for word ops
                cycles += this.B === 1 ? 6 : 8;
                break;
        }
        return cycles;
    },

    fixD: function () {
        var cycles = 0;
        var temp, t2;
        // destination type
        // same as the source types
        switch (this.Td) {
            case 0:
                // register
                this.D = this.WP + (this.D << 1);
                break;
            case 1:
                // register indirect
                this.D = this.readMemoryWord(this.WP + (this.D << 1));
                cycles += 4;
                break;
            case 2:
                if (this.D !== 0) {
                    // indexed
                    this.D = this.readMemoryWord(this.PC) + this.readMemoryWord(this.WP + (this.D << 1));
                }
                else {
                    // symbolic
                    this.D = this.readMemoryWord(this.PC);
                }
                this.inctPC();
                cycles += 8;
                break;
            case 3:
                // do the increment after the opcode is done with the dest
                this.nPostInc[this.DST] = this.D | (this.B === 1 ? this.POSTINC1 : this.POSTINC2);
                // (add 1 if byte, 2 if word)
                t2 = this.WP + (this.D << 1);
                temp = this.readMemoryWord(t2);
                this.D = temp;
                // register indirect autoincrement
                cycles += this.B === 1 ? 6 : 8;
                break;
        }
        return cycles;
    },

    postIncrement: function (nWhich) {
        if (this.nPostInc[nWhich]) {
            var i = this.nPostInc[nWhich] & 0xf;
            var t2 = this.WP + (i << 1);

            var tmpCycles = this.cycles;
            var nTmpVal = this.readMemoryWord(t2);	// We need to reread this value, but the memory access can't count for cycles
            this.cycles = tmpCycles;

            this.writeMemoryWord(t2, (nTmpVal + ((this.nPostInc[nWhich] & this.POSTINC2) !==0 ? 2 : 1)) & 0xFFFF);
            this.nPostInc[nWhich] = 0;
        }
    },

    writeMemoryWord: function (addr, w) {
        this.memory.readWord(addr, this); // Read before write
        this.memory.writeWord(addr, w, this);
    },

    writeMemoryByte: function (addr, b) {
        var w = this.memory.readWord(addr, this); // Read before write
        this.memory.writeWord(addr, (addr & 1) !== 0 ? (w & 0xFF00) | b : (w & 0x00FF) | (b << 8), this);
    },

    readMemoryWord: function (addr) {
        return this.memory.readWord(addr, this);
    },

    readMemoryByte: function (addr) {
        var w = this.memory.readWord(addr, this);
        return (addr & 1) !== 0 ? w & 0x00FF : (w & 0xFF00) >> 8;
    },

    readCruBit: function (addr) {
        return this.cru.readBit(addr);
    },

    writeCruBit: function (addr, bool) {
        this.cru.writeBit(addr, bool);
    },

    doInterrupt: function (vector) {
        var newWP = this.readMemoryWord(vector);
        var newPC = this.readMemoryWord(vector + 2);

        this.writeMemoryWord(newWP + 26, this.WP);	// WP in new R13
        this.writeMemoryWord(newWP + 28, this.PC);	// PC in new R14
        this.writeMemoryWord(newWP + 30, this.ST);	// ST in new R15

        // Load the correct workspace, and perform a branch and link to the address
        this.setWP(newWP);
        this.setPC(newPC);

        return 22;
    },

    // Load Immediate: LI src, imm
    li: function () {
        this.writeMemoryWord(this.D, this.S);
        this.resetLGT_AGT_EQ();
        this.ST |= this.wStatusLookup[this.S] & this.maskLGT_AGT_EQ;
        return 12;
    },

    // Add Immediate: AI src, imm
    ai: function () {
        var x1 = this.readMemoryWord(this.D);

        var x3 = (x1 + this.S) & 0xFFFF;
        this.writeMemoryWord(this.D, x3);

        this.resetEQ_LGT_AGT_C_OV();
        this.ST |= this.wStatusLookup[x3] & this.maskLGT_AGT_EQ;

        if (x3 < x1) this.setC();
        if (((x1 & 0x8000) === (this.S & 0x8000)) && ((x3 & 0x8000) !== (this.S & 0x8000))) this.setOV();

        return 14;
    },

    // AND Immediate: ANDI src, imm
    andi: function () {
        var x1 = this.readMemoryWord(this.D);
        var x2 = x1 & this.S;
        this.writeMemoryWord(this.D, x2);

        this.resetLGT_AGT_EQ();
        this.ST |= this.wStatusLookup[x2] & this.maskLGT_AGT_EQ;

        return 14;
    },

    // OR Immediate: ORI src, imm
    ori: function () {
        var x1 = this.readMemoryWord(this.D);
        var x2 = x1 | this.S;
        this.writeMemoryWord(this.D, x2);

        this.resetLGT_AGT_EQ();
        this.ST |= this.wStatusLookup[x2] & this.maskLGT_AGT_EQ;

        return 14;
    },

    // Compare Immediate: CI src, imm
    ci: function () {
        var x3 = this.readMemoryWord(this.D);

        this.resetLGT_AGT_EQ();
        if (x3 > this.S) this.setLGT();
        if (x3 === this.S) this.setEQ();
        if ((x3 & 0x8000) === (this.S & 0x8000)) {
            if (x3 > this.S) this.setAGT();
        } else {
            if ((this.S & 0x8000) !== 0) this.setAGT();
        }

        return 14;
    },

    // STore Workspace Pointer: STWP src
    // Copy the workspace pointer to memory
    stwp: function () {
        this.writeMemoryWord(this.D, this.WP);
        return 8;
    },

    // STore STatus: STST src
    // Copy the status register to memory
    stst: function () {
        this.writeMemoryWord(this.D, this.ST);
        return 8;
    },

    // Load Workspace Pointer Immediate: LWPI imm
    // changes the Workspace Pointer
    lwpi: function () {
        this.setWP(this.S);
        return 10;
    },

    // Load Interrupt Mask Immediate: LIMI imm
    // Sets the CPU interrupt mask
    limi: function () {
        this.ST = (this.ST & 0xfff0) | (this.S & 0xf);
        return 16;
    },

    // This sets A0-A2 to 010, and pulses CRUCLK until an interrupt is received.
    idle: function () {
        return TMS9900.CYCLES_PER_FRAME - this.cycles % TMS9900.CYCLES_PER_FRAME;
    },

    // This will set A0-A2 to 011 and pulse CRUCLK (so not emulated)
    // However, it does have an effect, it zeros the interrupt mask
    rset: function () {
        this.ST &= 0xfff0;
        return 12;
    },

    // ReTurn with Workspace Pointer: RTWP
    // The matching return for BLWP, see BLWP for description
    rtwp: function () {
        this.ST = this.readMemoryWord(this.WP + 30); // R15
        this.setPC(this.readMemoryWord(this.WP + 28)); // R14
        this.setWP(this.readMemoryWord(this.WP + 26)); // R13
        return 14;
    },

    // This will set A0-A2 to 101 and pulse CRUCLK
    ckon: function () {
        // Not implemented
        return null;
    },

    // This will set A0-A2 to 110 and pulse CRUCLK
    ckof: function () {
        // Not implemented
        return null;
    },

    // This will set A0-A2 to 111 and pulse CRUCLK
    lrex: function () {
        // Not implemented
        return null;
    },

    // Branch and Load Workspace Pointer: BLWP src
    // A context switch. The src address points to a 2 word table.
    // the first word is the new workspace address, the second is
    // the address to branch to. The current Workspace Pointer,
    // Program Counter (return address), and Status register are
    // stored in the new R13, R14 and R15, respectively
    // Return is performed with RTWP
    blwp: function () {
        var x1 = this.WP;
        this.setWP(this.readMemoryWord(this.S));
        this.writeMemoryWord(this.WP + 26, x1);
        this.writeMemoryWord(this.WP + 28, this.PC);
        this.writeMemoryWord(this.WP + 30, this.ST);
        this.setPC(this.readMemoryWord(this.S + 2));
        this.postIncrement(this.SRC);

        // skip_interrupt=1;

        return 26;
    },

    // Branch: B src
    // Unconditional absolute branch
    b: function () {
        this.setPC(this.S);
        this.postIncrement(this.SRC);
        return 8;
    },

    // eXecute: X src
    // The argument is interpreted as an instruction and executed
    x: function () {
        if (this.flagX !== 0) {
            this.log.info("Recursive X instruction!");
        }

        var xInstr = this.readMemoryWord(this.S);
        this.postIncrement(this.SRC);	// does this go before or after the eXecuted instruction??
        // skip_interrupt=1;	    // (ends up having no effect because we call the function inline, but technically still correct)

        var cycles = 8 - 4;	        // For X, add this time to the execution time of the instruction found at the source address, minus 4 clock cycles and 1 memory access.
        this.flagX = this.PC;	    // set flag and save true post-X address for the JMPs (AFTER X's operands but BEFORE the instruction's operands, if any)
        cycles += this.execute(xInstr);
        this.flagX = 0;			    // clear flag

        return cycles;
    },

    // CLeaR: CLR src
    // sets word to 0
    clr: function () {
        this.writeMemoryWord(this.S, 0);
        this.postIncrement(this.SRC);
        return 10;
    },

    // NEGate: NEG src
    neg: function () {
        var x1 = this.readMemoryWord(this.S);

        x1 = ((~x1) + 1) & 0xFFFF;
        this.writeMemoryWord(this.S, x1);
        this.postIncrement(this.SRC);

        this.resetEQ_LGT_AGT_C_OV();
        this.ST |= this.wStatusLookup[x1] & this.maskLGT_AGT_EQ_OV_C;

        return 12;
    },

    // INVert: INV src
    inv: function () {
        var x1 = this.readMemoryWord(this.S);
        x1 = (~x1) & 0xFFFF;
        this.writeMemoryWord(this.S, x1);
        this.postIncrement(this.SRC);

        this.resetLGT_AGT_EQ();
        this.ST |= this.wStatusLookup[x1] & this.maskLGT_AGT_EQ;

        return 10;
    },

    // INCrement: INC src
    inc: function () {
        var x1 = this.readMemoryWord(this.S);

        x1 = (x1 + 1) & 0xFFFF;
        this.writeMemoryWord(this.S, x1);
        this.postIncrement(this.SRC);

        this.resetEQ_LGT_AGT_C_OV();
        this.ST |= this.wStatusLookup[x1] & this.maskLGT_AGT_EQ_OV_C;

        return 10;
    },

    // INCrement by Two: INCT src
    inct: function () {
        var x1 = this.readMemoryWord(this.S);

        x1 = (x1 + 2) & 0xFFFF;
        this.writeMemoryWord(this.S, x1);
        this.postIncrement(this.SRC);

        this.resetEQ_LGT_AGT_C_OV();
        this.ST |= this.wStatusLookup[x1] & this.maskLGT_AGT_EQ;

        if (x1 < 2) this.setC();
        if ((x1 === 0x8000) || (x1 === 0x8001)) this.setOV();

        return 10;
    },

    // DECrement: DEC src
    dec: function () {
        var x1 = this.readMemoryWord(this.S);

        x1 = (x1 - 1) & 0xFFFF;
        this.writeMemoryWord(this.S, x1);
        this.postIncrement(this.SRC);

        this.resetEQ_LGT_AGT_C_OV();
        this.ST |= this.wStatusLookup[x1] & this.maskLGT_AGT_EQ;

        if (x1 !== 0xffff) this.setC();
        if (x1 === 0x7fff) this.setOV();

        return 10;
    },

    // DECrement by Two: DECT src
    dect: function () {
        var x1 = this.readMemoryWord(this.S);

        x1 = (x1 - 2) & 0xFFFF;
        this.writeMemoryWord(this.S, x1);
        this.postIncrement(this.SRC);

        this.resetEQ_LGT_AGT_C_OV();
        this.ST |= this.wStatusLookup[x1] & this.maskLGT_AGT_EQ;

        // if (x1 < 0xfffe) this.set_C();
        if (x1 < 0xfffe) this.setC();
        if ((x1 === 0x7fff) || (x1 === 0x7ffe)) this.setOV();

        return 10;
    },

    bl: function () {
        // Branch and Link: BL src
        // Essentially a subroutine jump - return address is stored in R11
        // Note there is no stack, and no official return function.
        // A return is simply B *R11. Some assemblers define RT as this.

        this.writeMemoryWord(this.WP + 22, this.PC);
        this.setPC(this.S);
        this.postIncrement(this.SRC);

        return 12;
    },

    // SWaP Bytes: SWPB src
    // swap the high and low bytes of a word
    swpb: function () {
        var x1 = this.readMemoryWord(this.S);

        var x2 = ((x1 & 0xff) << 8) | (x1 >> 8);
        this.writeMemoryWord(this.S, x2);
        this.postIncrement(this.SRC);

        return 10;
    },

    // SET to One: SETO src
    // sets word to 0xffff
    seto: function () {
        this.writeMemoryWord(this.S, 0xffff);
        this.postIncrement(this.SRC);

        return 10;
    },

    // ABSolute value: ABS src
    abs: function () {
        var cycles = 0;
        var x1 = this.readMemoryWord(this.S);

        if ((x1 & 0x8000) !== 0) {
            var x2 = ((~x1) + 1) & 0xFFFF;	// if negative, make positive
            this.writeMemoryWord(this.S, x2);
            cycles += 2;
        }
        this.postIncrement(this.SRC);

        this.resetEQ_LGT_AGT_C_OV();
        this.ST |= this.wStatusLookup[x1] & this.maskLGT_AGT_EQ_OV;

        return cycles + 12;
    },

    // Shift Right Arithmetic: SRA src, dst
    // For the shift instructions, a count of '0' means use the
    // value in register 0. If THAT is zero, the count is 16.
    // The arithmetic operations preserve the sign bit
    sra: function () {
        var cycles = 0;
        if (this.D === 0) {
            this.D = this.readMemoryWord(this.WP) & 0xf;
            if (this.D === 0) this.D = 16;
            cycles += 8;
        }
        var x1 = this.readMemoryWord(this.S);
        var x4 = x1 & 0x8000;
        var x3 = 0;

        for (var x2 = 0; x2 < this.D; x2++) {
            x3 = x1 & 1;   /* save carry */
            x1 = x1 >> 1;  /* shift once */
            x1 = x1 | x4;  /* extend sign bit */
        }
        this.writeMemoryWord(this.S, x1);

        this.resetEQ_LGT_AGT_C();
        this.ST |= this.wStatusLookup[x1] & this.maskLGT_AGT_EQ;

        if (x3 !== 0) this.setC();

        return cycles + 12 + 2 * this.D;
    },

    // Shift Right Logical: SRL src, dst
    // The logical shifts do not preserve the sign
    srl: function () {
        var cycles = 0;
        if (this.D === 0) {
            this.D = this.readMemoryWord(this.WP) & 0xf;
            if (this.D === 0) this.D = 16;
            cycles += 8;
        }
        var x1 = this.readMemoryWord(this.S);
        var x3 = 0;

        for (var x2 = 0; x2 < this.D; x2++) {
            x3 = x1 & 1;
            x1= x1 >> 1;
        }
        this.writeMemoryWord(this.S, x1);

        this.resetEQ_LGT_AGT_C();
        this.ST |= this.wStatusLookup[x1] & this.maskLGT_AGT_EQ;

        if (x3 !== 0) this.setC();

        return cycles + 12 + 2 * this.D;
    },

    // Shift Left Arithmetic: SLA src, dst
    sla: function () {
        var cycles = 0;
        if (this.D === 0) {
            this.D = this.readMemoryWord(this.WP) & 0xf;
            if (this.D === 0) this.D = 16;
            cycles += 8;
        }
        var x1 = this.readMemoryWord(this.S);
        var x4 = x1 & 0x8000;
        this.resetEQ_LGT_AGT_C_OV();

        var x3=0;
        for (var x2 = 0; x2 < this.D; x2++) {
            x3 = x1 & 0x8000;
            x1 = x1 << 1;
            if ((x1 & 0x8000) !== x4) this.setOV();
        }
        x1 = x1 & 0xFFFF;
        this.writeMemoryWord(this.S , x1);

        this.ST |= this.wStatusLookup[x1] & this.maskLGT_AGT_EQ;

        if (x3 !== 0) this.setC();

        return cycles + 12 + 2 * this.D;
    },

    // Shift Right Circular: SRC src, dst
    // Circular shifts pop bits off one end and onto the other
    // The carry bit is not a part of these shifts, but it set
    // as appropriate
    src: function () {
        var cycles = 0;
        if (this.D === 0)
        {
            this.D = this.readMemoryWord(this.WP) & 0xf;
            if (this.D===0) this.D=16;
            cycles += 8;
        }
        var x1 = this.readMemoryWord(this.S);
        for (var x2 = 0; x2 < this.D; x2++) {
            var x4 = x1 & 0x1;
            x1 = x1 >> 1;
            if (x4 !== 0) {
                x1 = x1 | 0x8000;
            }
        }
        this.writeMemoryWord(this.S, x1);

        this.resetEQ_LGT_AGT_C();
        this.ST |= this.wStatusLookup[x1] & this.maskLGT_AGT_EQ;

        if (x4 !== 0) this.setC();

        return cycles + 12 + 2 * this.D;
    },

    // JuMP: JMP dsp
    // (unconditional)
    jmp: function () {
        if (this.flagX !== 0) {
            this.setPC(this.flagX);	// Update offset - it's relative to the X, not the opcode
        }
        if ((this.D & 0x80) !== 0) {
            this.D = 128 - (this.D & 0x7f);
            this.addPC(-(this.D + this.D));
        }
        else {
            this.addPC(this.D + this.D);
        }
        return 10;
    },

    // Jump if Less Than: JLT dsp
    jlt: function () {
        if (this.getAGT() === 0 && this.getEQ() === 0) {
            if (this.flagX !== 0) {
                this.setPC(this.flagX);	// Update offset - it's relative to the X, not the opcode
            }

            if ((this.D & 0x80) !== 0) {
                this.D = 128 - (this.D & 0x7f);
                this.addPC(-(this.D + this.D));
            }
            else {
                this.addPC(this.D + this.D);
            }
            return 10;
        } else {
            return 8;
        }
    },

    // Jump if Low or Equal: JLE dsp
    jle: function () {
        if ((this.getLGT() === 0) || (this.getEQ() !== 0)) {
            if (this.flagX !== 0) {
                this.setPC(this.flagX);	// Update offset - it's relative to the X, not the opcode
            }

            if ((this.D & 0x80) !== 0) {
                this.D = 128 - (this.D & 0x7f);
                this.addPC(-(this.D + this.D));
            }
            else {
                this.addPC(this.D + this.D);
            }
            return 10;
        } else {
            return 8;
        }
    },

    // Jump if equal: JEQ dsp
    // Conditional relative branch. The displacement is a signed byte representing
    // the number of words to branch
    jeq: function () {
        if (this.getEQ() !== 0) {
            if (this.flagX !== 0) {
                this.setPC(this.flagX);	// Update offset - it's relative to the X, not the opcode
            }

            if ((this.D & 0x80) !== 0) {
                this.D = 128 - (this.D & 0x7f);
                this.addPC(-(this.D + this.D));
            } else {
                this.addPC(this.D + this.D);
            }
            return 10;
        } else {
            return 8;
        }
    },

    // Jump if High or Equal: JHE dsp
    jhe: function () {
        if ((this.getLGT() !== 0) || (this.getEQ() !== 0)) {
            if (this.flagX !== 0) {
                this.setPC(this.flagX);	// Update offset - it's relative to the X, not the opcode
            }

            if ((this.D & 0x80) !== 0) {
                this.D = 128 - (this.D & 0x7f);
                this.addPC(-(this.D + this.D));
            } else {
                this.addPC(this.D + this.D);
            }
            return 10;
        } else {
            return 8;
        }
    },

    // Jump if Greater Than: JGT dsp
    jgt: function () {
        if (this.getAGT() !== 0) {
            if (this.flagX !== 0) {
                this.setPC(this.flagX);	// Update offset - it's relative to the X, not the opcode
            }

            if ((this.D & 0x80) !== 0) {
                this.D = 128-(this.D & 0x7f);
                this.addPC(-(this.D + this.D));
            } else {
                this.addPC(this.D + this.D);
            }
            return 10;
        } else {
            return 8;
        }
   },

    // Jump if Not Equal: JNE dsp
    jne: function () {
        if (this.getEQ() === 0) {
            if (this.flagX !== 0) {
                this.setPC(this.flagX);	// Update offset - it's relative to the X, not the opcode
            }
            if ((this.D & 0x80) !== 0) {
                this.D = 128 - (this.D & 0x7f);
                this.addPC(-(this.D + this.D));
            } else {
                this.addPC(this.D + this.D);
            }
            return 10;
        }
        else {
            return 8;
        }
    },

    // Jump if No Carry: JNC dsp
    jnc: function () {
        if (this.getC() === 0) {
            if (this.flagX !== 0) {
                this.setPC(this.flagX);	// Update offset - it's relative to the X, not the opcode
            }

            if ((this.D & 0x80) !== 0) {
                this.D = 128 - (this.D & 0x7f);
                this.addPC(-(this.D + this.D));
            } else {
                this.addPC(this.D + this.D);
            }
            return 10;
        }
        else {
            return 8;
        }
    },

    // Jump On Carry: JOC dsp
    joc: function () {
        if (this.getC() !== 0) {
            if (this.flagX !== 0) {
                this.setPC(this.flagX);	// Update offset - it's relative to the X, not the opcode
            }

            if ((this.D & 0x80) !== 0) {
                this.D = 128 - (this.D & 0x7f);
                this.addPC(-(this.D + this.D));
            } else {
                this.addPC(this.D + this.D);
            }
            return 10;
        }
        else {
            return 8;
        }
    },

    // Jump if No Overflow: JNO dsp
    jno: function () {
        if (this.getOV() === 0) {
            if (this.flagX !== 0) {
                this.setPC(this.flagX);	// Update offset - it's relative to the X, not the opcode
            }

            if ((this.D & 0x80) !== 0) {
                this.D = 128 - (this.D & 0x7f);
                this.addPC(-(this.D + this.D));
            } else {
                this.addPC(this.D + this.D);
            }
            return 10;
        }
        else {
            return 8;
        }
    },

    jl: function () {
        if ((this.getLGT() === 0) && (this.getEQ() === 0)) {
            if (this.flagX !== 0) {
                this.setPC(this.flagX);	// Update offset - it's relative to the X, not the opcode
            }

            if ((this.D & 0x80) !== 0) {
                this.D = 128 - (this.D & 0x7f);
                this.addPC(-(this.D + this.D));
            } else {
                this.addPC(this.D + this.D);
            }
            return 10;
        }
        else {
            return 8;
        }
    },

    // Jump if High: JH dsp
    jh: function () {
        if ((this.getLGT() !== 0) && (this.getEQ() === 0))
        {
            if (this.flagX !== 0) {
                this.setPC(this.flagX);	// Update offset - it's relative to the X, not the opcode
            }

            if ((this.D & 0x80) !== 0) {
                this.D = 128 - (this.D & 0x7f);
                this.addPC(-(this.D + this.D));
            } else {
                this.addPC(this.D + this.D);
            }
            return 10;
        } else {
            return 8;
        }
    },

    // Jump on Odd Parity: JOP dsp
    jop: function () {
        if (this.getOP() !== 0) {
            if (this.flagX !== 0) {
                this.setPC(this.flagX);	// Update offset - it's relative to the X, not the opcode
            }

            if ((this.D & 0x80) !== 0) {
                this.D = 128 - (this.D & 0x7f);
                this.addPC(-(this.D + this.D));
            } else {
                this.addPC(this.D + this.D);
            }
            return 10;
        }
        else {
            return 8;
        }
    },

    // Set Bit On: SBO src
    // Sets a bit in the CRU
    sbo: function () {
        var addr = (this.readMemoryWord(this.WP + 24) >> 1) & 0xfff;
        if ((this.D & 0x80) !== 0) {
            addr -= 128 - (this.D & 0x7f);
        } else {
            addr += this.D;
        }
        this.writeCruBit(addr, true);

        return 12;
    },

    // Set Bit Zero: SBZ src
    // Zeros a bit in the CRU
    sbz: function () {
        var addr = (this.readMemoryWord(this.WP + 24) >> 1) & 0xfff;
        if ((this.D & 0x80) !== 0) {
            addr -= 128-(this.D & 0x7f);
        } else {
            addr += this.D;
        }
        this.writeCruBit(addr, false);

        return 12;
    },

    // Test Bit: TB src
    // Tests a CRU bit
    tb: function () {
        var add = (this.readMemoryWord(this.WP + 24) >> 1) & 0xfff;
        if ((this.D & 0x80) !== 0) {
            add -= 128 - (this.D & 0x7f);
        } else {
            add += this.D;
        }
        if (this.readCruBit(add)) this.setEQ(); else this.resetEQ();

        return 12;
    },

    // Compare Ones Corresponding: COC src, dst
    // Basically comparing against a mask, if all set bits in the src match
    // set bits in the dest (mask), the equal bit is set
    coc: function () {
        var x1 = this.readMemoryWord(this.S);
        this.postIncrement(this.SRC);

        var cycles = this.fixD();
        var x2 = this.readMemoryWord(this.D);

        var x3 = x1 & x2;

        if (x3 === x1) this.setEQ(); else this.resetEQ();

        return cycles + 14;
    },

    // Compare Zeros Corresponding: CZC src, dst
    // The opposite of COC. Each set bit in the dst (mask) must
    // match up with a zero bit in the src to set the equals flag
    czc: function () {
        var x1 = this.readMemoryWord(this.S);
        this.postIncrement(this.SRC);

        var cycles = this.fixD();
        var x2 = this.readMemoryWord(this.D);

        var x3 = x1 & x2;

        if (x3 === 0) this.setEQ(); else this.resetEQ();

        return cycles + 14;
    },

    // eXclusive OR: XOR src, dst
    xor: function () {
        var x1 = this.readMemoryWord(this.S);
        this.postIncrement(this.SRC);

        var cycles = this.fixD();
        var x2 = this.readMemoryWord(this.D);

        var x3 = (x1 ^ x2) & 0xFFFF;
        this.writeMemoryWord(this.D, x3);

        this.resetLGT_AGT_EQ();
        this.ST |= this.wStatusLookup[x3] & this.maskLGT_AGT_EQ;

        return cycles + 14;
    },

    // eXtended OPeration: XOP src ???
    // The CPU maintains a jump table starting at 0x0040, containing BLWP style
    // jumps for each operation. In addition, the new R11 gets a copy of the address of
    // the source operand.
    // Apparently not all consoles supported both XOP 1 and 2 (depends on the ROM?)
    // so it is probably rarely, if ever, used on the TI99.
    xop: function () {
        this.D &= 0xf;

        var x1 = this.WP;
        this.setWP(this.readMemoryWord(0x0040 + (this.D << 2)));
        this.writeMemoryWord(this.WP + 22, this.S);
        this.postIncrement(this.SRC);
        this.writeMemoryWord(this.WP + 26, x1);
        this.writeMemoryWord(this.WP + 28, this.PC);
        this.writeMemoryWord(this.WP + 30, this.ST);
        this.setPC(this.readMemoryWord(0x0042 + (this.D << 2)));
        this.setX();

        // skip_interrupt=1;

        return 36;
    },

    // LoaD CRu - LDCR src, dst
    // Writes dst bits serially out to the CRU registers
    // The CRU is the 9901 Communication chip, tightly tied into the 9900.
    // It's serially accessed and has 4096 single bit IO registers.
    // It's stupid and thinks 0 is true and 1 is false.
    // All addresses are offsets from the value in R12, which is divided by 2
    ldcr: function () {
        if (this.D === 0) this.D = 16;
        var x1 = (this.D < 9 ? this.readMemoryByte(this.S) : this.readMemoryWord(this.S));
        this.postIncrement(this.SRC);

        var x3 = 1;
        var cruBase = (this.readMemoryWord(this.WP + 24) >> 1) & 0xfff;
        for (var x2 = 0; x2 < this.D; x2++) {
            this.writeCruBit(cruBase + x2, (x1 & x3) !== 0);
            x3 = x3 << 1;
        }

        this.resetLGT_AGT_EQ();
        if (this.D < 9) {
            this.resetOP();
            this.ST |= this.bStatusLookup[x1 & 0xff] & this.maskLGT_AGT_EQ_OP;
        } else {
            this.ST |= this.wStatusLookup[x1] & this.maskLGT_AGT_EQ;
        }

        return 20 + 2 * this.D;
    },

    // STore CRU: STCR src, dst
    // Stores dst bits from the CRU into src
    stcr: function () {
        if (this.D === 0) this.D = 16;
        var x1=0;
        var x3=1;

        var cruBase = (this.readMemoryWord(this.WP + 24) >> 1) & 0xfff;
        for (var x2 = 0; x2 < this.D; x2++) {
            var x4 = this.readCruBit(cruBase + x2);
            if (x4) {
                x1 = x1 | x3;
            }
            x3 <<= 1;
        }

        if (this.D < 9) {
            this.writeMemoryByte(this.S, x1 & 0xff);
        }
        else {
            this.writeMemoryWord(this.S, x1);
        }
        this.postIncrement(this.SRC);

        this.resetLGT_AGT_EQ();
        if (this.D < 9) {
            this.resetOP();
            this.ST |= this.bStatusLookup[x1 & 0xff] & this.maskLGT_AGT_EQ_OP;
        } else {
            this.ST |= this.wStatusLookup[x1] & this.maskLGT_AGT_EQ;
        }

        var cycles;
        if (this.D < 8) {
            cycles = 42;
        } else if (this.D < 9) {
            cycles = 44;
        } else if (this.D < 16) {
            cycles = 58;
        } else {
            cycles = 60;
        }
        return cycles;
    },

    // MultiPlY: MPY src, dst
    // Multiply src by dest and store 32-bit result
    // Note: src and dest are unsigned.
    mpy: function () {
        var x1 = this.readMemoryWord(this.S);
        this.postIncrement(this.SRC);

        this.D = this.WP + (this.D << 1);
        var x3 = this.readMemoryWord(this.D);
        x3 = x3 * x1;
        this.writeMemoryWord(this.D,(x3 >> 16) & 0xFFFF);
        this.writeMemoryWord(this.D + 2,(x3 & 0xFFFF));

        return 52;
    },

    // DIVide: DIV src, dst
    // Dest, a 2 word number, is divided by src. The result is stored as two words at the dst:
    // the first is the whole number result, the second is the remainder
    div: function () {
        var x2 = this.readMemoryWord(this.S);
        this.postIncrement(this.SRC);

        this.D = this.WP + (this.D << 1);
        var x3 = this.readMemoryWord(this.D);

        if (x2 > x3) {		// x2 can not be zero because they're unsigned
            x3 = (x3 << 16) | this.readMemoryWord(this.D + 2);
            var x1 = x3 / x2;
            this.writeMemoryWord(this.D, x1 & 0xFFFF);
            x1 = x3 % x2;
            this.writeMemoryWord(this.D + 2, x1 & 0xFFFF);
            this.resetOV();
            return 92;		// This is not accurate. (Up to 124 "depends on the partial quotient after each clock cycle during execution")
        }
        else {
            this.setOV();	// division wasn't possible - change nothing
            return 16;
        }
    },

    // Set Zeros Corresponding: SZC src, dst
    // Zero all bits in dest that are zeroed in src
    szc: function () {
        var x1 = this.readMemoryWord(this.S);
        this.postIncrement(this.SRC);

        var cycles = this.fixD();
        var x2 = this.readMemoryWord(this.D);
        var x3 = (~x1) & x2;
        this.writeMemoryWord(this.D, x3);
        this.postIncrement(this.DST);

        this.resetLGT_AGT_EQ();
        this.ST |= this.wStatusLookup[x3] & this.maskLGT_AGT_EQ;

        return cycles + 14;
    },

    // Set Zeros Corresponding, Byte: SZCB src, dst
    szcb: function () {
        var x1 = this.readMemoryByte(this.S);
        this.postIncrement(this.SRC);

        var cycles = this.fixD();
        var x2 = this.readMemoryByte(this.D);
        var x3 = (~x1) & x2;
        this.writeMemoryByte(this.D, x3);
        this.postIncrement(this.DST);

        this.resetLGT_AGT_EQ_OP();
        this.ST |= this.bStatusLookup[x3] & this.maskLGT_AGT_EQ_OP;

        return cycles + 14;
    },

    // Subtract: S src, dst
    s: function () {
        var x1 = this.readMemoryWord(this.S);
        this.postIncrement(this.SRC);

        var cycles = this.fixD();
        var x2 = this.readMemoryWord(this.D);
        var x3 = (x2 - x1) & 0xFFFF;
        this.writeMemoryWord(this.D, x3);
        this.postIncrement(this.DST);

        this.resetEQ_LGT_AGT_C_OV();
        this.ST |= this.wStatusLookup[x3] & this.maskLGT_AGT_EQ;

        // any number minus 0 sets carry.. Tursi's theory is that converting 0 to the two's complement
        // is causing the carry flag to be set.
        if ((x3 < x2) || (x1 === 0)) this.setC();
        if (((x1 & 0x8000) !== (x2 & 0x8000)) && ((x3 & 0x8000) !== (x2 & 0x8000))) this.setOV();

        return cycles + 14;
    },

    // Subtract Byte: SB src, dst
    sb: function () {
        var x1 = this.readMemoryByte(this.S);
        this.postIncrement(this.SRC);

        var cycles = this.fixD();
        var x2 = this.readMemoryByte(this.D);
        var x3 = (x2 - x1) & 0xFF;
        this.writeMemoryByte(this.D, x3);
        this.postIncrement(this.DST);

        this.resetEQ_LGT_AGT_C_OV_OP();
        this.ST |= this.bStatusLookup[x3] & this.maskLGT_AGT_EQ_OP;

        // any number minus 0 sets carry.. Tursi's theory is that converting 0 to the two's complement
        // is causing the carry flag to be set.
        if ((x3 < x2) || (x1 === 0)) this.setC();
        if (((x1 & 0x80) !== (x2 & 0x80)) && ((x3 & 0x80) !== (x2 & 0x80))) this.setOV();

        return cycles + 14;
    },

    // Compare words: C src, dst
    c: function () {
        var x3 = this.readMemoryWord(this.S);
        this.postIncrement(this.SRC);

        var cycles = this.fixD();
        var x4 = this.readMemoryWord(this.D);
        this.postIncrement(this.DST);

        this.resetLGT_AGT_EQ();
        if (x3 > x4) this.setLGT();
        if (x3 === x4) this.setEQ();
        if ((x3 & 0x8000) === (x4 & 0x8000)) {
            if (x3 > x4) this.setAGT();
        }
        else {
            if ((x4 & 0x8000) !== 0) this.setAGT();
        }
        return cycles + 14;
    },

    // CompareBytes: CB src, dst
    cb: function () {
        var x3 = this.readMemoryByte(this.S);
        this.postIncrement(this.SRC);

        var cycles = this.fixD();
        var x4 = this.readMemoryByte(this.D);
        this.postIncrement(this.DST);

        this.resetLGT_AGT_EQ_OP();
        if (x3 > x4) this.setLGT();
        if (x3 === x4) this.setEQ();
        if ((x3 & 0x80) === (x4 & 0x80)) {
            if (x3 > x4) this.setAGT();
        } else {
            if ((x4 & 0x80) !== 0) this.setAGT();
        }
        this.ST |= this.bStatusLookup[x3] & this.BIT_OP;

        return cycles + 14;
    },

    // Add words: A src, dst
    a: function () {
        var x1 = this.readMemoryWord(this.S);
        this.postIncrement(this.SRC);

        var cycles = this.fixD();
        var x2 = this.readMemoryWord(this.D);
        var x3 = (x2 + x1) & 0xFFFF;
        this.writeMemoryWord(this.D, x3);
        this.postIncrement(this.DST);

        this.resetEQ_LGT_AGT_C_OV();	// We come out with either EQ or LGT, never both
        this.ST |= this.wStatusLookup[x3] & this.maskLGT_AGT_EQ;

        if (x3 < x2) this.setC();	// if it wrapped around, set carry
        if (((x1 & 0x8000) === (x2 & 0x8000)) && ((x3 & 0x8000) !== (x2 & 0x8000))) this.setOV(); // if it overflowed or underflowed (signed math), set overflow

        return cycles + 14;
    },

    // Add bytes: A src, dst
    ab: function () {
        var x1 = this.readMemoryByte(this.S);
        this.postIncrement(this.SRC);

        var cycles = this.fixD();
        var x2 = this.readMemoryByte(this.D);
        var x3 = (x2 + x1) & 0xFF;
        this.writeMemoryByte(this.D, x3);
        this.postIncrement(this.DST);

        this.resetEQ_LGT_AGT_C_OV();	// We come out with either EQ or LGT, never both
        this.ST |= this.bStatusLookup[x3] & this.maskLGT_AGT_EQ_OP;

        if (x3 < x2) this.setC();	// if it wrapped around, set carry
        if (((x1 & 0x80) === (x2 & 0x80)) && ((x3 & 0x80) !== (x2 & 0x80))) this.setOV();  // if it overflowed or underflowed (signed math), set overflow

        return cycles + 14;
    },

    // MOVe words: MOV src, dst
    mov: function () {
        var x1 = this.readMemoryWord(this.S);
        this.postIncrement(this.SRC);
        var cycles = this.fixD();

        this.writeMemoryWord(this.D, x1);
        this.postIncrement(this.DST);

        this.resetLGT_AGT_EQ();
        this.ST |= this.wStatusLookup[x1] & this.maskLGT_AGT_EQ;

        return cycles + 14;
    },

    // MOVe Bytes: MOVB src, dst
    movb: function () {
        var x1 = this.readMemoryByte(this.S);
        this.postIncrement(this.SRC);

        var cycles = this.fixD();
        this.writeMemoryByte(this.D, x1);
        this.postIncrement(this.DST);

        this.resetLGT_AGT_EQ_OP();
        this.ST |= this.bStatusLookup[x1] & this.maskLGT_AGT_EQ_OP;

        return cycles + 14;
    },

    // Set Ones Corresponding: SOC src, dst
    // Essentially performs an OR - setting all the bits in dst that
    // are set in src
    soc: function () {
        var x1 = this.readMemoryWord(this.S);
        this.postIncrement(this.SRC);

        var cycles = this.fixD();
        var x2 = this.readMemoryWord(this.D);
        var x3 = x1 | x2;
        this.writeMemoryWord(this.D, x3);
        this.postIncrement(this.DST);

        this.resetLGT_AGT_EQ();
        this.ST |= this.wStatusLookup[x3] & this.maskLGT_AGT_EQ;

        return cycles + 14;
    },

    socb: function () {
        var x1 = this.readMemoryByte(this.S);
        this.postIncrement(this.SRC);

        var cycles = this.fixD();
        var x2 = this.readMemoryByte(this.D);
        var x3 = x1 | x2;
        this.writeMemoryByte(this.D, x3);
        this.postIncrement(this.DST);

        this.resetLGT_AGT_EQ_OP();
        this.ST |= this.bStatusLookup[x3] & this.maskLGT_AGT_EQ_OP;

        return cycles + 14;
    },

    getLGT:     function () { return (this.ST & this.BIT_LGT) },	// Logical Greater Than
    getAGT:     function () { return (this.ST & this.BIT_AGT) },	// Arithmetic Greater Than
    getEQ:      function () { return (this.ST & this.BIT_EQ) },	// Equal
    getC:       function () { return (this.ST & this.BIT_C) },	// Carry
    getOV:      function () { return (this.ST & this.BIT_OV) },	// Overflow
    getOP:      function () { return (this.ST & this.BIT_OP) },	// Odd Parity
    getX:       function () { return (this.ST & this.BIT_X) },	// Set during an XOP instruction

    setLGT:     function () { this.ST |= 0x8000 },       		// Logical Greater than: >0x0000
    setAGT:     function () { this.ST |= 0x4000 },		        // Arithmetic Greater than: >0x0000 and <0x8000
    setEQ:      function () { this.ST |= 0x2000 },       		// Equal: ==0x0000
    setC:       function () { this.ST |= 0x1000 },		        // Carry: carry occurred during operation
    setOV:      function () { this.ST |= 0x0800 },       		// Overflow: overflow occurred during operation
    setOP:      function () { this.ST |= 0x0400 },	            // Odd parity: word has odd number of '1' bits
    setX:       function () { this.ST |= 0x0200 },		        // Executing 'X' statement

    resetLGT:   function () { this.ST &= 0x7fff },               // Clear the flags
    resetAGT:   function () { this.ST &= 0xbfff },
    resetEQ:    function () { this.ST &= 0xdfff },
    resetC:     function () { this.ST &= 0xefff },
    resetOV:    function () { this.ST &= 0xf7ff },
    resetOP:    function () { this.ST &= 0xfbff },
    resetX:     function () { this.ST &= 0xfdff },

    // Group clears
    resetEQ_LGT:               function () { this.ST &= 0x5fff },
    resetLGT_AGT_EQ:           function () { this.ST &= 0x1fff },
    resetLGT_AGT_EQ_OP:        function () { this.ST &= 0x1bff },
    resetEQ_LGT_AGT_OV:        function () { this.ST &= 0x17ff },
    resetEQ_LGT_AGT_C:         function () { this.ST &= 0x0fff },
    resetEQ_LGT_AGT_C_OV:      function () { this.ST &= 0x7ff },
    resetEQ_LGT_AGT_C_OV_OP:   function () { this.ST &= 0x3ff },

    logRegs: function () {
        this.log.info(this.getRegsString() + this.getInternalRegsString());
    },

    getInternalRegsString: function () {
        return "PC :" + this.PC.toHexWord() + " WP :" + this.WP.toHexWord() + " ST :" + this.ST.toHexWord();
    },

    getRegsString: function () {
        var s = "";
        for (var i = 0; i < 16; i++) {
            s += "R" + i + ":" + (this.getReg(i)).toHexWord() + " ";
        }
        return s;
    },

    getReg: function (i) {
        return this.memory.getWord(this.WP + 2 * i);
    },

    getRegsStringFormatted: function () {
        var s = "";
        for (var i = 0; i < 16; i++) {
            s += "R" + i + (i < 10 ? " " : "") + ":" + (this.memory.getWord(this.WP + 2 * i)).toHexWord() + (i % 4 === 3 ? "\n" : " ");
        }
        return s;
    },

    isSuspended: function () {
        return this.suspended;
    },

    setSuspended: function (suspended) {
        this.suspended = suspended;
    },

    getBreakpoint: function () {
        return this.breakpoint;
    },

    setBreakpoint: function (addr) {
        this.breakpoint = addr;
    },

    setOtherBreakpoint: function (addr) {
        this.otherBreakpoint = addr;
    },

    atBreakpoint: function () {
        return this.PC === this.breakpoint || this.PC === this.otherBreakpoint;
    },

    dumpProfile: function () {
        if (TMS9900.PROFILE) {
            var sortedProfile = [];
            for (var i = 0; i < 0x10000; i++) {
                sortedProfile[i] = {addr: i, count: this.profile[i]};
            }
            sortedProfile.sort(function (p1, p2) {
                return p2.count - p1.count;
            });
            this.log.info("Profile:");
            for (var j = 0; j < 16; j++) {
                this.log.info(sortedProfile[j].addr.toHexWord() + ": " + sortedProfile[j].count + " cycles.");
            }
            this.profile = new Uint32Array(0x10000);
            this.log.info("--------");
        }
    },

    getState: function () {
        return {
            PC: this.PC,
            WP: this.WP,
            ST: this.ST,
            flagX: this.flagX,
            cycles: this.cycles,
            breakpoint: this.breakpoint,
            otherBreakpoint: this.otherBreakpoint,
            illegalCount: this.illegalCount,
            suspended: this.suspended
        };
    },

    restoreState: function (state) {
        this.PC = state.PC;
        this.WP = state.WP;
        this.ST = state.ST;
        this.flagX = state.flagX;
        this.cycles = state.cycles;
        this.breakpoint = state.breakpoint;
        // this.otherBreakpoint = state.otherBreakpoint;
        this.illegalCount = state.illegalCount;
        this.suspended = state.suspended;
    }
};
