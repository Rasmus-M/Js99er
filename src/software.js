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
Software.TYPE_MORE = 6;

function Software() {
    this.programs = Software.programs;
    this.log = Log.getLog();
}

Software.prototype = {

    getPrograms: function () {
        return this.programs;
    },

    getProgram: function (path, onReady) {
        var log = this.log;
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
                        if (program.url.substr(program.url.length - 3).toLowerCase() == "rpk") {
                            this.loadRPKModuleFromURL(program.url, onReady, function (msg) { log.error(msg); });
                        }
                        else if (program.url.substr(program.url.length - 3).toLowerCase() == "bin") {
                            this.loadBinModuleFromURL(program.url, onReady, function (msg) { log.error(msg); });
                        }
                        else {
                            this.loadProgram(program.url, program, function (prg) {
                                program.url = null; // Mark as loaded
                                onReady(prg);
                            });
                        }
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

    loadProgram: function (url, program, onReady) {
        var log = this.log;
        var self = this;
        $.ajax({
            url: url,
            async: true,
            dataType: "json",
            success: function (data, textStatus, jqXHR) {
                if (program == null) {
                    program = {};
                }
                if (program.type == null) {
                    program.type = (data.inverted == "true" ? Software.TYPE_INVERTED_CART : Software.TYPE_CART)
                }
                else if (program.type == Software.TYPE_MEMORY_DUMP) {
                    program.startAddress = data.startAddress ? parseInt(data.startAddress) : 0xA000;
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
            error: function (jqXHR, textStatus, errorThrown) {
                log.error(textStatus.toUpperCase() + ": " + (errorThrown ? errorThrown : "Could not load JSON file. In Chrome add --allow-file-access-from-files parameter."));
                onReady(null);
            }
        });
    },

    hexArrayToBin: function (hexArray) {
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

    loadRPKModuleFromFile: function (file, onSuccess, onError) {
        this.loadRPKModule(new zip.BlobReader(file), onSuccess, onError);
    },

    loadRPKModuleFromURL: function (url, onSuccess, onError) {
        this.loadRPKModule(new zip.HttpReader(url), onSuccess, onError);
    },

    loadRPKModule: function (reader, onSuccess, onError) {
        var log = Log.getLog();
        zip.createReader(reader, function (zipReader) {
            zipReader.getEntries(function (entries) {
                var layoutEntry = null;
                entries.forEach(function (entry) {
                    // log.info(entry.filename);
                    if (entry.filename == "layout.xml") {
                        // log.info("Layout file found");
                        layoutEntry = entry;
                    }
                });
                if (layoutEntry != null) {
                    var writer = new zip.TextWriter("ISO-8859-1");
                    layoutEntry.getData(writer, function (txt) {
                        // log.info(txt);
                        var parser = new DOMParser();
                        var xmlDoc = parser.parseFromString(txt, "text/xml");
                        var sw = {
                            ramAt6000: false,
                            ramAt7000: false
                        };
                        var pcb = xmlDoc.getElementsByTagName("pcb")[0];
                        var pcbType = pcb.getAttribute("type").toLowerCase();
                        sw.type = pcbType == "paged379i" ? Software.TYPE_INVERTED_CART : Software.TYPE_CART;
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
                            loadFile(entries, filename, romId, socketId, pcbType);
                        }

                        function loadFile(entries, filename, romId, socketId, pcbType) {
                            entries.forEach(function (entry) {
                                if (entry.filename == filename) {
                                    var blobWriter = new zip.BlobWriter();
                                    entry.getData(blobWriter, function (blob) {
                                        var reader = new FileReader();
                                        reader.onload = function () {
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
                                                for (i = 0; i < Math.min(byteArray.length, pcbType == "paged" ? 0x2000 : byteArray.length); i++) {
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
        }, function (message) {
            if (onError) onError(message);
        });
    },

    loadBinModuleFromURL: function (url, onSuccess, onError) {
        console.log(url);
        var baseFileName = url.split('.')[0];
        var inverted = baseFileName && baseFileName.charAt(baseFileName.length - 1) == "3";
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'arraybuffer';
        xhr.onload = function (e) {
            var byteArray = new Uint8Array(this.response);
            var cart = {
                type: inverted ? Software.TYPE_INVERTED_CART : Software.TYPE_CART,
                rom: byteArray
            };
            onSuccess(cart);
        };
        xhr.send();
    },

    loadModuleFromBinFile: function (file, onSuccess, onError) {
        var baseFileName = file.name.split('.')[0];
        var inverted = baseFileName && baseFileName.charAt(baseFileName.length - 1) == "3";
        var grom = baseFileName && baseFileName.charAt(baseFileName.length - 1) == "g";
        var reader = new FileReader();
        reader.onload = function () {
            var byteArray = new Uint8Array(this.result);
            var cart;
            if (grom) {
                cart = {
                    type: Software.TYPE_CART,
                    grom: byteArray,
                    ramAt6000: false,
                    ramAt7000: false
                };
            }
            else {
                var ramPaged = (byteArray[3] === 0x52);
                cart = {
                    type: inverted ? Software.TYPE_INVERTED_CART : Software.TYPE_CART,
                    rom: byteArray,
                    ramAt6000: false,
                    ramAt7000: ramPaged,
                    ramPaged: ramPaged
                };
            }
            onSuccess(cart);
        };
        reader.onerror = function () {
            if (onError) onError(this.error.name);
        };
        reader.readAsArrayBuffer(file);
    }
};

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
                name: "Supercart",
                type: Software.TYPE_CART,
                url: "software/supercart.json"
            },
            {
                name: "Editor Assembler II",
                type: Software.TYPE_CART,
                url: "software/ea2.json"
            },
            {
                name: "RXB 2015",
                type: Software.TYPE_CART,
                url: "software/RXB2015.rpk"
            },
            {
                name: "Cortex Basic",
                type: Software.TYPE_INVERTED_CART,
                url: "software/cortexbasic.rpk"
            },
            {
                name: "Cortex Basic 80",
                type: Software.TYPE_INVERTED_CART,
                url: "software/cortex_basic_80.rpk"
            },
            {
                name: "TurboForth",
                type: Software.TYPE_CART,
                url: "software/turboforth.rpk"
            },
            {
                name: "fbForth",
                type: Software.TYPE_INVERTED_CART,
                url: "software/fbForth200.rpk"
            },
            {
                name: "TI Workshop",
                type: Software.TYPE_INVERTED_CART,
                url: "software/ti-workshop.json"
            },
            {
                name: "XB 2.7 Suite",
                type: Software.TYPE_CART,
                url: "software/xb27suite2.json"
            },
            {
                name: "Jumpstart for xas99",
                type: Software.TYPE_CART,
                url: "software/jumpstart.rpk"
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
                name: "Q-Bert",
                type: Software.TYPE_CART,
                url: "software/qbert.json"
            },
            //{
            //    name: "Donkey Kong",
            //    type: Software.TYPE_CART,
            //    url: "software/donkeykong.json"
            //},
            //{
            //    name: "Ms Pac-Man",
            //    type: Software.TYPE_CART,
            //    url: "software/mspacman.json"
            //},
            //{
            //    name: "Robotron: 2084",
            //    type: Software.TYPE_CART,
            //    url: "software/robotron-2084.json"
            //},
            {
                name: "Atarisoft compilation",
                type: Software.TYPE_CART,
                url: "software/atarisoft-multicart.rpk"
            },
            {
                name: "Game cart 1 (512K)",
                type: Software.TYPE_CART,
                url: "software/gamecart.rpk"
            },
            {
                name: "Game cart 2 (512K)",
                type: Software.TYPE_CART,
                url: "software/gamecart2.rpk"
            },
            {
                name: "Game cart 3 (512K)",
                type: Software.TYPE_CART,
                url: "software/gamecart3.rpk"
            },
            {
                name: "Rasmus 8-in-1 game cart",
                type: Software.TYPE_CART,
                url: "software/rasmus-8in1-cart.rpk"
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
                url: "software/sabrewulf.rpk"
            },
            {
                name: "Sports",
                type: Software.TYPE_INVERTED_CART,
                url: "software/sports.rpk"
            },
            {
                name: "Jet Set Willy",
                type: Software.TYPE_INVERTED_CART,
                url: "software/jsw.rpk"
            },
            {
                name: "Bouncy",
                type: Software.TYPE_INVERTED_CART,
                url: "software/bouncy.rpk"
            },
            {
                name: "JetPac",
                type: Software.TYPE_INVERTED_CART,
                url: "software/JetPac3.bin"
            },
            {
                name: "Pitfall!",
                type: Software.TYPE_INVERTED_CART,
                url: "software/pitfall.json"
            },
            {
                name: "Break Free (demo)",
                type: Software.TYPE_CART,
                url: "software/brkfree.rpk"
            },
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
                name: "Megademo",
                type: Software.TYPE_CART,
                url: "software/ti99demo.rpk"
            },
            {
                name: "Horizontal scrolling demo",
                type: Software.TYPE_MEMORY_DUMP,
                url: "software/hscroll.json"
            },
            {
                name: "Platform 2D scrolling demo",
                type: Software.TYPE_MEMORY_DUMP,
                url: "software/platform.json"
            },
            {
                name: "Isometric scrolling demo",
                type: Software.TYPE_MEMORY_DUMP,
                url: "software/isoscroll.json"
            },
            {
                name: "Dungeon demo",
                type: Software.TYPE_MEMORY_DUMP,
                url: "software/dungeon.json"
            },
            {
                name: "Light-year demo",
                type: Software.TYPE_MEMORY_DUMP,
                url: "software/light-year.json"
            },
            {
                name: "Lines demo",
                type: Software.TYPE_MEMORY_DUMP,
                url: "software/lines.json"
            },
            {
                name: "Multicolor demo",
                type: Software.TYPE_MEMORY_DUMP,
                url: "software/multicolor.json"
            },
            {
                name: "Scrolling Text demo",
                type: Software.TYPE_MEMORY_DUMP,
                url: "software/scrolltxt.json"
            },
            {
                name: "Happy 2015 demo",
                type: Software.TYPE_MEMORY_DUMP,
                url: "software/happy2015.json"
            },
            {
                name: "Another scrolling demo",
                type: Software.TYPE_MEMORY_DUMP,
                url: "software/platform2.json"
            },
            {
                name: "Animated hat demo",
                type: Software.TYPE_CART,
                url: "software/hat.rpk"
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
                url: "software/ecm3scroll.json"
            },
            {
                name: "F18A bitmap demo",
                type: Software.TYPE_MEMORY_DUMP,
                url: "software/bitmap.json"
            },
            {
                name: "GPU image rotation",
                type: Software.TYPE_MEMORY_DUMP,
                url: "software/gpu-rotate.json"
            },
            {
                name: "GPU lines demo",
                type: Software.TYPE_MEMORY_DUMP,
                url: "software/gpu-lines.json"
            },
            {
                name: "GPU PIX lines demo",
                type: Software.TYPE_MEMORY_DUMP,
                url: "software/gpu-pixlines.json"
            },
            {
                name: "GPU Mandelbrot (Tursi)",
                type: Software.TYPE_MEMORY_DUMP,
                url: "software/gpu-mandelbrot.json"
            },
            {
                name: "Power Strike demo",
                type: Software.TYPE_MEMORY_DUMP,
                url: "software/powerstrike.json"
            },
            {
                name: "Poly 3D demo",
                type: Software.TYPE_MEMORY_DUMP,
                url: "software/poly3d.json"
            },
            {
                name: "Position attributes demo",
                type: Software.TYPE_MEMORY_DUMP,
                url: "software/posattr.json"
            },
            {
                name: "TI-99 Mario Bros",
                type: Software.TYPE_INVERTED_CART,
                url: "software/Mario3.bin"
            }
        ]
    },
    {
        type: Software.TYPE_DIVIDER
    },
    {
        name: "More...",
        type: Software.TYPE_MORE
    }
];

Software.carts = [
    ["4a_flyer", null],
    ["5_card_draw", null],
    ["9900_break_thru", null],
    ["a-maze-ing", null],
    ["action_demo", null],
    ["Ader_Logiciel_Graphique", null],
    ["adventure", null],
    ["ag_edupack", null],
    ["ag_link", null],
    ["air_wolf", null],
    ["aliens", null],
    ["alien_rain", null],
    ["alpiner", null],
    ["archie_archiver", null],
    ["archiver_2_24", null],
    ["archiver_2_302", null],
    ["archiver_2_303", null],
    ["Arcturus", null],
    ["as_centipede", null],
    ["as_defender", null],
    ["as_digdug", null],
    ["as_jungle_hunt", null],
    ["as_moon_patrol", null],
    ["as_mrs_pac-man", null],
    ["as_pac-man", null],
    ["as_picnic_paranoia", null],
    ["as_pole_position", null],
    ["as_protector_2", null],
    ["as_robotron_2084", null],
    ["as_shamus", null],
    ["as_superstorm", null],
    ["attack_of_the_creepers", null],
    ["aw_computer_math_games_1", null],
    ["aw_computer_math_games_2", null],
    ["aw_computer_math_games_3", null],
    ["aw_computer_math_games_4", null],
    ["aw_computer_math_games_6", null],
    ["axel_f_soundtrack", null],
    ["bad_walls", null],
    ["ballroom_blitz_demo", null],
    ["bandit", null],
    ["battleship", null],
    ["beginning_grammar", null],
    ["beyond_space", null],
    ["binary", null],
    ["bingo", null],
    ["blackjack_and_poker", null],
    ["brain_buster", null],
    ["buzzard_bait", null],
    ["c64_screen_demo", null],
    ["c99_invaders", null],
    ["cache-cache", null],
    ["california_nights_demo", null],
    ["canada_mortgage", null],
    ["carts.txt", null],
    ["car_wars", null],
    ["cassette_backup_10", null],
    ["cataloging_library", null],
    ["cataloging_library_epson", null],
    ["cataloging_library_oki", null],
    ["caverns", null],
    ["cerberus", null],
    ["cf2k20-final", null],
    ["chainlink_master_solitaire", null],
    ["chisholm_trail", null],
    ["clowns", null],
    ["cockroach", null],
    ["coke_demo", null],
    ["colecovision_demo", null],
    ["compu-car", null],
    ["co_99_home_sentry", null],
    ["co_peripheral_test", null],
    ["co_ti2ibm_copier", null],
    ["cru_tester", null],
    ["cy_escape", null],
    ["cy_king_of_the_castle", null],
    ["db_beyond_parsec", null],
    ["db_black_hole", null],
    ["db_break_thru", null],
    ["db_burger_builder", null],
    ["db_d-station_1", null],
    ["db_d-station_2", null],
    ["db_desk_top_publisher", null],
    ["db_junkman_junior", null],
    ["db_mancala", null],
    ["db_micro_pinball_2", null],
    ["db_miniwriter_2_10", null],
    ["db_miniwriter_2_14", null],
    ["db_miniwriter_2_16", null],
    ["db_pro_typer", null],
    ["db_star_runner", null],
    ["db_super_space_2", null],
    ["db_tennis", null],
    ["db_ti_planner", null],
    ["dc_angler_dangler", null],
    ["dc_astro_fighter", null],
    ["demonstration", null],
    ["demonstration_de", null],
    ["de_burgertime", null],
    ["de_burgertime_beta", null],
    ["de_mission_x", null],
    ["de_treasure_island", null],
    ["de_treasure_island_beta", null],
    ["diagnostic_tests", null],
    ["diagnostic_tests_fr", null],
    ["disk-aid", null],
    ["diskassembler", null],
    ["diskodex", null],
    ["disk_catalogue_system", null],
    ["disk_catalog_utility", null],
    ["disk_copy_utility", null],
    ["disk_manager_1", null],
    ["disk_manager_1000", null],
    ["disk_manager_1000_31", null],
    ["disk_manager_1000_35", null],
    ["disk_manager_1000_35b", null],
    ["disk_manager_1000_36", null],
    ["disk_manager_1000_38", null],
    ["disk_manager_1000_40", null],
    ["disk_manager_1000_50", null],
    ["disk_manager_1000_60", null],
    ["disk_manager_1000_61", null],
    ["disk_manager_1000_gk3", null],
    ["disk_manager_1_int", null],
    ["disk_manager_2", null],
    ["disk_manager_2000_12", null],
    ["disk_manager_2000_22", null],
    ["disk_manager_3", null],
    ["disk_master_15", null],
    ["disk_master_16", null],
    ["disk_master_1_47", null],
    ["disk_repair", null],
    ["disk_to_cassette_utility", null],
    ["disk_utilities_11_pio", null],
    ["disk_utilities_11_rs", null],
    ["disk_utilities_20", null],
    ["disk_utilities_2000_17", null],
    ["disk_utilities_2000_18", null],
    ["disk_utilities_40a", null],
    ["disk_utilities_412", null],
    ["dlm_alien_addition", null],
    ["dlm_alligator_mix", null],
    ["dlm_demolition_division", null],
    ["dlm_dragon_mix", null],
    ["dlm_meteor_multiplication", null],
    ["dlm_minus_mission", null],
    ["dlm_verb_viper", null],
    ["dlm_word_invasion", null],
    ["dlm_word_radar", null],
    ["DM2K24-final", null],
    ["dragonflyer", null],
    ["dragons", null],
    ["driving_demon", null],
    ["DU2K20-final", null],
    ["dv_berlin", null],
    ["dv_boxer", null],
    ["dv_cannonball_blitz", null],
    ["dv_disk_utilities", null],
    ["dv_games_in_basic", null],
    ["dv_natures_way", null],
    ["dv_one_pass_copy_sssd", null],
    ["dv_othello", null],
    ["dv_simon_says", null],
    ["dv_snake_plissken", null],
    ["dv_sorgan_2", null],
    ["dv_space_patrol", null],
    ["dv_spies_demise", null],
    ["dv_super_disk_manager", null],
    ["dv_super_sketch", null],
    ["dv_tennis", null],
    ["dv_tile_breaker", null],
    ["dv_u-boat_de", null],
    ["early_learning_fun", null],
    ["early_logo_learning_fun", null],
    ["early_reading", null],
    ["editor_assembler", null],
    ["electrical_engineering_lib", null],
    ["encode-it", null],
    ["entrapment", null],
    ["Espial", null],
    ["et", "E.T."],
    ["et_at_sea", "E.T. at sea"],
    ["extended_basic", null],
    ["extended_basic_100", null],
    ["extended_basic_25", null],
    ["extended_basic_plus", null],
    ["facechase", null],
    ["face_demo", null],
    ["fallschirmspringer", null],
    ["fantasy", null],
    ["fast_copy", null],
    ["fast_term_113pc", null],
    ["fast_term_116", null],
    ["figforth", null],
    ["file_understanding_cataloger", null],
    ["file_utilities_12", null],
    ["fingertips", null],
    ["fireball", null],
    ["flow_chart_creator", null],
    ["fontsets_demo", null],
    ["football", null],
    ["fredcarts-cf2k-dm2k-du2k", null],
    ["free_bee_xcopy", null],
    ["fuel_bar_demo", null],
    ["fw_ambulance", null],
    ["fw_ant_colony_beta", null],
    ["fw_cave_creatures", null],
    ["fw_driving_demon", null],
    ["fw_henhouse", null],
    ["fw_lobster_bay", null],
    ["fw_rabbit_trail", null],
    ["fw_schnoz-ola", null],
    ["fw_shanghai", null],
    ["fw_st_nick", null],
    ["fw_video_vegas", null],
    ["galaga_screen_demo", null],
    ["gbs_31e", null],
    ["gbs_31f", null],
    ["germ_patrol", null],
    ["gestion_privee", null],
    ["ghostman_1", null],
    ["ghostman_2", null],
    ["ghost_spelling", null],
    ["gpl_disassembler", null],
    ["gram-based_disassembler", null],
    ["gram-based_disassembler_nohelp", null],
    ["gram_filler_20", null],
    ["graphic_editor", null],
    ["greatwordrace", null],
    ["great_word_race", null],
    ["grom_master_101", null],
    ["guardian", null],
    ["guardian_space", null],
    ["halffull_demo", null],
    ["heartbreak_today_demo", null],
    ["hellraiser_demo", null],
    ["hexadecimal_demo", null],
    ["home_financial_decisions", null],
    ["hopper", null],
    ["household_budget_management", null],
    ["household_budget_management_fr", null],
    ["hunt_the_wumpus", null],
    ["hustle", null],
    ["identifile_10_hd", null],
    ["identifile_10_rd", null],
    ["im_demon_attack", null],
    ["im_demon_attack_beta", null],
    ["im_fathom", null],
    ["im_fathom_beta", null],
    ["im_microsurgeon", null],
    ["im_moonsweeper", null],
    ["im_wingwar", null],
    ["im_wingwar_beta", null],
    ["intercept", null],
    ["intruder_demo", null],
    ["jeu_de_billiard", null],
    ["jims_typing_tutor", null],
    ["jph_asteroids", null],
    ["jph_snake", null],
    ["jp_star_wars", null],
    ["jp_strike_three", null],
    ["jumpy", null],
    ["kaboom", null],
    ["keyboard_joystick_test", null],
    ["Killer", null],
    ["kippys_nightmare", null],
    ["know_the_score_demo", null],
    ["krazy_koala", null],
    ["lasso", null],
    ["lego_demo", null],
    ["level_code_demo", null],
    ["level_headed_demo", null],
    ["lightbulbs_demo", null],
    ["lightspeed", null],
    ["light_cycles", null],
    ["lines_demo", null],
    ["lunar_lander_demo", null],
    ["magic_music_box", null],
    ["mancala", null],
    ["marbles_demo", null],
    ["mash", null],
    ["mass_transfer_43", null],
    ["math_catch", null],
    ["maximem", null],
    ["max_rle", null],
    ["maze_demo", null],
    ["mbx_championship_baseball", null],
    ["mbx_im_hiding", null],
    ["mbx_sewermania", null],
    ["mbx_space_bandits", null],
    ["mbx_terry_turtle", null],
    ["mb_bigfoot", null],
    ["mb_blasto", null],
    ["mb_card_sharp", null],
    ["mb_connect_four", null],
    ["mb_gamevision", null],
    ["mb_hangman", null],
    ["mb_honey_hunt", null],
    ["mb_meteor_belt", null],
    ["mb_sewermania", null],
    ["mb_soundtrack_trolley", null],
    ["mb_space_bandits", null],
    ["mb_starship_pegasus", null],
    ["mb_superfly", null],
    ["mb_zero-zap", null],
    ["me_extended_basic", null],
    ["mg_explorer", null],
    ["Miner", null],
    ["mini_memory", null],
    ["mini_memory_plus_20", null],
    ["mi_addition_sequence", null],
    ["mi_decimals_sequence", null],
    ["mi_division_sequence", null],
    ["mi_equations_sequence", null],
    ["mi_fractional_numbers_sequence", null],
    ["mi_integers_sequence", null],
    ["mi_laws_of_arithmetic_sequence", null],
    ["mi_manager", null],
    ["mi_measurement_formulas_sequence", null],
    ["mi_multiplication_sequence", null],
    ["mi_number_readiness_sequence", null],
    ["mi_percents_sequence", null],
    ["mi_subtraction_sequence", null],
    ["moon_base", null],
    ["moon_mine", null],
    ["more_fonts_demo", null],
    ["ms_multiplan", null],
    ["munchman", null],
    ["munchman_2", null],
    ["munchman_beta", null],
    ["munchmobile", null],
    ["music_maker", null],
    ["music_sda", null],
    ["na_chicken_coop", null],
    ["na_console_writer_11", null],
    ["na_console_writer_21", null],
    ["na_dbm_system", null],
    ["na_disk_fixer_20", null],
    ["na_disk_fixer_21", null],
    ["na_frog_stickers", null],
    ["na_homework_helper", null],
    ["na_speed_reading_a", null],
    ["na_speed_reading_b", null],
    ["na_super_duper", null],
    ["na_super_sort", null],
    ["na_topper_1983", null],
    ["na_topper_1986", null],
    ["neverlander", null],
    ["newtons_revenge", null],
    ["nibbler", null],
    ["ni_donkeykong", "Donkey Kong"],
    ["number_guess", null],
    ["number_magic", null],
    ["number_magic_intl", null],
    ["oh_mummy", null],
    ["orb", null],
    ["os99_40", null],
    ["own_up_demo", null],
    ["paddleball", null],
    ["paint_and_print_gp", null],
    ["paint_and_print_ibm", null],
    ["panic", null],
    ["parsec", null],
    ["parsec_title_demo", null],
    ["parsec_title_fuel_demo", null],
    ["pascal_debug_loader", null],
    ["pb_frogger", null],
    ["pb_popeye", null],
    ["pb_qbert", "Q*bert"],
    ["pc_transfer_10", null],
    ["perfect_push", null],
    ["personal_real_estate", null],
    ["personal_record_keeping", null],
    ["personal_record_keeping_de_it", null],
    ["personal_report_generator", null],
    ["physical_fitness", null],
    ["ping_pong", null],
    ["pitfall", null],
    ["pizza", null],
    ["plant_genetics", null],
    ["plato_courseware", null],
    ["plato_make_a_sentence", null],
    ["poisonous_prison2_demo", null],
    ["poisonous_prison3_demo", null],
    ["poppa_joe_demo", null],
    ["printer_setup", null],
    ["prison1_demo", null],
    ["prison4_demo", null],
    ["program_file_compressor", null],
    ["q99_quick_copier", null],
    ["quick_four_catalog_epson", null],
    ["quick_four_catalog_oki", null],
    ["race", null],
    ["randomizer_demo", null],
    ["rapid_copy_10", null],
    ["rectangles_demo", null],
    ["rediskit", null],
    ["return_to_pirates_isle", null],
    ["robot_rampage", null],
    ["rock_runner", null],
    ["ro_ant-eater", null],
    ["ro_hen_pecked", null],
    ["ro_princess_and_frog", null],
    ["ro_rotor_raiders", null],
    ["ro_typoman", null],
    ["ro_typo_2", null],
    ["ro_video_game_library", null],
    ["rxb", null],
    ["rxb_1002_super_ea", null],
    ["rxb_2002_super_ea", null],
    ["rxb_237", null],
    ["rxb_24", null],
    ["rxb_26", null],
    ["rxb_v2000", null],
    ["rxb_v2001_super_ea", null],
    ["rxb_v555", null],
    ["saguaro_city", null],
    ["sargon_1", null],
    ["scholastic_spelling_3", null],
    ["scholastic_spelling_4", null],
    ["scholastic_spelling_5", null],
    ["scholastic_spelling_6", null],
    ["scrabble", null],
    ["sdl_editor_20", null],
    ["seahorse_software_demo", null],
    ["sector_one_11", null],
    ["securities_analysis", null],
    ["se_buck_rogers", null],
    ["se_congo_bongo", null],
    ["se_star_trek", null],
    ["sf_accounting_assistant", null],
    ["sf_activity_accountant", null],
    ["sf_addition_and_subtraction_1", null],
    ["sf_addition_and_subtraction_2", null],
    ["sf_addition_and_subtraction_3", null],
    ["sf_attendance_recorder", null],
    ["sf_class_data_recorder", null],
    ["sf_course_manager", null],
    ["sf_decimal_deli_2", null],
    ["sf_division_1", null],
    ["sf_electrifying_fractions_2", null],
    ["sf_fantastic_fractions_1", null],
    ["sf_frog_jump", null],
    ["sf_mighty_multiplication_2", null],
    ["sf_multiplication_1", null],
    ["sf_number_bowling", null],
    ["sf_numeration_1", null],
    ["sf_numeration_2", null],
    ["sf_payroll_assistant", null],
    ["sf_picture_parts", null],
    ["sf_pyramid_puzzler", null],
    ["sf_reading_adventures", null],
    ["sf_reading_cheers", null],
    ["sf_reading_flight", null],
    ["sf_reading_fun", null],
    ["sf_reading_on", null],
    ["sf_reading_power", null],
    ["sf_reading_rainbows", null],
    ["sf_reading_rally", null],
    ["sf_reading_roundup", null],
    ["sf_reading_trail", null],
    ["sf_reading_wonders", null],
    ["sf_salary_planner", null],
    ["sf_school_mailer", null],
    ["sf_space_journey", null],
    ["sf_star_maze", null],
    ["sf_win_with_decimals_1", null],
    ["shapes_demo", null],
    ["sixties_man_1_demo", null],
    ["sixties_man_2_demo", null],
    ["sixties_man_3_demo", null],
    ["sixties_man_4_demo", null],
    ["sixties_man_5_demo", null],
    ["slymoids", null],
    ["sm_barrage", null],
    ["sm_spot_shot", null],
    ["sneggit", null],
    ["soccer", null],
    ["soduko", null],
    ["solitaire", null],
    ["so_crossfire", null],
    ["so_jawbreaker", null],
    ["so_mousk_attack", null],
    ["spacepatrol", null],
    ["spacestation_pheta", null],
    ["space_agressor", null],
    ["space_invaders_demo", null],
    ["spad_xiii", null],
    ["speech_editor", null],
    ["spin_demo", null],
    ["sprites_screen_editor_demo", null],
    ["sp_face_maker", null],
    ["sp_story_machine", null],
    ["sqrxz_demo", null],
    ["ss_midnite_mason", null],
    ["ss_ti-toad", null],
    ["starfield_demo", null],
    ["stars_scrolling_demo", null],
    ["star_force", null],
    ["star_fort", null],
    ["star_voyager", null],
    ["statistics", null],
    ["statistics_de", null],
    ["submarine_battle", null],
    ["sudoku", null],
    ["super-xb", null],
    ["supermodul", null],
    ["super_disk_cataloger", null],
    ["super_disk_duplicator_41", null],
    ["super_minimem", null],
    ["tafara", null],
    ["tax_investment_record_keeping", null],
    ["television_test_demo", null],
    ["terminal_emulator_1", null],
    ["terminal_emulator_2", null],
    ["terminal_emulator_utility", null],
    ["testtrainer", null],
    ["tetris", null],
    ["the_attack", null],
    ["the_attack_beta", null],
    ["the_castle_proto", null],
    ["the_explorer_10", null],
    ["the_project_demo", null],
    ["th_computer_war", null],
    ["th_river_rescue", null],
    ["th_submarine_commander", null],
    ["ti-corcomp_trak_copy", null],
    ["ti-lander", null],
    ["ti-mazogz", null],
    ["ti-tiler", null],
    ["ti-writer", null],
    ["ti-writer_gram", null],
    ["tictactoe", null],
    ["tiworkshop", null],
    ["ti_invaders", null],
    ["ti_logo", null],
    ["ti_logo_2", null],
    ["ti_logo_2_de", null],
    ["ti_logo_2_it", null],
    ["tombstone_city", null],
    ["touch_typing_tutor", null],
    ["track-hack", null],
    ["track_master_1", null],
    ["tris2", null],
    ["tron", null],
    ["tunnels_of_doom", null],
    ["turbo-copy", null],
    ["turn_it_down", null],
    ["tvset_no_signal_demo", null],
    ["tv_espial", null],
    ["tv_miner2049er", null],
    ["tv_springer", null],
    ["unnamed_adventure_prototype", null],
    ["vaders", null],
    ["vat_accounting", null],
    ["video-graphs", null],
    ["video_chess", null],
    ["video_chess_de", null],
    ["video_chess_fr", null],
    ["video_games_1", null],
    ["video_games_2", null],
    ["virus_attack", null],
    ["vm_face_chase", null],
    ["vm_star_gazer_1", null],
    ["vm_star_gazer_2", null],
    ["vm_star_gazer_3", null],
    ["waters_edge_demo", null],
    ["wd_peter_pan_space_odyssee", null],
    ["wd_pinocchios_great_escape", null],
    ["wd_von_drakes_molecular_mission", null],
    ["weight_control_and_nutrition", null],
    ["wl_spanish_12", null],
    ["wl_spanish_34", null],
    ["wl_spanish_56", null],
    ["workbench_demo", null],
    ["worm_attack", null],
    ["ww_editass2_easybug", null],
    ["yahtzee", null],
	["RockRunner", "Rock Runner (ROM)"]
];

