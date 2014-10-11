/*
 * js99'er - TI-99/4A emulator written in JavaScript
 *
 * Created 2014 by Rasmus Moustgaard <rasmus.moustgaard@gmail.com>
 */

'use strict';

Software.TYPE_SYSTEM = 0;
Software.TYPE_MEMORY_DUMP = 1;
Software.TYPE_CART = 2;
Software.TYPE_INVERTED_CART = 3;
Software.TYPE_DIVIDER = 4;
Software.TYPE_GROUP = 5;

Software.programs = [
    {
        name: "TI Basic",
        type: Software.TYPE_SYSTEM
    },
    {
        name: "TI Extended Basic",
        type: Software.TYPE_CART,
        url: "software/xb.json"
    },
    {
        name: "Editor/Assembler",
        type: Software.TYPE_CART,
        url: "software/editor-assembler.json"
    },
    {
        type: Software.TYPE_DIVIDER
    },
    {
        name: "Apps",
        type: Software.TYPE_GROUP,
        programs: [
            {
                name: "Mini Memory",
                type: Software.TYPE_CART,
                url: "software/minimem.json"
            },
            {
                name: "Editor Assembler II",
                type: Software.TYPE_CART,
                url: "software/ea2.json"
            },
            {
                name: "RXB 2012",
                type: Software.TYPE_CART,
                url: "software/rxb2012.json"
            },
            {
                name: "TurboForth",
                type: Software.TYPE_CART,
                url: "software/turboforth.json"
            },
            {
                name: "fbForth",
                type: Software.TYPE_INVERTED_CART,
                url: "software/fbForth200.json"
            },
            {
                name: "TI Workshop",
                type: Software.TYPE_INVERTED_CART,
                url: "software/ti-workshop.json"
            },
            {
                name: "Extended Basic 2.7 Suite",
                type: Software.TYPE_INVERTED_CART,
                url: "software/xb27suite.json"
            }
        ]
    },
    {
        type: Software.TYPE_DIVIDER
    },
    {
        name: "Games",
        type: Software.TYPE_GROUP,
        programs: [
            {
                name: "Parsec",
                type: Software.TYPE_CART,
                url: "software/parsec.json"
            },
            {
                name: "TI Invaders",
                type: Software.TYPE_CART,
                url: "software/ti-invaders.json"
            },
            {
                name: "Donkey Kong",
                type: Software.TYPE_CART,
                url: "software/donkeykong.json"
            },
            {
                name: "Ms Pac-Man",
                type: Software.TYPE_CART,
                url: "software/mspacman.json"
            },
            {
                name: "Robotron: 2084",
                type: Software.TYPE_CART,
                url: "software/robotron-2084.json"
            },
            {
                name: "Q-Bert",
                type: Software.TYPE_CART,
                url: "software/qbert.json"
            },
            {
                name: "Demon Attack",
                type: Software.TYPE_CART,
                url: "software/demon-attack.json"
            },
            {
                name: "512K Game cart",
                type: Software.TYPE_CART,
                url: "software/gamecart.json"
            },
            {
                name: "512K Game cart 2",
                type: Software.TYPE_CART,
                url: "software/gamecart2.json"
            },
            {
                name: "Road Hunter/TI Scramble/Titanium",
                type: Software.TYPE_INVERTED_CART,
                url: "software/scrolling-trilogy.json"
            },
            {
                name: "Flappy Bird",
                type: Software.TYPE_INVERTED_CART,
                url: "software/flappybird.json"
            },
            {
                name: "Sabre Wulf",
                type: Software.TYPE_INVERTED_CART,
                url: "software/sabrewulf.json"
            },
            {
                name: "Pitfall!",
                type: Software.TYPE_INVERTED_CART,
                url: "software/pitfall.json"
            }
        ]
    },
    {
        type: Software.TYPE_DIVIDER
    },
    {
        name: "Demos",
        type: Software.TYPE_GROUP,
        programs: [
            {
                name: "Horizontal scrolling demo",
                type: Software.TYPE_MEMORY_DUMP,
                startAddress: 0xA000,
                url: "software/hscroll.json"
            },
            {
                name: "Platform 2D scrolling demo",
                type: Software.TYPE_MEMORY_DUMP,
                startAddress: 0xA000,
                url: "software/platform.json"
            },
            {
                name: "Isometric scrolling demo",
                type: Software.TYPE_MEMORY_DUMP,
                startAddress: 0xA000,
                url: "software/isoscroll.json"
            },
            {
                name: "Dungeon demo",
                type: Software.TYPE_MEMORY_DUMP,
                startAddress: 0xA000,
                url: "software/dungeon.json"
            },
            {
                name: "Light-year demo",
                type: Software.TYPE_MEMORY_DUMP,
                startAddress: 0xA000,
                url: "software/light-year.json"
            }
        ]
    },
    {
        type: Software.TYPE_DIVIDER
    },
    {
        name: "F18A specific",
        type: Software.TYPE_GROUP,
        programs: [
            {
                name: "F18A scrolling demo",
                type: Software.TYPE_MEMORY_DUMP,
                startAddress: 0xA000,
                url: "software/ecm3scroll.json"
            },
            {
                name: "F18A bitmap demo",
                type: Software.TYPE_MEMORY_DUMP,
                startAddress: 0xA000,
                url: "software/bitmap.json"
            },
            {
                name: "F18A scroll v. 1.6",
                type: Software.TYPE_MEMORY_DUMP,
                startAddress: 0xA01A,
                url: "software/f18ascrollv16.json"
            },
            {
                name: "F18A scroll 'Rasmus'",
                type: Software.TYPE_MEMORY_DUMP,
                startAddress: 0xA04C,
                url: "software/f18a-titanium-scroll.json"
            },
            {
                name: "GPU image rotation",
                type: Software.TYPE_MEMORY_DUMP,
                startAddress: 0xA000,
                url: "software/gpu-rotate.json"
            },
            {
                name: "GPU lines demo",
                type: Software.TYPE_MEMORY_DUMP,
                startAddress: 0xA000,
                url: "software/gpu-lines.json"
            },
            {
                name: "GPU PIX lines demo",
                type: Software.TYPE_MEMORY_DUMP,
                startAddress: 0xA000,
                url: "software/gpu-pixlines.json"
            },
            {
                name: "GPU Mandelbrot (Tursi)",
                type: Software.TYPE_MEMORY_DUMP,
                startAddress: 0xA000,
                url: "software/gpu-mandelbrot.json"
            },
            {
                name: "Power Strike demo",
                type: Software.TYPE_MEMORY_DUMP,
                startAddress: 0xA000,
                url: "software/powerstrike.json"
            }
        ]
    }
];

