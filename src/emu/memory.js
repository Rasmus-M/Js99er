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
    this.enableGRAM = settings && settings.isGRAMEnabled();
    this.ramAt6000 = false;
    this.ramAt7000 = false;

    this.ram = new Uint8Array(0x10000);
    this.rom = new Uint8Array(SYSTEM.ROM);

    this.rom[0x14a7] = 0x03; // Fix cassette sync (LI instead of CI)
    this.rom[0x14a9] = 0x37; // Cassette read time (original 0x1f)
    this.rom[0x1353] = 0x1f; // Cassette write time (original 0x23)

    this.groms = [];
    for (var i = 0; i < Memory.GROM_BASES; i++) {
        this.groms[i] = new Uint8Array(0x10000);
    }
    this.ams = this.enableAMS ? new AMS(1024) : null;

    this.loadGROM(SYSTEM.GROM, 0, 0);
    this.gromAddress = 0;
    this.gromAccess = 2;
    this.gromPrefetch = new Uint8Array(Memory.GROM_BASES);
    this.multiGROMBases = false;

    this.cartImage = null;
    this.cartInverted = false;
    this.cartBankCount = 0;
    this.currentCartBank = 0;
    this.cartAddrOffset = -0x6000;
    this.cartRAMPaged = false;
    this.currentCartRAMBank = 0;
    this.cartAddrRAMOffset = -0x6000;

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
        var cartridgeRAMAccessors = [this.readCartridgeRAM, this.writeCartridgeRAM];
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
        for (i = 0x6000; i < 0x7000; i++) {
            this.memoryMap[i] = this.ramAt6000 ? cartridgeRAMAccessors : cartridgeROMAccessors;
        }
        for (i = 0x7000; i < 0x8000; i++) {
            this.memoryMap[i] = this.ramAt7000 ? cartridgeRAMAccessors : cartridgeROMAccessors;
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
            this.ram[i] = 0;
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
        this.gromAccess = 2;
    },

    loadRAM: function (addr, byteArray) {
        for (var i = 0; i < byteArray.length; i++) {
            var a = addr + i;
            if (this.enableAMS && (a >= 0x2000 && a < 0x4000 || a >= 0xa000 && a < 0x10000)) {
                this.ams.setByte(a, byteArray[i]);
            }
            else if (a >= 0x6000 && a < 0x8000) {
                this.cartImage[a + this.cartAddrRAMOffset] = byteArray[i];
            }
            else {
                this.ram[a] = byteArray[i];
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

    setCartridgeImage: function (byteArray, inverted, ramAt6000, ramAt7000, ramPaged) {
        var i;
        var length = ((byteArray.length / 0x2000) + (byteArray.length % 0x2000 === 0 ? 0 : 1)) * 0x2000;
        this.log.info("Cartridge size: " + length.toHexWord());
        this.cartImage = new Uint8Array(length);
        for (i = 0; i < this.cartImage.length; i++) {
            this.cartImage[i] = i < byteArray.length ? byteArray[i] : 0;
        }
        this.cartInverted = inverted;
        this.cartBankCount = this.cartImage.length / 0x2000;
        this.currentCartBank = 0;
        this.cartAddrOffset = -0x6000;
        this.cartRAMPaged = ramPaged;
        if (ramPaged) {
            this.log.info("Paged RAM cart found.");
            this.currentCartRAMBank = 0;
            this.cartAddrRAMOffset = -0x6000;
        }
        this.ramAt6000 = ramAt6000;
        if (this.ramAt6000) {
            this.log.info("RAM at >6000");
        }
        this.ramAt7000 = ramAt7000;
        if (this.ramAt7000) {
            this.log.info("RAM at >7000");
        }
        this.buildMemoryMap();
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
            if (peripheralROM) {
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
        return this.cartImage  ? (this.cartImage[addr + this.cartAddrOffset] << 8) | this.cartImage[addr + this.cartAddrOffset + 1] : 0;
    },

    writeCartridgeROM: function (addr, w, cpu) {
        cpu.addCycles(4);
        if (!this.cartRAMPaged || addr < 0x6800) {
            this.currentCartBank = (addr >> 1) & (this.cartBankCount - 1);
            if (this.cartInverted) {
                this.currentCartBank = this.cartBankCount - this.currentCartBank - 1;
            }
            this.cartAddrOffset = this.currentCartBank * 0x2000 - 0x6000;
            // this.log.info("Cartridge ROM bank selected: " + this.currentCartBank);
        }
        else {
            this.currentCartRAMBank = (addr >> 1) & (this.cartBankCount - 1);
            this.cartAddrRAMOffset = this.currentCartRAMBank * 0x2000 - 0x6000;
            // this.log.info("Cartridge RAM bank selected: " + this.currentCartRAMBank);
        }
    },

    readCartridgeRAM: function (addr, cpu) {
        // this.log.info("Read cartridge RAM: " + addr.toHexWord());
        cpu.addCycles(4);
        return this.cartImage ? (this.cartImage[addr + this.cartAddrRAMOffset] << 8) | this.cartImage[addr + this.cartAddrRAMOffset + 1] : 0;
    },

    writeCartridgeRAM: function (addr, w, cpu) {
        // this.log.info("Write cartridge RAM: " + addr.toHexWord());
        cpu.addCycles(4);
        if (this.cartImage) {
            this.cartImage[addr + this.cartAddrRAMOffset] = w >> 8;
            this.cartImage[addr + this.cartAddrRAMOffset + 1] = w & 0xFF;
        }
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
        if (addr === Memory.VDPRD) {
            return this.vdp.readData() << 8;
        }
        else if (addr === Memory.VDPSTA) {
            return this.vdp.readStatus() << 8;
        }
        return 0;
    },

    writeVDP: function (addr, w, cpu) {
        cpu.addCycles(4);
        addr = addr & 0x8C02;
        if (addr === Memory.VDPWD) {
            this.vdp.writeData(w >> 8);
        }
        else if (addr === Memory.VDPWA) {
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
        if (addr === Memory.GRMRD) {
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
        else if (addr === Memory.GRMRA) {
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
        cpu.addCycles(23);
        addr = addr & 0x9C02;
        if (addr === Memory.GRMWD) {
            if (this.enableGRAM) {
                // Write data to GROM
                var base = !this.multiGROMBases || this.gromAddress - 1 < 0x6000 ? 0 : (addr & 0x003C) >> 2;
                this.gromAccess = 2;
                this.groms[base][this.gromAddress-1] = w >> 8;
                // Prefetch for all bases
                for (var i = 0; i < Memory.GROM_BASES; i++) {
                    this.gromPrefetch[i] = this.groms[i][this.gromAddress];
                }
                this.gromAddress++;
            }
        }
        else if (addr === Memory.GRMWA) {
            // Set GROM address
            this.gromAddress = ((this.gromAddress << 8) | w >> 8) & 0xFFFF;
            this.gromAccess--;
            if (this.gromAccess === 0) {
                this.gromAccess = 2;
                // Prefetch for all bases
                for (var b = 0; b < Memory.GROM_BASES; b++) {
                    this.gromPrefetch[b] = this.groms[b][this.gromAddress];
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

    // Fast methods that don't produce wait states. For debugger etc.

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
                return peripheralROM ? peripheralROM[addr - 0x4000] : 0;
            }
            else {
                return 0;
            }
        }
        if (addr < 0x7000) {
            return this.cartImage ? this.cartImage[addr + this.cartAddrOffset] || 0 : 0;
        }
        if (addr < 0x8000) {
            if (this.cartRAMPaged) {
                return this.cartImage ? this.cartImage[addr + this.cartAddrRAMOffset] : 0;
            }
            else {
                return this.cartImage ? this.cartImage[addr + this.cartAddrOffset] : 0;
            }
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
                return peripheralROM ? peripheralROM[addr - 0x4000] << 8 | peripheralROM[addr + 1 - 0x4000] : 0;
            }
            else {
                return 0;
            }
        }
        if (addr < 0x7000) {
            return this.cartImage ? (this.cartImage[addr + this.cartAddrOffset] << 8) | this.cartImage[addr + this.cartAddrOffset + 1] : 0;
        }
        if (addr < 0x8000) {
            if (this.cartRAMPaged) {
                return this.cartImage ? (this.cartImage[addr + this.cartAddrRAMOffset] << 8) | this.cartImage[addr + this.cartAddrRAMOffset + 1] : 0;
            }
            else {
                return this.cartImage ? (this.cartImage[addr + this.cartAddrOffset] << 8) | this.cartImage[addr + this.cartAddrOffset + 1] : 0;
            }
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
           (this.cartImage ? "CART: bank " + this.currentCartBank + (this.cartRAMPaged ? "/" + this.currentCartRAMBank : "") + " of " + this.cartBankCount : "") +
           (this.enableAMS ? "\nAMS Regs: " + this.ams.getStatusString() : "")
    },

    hexView: function (start, length, anchorAddr) {
        var text = "";
        var anchorLine = null;
        var addr = start;
        var line = 0;
        for (var i = 0; i < length; addr++, i++) {
            if ((i & 0x000F) === 0) {
                text += "\n" + addr.toHexWord() + ":";
                line++;
            }
            text += " ";
            if (anchorAddr && anchorAddr === addr) {
                anchorLine = line;
            }
            var hex;
            var byte = this.getByte(addr);
            if (typeof(byte) === 'number') {
                hex = byte.toString(16).toUpperCase();
            } else {
                hex = "??";
            }
            if (hex.length === 1) {
                text += "0";
            }
            text += hex;
        }
        return {text: text.substr(1), lineCount: line, anchorLine: anchorLine - 1};
    },

    set32KRAMEnabled: function (enabled) {
        this.enable32KRAM = enabled;
    },

    setAMSEnabled: function (enabled) {
        this.enableAMS = enabled;
    },

    setGRAMEnabled: function (enabled) {
        this.enableGRAM = enabled;
    },

    getState: function () {
        return {
            enable32KRAM: this.enable32KRAM,
            enableAMS: this.enableAMS,
            enableGRAM: this.enableGRAM,
            ramAt6000: this.ramAt6000,
            ramAt7000: this.ramAt7000,
            ram: this.ram,
            rom: this.rom,
            groms: this.groms,
            gromAddress: this.gromAddress,
            gromAccess: this.gromAccess,
            gromPrefetch: this.gromPrefetch,
            multiGROMBases: this.multiGROMBases,
            cartImage: this.cartImage,
            cartInverted: this.cartInverted,
            cartBankCount: this.cartBankCount,
            currentCartBank: this.currentCartBank,
            cartAddrOffset: this.cartAddrOffset,
            cartRAMPaged: this.cartRAMPaged,
            currentCartRAMBank: this.currentCartRAMBank,
            cartAddrRAMOffset: this.cartAddrRAMOffset,
            peripheralROMs: this.peripheralROMs,
            peripheralROMEnabled: this.peripheralROMEnabled,
            peripheralROMNumber: this.peripheralROMNumber,
            ams: this.enableAMS ? this.ams.getState() : null
        };
    },

    restoreState: function (state) {
        this.enable32KRAM = state.enable32KRAM;
        this.enableAMS = state.enableAMS;
        this.enableGRAM = state.enableGRAM;
        this.ramAt6000 = state.ramAt6000;
        this.ramAt7000 = state.ramAt7000;
        this.ram = state.ram;
        this.rom = state.rom;
        this.groms = state.groms;
        this.gromAddress = state.gromAddress;
        this.gromAccess = state.gromAccess;
        this.gromPrefetch = state.gromPrefetch;
        this.multiGROMBases = state.multiGROMBases;
        this.cartImage = state.cartImage;
        this.cartInverted = state.cartInverted;
        this.cartBankCount  = state.cartBankCount;
        this.currentCartBank = state.currentCartBank;
        this.cartAddrOffset = state.cartAddrOffset;
        this.cartRAMPaged = state.cartRAMPaged;
        this.currentCartRAMBank = state.currentCartRAMBank;
        this.cartAddrRAMOffset = state.cartAddrRAMOffset;
        this.peripheralROMs = state.peripheralROMs;
        this.peripheralROMEnabled = state.peripheralROMEnabled;
        this.peripheralROMNumber = state.peripheralROMNumber;
        if (this.enableAMS) {
            this.ams.restoreState(state.ams);
        }
        this.buildMemoryMap();
    }
};
