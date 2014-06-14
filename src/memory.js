/*
 * js99'er - TI-99/4A emulator written in JavaScript
 *
 * Created 2014 by Rasmus Moustgaard <rasmus.moustgaard@gmail.com>
 */

'use strict';

Memory.SOUND   = 0x8400;  // Sound write data
Memory.VDPRD   = 0x8800;  // VDP read data
Memory.VDPSTA  = 0x8802;  // VDP status
Memory.VDPWD   = 0x8C00;  // VDP write data
Memory.VDPWA   = 0x8C02;  // VDP set read/write address
Memory.GRMRD   = 0x9800;  // GROM read data
Memory.GRMRA   = 0x9802;  // GROM read address
Memory.GRMWD   = 0x9C00;  // GROM write data
Memory.GRMWA   = 0x9C02;  // GROM write address

function Memory(vdp, tms9919, tms5220, enable32KRAM) {
    this.vdp = vdp;
    this.tms9919 = tms9919;
    this.tms5220 = tms5220;

    this.ram = new Uint8Array(0x10000);
    this.rom = new Uint8Array(SYSTEM.ROM);
    this.grom = new Uint8Array(0x10000);
    this.peripheralROM = new Uint8Array(0x2000);

    this.loadGROM(SYSTEM.GROM, 0);
    this.gromAddress = 0;
    this.gromAccess = 2;
    this.gromPrefetch = 0;

    this.cartImage = null;
    this.cartInverted = false;
    this.cartBankCount = 0;
    this.currentCartBank = 0;
    this.cartAddrOffset = 0x6000;

    this.peripheralROMEnabled  = false;
    this.loadPeripheralROM(DiskDrive.DSR_ROM);

    this.buildMemoryMap();

    this.enable32KRAM = enable32KRAM;

    this.log = Log.getLog();
    this.reset();
}

