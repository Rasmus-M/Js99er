/*
 * js99'er - TI-99/4A emulator written in JavaScript
 *
 * Created 2014 by Rasmus Moustgaard <rasmus.moustgaard@gmail.com>
 *
 * This file is based on code borrowed from the Classic99 emulator
 * Copyright (c) 2007 Mike Brent aka Tursi aka HarmlessLion.com
 *
 * F18A GPU emulation.
 *
 */

'use strict';

F18AGPU.FRAME_CYCLES = 500000;

function F18AGPU(f18a) {
    this.f18a = f18a;
    this.vdpRAM = f18a.getRAM();

    this.cpuIdle = true;
    this.WP = 0x4800;

    // Internal registers
    this.PC = 0;
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
    this.log = Log.getLog();
}

F18AGPU.prototype = {

    reset: function() {
        this.cpuIdle = true;
        this.PC = 0;
        for (var i = 0; i < 32; i++) {
            this.vdpRAM[this.WP + i] = 0;
        }
        this.ST = 0x01C0;
        this.flagX = 0;
        this.Ts = 0;
        this.Td = 0;
        this.D = 0;
        this.S = 0;
        this.B = 0;
        this.nPostInc = [0, 0];
        this.cycles = 0;
    },

    // Build the word status lookup table
    buildWStatusLookupTable: function() {
        var wStatusLookup = [];
        for (var i = 0; i < 0x10000; i++) {
            wStatusLookup[i] = 0;
            // LGT
            if (i > 0) wStatusLookup[i] |= this.BIT_LGT;
            // AGT
            if ((i > 0) && (i < 0x8000)) wStatusLookup[i] |= this.BIT_AGT;
            // EQ
            if (i == 0) wStatusLookup[i] |= this.BIT_EQ;
            // C
            if (i == 0) wStatusLookup[i] |= this.BIT_C;
            // OV
            if (i == 0x8000) wStatusLookup[i] |= this.BIT_OV;
        }
        return wStatusLookup;
    },

    // Build the byte status lookup table
    buildBStatusLookupTable: function() {
        var bStatusLookup = [];
        for (var i = 0; i < 0x100; i++) {
            var x = (i & 0xFF);
            bStatusLookup[i] = 0;
            // LGT
            if (i > 0) bStatusLookup[i] |= this.BIT_LGT;
            // AGT
            if ((i > 0) && (i < 0x80)) bStatusLookup[i] |= this.BIT_AGT;
            // EQ
            if (i == 0) bStatusLookup[i] |= this.BIT_EQ;
            // C
            if (i == 0) bStatusLookup[i] |= this.BIT_C;
            // OV
            if (i == 0x80) bStatusLookup[i] |= this.BIT_OV;
            // OP
            for (var z = 0; x != 0; x = (x & (x - 1)) & 0xFF) z++;						// black magic?
            if ((z & 1) != 0) bStatusLookup[i] |= this.BIT_OP;		    // set bit if an odd number
        }
        return bStatusLookup;
    },

    run: function(cyclesToRun) {
        var startCycles = this.cycles;
        while (!this.cpuIdle && this.cycles - startCycles < cyclesToRun) {
            // Execute instruction
            var instruction = this.readMemoryWord(this.PC);
            this.inctPC();
            this.addCycles(this.execute(instruction));
        }
    },

    execute: function(instruction) {
        var opcode = this.decoderTable[instruction];
        if (opcode != null) {
            var cycles = this.decodeOperands(opcode, instruction);
            var moreCycles = this[opcode.id.toLowerCase()].call(this);
            if (moreCycles != 0) {
                cycles += moreCycles;
            }
            else {
                this.log.info(((this.PC - 2) & 0xFFFF).toHexWord() + ": " + instruction.toHexWord() + " Not implemented");
            }
            return cycles;
        }
        else {
            this.log.info(((this.PC - 2) & 0xFFFF).toHexWord() + ": " + instruction.toHexWord() + " Illegal");
            return 10;
        }
    },

    isIdle: function() {
        return this.cpuIdle;
    },

    setIdle: function(idle) {
        this.cpuIdle = idle;
    },

    getPC: function() {
        return this.PC;
    },

    setPC: function(value) {
        this.PC = value;
        this.setIdle(false);
        this.run(F18AGPU.FRAME_CYCLES);
    },

    inctPC: function() {
        this.PC = (this.PC + 2) & 0xFFFF;
    },

    addPC: function(value) {
        this.PC = (this.PC + value) & 0xFFFF;
    },

    getST: function() {
        return this.ST;
    },

    addCycles: function(value) {
        this.cycles += value;
    },

    decodeOperands: function(opcode, instr) {
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
                if (opcode.id == "STST" || opcode.id == "STWP") {
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

    fixS: function() {
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
                if (this.S != 0) {
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
                this.nPostInc[this.SRC] = this.S | (this.B == 1 ? this.POSTINC1 : this.POSTINC2);
                t2 = this.WP + (this.S << 1);
                temp = this.readMemoryWord(t2);
                this.S = temp;
                // (add 1 if byte, 2 if word) (*R1+) Address is the contents of the register, which
                // register indirect autoincrement is incremented by 1 for byte or 2 for word ops
                cycles += this.B == 1 ? 6 : 8;
                break;
        }
        return cycles;
    },

    fixD: function() {
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
                if (this.D != 0) {
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
                this.nPostInc[this.DST] = this.D | (this.B == 1 ? this.POSTINC1 : this.POSTINC2);
                // (add 1 if byte, 2 if word)
                t2 = this.WP + (this.D << 1);
                temp = this.readMemoryWord(t2);
                this.D = temp;
                // register indirect autoincrement
                cycles += this.B == 1 ? 6 : 8;
                break;
        }
    },

    postIncrement: function(nWhich) {
        if (this.nPostInc[nWhich]) {
            var i = this.nPostInc[nWhich] & 0xf;
            var t2 = this.WP + (i << 1);

            var tmpCycles = this.cycles;
            var nTmpVal = this.readMemoryWord(t2);	// We need to reread this value, but the memory access can't count for cycles
            this.cycles = tmpCycles;

            this.writeMemoryWord(t2, (nTmpVal + ((this.nPostInc[nWhich] & this.POSTINC2) != 0 ? 2 : 1)) & 0xFFFF);
            this.nPostInc[nWhich] = 0;
        }
    },

    writeMemoryWord: function(addr, w) {
        this.vdpRAM[addr] = (w & 0xFF00) >> 8;
        this.vdpRAM[addr + 1] = w & 0x00FF;
        if (addr < 0x4000) {
            this.f18a.redrawRequired = true;
        }
    },

    writeMemoryByte: function(addr, b) {
        if (addr >= 0x6000 && addr < 0x6040) {
            this.f18a.writeRegister(addr - 0x6000, b);
        }
        else {
            this.vdpRAM[addr] = b;
            if (addr < 0x4000) {
                this.f18a.redrawRequired = true;
            }
        }
    },

    readMemoryWord: function(addr) {
        return this.vdpRAM[addr] << 8 | this.vdpRAM[addr + 1];
    },

    readMemoryByte: function(addr) {
        if (addr == 0x7000) {
            return this.f18a.getCurrentScanline();
        }
        else {
            return this.vdpRAM[addr];
        }
    },

    // Load Immediate: LI src, imm
    li: function() {
        this.writeMemoryWord(this.D, this.S);
        this.resetLGT_AGT_EQ();
        this.ST |= this.wStatusLookup[this.S] & this.maskLGT_AGT_EQ;
        return 12;
    },

    // Add Immediate: AI src, imm
    ai: function() {
        var x1 = this.readMemoryWord(this.D);

        var x3 = (x1 + this.S) & 0xFFFF;
        this.writeMemoryWord(this.D, x3);

        this.resetEQ_LGT_AGT_C_OV();
        this.ST |= this.wStatusLookup[x3] & this.maskLGT_AGT_EQ;

        if (x3 < x1) this.setC();
        if (((x1 & 0x8000) == (this.S & 0x8000)) && ((x3 & 0x8000) != (this.S & 0x8000))) this.setOV();

        return 14;
    },

    // AND Immediate: ANDI src, imm
    andi: function() {
        var x1 = this.readMemoryWord(this.D);
        var x2 = x1 & this.S;
        this.writeMemoryWord(this.D, x2);

        this.resetLGT_AGT_EQ();
        this.ST |= this.wStatusLookup[x2] & this.maskLGT_AGT_EQ;

        return 14;
    },

    // OR Immediate: ORI src, imm
    ori: function() {
        var x1 = this.readMemoryWord(this.D);
        var x2 = x1 | this.S;
        this.writeMemoryWord(this.D, x2);

        this.resetLGT_AGT_EQ();
        this.ST |= this.wStatusLookup[x2] & this.maskLGT_AGT_EQ;

        return 14;
    },

    // Compare Immediate: CI src, imm
    ci: function() {
        var x3 = this.readMemoryWord(this.D);

        this.resetLGT_AGT_EQ();
        if (x3 > this.S) this.setLGT();
        if (x3 == this.S) this.setEQ();
        if ((x3 & 0x8000) == (this.S & 0x8000)) {
            if (x3 > this.S) this.setAGT();
        } else {
            if ((this.S & 0x8000) != 0) this.setAGT();
        }

        return 14;
    },

    // STore Workspace Pointer: STWP src
    // Copy the workspace pointer to memory
    stwp: function() {
        // Not implemented
        return null;
    },

    // STore STatus: STST src
    // Copy the status register to memory
    stst: function() {
        this.writeMemoryWord(this.D, this.ST);
        return 8;
    },

    // Load Workspace Pointer Immediate: LWPI imm
    // changes the Workspace Pointer
    lwpi: function() {
        // Not implemented
        return null;
    },

    // Load Interrupt Mask Immediate: LIMI imm
    // Sets the CPU interrupt mask
    limi: function() {
        return null;
        // Not implemented
    },

    // This sets A0-A2 to 010, and pulses CRUCLK until an interrupt is received.
    idle: function() {
        this.setIdle(true);
        return 10;
    },

    // This will set A0-A2 to 011 and pulse CRUCLK (so not emulated)
    // However, it does have an effect, it zeros the interrupt mask
    rset: function() {
        // Not implemented
        return null;
    },

    // ReTurn with Workspace Pointer: RTWP
    // The matching return for BLWP, see BLWP for description
    // F18A Modified, does not use R13, only performs R14->PC, R15->status flags
    rtwp: function() {
        this.ST = this.readMemoryWord(this.WP + 30); // R15
        this.PC = this.readMemoryWord(this.WP + 28); // R14
        return 14;
    },

    // This will set A0-A2 to 101 and pulse CRUCLK
    ckon: function() {
        // Not implemented
        return null;
    },

    // This will set A0-A2 to 110 and pulse CRUCLK
    ckof: function() {
        // Not implemented
        return null;
    },

    // This will set A0-A2 to 111 and pulse CRUCLK
    lrex: function() {
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
    blwp: function() {
        // Not implemented
        return null;
    },

    // Branch: B src
    // Unconditional absolute branch
    b: function() {
        this.PC = this.S;
        this.postIncrement(this.SRC);
        return 8;
    },

    // eXecute: X src
    // The argument is interpreted as an instruction and executed
    x: function() {
        if (this.flagX != 0) {
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
    clr: function() {
        this.writeMemoryWord(this.S, 0);
        this.postIncrement(this.SRC);
        return 10;
    },

    // NEGate: NEG src
    neg: function() {
        var x1 = this.readMemoryWord(this.S);

        x1 = ((~x1) + 1) & 0xFFFF;
        this.writeMemoryWord(this.S, x1);
        this.postIncrement(this.SRC);

        this.resetEQ_LGT_AGT_C_OV();
        this.ST |= this.wStatusLookup[x1] & this.maskLGT_AGT_EQ_OV_C;

        return 12;
    },

    // INVert: INV src
    inv: function() {
        var x1 = this.readMemoryWord(this.S);
        x1 = (~x1) & 0xFFFF;
        this.writeMemoryWord(this.S, x1);
        this.postIncrement(this.SRC);

        this.resetLGT_AGT_EQ();
        this.ST |= this.wStatusLookup[x1] & this.maskLGT_AGT_EQ;

        return 10;
    },

    // INCrement: INC src
    inc: function() {
        var x1 = this.readMemoryWord(this.S);

        x1 = (x1 + 1) & 0xFFFF;
        this.writeMemoryWord(this.S, x1);
        this.postIncrement(this.SRC);

        this.resetEQ_LGT_AGT_C_OV();
        this.ST |= this.wStatusLookup[x1] & this.maskLGT_AGT_EQ_OV_C;

        return 10;
    },

    // INCrement by Two: INCT src
    inct: function() {
        var x1 = this.readMemoryWord(this.S);

        x1 = (x1 + 2) & 0xFFFF;
        this.writeMemoryWord(this.S, x1);
        this.postIncrement(this.SRC);

        this.resetEQ_LGT_AGT_C_OV();
        this.ST |= this.wStatusLookup[x1] & this.maskLGT_AGT_EQ;

        if (x1 < 2) this.setC();
        if ((x1 == 0x8000) || (x1 == 0x8001)) this.setOV();

        return 10;
    },

    // DECrement: DEC src
    dec: function() {
        var x1 = this.readMemoryWord(this.S);

        x1 = (x1 - 1) & 0xFFFF;
        this.writeMemoryWord(this.S, x1);
        this.postIncrement(this.SRC);

        this.resetEQ_LGT_AGT_C_OV();
        this.ST |= this.wStatusLookup[x1] & this.maskLGT_AGT_EQ;

        if (x1 != 0xffff) this.setC();
        if (x1 == 0x7fff) this.setOV();

        return 10;
    },

    // DECrement by Two: DECT src
    dect: function() {
        var x1 = this.readMemoryWord(this.S);

        x1 = (x1 - 2) & 0xFFFF;
        this.writeMemoryWord(this.S, x1);
        this.postIncrement(this.SRC);

        this.resetEQ_LGT_AGT_C_OV();
        this.ST |= this.wStatusLookup[x1] & this.maskLGT_AGT_EQ;

        // if (x1 < 0xfffe) this.set_C();
        if (x1 < 0xfffe) this.setC();
        if ((x1 == 0x7fff) || (x1 == 0x7ffe)) this.setOV();

        return 10;
    },

    bl: function() {
        // Branch and Link: BL src
        // Essentially a subroutine jump - return address is stored in R11
        // Note there is no stack, and no official return function.
        // A return is simply B *R11. Some assemblers define RT as this.

        this.writeMemoryWord(this.WP + 22, this.PC);
        this.PC = this.S;
        this.postIncrement(this.SRC);

        return 12;
    },

    // SWaP Bytes: SWPB src
    // swap the high and low bytes of a word
    swpb: function() {
        var x1 = this.readMemoryWord(this.S);

        var x2 = ((x1 & 0xff) << 8) | (x1 >> 8);
        this.writeMemoryWord(this.S, x2);
        this.postIncrement(this.SRC);

        return 10;
    },

    // SET to One: SETO src
    // sets word to 0xffff
    seto: function() {
        this.writeMemoryWord(this.S, 0xffff);
        this.postIncrement(this.SRC);

        return 10;
    },

    // ABSolute value: ABS src
    abs: function() {
        var cycles = 0;
        var x1 = this.readMemoryWord(this.S);

        if ((x1 & 0x8000) != 0) {
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
    sra: function() {
        var cycles = 0;
        if (this.D == 0) {
            this.D = this.readMemoryWord(this.WP) & 0xf;
            if (this.D == 0) this.D = 16;
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

        if (x3 != 0) this.setC();

        return cycles + 12 + 2 * this.D;
    },

    // Shift Right Logical: SRL src, dst
    // The logical shifts do not preserve the sign
    srl: function() {
        var cycles = 0;
        if (this.D == 0) {
            this.D = this.readMemoryWord(this.WP) & 0xf;
            if (this.D == 0) this.D = 16;
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

        if (x3 != 0) this.setC();

        return cycles + 12 + 2 * this.D;
    },

    // Shift Left Arithmetic: SLA src, dst
    sla: function() {
        var cycles = 0;
        if (this.D == 0) {
            this.D = this.readMemoryWord(this.WP) & 0xf;
            if (this.D == 0) this.D = 16;
            cycles += 8;
        }
        var x1 = this.readMemoryWord(this.S);
        var x4 = x1 & 0x8000;
        this.resetEQ_LGT_AGT_C_OV();

        var x3=0;
        for (var x2 = 0; x2 < this.D; x2++) {
            x3 = x1 & 0x8000;
            x1 = x1 << 1;
            if ((x1 & 0x8000) != x4) this.setOV();
        }
        x1 = x1 & 0xFFFF;
        this.writeMemoryWord(this.S , x1);

        this.ST |= this.wStatusLookup[x1] & this.maskLGT_AGT_EQ;

        if (x3 != 0) this.setC();

        return cycles + 12 + 2 * this.D;
    },

    // Shift Right Circular: SRC src, dst
    // Circular shifts pop bits off one end and onto the other
    // The carry bit is not a part of these shifts, but it set
    // as appropriate
    src: function() {
        var cycles = 0;
        if (this.D == 0)
        {
            this.D = this.readMemoryWord(this.WP) & 0xf;
            if (this.D==0) this.D=16;
            cycles += 8;
        }
        var x1 = this.readMemoryWord(this.S);
        for (var x2 = 0; x2 < this.D; x2++) {
            var x4 = x1 & 0x1;
            x1 = x1 >> 1;
            if (x4 != 0) {
                x1 = x1 | 0x8000;
            }
        }
        this.writeMemoryWord(this.S, x1);

        this.resetEQ_LGT_AGT_C();
        this.ST |= this.wStatusLookup[x1] & this.maskLGT_AGT_EQ;

        if (x4 != 0) this.setC();

        return cycles + 12 + 2 * this.D;
    },

    // JuMP: JMP dsp
    // (unconditional)
    jmp: function() {
        if (this.flagX != 0) {
            this.PC = this.flagX;	// Update offset - it's relative to the X, not the opcode
        }
        if ((this.D & 0x80) != 0) {
            this.D = 128 - (this.D & 0x7f);
            this.addPC(-(this.D + this.D));
        }
        else {
            this.addPC(this.D + this.D);
        }
        return 10;
    },

    // Jump if Less Than: JLT dsp
    jlt: function() {
        if (((!this.getAGT()) && (!this.getEQ())) != 0) {
            if (this.flagX != 0) {
                this.PC = this.flagX;	// Update offset - it's relative to the X, not the opcode
            }

            if ((this.D & 0x80) != 0) {
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
    jle: function() {
        if ((this.getLGT() == 0) || (this.getEQ() != 0)) {
            if (this.flagX != 0) {
                this.PC = this.flagX;	// Update offset - it's relative to the X, not the opcode
            }

            if ((this.D & 0x80) != 0) {
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
    jeq: function() {
        if (this.getEQ() != 0) {
            if (this.flagX != 0) {
                this.PC = this.flagX;	// Update offset - it's relative to the X, not the opcode
            }

            if ((this.D & 0x80) != 0) {
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
    jhe: function() {
        if ((this.getLGT() != 0) || (this.getEQ() != 0)) {
            if (this.flagX != 0) {
                this.PC = this.flagX;	// Update offset - it's relative to the X, not the opcode
            }

            if ((this.D & 0x80) != 0) {
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
    jgt: function() {
        if (this.getAGT() != 0) {
            if (this.flagX != 0) {
                this.PC = this.flagX;	// Update offset - it's relative to the X, not the opcode
            }

            if ((this.D & 0x80) != 0) {
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
    jne: function() {
        if (this.getEQ() == 0) {
            if (this.flagX != 0) {
                this.PC = this.flagX;	// Update offset - it's relative to the X, not the opcode
            }
            if ((this.D & 0x80) != 0) {
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
    jnc: function() {
        if (this.getC() == 0) {
            if (this.flagX != 0) {
                this.PC = this.flagX;	// Update offset - it's relative to the X, not the opcode
            }

            if ((this.D & 0x80) != 0) {
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
    joc: function() {
        if (this.getC() != 0) {
            if (this.flagX != 0) {
                this.PC = this.flagX;	// Update offset - it's relative to the X, not the opcode
            }

            if ((this.D & 0x80) != 0) {
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
    jno: function() {
        if (this.getOV() == 0) {
            if (this.flagX != 0) {
                this.PC = this.flagX;	// Update offset - it's relative to the X, not the opcode
            }

            if ((this.D & 0x80) != 0) {
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

    jl: function() {
        if ((this.getLGT() == 0) && (this.getEQ() == 0)) {
            if (this.flagX != 0) {
                this.PC = this.flagX;	// Update offset - it's relative to the X, not the opcode
            }

            if ((this.D & 0x80) != 0) {
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
    jh: function() {
        if ((this.getLGT() != 0) && (this.getEQ() == 0))
        {
            if (this.flagX != 0) {
                this.PC = this.flagX;	// Update offset - it's relative to the X, not the opcode
            }

            if ((this.D & 0x80) != 0) {
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
    jop: function() {
        if (this.getOP() != 0) {
            if (this.flagX != 0) {
                this.PC = this.flagX;	// Update offset - it's relative to the X, not the opcode
            }

            if ((this.D & 0x80) != 0) {
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
    sbo: function() {
        return null;
    },

    // Set Bit Zero: SBZ src
    // Zeros a bit in the CRU
    sbz: function() {
        return null;
    },

    // Test Bit: TB src
    // Tests a CRU bit
    tb: function() {
        return null;
    },

    // Compare Ones Corresponding: COC src, dst
    // Basically comparing against a mask, if all set bits in the src match
    // set bits in the dest (mask), the equal bit is set
    coc: function() {
        var x1 = this.readMemoryWord(this.S);
        this.postIncrement(this.SRC);

        this.fixD();
        var x2 = this.readMemoryWord(this.D);

        var x3 = x1 & x2;

        if (x3 == x1) this.setEQ(); else this.resetEQ();

        return 14;
    },

    // Compare Zeros Corresponding: CZC src, dst
    // The opposite of COC. Each set bit in the dst (mask) must
    // match up with a zero bit in the src to set the equals flag
    czc: function() {
        var x1 = this.readMemoryWord(this.S);
        this.postIncrement(this.SRC);

        this.fixD();
        var x2 = this.readMemoryWord(this.D);

        var x3 = x1 & x2;

        if (x3 == 0) this.setEQ(); else this.resetEQ();

        return 14;
    },

    // eXclusive OR: XOR src, dst
    xor: function() {
        var x1 = this.readMemoryWord(this.S);
        this.postIncrement(this.SRC);

        this.fixD();
        var x2 = this.readMemoryWord(this.D);

        var x3 = (x1 ^ x2) & 0xFFFF;
        this.writeMemoryWord(this.D, x3);

        this.resetLGT_AGT_EQ();
        this.ST |= this.wStatusLookup[x3] & this.maskLGT_AGT_EQ;

        return 14;
    },

    // eXtended OPeration: XOP src ???
    // The CPU maintains a jump table starting at 0x0040, containing BLWP style
    // jumps for each operation. In addition, the new R11 gets a copy of the address of
    // the source operand.
    // Apparently not all consoles supported both XOP 1 and 2 (depends on the ROM?)
    // so it is probably rarely, if ever, used on the TI99.
    //
    // In the F18A GPU this is the PIX instruction
    // Format: MAxxRWCE xxOOxxPP
    // M - 1 = calculate the effective address for GM2 instead of the new bitmap layer
    //     0 = use the remainder of the bits for the new bitmap layer pixels
    // A - 1 = retrieve the pixel's effective address instead of setting a pixel
    //     0 = read or set a pixel according to the other bits
    // R - 1 = read current pixel into PP, only after possibly writing PP
    //     0 = do not read current pixel into PP
    // W - 1 = do not write PP 0 = write PP to current pixel
    // C - 1 = compare OO with PP according to E, and write PP only if true
    //     0 = always write
    // E - 1 = only write PP if current pixel is equal to OO
    //     0 = only write PP if current pixel is not equal to OO
    // OO - pixel to compare to existing pixel
    // PP - new pixel to write, and previous pixel when reading
    xop: function() {
        this.D = this.WP + (this.D << 1);
        var x1 = this.readMemoryWord(this.S);
        var x2 = this.readMemoryWord(this.D);
        var addr = 0;
        if ((x2 & 0x8000) != 0) {
            // calculate BM2 address:
            // 00PYYYYY00000YYY +
            //     0000XXXXX000
            // ------------------
            // 00PY YYYY XXXX XYYY
            //
            // Note: Bitmap GM2 address /includes/ the offset from VR4 (pattern table), so to use
            // it for both pattern and color tables, put the pattern table at >0000
            addr =
                (((this.f18a.registers[4] & 0x04) != 0) ? 0x2000 : 0) |	// P
                ((x1 & 0x00F8) << 5) |						            // YYYYY
                ((x1 & 0xF800) >> 8) |						            // XXXXX
                (x1 & 0x0007);  							            // YYY
        } else {
            // Calculate bitmap layer address
            // this.log.info("Plot(" + ((x1 & 0xFF00) >> 8) + ", " + (x1 & 0x00FF) + ")");
            addr =
                this.f18a.bitmapBaseAddr +
                ((((x1 & 0xFF00) >> 8) + (x1 & 0x00FF) * this.f18a.bitmapWidth) >> 2);
        }

        // Only parse the other bits if M and A are zero
        if ((x2 & 0xc000) == 0) {
            var pixByte = this.readMemoryByte(addr);	    // Get the byte
            var bitShift = (x1 & 0x0300) >> 7;
            var mask = 0xC0 >> bitShift;
            var pix = (pixByte & mask) >> (6 - bitShift);
            var write = (x2 & 0x0400) == 0;		            // Whether to write
            // TODO: are C and E dependent on W being set? I am assuming yes.
            if (write && (x2 & 0x0200) != 0) {		        // C - compare active (only important if we are writing anyway?)
                var comp = (pix == ((x2 & 0x0030) >> 4));	    // Compare the pixels
                if ((x2 & 0x0100) != 0) {
                    // E is set, comparison must be true
                    if (!comp) {
                        write = false;
                    }
                } else {
                    // E is clear, comparison must be false
                    if (comp) {
                        write = false;
                    }
                }
            }
            if (write) {
                var newPix = (x2 & 0x0003) << (6 - bitShift);	// New pixel
                var invMask = (~mask) & 0xFF;
                this.writeMemoryByte(addr, (pixByte & invMask) | newPix);
            }
            if ((x2 & 0x0800) != 0) {
                // Read is set, so save the original read pixel color in PP
                x2 = (x2 & 0xFFFC) | pix;
                this.writeMemoryWord(this.D, x2);		    // Write it back
            }
        } else {
            // User only wants the address
            this.writeMemoryWord(this.D, addr);
        }

        // Only the source address can be post-inc
        this.postIncrement(this.SRC);

        return 10;
    },

    // LoaD CRu - LDCR src, dst
    // Writes dst bits serially out to the CRU registers
    // The CRU is the 9901 Communication chip, tightly tied into the 9900.
    // It's serially accessed and has 4096 single bit IO registers.
    // It's stupid and thinks 0 is true and 1 is false.
    // All addresses are offsets from the value in R12, which is divided by 2
    ldcr: function() {
        return null;
    },

    // STore CRU: STCR src, dst
    // Stores dst bits from the CRU into src
    stcr: function() {
        return null;
    },

    // MultiPlY: MPY src, dst
    // Multiply src by dest and store 32-bit result
    // Note: src and dest are unsigned.
    mpy: function() {
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
    div: function() {
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
    szc: function() {
        var x1 = this.readMemoryWord(this.S);
        this.postIncrement(this.SRC);

        this.fixD();
        var x2 = this.readMemoryWord(this.D);
        var x3 = (~x1) & x2;
        this.writeMemoryWord(this.D, x3);
        this.postIncrement(this.DST);

        this.resetLGT_AGT_EQ();
        this.ST |= this.wStatusLookup[x3] & this.maskLGT_AGT_EQ;

        return 14;
    },

    // Set Zeros Corresponding, Byte: SZCB src, dst
    szcb: function() {
        var x1 = this.readMemoryByte(this.S);
        this.postIncrement(this.SRC);

        this.fixD();
        var x2 = this.readMemoryByte(this.D);
        var x3 = (~x1) & x2;
        this.writeMemoryByte(this.D, x3);
        this.postIncrement(this.DST);

        this.resetLGT_AGT_EQ_OP();
        this.ST |= this.bStatusLookup[x3] & this.maskLGT_AGT_EQ_OP;

        return 14;
    },

    // Subtract: S src, dst
    s: function() {
        var x1 = this.readMemoryWord(this.S);
        this.postIncrement(this.SRC);

        this.fixD();
        var x2 = this.readMemoryWord(this.D);
        var x3 = (x2 - x1) & 0xFFFF;
        this.writeMemoryWord(this.D, x3);
        this.postIncrement(this.DST);

        this.resetEQ_LGT_AGT_C_OV();
        this.ST |= this.wStatusLookup[x3] & this.maskLGT_AGT_EQ;

        // any number minus 0 sets carry.. Tursi's theory is that converting 0 to the two's complement
        // is causing the carry flag to be set.
        if ((x3 < x2) || (x1 == 0)) this.setC();
        if (((x1 & 0x8000) != (x2 & 0x8000)) && ((x3 & 0x8000) != (x2 & 0x8000))) this.setOV();

        return 14;
    },

    // Subtract Byte: SB src, dst
    sb: function() {
        var x1 = this.readMemoryByte(this.S);
        this.postIncrement(this.SRC);

        this.fixD();
        var x2 = this.readMemoryByte(this.D);
        var x3 = (x2 - x1) & 0xFF;
        this.writeMemoryByte(this.D, x3);
        this.postIncrement(this.DST);

        this.resetEQ_LGT_AGT_C_OV_OP();
        this.ST |= this.bStatusLookup[x3] & this.maskLGT_AGT_EQ_OP;

        // any number minus 0 sets carry.. Tursi's theory is that converting 0 to the two's complement
        // is causing the carry flag to be set.
        if ((x3 < x2) || (x1 == 0)) this.setC();
        if (((x1 & 0x80) != (x2 & 0x80)) && ((x3 & 0x80) != (x2 & 0x80))) this.setOV();

        return 14;
    },

    // Compare words: C src, dst
    c: function() {
        var x3 = this.readMemoryWord(this.S);
        this.postIncrement(this.SRC);

        this.fixD();
        var x4 = this.readMemoryWord(this.D);
        this.postIncrement(this.DST);

        this.resetLGT_AGT_EQ();
        if (x3 > x4) this.setLGT();
        if (x3 == x4) this.setEQ();
        if ((x3 & 0x8000) == (x4 & 0x8000)) {
            if (x3 > x4) this.setAGT();
        }
        else {
            if ((x4 & 0x8000) != 0) this.setAGT();
        }
        return 14;
    },

    // CompareBytes: CB src, dst
    cb: function() {
        var x3 = this.readMemoryByte(this.S);
        this.postIncrement(this.SRC);

        this.fixD();
        var x4 = this.readMemoryByte(this.D);
        this.postIncrement(this.DST);

        this.resetLGT_AGT_EQ_OP();
        if (x3 > x4) this.setLGT();
        if (x3 == x4) this.setEQ();
        if ((x3 & 0x80) == (x4 & 0x80)) {
            if (x3 > x4) this.setAGT();
        } else {
            if ((x4 & 0x80) != 0) this.setAGT();
        }
        this.ST |= this.bStatusLookup[x3] & this.BIT_OP;

        return 14;
    },

    // Add words: A src, dst
    a: function() {
        var x1 = this.readMemoryWord(this.S);
        this.postIncrement(this.SRC);

        this.fixD();
        var x2 = this.readMemoryWord(this.D);
        var x3 = (x2 + x1) & 0xFFFF;
        this.writeMemoryWord(this.D, x3);
        this.postIncrement(this.DST);

        this.resetEQ_LGT_AGT_C_OV();	// We come out with either EQ or LGT, never both
        this.ST |= this.wStatusLookup[x3] & this.maskLGT_AGT_EQ;

        if (x3 < x2) this.setC();	// if it wrapped around, set carry
        if (((x1 & 0x8000) == (x2 & 0x8000)) && ((x3 & 0x8000) != (x2 & 0x8000))) this.setOV(); // if it overflowed or underflowed (signed math), set overflow

        return 14;
    },

    // Add bytes: A src, dst
    ab: function() {
        var x1 = this.readMemoryByte(this.S);
        this.postIncrement(this.SRC);

        this.fixD();
        var x2 = this.readMemoryByte(this.D);
        var x3 = (x2 + x1) & 0xFF;
        this.writeMemoryByte(this.D, x3);
        this.postIncrement(this.DST);

        this.resetEQ_LGT_AGT_C_OV();	// We come out with either EQ or LGT, never both
        this.ST |= this.bStatusLookup[x3] & this.maskLGT_AGT_EQ_OP;

        if (x3 < x2) this.setC();	// if it wrapped around, set carry
        if (((x1 & 0x80) == (x2 & 0x80)) && ((x3 & 0x80) != (x2 & 0x80))) this.setOV();  // if it overflowed or underflowed (signed math), set overflow

        return 14;
    },

    // MOVe words: MOV src, dst
    mov: function() {
        var x1 = this.readMemoryWord(this.S);
        this.postIncrement(this.SRC);
        this.fixD();

        this.writeMemoryWord(this.D, x1);
        this.postIncrement(this.DST);

        this.resetLGT_AGT_EQ();
        this.ST |= this.wStatusLookup[x1] & this.maskLGT_AGT_EQ;

        return 14;
    },

    // MOVe Bytes: MOVB src, dst
    movb: function() {
        var x1 = this.readMemoryByte(this.S);
        this.postIncrement(this.SRC);

        this.fixD();
        this.writeMemoryByte(this.D, x1);
        this.postIncrement(this.DST);

        this.resetLGT_AGT_EQ_OP();
        this.ST |= this.bStatusLookup[x1] & this.maskLGT_AGT_EQ_OP;

        return 14;
    },

    // Set Ones Corresponding: SOC src, dst
    // Essentially performs an OR - setting all the bits in dst that
    // are set in src
    soc: function() {
        var x1 = this.readMemoryWord(this.S);
        this.postIncrement(this.SRC);

        this.fixD();
        var x2 = this.readMemoryWord(this.D);
        var x3 = x1 | x2;
        this.writeMemoryWord(this.D, x3);
        this.postIncrement(this.DST);

        this.resetLGT_AGT_EQ();
        this.ST |= this.wStatusLookup[x3] & this.maskLGT_AGT_EQ;

        return 14;
    },

    socb: function() {
        var x1 = this.readMemoryByte(this.S);
        this.postIncrement(this.SRC);

        this.fixD();
        var x2 = this.readMemoryByte(this.D);
        var x3 = x1 | x2;
        this.writeMemoryByte(this.D, x3);
        this.postIncrement(this.DST);

        this.resetLGT_AGT_EQ_OP();
        this.ST |= this.bStatusLookup[x3] & this.maskLGT_AGT_EQ_OP;

        return 14;
    },

    // F18A specific opcodes

    call: function() {
        var x2 = this.readMemoryWord(this.WP + 30);	// get R15
        this.writeMemoryWord(x2, this.PC);
        this.PC = this.S;
        x2 -= 2;
        this.writeMemoryWord(this.WP + 30, x2);     // update R15
        this.postIncrement(this.SRC);
        return 8;
    },

    ret: function() {
        var x1 = this.readMemoryWord(this.WP + 30); // get R15
        x1 += 2;
        this.PC = this.readMemoryWord(x1);          // get PC
        this.writeMemoryWord(this.WP + 30, x1);     // update R15
        return 8;
    },

    push: function() {
        var x1 = this.readMemoryWord(this.S);
        var x2 = this.readMemoryWord(this.WP + 30); // get R15
        this.writeMemoryWord(x2, x1);               // Push the word on the stack
        x2 -= 2;                                    // the stack pointer post-decrements (per Matthew)
        this.writeMemoryWord(this.WP + 30, x2);		// update R15
        this.postIncrement(this.SRC);
        return 8;
    },

    slc: function() {
        var cycles = 0;
        if (this.D == 0)
        {
            this.D = this.readMemoryWord(this.WP) & 0xf;
            if (this.D==0) this.D=16;
            cycles += 8;
        }
        var x1 = this.readMemoryWord(this.S);
        for (var x2 = 0; x2 < this.D; x2++) {
            var x4 = x1 & 0x8000;
            x1 = x1 << 1;
            if (x4 != 0) {
                x1 = x1 | 1;
            }
        }
        this.writeMemoryWord(this.S, x1);

        this.resetEQ_LGT_AGT_C();
        this.ST |= this.wStatusLookup[x1] & this.maskLGT_AGT_EQ;

        if (x4 != 0) this.setC();

        return cycles + 12 + 2 * this.D;
    },

    pop: function() {
        var x2 = this.readMemoryWord(this.WP + 30);	// get R15
        // POP the word from the stack
        // the stack pointer post-decrements (per Matthew)
        x2 += 2;                                    // so here we pre-increment!
        var x1 = this.readMemoryWord(x2);
        this.writeMemoryWord(this.S, x1);
        this.writeMemoryWord(this.WP + 30, x2);		// update R15
        this.postIncrement(this.SRC);
        return 8;
    },

    getLGT:     function() { return (this.ST & this.BIT_LGT) },	// Logical Greater Than
    getAGT:     function() { return (this.ST & this.BIT_AGT) },	// Arithmetic Greater Than
    getEQ:      function() { return (this.ST & this.BIT_EQ) },	// Equal
    getC:       function() { return (this.ST & this.BIT_C) },	// Carry
    getOV:      function() { return (this.ST & this.BIT_OV) },	// Overflow
    getOP:      function() { return (this.ST & this.BIT_OP) },	// Odd Parity
    getX:       function() { return (this.ST & this.BIT_X) },	// Set during an XOP instruction

    setLGT:     function() { this.ST |= 0x8000 },       		// Logical Greater than: >0x0000
    setAGT:     function() { this.ST |= 0x4000 },		        // Arithmetic Greater than: >0x0000 and <0x8000
    setEQ:      function() { this.ST |= 0x2000 },       		// Equal: ==0x0000
    setC:       function() { this.ST |= 0x1000 },		        // Carry: carry occurred during operation
    setOV:      function() { this.ST |= 0x0800 },       		// Overflow: overflow occurred during operation
    setOP:      function() { this.ST |= 0x0400 },	            // Odd parity: word has odd number of '1' bits
    setX:       function() { this.ST |= 0x0200 },		        // Executing 'X' statement

    resetLGT:   function() { this.ST &= 0x7fff },               // Clear the flags
    resetAGT:   function() { this.ST &= 0xbfff },
    resetEQ:    function() { this.ST &= 0xdfff },
    resetC:     function() { this.ST &= 0xefff },
    resetOV:    function() { this.ST &= 0xf7ff },
    resetOP:    function() { this.ST &= 0xfbff },
    resetX:     function() { this.ST &= 0xfdff },

    // Group clears
    resetEQ_LGT:               function() { this.ST &= 0x5fff },
    resetLGT_AGT_EQ:           function() { this.ST &= 0x1fff },
    resetLGT_AGT_EQ_OP:        function() { this.ST &= 0x1bff },
    resetEQ_LGT_AGT_OV:        function() { this.ST &= 0x17ff },
    resetEQ_LGT_AGT_C:         function() { this.ST &= 0x0fff },
    resetEQ_LGT_AGT_C_OV:      function() { this.ST &= 0x7ff },
    resetEQ_LGT_AGT_C_OV_OP:   function() { this.ST &= 0x3ff },

    logRegs: function() {
        this.log.info(this.getRegsString() + this.getInternalRegsString());
    },

    getInternalRegsString: function() {
        return "PC: " + this.PC.toHexWord() + " ST: " + this.ST.toHexWord();
    },

    getRegsString: function() {
        var s = "";
        for (var i = 0; i < 16; i++) {
            s += "R" + i + ":" + (this.readMemoryWord(this.WP + 2 * i)).toHexWord() + " ";
        }
        return s;
    },

    getRegsStringFormatted: function() {
        var s = "";
        for (var i = 0; i < 16; i++) {
            s += "R" + i + (i < 10 ? " " : "") + ":" + (this.readMemoryWord(this.WP + 2 * i)).toHexWord() + (i % 4 == 3 ? "\n" : " ");
        }
        return s;
    }
};
