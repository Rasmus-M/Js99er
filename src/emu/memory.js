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

Memory.GROM_BASES = 16;

function Memory(vdp, tms9919, tms5220, settings) {
    this.vdp = vdp;
    this.tms9919 = tms9919;
    this.tms5220 = tms5220;

    this.enable32KRAM = settings && settings.is32KRAMEnabled();
    this.enableAMS = settings && settings.isAMSEnabled();

    this.ram = new Uint8Array(0x10000);
    this.rom = new Uint8Array(SYSTEM.ROM);
    this.groms = [];
    for (var i = 0; i < Memory.GROM_BASES; i++) {
        this.groms[i] = new Uint8Array(0x10000);
    }
    this.ams = this.enableAMS ? new AMS(512) : null;

    this.loadGROM(SYSTEM.GROM, 0, 0);
    this.gromAddress = 0;
    this.gromAccess = 2;
    this.gromPrefetch = new Uint8Array(Memory.GROM_BASES);
    this.multiGROMBases = false;

    this.cartImage = null;
    this.cartInverted = false;
    this.cartBankCount = 0;
    this.currentCartBank = 0;
    this.cartAddrOffset = 0x6000;

    this.peripheralROMs = [];
    this.peripheralROMEnabled  = false;
    this.peripheralROMNumber = 0;
    this.loadPeripheralROM(DiskDrive.DSR_ROM, 1);
    if (settings && settings.isGoogleDriveEnabled()) {
        this.loadPeripheralROM(GoogleDrive.DSR_ROM, 2);
    }

    this.buildMemoryMap();

    this.log = Log.getLog();
    this.reset(false);
}