Memory.prototype = {

    buildMemoryMap: function() {
        var i;
        this.memoryMap = [];
        var romAccessors = [this.readROM, this.writeROM];
        var ramAccessors = [this.readRAM, this.writeRAM];
        var peripheralROMAccessors = [this.readPeripheralROM, this.writePeripheralROM];
        var cartridgeROMAccessors = [this.readCartridgeROM, this.writeCartridgeROM];
        var padAccessors = [this.readPAD, this.writePAD];
        var soundAccessors = [this.readSound, this.writeSound];
        var vdpReadAccessors = [this.readVDP, this.writeNull];
        var vdpWriteAccessors = [this.readNull, this.writeVDP];
        var speechReadAccessors = [this.readSpeech, this.writeNull];
        var speechWriteAccessors = [this.readNull, this.writeSpeech];
        var gromReadAccessors = [this.readGROM, this.writeNull];
        var gromWriteAccessors = [this.readNull, this.writeGROM];
        var nullAccessors = [this.readNull, this.writeNull];
        for (i = 0; i < 0x2000; i++) {
            this.memoryMap[i] = romAccessors;
        }
        for (i = 0x2000; i < 0x4000; i++) {
            this.memoryMap[i] = ramAccessors;
        }
        for (i = 0x4000; i < 0x6000; i++) {
            this.memoryMap[i] = peripheralROMAccessors;
        }
        for (i = 0x6000; i < 0x8000; i++) {
            this.memoryMap[i] = cartridgeROMAccessors;
        }
        for (i = 0x8000; i < 0x8400; i++) {
            this.memoryMap[i] = padAccessors;
        }
        for (i = 0x8400; i < 0x8600; i++) {
            this.memoryMap[i] = soundAccessors;
        }
        for (i = 0x8600; i < 0x8800; i++) {
            this.memoryMap[i] = nullAccessors;
        }
        for (i = 0x8800; i < 0x8C00; i++) {
            this.memoryMap[i] = vdpReadAccessors;
        }
        for (i = 0x8C00; i < 0x9000; i++) {
            this.memoryMap[i] = vdpWriteAccessors;
        }
        for (i = 0x9000; i < 0x9400; i++) {
            this.memoryMap[i] = speechReadAccessors;
        }
        for (i = 0x9400; i < 0x9800; i++) {
            this.memoryMap[i] = speechWriteAccessors;
        }
        for (i = 0x9800; i < 0x9C00; i++) {
            this.memoryMap[i] = gromReadAccessors;
        }
        for (i = 0x9C00; i < 0xA000; i++) {
            this.memoryMap[i] = gromWriteAccessors;
        }
        for (i = 0xA000; i < 0x10000; i++) {
            this.memoryMap[i] = ramAccessors;
        }
    },

    reset: function(keepCart) {
        for (var i = 0; i < this.ram.length; i++) {
            this.ram[i] = 0;
        }
        if (!keepCart) {
            for (i = 0x6000; i < 0x10000; i++) {
                this.grom[i] = 0;
            }
            this.cartImage = null;
        }
    },

    toggleCartridgeRAM: function(addr, length, enabled) {
        var accessors = enabled ? [this.readRAM, this.writeRAM] : [this.readCartridgeROM, this.writeCartridgeROM];
        for (var i = addr; i < addr + length; i++) {
            this.memoryMap[i] = accessors;
        }
    },

    loadRAM: function(addr, byteArray) {
        for (var i = 0; i < byteArray.length; i++) {
            this.ram[addr + i] = byteArray[i] & 0xFF;
        }
    },

    loadGROM: function(byteArray, bank) {
        var addr = bank * 0x2000;
        for (var i = 0; i < byteArray.length; i++) {
            this.grom[addr + i] = byteArray[i];
        }
    },

    setCartridgeImage: function(byteArray, inverted) {
        this.cartImage = new Uint8Array(byteArray);
        this.cartInverted = inverted;
        this.cartBankCount = this.cartImage.length / 0x2000;
        this.currentCartBank = 0;
        this.cartAddrOffset = -0x6000;
    },

    loadPeripheralROM: function(byteArray) {
        for (var i = 0; i < byteArray.length; i++) {
            this.peripheralROM[i] = byteArray[i];
        }
    },

    togglePeripheralROM: function(romNo, enabled) {
        this.peripheralROMEnabled = romNo == 1 && enabled;
    },

    readROM: function(addr, cpu) {
        return (this.rom[addr] << 8) | this.rom[addr + 1];
    },

    writeROM: function(addr, w, cpu) {
    },

    readRAM: function(addr, cpu) {
        cpu.addCycles(4);
        return this.enable32KRAM ? (this.ram[addr] << 8) | this.ram[addr + 1] : 0;
    },

    writeRAM: function(addr, w, cpu) {
        cpu.addCycles(4);
        if (this.enable32KRAM) {
            this.ram[addr] = w >> 8;
            this.ram[addr + 1] = w & 0xFF;
        }
    },

    readPeripheralROM: function(addr, cpu) {
        cpu.addCycles(4);
        // this.log.info("Read DSR ROM " + addr.toHexWord() + ": " + (this.dsrromEnabled ? this.dsrrom[addr - 0x4000] << 8 | this.dsrrom[addr + 1 - 0x4000] : 0).toHexWord());
        return this.peripheralROMEnabled ? this.peripheralROM[addr - 0x4000] << 8 | this.peripheralROM[addr + 1 - 0x4000] : 0;
    },

    writePeripheralROM: function(addr, w, cpu) {
        cpu.addCycles(4);
    },

    readCartridgeROM: function(addr, cpu) {
        cpu.addCycles(4);
        return this.cartImage != null ? (this.cartImage[addr + this.cartAddrOffset] << 8) | this.cartImage[addr + this.cartAddrOffset + 1] : 0;

    },

    writeCartridgeROM: function(addr, w, cpu) {
        cpu.addCycles(4);
        this.currentCartBank = (addr >> 1) & (this.cartBankCount - 1);
        if (this.cartInverted) {
            this.currentCartBank = this.cartBankCount - this.currentCartBank - 1;
        }
        this.cartAddrOffset = this.currentCartBank * 0x2000 - 0x6000;
        // this.log.info("Cartridge bank selected: " + this.currentCartBank);
    },

    readPAD: function(addr, cpu) {
        addr = addr | 0x0300;
        return (this.ram[addr] << 8) | this.ram[addr + 1];
    },

    writePAD: function(addr, w, cpu) {
        addr = addr | 0x0300;
        this.ram[addr] = w >> 8;
        this.ram[addr + 1] = w & 0xFF;
    },

    readSound: function(addr, cpu) {
        cpu.addCycles(4);
        return 0;
    },

    writeSound: function(addr, w, cpu) {
        cpu.addCycles(4);
        this.tms9919.writeData(w >> 8);
    },

    readVDP: function(addr, cpu) {
        cpu.addCycles(4);
        addr = addr & 0x8802;
        if (addr == Memory.VDPRD) {
            return this.vdp.readData() << 8;
        }
        else if (addr == Memory.VDPSTA) {
            return this.vdp.readStatus() << 8;
        }
        return 0;
    },

    writeVDP: function(addr, w, cpu) {
        cpu.addCycles(4);
        addr = addr & 0x8C02;
        if (addr == Memory.VDPWD) {
            this.vdp.writeData(w >> 8);
        }
        else if (addr == Memory.VDPWA) {
            this.vdp.writeAddress(w >> 8);
        }
    },

    readSpeech: function(addr, cpu) {
        cpu.addCycles(4);
        return this.tms5220.readSpeechData() << 8;
    },

    writeSpeech: function(addr, w, cpu) {
        cpu.addCycles(4);
        this.tms5220.writeSpeechData(w >> 8);
    },

    readGROM: function(addr, cpu) {
        cpu.addCycles(4);
		// if (addr >= 0x9800 && addr < 0x9840) {
            addr = addr & 0x9802;
        // }
        if (addr == Memory.GRMRD) {
            // Read data from GROM
            this.gromAccess = 2;
            var w = this.gromPrefetch << 8;
            // this.log.info((cpu.getPC().toHexWord()) + " GROM read bank " + ((this.gromAddress & 0xE000) >> 13) + " addr " + (((this.gromAddress - 1) & 0x1FFF).toHexWord()) + ": " + this.gromPrefetch.toHexByte());
            // Prefetch
            this.gromPrefetch = this.grom[this.gromAddress++];
            return w;
        }
        else if (addr == Memory.GRMRA) {
            // Get GROM address
            this.gromAccess = 2;
            var wa = this.gromAddress & 0xFF00;
            // this.log.info("GROM read address: " + wa.toHexWord());
            this.gromAddress = ((this.gromAddress << 8) | this.gromAddress & 0xFF) & 0xFFFF;
            return wa;
        }
        return 0;
    },

    writeGROM: function(addr, w, cpu) {
        cpu.addCycles(4);
        // if (addr >= 0x9C00 && addr < 0x9C40) {
            addr = addr & 0x9C02;
        // }
        if (addr == Memory.GRMWD) {
            // Write data to GROM - not implemented
        }
        else if (addr == Memory.GRMWA) {
            // Set GROM address
            this.gromAddress = ((this.gromAddress << 8) | w >> 8) & 0xFFFF;
            this.gromAccess--;
            if (this.gromAccess == 0) {
                this.gromAccess = 2;
                this.gromPrefetch = this.grom[this.gromAddress];
                // this.log.info("GROM address set to: " + this.gromAddress.toHexWord());
                this.gromAddress++;
            }
        }
    },

    readNull: function(addr, cpu) {
        return 0;
    },

    writeNull: function(addr, w, cpu) {
    },

    readWord: function(addr, cpu) {
        addr &= 0xFFFE;
        return this.memoryMap[addr][0].call(this, addr, cpu);
    },

    writeWord: function(addr, w, cpu) {
        addr &= 0xFFFE;
        this.memoryMap[addr][1].call(this, addr, w, cpu);
    },

    getRAMByte: function(addr) {
        return this.ram[addr];
    },

    getRAMWord: function(addr) {
        return this.ram[addr] << 8 | this.ram[addr + 1];
    },

    setRAMByte: function(addr, b) {
        return this.ram[addr] = b;
    },

    setRAMWord: function(addr, w) {
        this.ram[addr] = w >> 8;
        this.ram[addr] = w & 0xFF;
    },

    getStatusString: function() {
        return "GROM: " + this.gromAddress.toHexWord() + " (bank=" + ((this.gromAddress & 0xE000) >> 13) + ", addr=" + (this.gromAddress & 0x1FFF).toHexWord() + ")";
    },

    logMemory: function(start, length) {
        var buffer = "";
        for (var i = 0; i < length; i += 2) {
            var addr = start + i;
            if (i % 16 == 0) {
                buffer += addr.toHexWord() + ": ";
            }
            buffer += this.readWord(addr).toHexWord();
            if (i % 16 < 14) {
                buffer += ", ";
            }
            else {
                this.log.info(buffer);
                buffer = "";
            }
        }
    },

    set32KRAMEnabled: function(enabled) {
        this.enable32KRAM = enabled;
    }
};