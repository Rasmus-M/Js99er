/*
 * js99'er - TI-99/4A emulator written in JavaScript
 *
 * Created 2014 by Rasmus Moustgaard <rasmus.moustgaard@gmail.com>
*/

 'use strict';

TI994A.FRAMES_TO_RUN = Number.MAX_VALUE;
TI994A.FRAME_MS = 16.66;
TI994A.FPS_MS = 4000;

function TI994A(document, canvas, diskImages, settings) {

    // Assemble the console
    this.keyboard = new Keyboard();
    this.cru = new CRU(this.keyboard);
    this.vdp = settings && settings.isF18AEnabled() ? new F18A(canvas, this.cru) : new TMS9918A(canvas, this.cru);
    var vdpRAM = this.vdp.getRAM();
    this.diskDrives = [
        new DiskDrive("DSK1", vdpRAM, diskImages ? diskImages.FLOPPY1 : null),
        new DiskDrive("DSK2", vdpRAM, diskImages ? diskImages.FLOPPY2 : null),
        new DiskDrive("DSK3", vdpRAM, diskImages ? diskImages.FLOPPY3 : null)
    ];
    this.tms9919 = new TMS9919(settings && settings.isSoundEnabled());
    this.tms5220 = new TMS5220();
    this.memory = new Memory(this.vdp, this.tms9919, this.tms5220, settings && settings.is32KRAMEnabled());
    this.tms9900 = new TMS9900(this.memory, this.cru, this.diskDrives);
    this.cru.setMemory(this.memory);

    // Attach keyboard listeners
    var self = this;
    document.onkeydown = function(evt) {
        self.keyboard.keyEvent(evt, true);
    };
    document.onkeyup = function(evt) {
        self.keyboard.keyEvent(evt, false);
    };
    // document.onkeypress = function(evt) {
    //     self.keyboard.keyPressEvent(evt);
    // };

    this.cpuSpeed = 1;
    this.frameCount = 0;
    this.lastFpsTime = null;
    this.fpsFrameCount = 0;
    this.running = false;
    this.log = Log.getLog();

    this.reset();
}

TI994A.prototype = {

    isRunning: function() {
        return this.running;
    },

    reset: function(keepCart) {
        this.vdp.reset();
        this.tms9919.reset();
        this.keyboard.reset();
        this.memory.reset(keepCart);
        this.cru.reset();
        this.tms9900.reset();
        this.resetFps();
        this.cpuSpeed = 1;
    },

    start: function(fast) {
        if (!this.isRunning()) {
            this.cpuSpeed = fast ? 2 : 1;
            if (this.isRunning()) {
                this.stop();
            }
            this.log.info("Start");
            var self = this;
            this.frameInterval = setInterval(
                function() {
                    // Log.getLog().info("Frame " + self.frameCount);
                    if (self.frameCount < TI994A.FRAMES_TO_RUN) {
                        self.frame();
                    }
                    else {
                        self.stop();
                    }
                },
                TI994A.FRAME_MS
            );
            this.resetFps();
            this.printFps();
            this.fpsInterval = setInterval(
                function() {
                    self.printFps();
                },
                TI994A.FPS_MS
            );
            this.vdp.start();
        }
        this.running = true;
    },

    frame: function() {
        this.tms9900.run(TMS9900.FRAME_CYCLES * this.cpuSpeed);
        var self = this;
        requestAnimationFrame(function() {self.vdp.drawFrame();}, null);
        this.frameCount++;
        this.fpsFrameCount++;
    },

    stop: function() {
        this.log.info("Stop");
        clearInterval(this.frameInterval);
        clearInterval(this.fpsInterval);
        this.tms9919.mute();
        this.vdp.stop();
        this.running = false;
    },

    resetFps: function() {
        this.lastFpsTime = null;
        this.fpsFrameCount = 0;
    },

    printFps: function() {
        var now = +new Date();
        var s = 'Frame ' + this.frameCount + ' running';
        if (this.lastFpsTime) {
            s += ': '
                + (this.fpsFrameCount / ((now - this.lastFpsTime) / 1000)).toFixed(1)
                + ' / '
                + (1000 / TI994A.FRAME_MS).toFixed(1)
                + ' FPS';
        }
        this.log.info(s);
        this.fpsFrameCount = 0;
        this.lastFpsTime = now;
    },

    getStatusString: function() {
        return "CPU: " + this.tms9900.getInternalRegsString() + "\n" +
               this.tms9900.getRegsStringFormatted() +
               this.memory.getStatusString() + "\n" +
               "VDP: " + this.vdp.getRegsString();
    },

    getDiskDrives: function() {
        return this.diskDrives;
    },

    loadSoftware: function(sw) {
        var wasRunning = this.isRunning();
        if (wasRunning) {
            this.stop();
        }
        this.reset(false);
        if (sw.memoryBlocks != null) {
            for (var i = 0; i < sw.memoryBlocks.length; i++) {
                var memoryBlock = sw.memoryBlocks[i];
                this.memory.loadRAM(memoryBlock.address, memoryBlock.data);
            }
        }
        if (sw.rom != null) {
            this.memory.setCartridgeImage(sw.rom, sw.type == Software.TYPE_INVERTED_CART);
        }
        if (sw.grom != null) {
            this.memory.loadGROM(sw.grom, 3);
        }
        this.memory.toggleCartridgeRAM(0x6000, 0x1000, sw.ramAt6000);
        this.memory.toggleCartridgeRAM(0x7000, 0x1000, sw.ramAt7000);
        this.tms9900.setWP(sw.workspaceAddress != null ? sw.workspaceAddress : (SYSTEM.ROM[0] << 8 | SYSTEM.ROM[1]));
        this.tms9900.setPC(sw.startAddress != null ? sw.startAddress : (SYSTEM.ROM[2] << 8 | SYSTEM.ROM[3]));
        if (wasRunning) {
            this.start();
        }
    }
};