function Software() {
    this.programs = Software.programs;
    this.log = Log.getLog();
}

Software.prototype = {

    getPrograms: function() {
        return this.programs;
    },

    getProgram: function(path, onReady) {
        var pathParts = path.split(".");
        var programs = this.programs;
        for (var i = 0; i < pathParts.length && programs != null; i++) {
            if (i < pathParts.length - 1) {
                programs = programs[pathParts[i]].programs;
            }
            else {
                var program = programs[pathParts[i]];
                if (program != null) {
                    if (program.url != null) {
                        this.loadProgram(program.url, program, function(prg) {
                            program.url = null; // Mark as loaded
                            onReady(prg);
                        });
                    }
                    else {
                        onReady(program);
                    }
                    return;
                }
            }
        }
        onReady(null);
    },

    loadProgram: function(url, program, onReady) {
        var log = this.log;
        var self = this;
        $.ajax({
            url: url,
            async: true,
            dataType: "json",
            success: function(data, textStatus, jqXHR) {
                if (program == null) {
                    program = {};
                }
                if (program.type == null) {
                    program.type = (data.inverted == "true" ? Software.TYPE_INVERTED_CART : Software.TYPE_CART)
                }
                if (data.rom != null) {
                    program.rom = self.hexArrayToBin(data.rom);
                }
                if (data.grom != null) {
                    program.grom = self.hexArrayToBin(data.grom);
                }
                if (data.groms != null) {
                    program.groms = [];
                    for (var g = 0; g < data.groms.length; g++) {
                        program.groms[g] = self.hexArrayToBin(data.groms[g]);
                    }
                }
                if (data.memoryBlocks != null) {
                    program.memoryBlocks = [];
                    for (var i = 0; i < data.memoryBlocks.length; i++) {
                        program.memoryBlocks[i] = {};
                        program.memoryBlocks[i].address = parseInt(data.memoryBlocks[i].address);
                        program.memoryBlocks[i].data = self.hexArrayToBin(data.memoryBlocks[i].data);
                    }
                }
                program.ramAt6000 = data.ramAt6000 == "true";
                program.ramAt7000 = data.ramAt7000 == "true";
                onReady(program);
            },
            error: function(jqXHR, textStatus, errorThrown) {
                log.error(textStatus.toUpperCase() + ": " + (errorThrown ? errorThrown : "Could not load JSON file. In Chrome add --allow-file-access-from-files parameter."));
                onReady(null);
            }
        });
    },

    hexArrayToBin: function(hexArray) {
        var binArray = [];
        var n = 0;
        for (var i = 0; i < hexArray.length; i++) {
            var row = hexArray[i];
            for (var j = 0; j < row.length; j += 2) {
                binArray[n++] = parseInt(row.substr(j, 2), 16);
            }
        }
        return binArray;
    },

    loadRPKModuleFromFile: function(file, onSuccess, onError) {
        this.loadRPKModule(new zip.BlobReader(file), onSuccess, onError);
    },

    loadRPKModuleFromURL: function(url, onSuccess, onError) {
        this.loadRPKModule(new zip.HttpReader(url), onSuccess, onError);
    },

    loadRPKModule: function(reader, onSuccess, onError) {
        var log = Log.getLog();
        zip.createReader(reader, function(zipReader) {
            zipReader.getEntries(function(entries) {
                var layoutEntry = null;
                entries.forEach(function(entry) {
                    // log.info(entry.filename);
                    if (entry.filename == "layout.xml") {
                        // log.info("Layout file found");
                        layoutEntry = entry;
                    }
                });
                if (layoutEntry != null) {
                    var writer = new zip.TextWriter("ISO-8859-1");
                    layoutEntry.getData(writer, function(txt) {
                        // log.info(txt);
                        var parser = new DOMParser();
                        var xmlDoc = parser.parseFromString(txt, "text/xml");
                        var sw = {};
                        var pcb = xmlDoc.getElementsByTagName("pcb")[0];
                        var pcbType = pcb.getAttribute("type");
                        sw.type = pcbType.toLowerCase() == "paged379i" ? Software.TYPE_INVERTED_CART : Software.TYPE_CART;
                        var roms = xmlDoc.getElementsByTagName("rom");
                        var sockets = xmlDoc.getElementsByTagName("socket");
                        var filesToLoad = roms.length;
                        for (var i = 0; i < roms.length; i++) {
                            var rom = roms[i];
                            var romId = rom.getAttribute("id");
                            var filename = rom.getAttribute("file");
                            var socketId = null;
                            for (var j = 0; j < sockets.length; j++) {
                                if (sockets[j].getAttribute("uses") == romId) {
                                    socketId = sockets[j].getAttribute("id");
                                }
                            }
                            // log.info("ROM " + romId + " (" + socketId + "): " + filename);
                            loadFile(entries, filename, romId, socketId);
                        }

                        function loadFile(entries, filename, romId, socketId) {
                            entries.forEach(function(entry) {
                                if (entry.filename == filename) {
                                    var blobWriter = new zip.BlobWriter();
                                    entry.getData(blobWriter, function(blob) {
                                        var reader = new FileReader();
                                        reader.onload = function() {
                                            // reader.result contains the contents of blob as a typed array
                                            var typedArray = new Uint8Array(this.result);
                                            var byteArray = [];
                                            for (var i = 0; i < typedArray.length; i++) {
                                                byteArray[i] = typedArray[i];
                                            }
                                            if (socketId.substr(0, 3).toLowerCase() == "rom") {
                                                log.info("ROM " + romId + " (" + socketId + "): '" + filename + "', " + byteArray.length + " bytes");
                                                var addr = (socketId == "rom2_socket") ? 0x2000 : 0;
                                                if (sw.rom == null) {
                                                    sw.rom = [];
                                                }
                                                for (i = 0; i < byteArray.length; i++) {
                                                    sw.rom[addr + i] = byteArray[i];
                                                }
                                                for (i = byteArray.length; i < 0x2000; i++) {
                                                    sw.rom[addr + i] = 0;
                                                }
                                            }
                                            else if (socketId.substr(0, 4).toLowerCase() == "grom") {
                                                log.info("GROM " + romId + " (" + socketId + "): '" + filename + "', " + byteArray.length + " bytes");
                                                sw.grom = byteArray;
                                            }
                                            filesToLoad--;
                                            if (filesToLoad == 0) {
                                                onSuccess(sw);
                                            }
                                        };
                                        reader.readAsArrayBuffer(blob);
                                    });
                                }
                            });
                        }
                    });
                }
            });
        }, function(message) {
            onError(message);
        });
    }
};