Memory.prototype = {

    buildMemoryMap: function () {
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

    reset: function (keepCart) {
        var i;
        for (i = 0; i < this.ram.length; i++) {
            // Don't erase cartridge RAM for Mini Memory etc.
            if (!keepCart || i >= 0x2000 && i < 0x4000 || i >= 0xa000 && i < 0x10000) {
                this.ram[i] = 0; // i & 0xFF;
            }
        }
        if (!keepCart) {
            var grom = this.groms[0];
            for (i = 0x6000; i < grom.length; i++) {
                grom[i] = 0;
            }
            for (i = 1; i < Memory.GROM_BASES; i++) {
                this.groms[i] = new Uint8Array(0x10000);
            }
            this.gromPrefetch = new Uint8Array(Memory.GROM_BASES);
            this.multiGROMBases = false;
            this.cartImage = null;
        }
        if (this.enableAMS) {
            if (this.ams) {
                this.ams.reset();
            }
            else {
                this.ams = new AMS(1024);
            }
        }
    },

    toggleCartridgeRAM: function (addr, length, enabled) {
        var accessors = enabled ? [this.readCartridgeRAM, this.writeCartridgeRAM] : [this.readCartridgeROM, this.writeCartridgeROM];
        for (var i = addr; i < addr + length; i++) {
            this.memoryMap[i] = accessors;
        }
    },

    loadRAM: function (addr, byteArray) {
        for (var i = 0; i < byteArray.length; i++) {
            if (this.enableAMS) {
                this.ams.setByte(addr + i, byteArray[i]);
            }
            else {
                this.ram[addr + i] = byteArray[i];
            }
        }
    },

    loadGROM: function (byteArray, bank, base) {
        var grom = this.groms[base];
        var addr = bank * 0x2000;
        for (var i = 0; i < byteArray.length; i++) {
            grom[addr + i] = byteArray[i];
        }
        if (base > 0) {
            this.multiGROMBases = true;
        }
    },

    setCartridgeImage: function (byteArray, inverted) {
        this.cartImage = new Uint8Array(byteArray);
        this.cartInverted = inverted;
        this.cartBankCount = this.cartImage.length / 0x2000;
        this.currentCartBank = 0;
        this.cartAddrOffset = -0x6000;
    },

    loadPeripheralROM: function (byteArray, number) {
        this.peripheralROMs[number] = new Uint8Array(0x2000);
        for (var i = 0; i < byteArray.length; i++) {
            this.peripheralROMs[number][i] = byteArray[i];
        }
    },

    setPeripheralROM: function (romNo, enabled) {
        // this.log.info("Toggle ROM " + romNo + " " + (enabled ? "on" : "off") + ".");
        if (romNo > 0 && romNo < this.peripheralROMs.length) {
            this.peripheralROMNumber = romNo;
            this.peripheralROMEnabled = enabled;
        }
        else {
            this.peripheralROMEnabled = false;
        }
    },

    readROM: function (addr, cpu) {
        return (this.rom[addr] << 8) | this.rom[addr + 1];
    },

    writeROM: function (addr, w, cpu) {
    },

    readRAM: function (addr, cpu) {
        cpu.addCycles(4);
        if (this.enableAMS) {
            return this.ams.readWord(addr);
        }
        else if (this.enable32KRAM) {
            return (this.ram[addr] << 8) | this.ram[addr + 1];
        }
        return 0;
    },

    writeRAM: function (addr, w, cpu) {
        //if (addr == 0xb6f4) {
        //    this.log.info("Write RAM " + addr.toHexWord() + ": " + w.toHexWord() + " from PC=" + cpu.getPC().toHexWord());
        //}
        cpu.addCycles(4);
        if (this.enableAMS) {
            this.ams.writeWord(addr, w);
        }
        else if (this.enable32KRAM) {
            this.ram[addr] = w >> 8;
            this.ram[addr + 1] = w & 0xFF;
        }
    },

    readPeripheralROM: function (addr, cpu) {
        cpu.addCycles(4);
        if (this.enableAMS && this.ams.hasRegisterAccess()) {
            var w = this.ams.readRegister((addr & 0x1F) >> 1);
            return ((w & 0xFF) << 8) | (w >> 8)
        }
        else if (this.peripheralROMEnabled) {
            var peripheralROM = this.peripheralROMs[this.peripheralROMNumber];
            if (peripheralROM != null) {
                // this.log.info("Read peripheral ROM " + addr.toHexWord() + ": " + (peripheralROM[addr - 0x4000] << 8 | peripheralROM[addr + 1 - 0x4000]).toHexWord());
                return peripheralROM[addr - 0x4000] << 8 | peripheralROM[addr + 1 - 0x4000];
            }
        }
        return 0;
    },

    writePeripheralROM: function (addr, w, cpu) {
        cpu.addCycles(4);
        if (this.enableAMS && this.ams.hasRegisterAccess()) {
            this.ams.writeRegister((addr & 0x1F) >> 1, ((w & 0xFF) << 8) | (w >> 8));
        }
    },

    readCartridgeROM: function (addr, cpu) {
        cpu.addCycles(4);
        return this.cartImage != null ? (this.cartImage[addr + this.cartAddrOffset] << 8) | this.cartImage[addr + this.cartAddrOffset + 1] : 0;
    },

    writeCartridgeROM: function (addr, w, cpu) {
        cpu.addCycles(4);
        this.currentCartBank = (addr >> 1) & (this.cartBankCount - 1);
        if (this.cartInverted) {
            this.currentCartBank = this.cartBankCount - this.currentCartBank - 1;
        }
        this.cartAddrOffset = this.currentCartBank * 0x2000 - 0x6000;
        // this.log.info("Cartridge bank selected: " + this.currentCartBank);
    },

    readCartridgeRAM: function (addr, cpu) {
        cpu.addCycles(4);
        return (this.ram[addr] << 8) | this.ram[addr + 1];
    },

    writeCartridgeRAM: function (addr, w, cpu) {
        cpu.addCycles(4);
        this.ram[addr] = w >> 8;
        this.ram[addr + 1] = w & 0xFF;
    },

    readPAD: function (addr, cpu) {
        addr = addr | 0x0300;
        return (this.ram[addr] << 8) | this.ram[addr + 1];
    },

    writePAD: function (addr, w, cpu) {
        addr = addr | 0x0300;
        this.ram[addr] = w >> 8;
        this.ram[addr + 1] = w & 0xFF;
    },

    readSound: function (addr, cpu) {
        cpu.addCycles(4);
        return 0;
    },

    writeSound: function (addr, w, cpu) {
        cpu.addCycles(4);
        this.tms9919.writeData(w >> 8);
    },

    readVDP: function (addr, cpu) {
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

    writeVDP: function (addr, w, cpu) {
        cpu.addCycles(4);
        addr = addr & 0x8C02;
        if (addr == Memory.VDPWD) {
            this.vdp.writeData(w >> 8);
        }
        else if (addr == Memory.VDPWA) {
            this.vdp.writeAddress(w >> 8);
        }
    },

    readSpeech: function (addr, cpu) {
        cpu.addCycles(4);
        return this.tms5220.readSpeechData() << 8;
    },

    writeSpeech: function (addr, w, cpu) {
        cpu.addCycles(4);
        this.tms5220.writeSpeechData(w >> 8);
    },

    readGROM: function (addr, cpu) {
        cpu.addCycles(4);
        var base = !this.multiGROMBases || this.gromAddress - 1 < 0x6000 ? 0 : (addr & 0x003C) >> 2;
        addr = addr & 0x9802;
        if (addr == Memory.GRMRD) {
            // Read data from GROM
            this.gromAccess = 2;
            var w = this.gromPrefetch[base] << 8;
            // if (base > 0) {
            //     this.log.info((cpu.getPC().toHexWord()) + " GROM read base " + base + " bank " + ((this.gromAddress & 0xE000) >> 13) + " addr " + (((this.gromAddress - 1) & 0x1FFF).toHexWord()) + ": " + this.gromPrefetch[base].toHexByte());
            // }
            // Prefetch for all bases
            for (var i = 0; i < Memory.GROM_BASES; i++) {
                this.gromPrefetch[i] = this.groms[i][this.gromAddress];
            }
            this.gromAddress++;
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

    writeGROM: function (addr, w, cpu) {
        cpu.addCycles(4);
        addr = addr & 0x9C02;
        if (addr == Memory.GRMWD) {
            // Write data to GROM - not implemented
        }
        else if (addr == Memory.GRMWA) {
            // Set GROM address
            this.gromAddress = ((this.gromAddress << 8) | w >> 8) & 0xFFFF;
            this.gromAccess--;
            if (this.gromAccess == 0) {
                this.gromAccess = 2;
                // Prefetch for all bases
                for (var i = 0; i < Memory.GROM_BASES; i++) {
                    this.gromPrefetch[i] = this.groms[i][this.gromAddress];
                }
                // this.log.info("GROM address set to: " + this.gromAddress.toHexWord());
                this.gromAddress++;
            }
        }
    },

    readNull: function (addr, cpu) {
        return 0;
    },

    writeNull: function (addr, w, cpu) {
    },

    readWord: function (addr, cpu) {
        addr &= 0xFFFE;
        return this.memoryMap[addr][0].call(this, addr, cpu);
    },

    writeWord: function (addr, w, cpu) {
        addr &= 0xFFFE;
        this.memoryMap[addr][1].call(this, addr, w, cpu);
    },

    // Fast methods that doesn't produce wait states. For debugger etc.

    getByte: function (addr) {
        if (addr < 0x2000) {
            return this.rom[addr];
        }
        if (addr < 0x4000) {
            if (this.enableAMS) {
                return this.ams.getByte(addr);
            }
            else {
                return this.ram[addr];
            }
        }
        if (addr < 0x6000) {
            if (this.peripheralROMEnabled) {
                var peripheralROM = this.peripheralROMs[this.peripheralROMNumber];
                return peripheralROM != null ? peripheralROM[addr - 0x4000] : 0;
            }
            else {
                return 0;
            }
        }
        if (addr < 0x8000) {
            return this.cartImage != null ? this.cartImage[addr + this.cartAddrOffset] : this.ram[addr];
        }
        if (addr < 0x8400) {
            addr = addr | 0x0300;
            return this.ram[addr];
        }
        if (addr < 0xA000) {
            return 0;
        }
        if (addr < 0x10000) {
            if (this.enableAMS) {
                return this.ams.getByte(addr);
            }
            else {
                return this.ram[addr];
            }
        }
        return 0;
    },

    getWord: function (addr) {
        if (addr < 0x2000) {
            return (this.rom[addr] << 8) | this.rom[addr + 1];
        }
        if (addr < 0x4000) {
            if (this.enableAMS) {
                return this.ams.readWord(addr);
            }
            else {
                return this.ram[addr] << 8 | this.ram[addr + 1];
            }
        }
        if (addr < 0x6000) {
            if (this.peripheralROMEnabled) {
                var peripheralROM = this.peripheralROMs[this.peripheralROMNumber];
                return peripheralROM != null ? peripheralROM[addr - 0x4000] << 8 | peripheralROM[addr + 1 - 0x4000] : 0;
            }
            else {
                return 0;
            }
        }
        if (addr < 0x8000) {
            return this.cartImage != null ? (this.cartImage[addr + this.cartAddrOffset] << 8) | this.cartImage[addr + this.cartAddrOffset + 1] : this.ram[addr] << 8 | this.ram[addr + 1];
        }
        if (addr < 0x8400) {
            addr = addr | 0x0300;
            return this.ram[addr] << 8 | this.ram[addr + 1];
        }
        if (addr < 0xA000) {
            return 0;
        }
        if (addr < 0x10000) {
            if (this.enableAMS) {
                return this.ams.readWord(addr);
            }
            else {
                return this.ram[addr] << 8 | this.ram[addr + 1];
            }
        }
        return 0;
    },

    // For disk IO etc. that's not faithfully emulated

    getPADByte: function (addr) {
        return this.ram[addr];
    },

    getPADWord: function (addr) {
        return this.ram[addr] << 8 | this.ram[addr + 1];
    },

    setPADByte: function (addr, b) {
        return this.ram[addr] = b;
    },

    setPADWord: function (addr, w) {
        this.ram[addr] = w >> 8;
        this.ram[addr] = w & 0xFF;
    },

    getStatusString: function () {
        return "GROM:" + this.gromAddress.toHexWord() + " (bank:" + ((this.gromAddress & 0xE000) >> 13) +
            ", addr:" + (this.gromAddress & 0x1FFF).toHexWord() + ") " +
           (this.cartImage != null ? "CART: bank " + this.currentCartBank +" / 0-" + (this.cartBankCount - 1) : "");
    },

    hexView: function (start, length, anchorAddr) {
        var text = "";
        var anchorLine = null;
        var addr = start;
        var line = 0;
        for (var i = 0; i < length; addr++, i++) {
            if ((i & 0x000F) == 0) {
                text += "\n" + addr.toHexWord() + ":";
                line++;
            }
            text += " ";
            if (anchorAddr && anchorAddr == addr) {
                anchorLine = line;
            }
            var hex = this.getByte(addr).toString(16).toUpperCase();
            if (hex.length == 1) {
                text += "0";
            }
            text += hex;
        }
        return {text: text.substr(1), anchorLine: anchorLine - 1};
    },

    set32KRAMEnabled: function (enabled) {
        this.enable32KRAM = enabled;
    },

    setAMSEnabled: function (enabled) {
        this.enableAMS = enabled;
    }
};