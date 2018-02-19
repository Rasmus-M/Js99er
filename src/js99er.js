 /*
 * js99'er - TI-99/4A emulator written in JavaScript
 *
 * Created 2014 by Rasmus Moustgaard <rasmus.moustgaard@gmail.com>
 */

"use strict"; 
 
(function (document, window, $) {

    var log;
    var settings;
    var diskImages;
    var ti994a;
    var sound;
    var software;
    var database;
    var disassembler;
    var memoryView = 0;
    var memoryType = 0;
    var debuggerAddress = null;
    var debugTimerId = null;
    var activeTab = null;

    $(document).ready(function () {

        // Check if a new app cache is available on page load

        //if (window.applicationCache) {
        //    window.applicationCache.addEventListener('updateready', function (e) {
        //        if (window.applicationCache.status == window.applicationCache.UPDATEREADY) {
        //            // Browser downloaded a new app cache.
        //            if (confirm("A new version of JS99'er is available. Would you like to download it?")) {
        //                window.applicationCache.swapCache();
        //                window.location.reload();
        //            }
        //        } else {
        //            // Manifest didn't change. Nothing new on server.
        //        }
        //    }, false);
        //}

        // Init

        log = Log.getLog();
        log.info("Welcome to JS99'er");
        log.info("Version 6.0.1, 18 February 2018");
        log.info("  - Save and restore full state");
        log.info("  - Fixed alignment issue in disassembler");
        settings = new Settings(true);
        diskImages = {
            FLOPPY1: new DiskImage("FLOPPY1", function (event) {
                updateDiskImageList("FLOPPY1");
            }),
            FLOPPY2: new DiskImage("FLOPPY2", function (event) {
                updateDiskImageList("FLOPPY2");
            }),
            FLOPPY3: new DiskImage("FLOPPY3", function (event) {
                updateDiskImageList("FLOPPY3");
            })
        };
        ti994a = new TI994A(document.getElementById("canvas"), diskImages, settings, onBreakpoint);
        sound = new Sound(settings.isSoundEnabled(), ti994a.tms9919, ti994a.tms5220, ti994a.tape);
        software = new Software();
        database = new Database();
        if (!database.isSupported()) {
            $("#btnSaveState").css("visibility", "hidden");
            $("#btnLoadState").css("visibility", "hidden");
        }
        disassembler = new Disassembler(ti994a.memory);

        // Keep track of active tab
        $('a[data-toggle="tab"]').on('shown.bs.tab', function (e) {
            activeTab = e.target;
        });

        if (settings.isPixelatedEnabled()) {
            $("#canvas").toggleClass("pixelated", true);
        }

        ///////////////
        // Main pane //
        ///////////////

        $("#canvas").on("click touchstart", function (evt) {
            sound.iOSUserTriggeredSound();
            var rect = this.getBoundingClientRect();
            var scale = this.clientHeight / 240;
            var tiX = Math.floor((evt.clientX - rect.left) / scale);
            var tiY = Math.floor((evt.clientY - rect.top) / scale);
            var charCode = ti994a.vdp.getCharAt(tiX, tiY);
            if (charCode > 0) {
                charCode = charCode >= 128 ? charCode - 96 : charCode;
                log.info("Click at (" + tiX + "," + tiY + "). Simulated keypress: " + String.fromCharCode(charCode));
                ti994a.keyboard.simulateKeyPress(charCode);
            }
        });
        $("#btnStart").on("click", function () {
            $("#btnStart").prop("disabled", true);
            $("#btnFast").prop("disabled", true);
            $("#btnFrame").prop("disabled", true);
            $("#btnStep").prop("disabled", true);
            $("#btnStop").prop("disabled", false);
            ti994a.start(false);
            debugTimerId = window.setInterval(updateDebugger, 100);
        });
        $("#btnFast").on("click", function () {
            $("#btnStart").prop("disabled", true);
            $("#btnFast").prop("disabled", true);
            $("#btnFrame").prop("disabled", true);
            $("#btnStep").prop("disabled", true);
            $("#btnStop").prop("disabled", false);
            ti994a.start(true);
            debugTimerId = window.setInterval(updateDebugger, 100);
        });
        $("#btnFrame").on("click", function () {
            ti994a.frame();
            updateDebugger(false);
        });
        $("#btnStep").on("click", function (evt) {
            if (!evt.shiftKey) {
                ti994a.step();
            }
            else {
                ti994a.stepOver();
            }
            updateDebugger(false);
        });
        $("#btnStop").on("click", function () {
            $("#btnStart").prop("disabled", false);
            $("#btnFast").prop("disabled", false);
            $("#btnFrame").prop("disabled", false);
            $("#btnStep").prop("disabled", false);
            $("#btnStop").prop("disabled", true);
            ti994a.stop();
            window.clearInterval(debugTimerId);
            updateDebugger(false);
        });
        $("#btnReset").on("click", function () {
            ti994a.reset(true);
            if (!ti994a.isRunning()) {
                $("#btnStart").click();
            }
            $("#btnTapeStop").click();
        });

        $("#btnScreenshot").on("click", function () {
            this.href = document.getElementById("canvas").toDataURL();
        });

        $("#btnLeft").on("mousedown touchstart", function () { ti994a.keyboard.simulateKeyDown(37); }).on("mouseup touchend", function () { ti994a.keyboard.simulateKeyUp(37); });
        $("#btnUp").on("mousedown touchstart", function () { ti994a.keyboard.simulateKeyDown(38); }).on("mouseup touchend", function () { ti994a.keyboard.simulateKeyUp(38); });
        $("#btnDown").on("mousedown touchstart", function () { ti994a.keyboard.simulateKeyDown(40); }).on("mouseup touchend", function () { ti994a.keyboard.simulateKeyUp(40); });
        $("#btnRight").on("mousedown touchstart", function () { ti994a.keyboard.simulateKeyDown(39); }).on("mouseup touchend", function () { ti994a.keyboard.simulateKeyUp(39); });
        $("#btnFire").on("mousedown touchstart", function () { ti994a.keyboard.simulateKeyDown(9); }).on("mouseup touchend", function () { ti994a.keyboard.simulateKeyUp(9); });


        buildPreloads($("#preloads"), software.getPrograms());
        $(".selectpicker").selectpicker();
        $("ul.dropdown-menu [data-toggle=dropdown]").multilevelDropdown();
        buildMore();

        $("#fileInputModule").on("change", function () {
            loadModuleFiles(this.files);
        }).on("click", function () {
			$(this).val("");
		});

        $("#fileInputDisk").on("change", function () {
            loadDiskFiles(this.files);
        }).on("click", function () {
			$(this).val("");
		});

        ///////////////////////
        // Disk Manager pane //
        ///////////////////////

        $("#diskImageList").on("change", function () { updateDiskFileTable(this.value); });
        updateDiskImageList();

        $("#btnDownload").on("click", function () { downloadDisk(); });

        $("#insertDSK0").on("click", function () { insertDisk(0); });
        $("#insertDSK1").on("click", function () { insertDisk(1); });
        $("#insertDSK2").on("click", function () { insertDisk(2); });
        $("#btnDeleteDisk").on("click", deleteDisk);
        $("#btnDeleteFiles").on("click", deleteFiles);

        ///////////////////////
        // Tape Manager pane //
        ///////////////////////

        $("#fileInputTape").on("change", function () {
            loadTapeFile(this.files, function () {
                $("#btnTapeStop").click()
            });
        }).on("click", function () {
            $(this).val("");
        });

        $("#btnSaveTape").on("click", function () {
            if (ti994a.tape.isRecordingAvailable()) {
                var tapeFile = ti994a.tape.getRecording();
                var blob = new Blob([tapeFile], { type: "application/wav" });
                saveAs(blob, "tape.wav");
            }
            else {
                alert("No recording available.");
            }
        });

        $("#btnRecord").on("click", function () {
            $("#btnRecord").prop("disabled", true);
            $("#btnPlay").prop("disabled", true);
            $("#btnRewind").prop("disabled", true);
            $("#btnTapeStop").prop("disabled", false);
            ti994a.tape.record();
        });

        $("#btnPlay").on("click", function () {
            $("#btnRecord").prop("disabled", true);
            $("#btnPlay").prop("disabled", true);
            $("#btnRewind").prop("disabled", true);
            $("#btnTapeStop").prop("disabled", false);
            ti994a.tape.play();
        });

        $("#btnRewind").on("click", function () {
            $("#btnRecord").prop("disabled", false);
            $("#btnPlay").prop("disabled", false);
            $("#btnRewind").prop("disabled", true);
            $("#btnTapeStop").prop("disabled", true);
            ti994a.tape.rewind();
        });

        $("#btnTapeStop").on("click", function () {
            $("#btnRecord").prop("disabled", false);
            $("#btnPlay").prop("disabled", !ti994a.tape.isPlayEnabled());
            $("#btnRewind").prop("disabled", !ti994a.tape.isRewindEnabled());
            $("#btnTapeStop").prop("disabled", true);
            ti994a.tape.stop();
        }).click();

        ///////////////////
        // Keyboard pane //
        ///////////////////

        $("#key0").on("click", function () { virtualKeyPress(48); });
        $("#key1").on("click", function () { virtualKeyPress(49); });
        $("#key2").on("click", function () { virtualKeyPress(50); });
        $("#key3").on("click", function () { virtualKeyPress(51); });
        $("#key4").on("click", function () { virtualKeyPress(52); });
        $("#key5").on("click", function () { virtualKeyPress(53); });
        $("#key6").on("click", function () { virtualKeyPress(54); });
        $("#key7").on("click", function () { virtualKeyPress(55); });
        $("#key8").on("click", function () { virtualKeyPress(56); });
        $("#key9").on("click", function () { virtualKeyPress(57); });
        $("#keyA").on("click", function () { virtualKeyPress(65); });
        $("#keyB").on("click", function () { virtualKeyPress(66); });
        $("#keyC").on("click", function () { virtualKeyPress(67); });
        $("#keyD").on("click", function () { virtualKeyPress(68); });
        $("#keyE").on("click", function () { virtualKeyPress(69); });
        $("#keyF").on("click", function () { virtualKeyPress(70); });
        $("#keyG").on("click", function () { virtualKeyPress(71); });
        $("#keyH").on("click", function () { virtualKeyPress(72); });
        $("#keyI").on("click", function () { virtualKeyPress(73); });
        $("#keyJ").on("click", function () { virtualKeyPress(74); });
        $("#keyK").on("click", function () { virtualKeyPress(75); });
        $("#keyL").on("click", function () { virtualKeyPress(76); });
        $("#keyM").on("click", function () { virtualKeyPress(77); });
        $("#keyN").on("click", function () { virtualKeyPress(78); });
        $("#keyO").on("click", function () { virtualKeyPress(79); });
        $("#keyP").on("click", function () { virtualKeyPress(80); });
        $("#keyQ").on("click", function () { virtualKeyPress(81); });
        $("#keyR").on("click", function () { virtualKeyPress(82); });
        $("#keyS").on("click", function () { virtualKeyPress(83); });
        $("#keyT").on("click", function () { virtualKeyPress(84); });
        $("#keyU").on("click", function () { virtualKeyPress(85); });
        $("#keyV").on("click", function () { virtualKeyPress(86); });
        $("#keyW").on("click", function () { virtualKeyPress(87); });
        $("#keyX").on("click", function () { virtualKeyPress(88); });
        $("#keyY").on("click", function () { virtualKeyPress(89); });
        $("#keyZ").on("click", function () { virtualKeyPress(90); });
        $("#keyEquals").on("click", function () { virtualKeyPress(187); });
        $("#keyDiv").on("click", function () { virtualKeyPress(189); });
        $("#keySemicolon").on("click", function () { virtualKeyPress(186); });
        $("#keyEnter").on("click", function () { virtualKeyPress(13); });
        $("#keyComma").on("click", function () { virtualKeyPress(188); });
        $("#keyFullStop").on("click", function () { virtualKeyPress(190); });
        $("#keySpace").on("click", function () { virtualKeyPress(32); });
        $("#keyLShift").on("click", function () { virtualKeyPress(16); });
        $("#keyRShift").on("click", function () { virtualKeyPress(16); });
        $("#keyCtrl").on("click", function () { virtualKeyPress(17); });
        $("#keyFctn").on("click", function () { virtualKeyPress(18); });
        $("#keyAlpha").on("click", function () { virtualKeyPress(20); });
        $('map').imageMapResize();

        ///////////////////
        // Debugger pane //
        ///////////////////

        $("#debuggerTab").on("click", function () {
            window.setTimeout(
                function () {
                    updateDebugger(true);
            }, 100);
        });
        $("#disassembly").on("click", function () {
            $("#disassemblyCheck").addClass("glyphicon glyphicon-ok");
            $("#hexViewCheck").removeClass("glyphicon glyphicon-ok");
            memoryView = 0;
            updateDebugger();
        });
        $("#hexView").on("click", function () {
            $("#disassemblyCheck").removeClass("glyphicon glyphicon-ok");
            $("#hexViewCheck").addClass("glyphicon glyphicon-ok");
            memoryView = 1;
            updateDebugger();
        });
        $("#cpumem").on("click", function () {
            $("#cpumemCheck").addClass("glyphicon glyphicon-ok");
            $("#vdpmemCheck").removeClass("glyphicon glyphicon-ok");
            memoryType = 0;
            updateDebugger();
        });
        $("#vdpmem").on("click", function () {
            $("#cpumemCheck").removeClass("glyphicon glyphicon-ok");
            $("#vdpmemCheck").addClass("glyphicon glyphicon-ok");
            memoryType = 1;
            updateDebugger();
        });

        $("#breakpoint").on("focus", function () {
            ti994a.keyboard.removeListeners();
        }).on("blur", function () {
            var val = this.value.parseHexWord();
            if (typeof(val) === "number") {
                this.value = val.toHexWord();
                setBreakpoint(val);
            }
            else {
                this.value = "";
                setBreakpoint(null);
            }
            ti994a.keyboard.attachListeners();
        });

        $("#address").on("focus", function () {
            ti994a.keyboard.removeListeners();
        }).on("blur", function () {
            var val = this.value.parseHexWord();
            if (typeof(val) === "number") {
                this.value = val.toHexWord();
                debuggerAddress = val;
            }
            else {
                this.value = "";
                debuggerAddress = null;
            }
            ti994a.keyboard.attachListeners();
            updateDebugger();
        });

        //////////////////
        // Options pane //
        //////////////////

        var enableSound = $("#enableSound");
        enableSound.bootstrapSwitch("state", settings.isSoundEnabled());
        enableSound.on('switchChange.bootstrapSwitch', function (event, state) {
            settings.setSoundEnabled(state);
            sound.setSoundEnabled(state);
        });

        var enableSpeech = $("#enableSpeech");
        enableSpeech.bootstrapSwitch("state", settings.isSpeechEnabled());
        enableSpeech.on('switchChange.bootstrapSwitch', function (event, state) {
            settings.setSpeechEnabled(state);
            ti994a.tms5220.setSpeechEnabled(state);
        });

        var enable32KRAM = $("#enable32KRAM");
        enable32KRAM.bootstrapSwitch("state", settings.is32KRAMEnabled());
        enable32KRAM.on('switchChange.bootstrapSwitch', function (event, state) {
            settings.set32KRAMEnabled(state);
            ti994a.memory.set32KRAMEnabled(state);
        });

        var enableAMS = $("#enableAMS");
        enableAMS.bootstrapSwitch("state", settings.isAMSEnabled());
        enableAMS.on('switchChange.bootstrapSwitch', function (event, state) {
            if (state !== settings.isAMSEnabled()) {
                settings.setAMSEnabled(state);
                ti994a.memory.setAMSEnabled(state);
                $("#btnReset").click();
            }
        });

        var enableGRAM = $("#enableGRAM");
        enableGRAM.bootstrapSwitch("state", settings.isGRAMEnabled());
        enableGRAM.on('switchChange.bootstrapSwitch', function (event, state) {
            if (state !== settings.isGRAMEnabled()) {
                settings.setGRAMEnabled(state);
                ti994a.memory.setGRAMEnabled(state);
                $("#btnReset").click();
            }
        });

        var enableFlicker = $("#enableFlicker");
        enableFlicker.bootstrapSwitch("state", settings.isFlickerEnabled());
        enableFlicker.on('switchChange.bootstrapSwitch', function (event, state) {
            settings.setFlickerEnabled(state);
            if (ti994a.vdp.setFlicker) {
                ti994a.vdp.setFlicker(state)
            }
        });

        var enableF18A = $("#enableF18A");
        enableF18A.bootstrapSwitch("state", settings.isF18AEnabled());
        enableF18A.on('switchChange.bootstrapSwitch', function (event, state) {
            if (state !== settings.isF18AEnabled()) {
                settings.setF18AEnabled(state);
                ti994a.setVDP(settings);
                window.setTimeout(function () { $("#btnReset").click(); }, 500);
            }
        });

        var enablePCKeyboard = $("#enablePCKeyboard");
        enablePCKeyboard.bootstrapSwitch("state", settings.isPCKeyboardEnabled());
        enablePCKeyboard.on('switchChange.bootstrapSwitch', function (event, state) {
            settings.setPCKeyboardEnabled(state);
            ti994a.keyboard.setPCKeyboardEnabled(state);
        });

        var enableMapArrowKeysToFctnSDEX = $("#enableMapArrowKeysToFctnSDEX");
        enableMapArrowKeysToFctnSDEX.bootstrapSwitch("state", settings.isMapArrowKeysToFctnSDEXEnabled());
        enableMapArrowKeysToFctnSDEX.on('switchChange.bootstrapSwitch', function (event, state) {
            settings.setMapArrowKeysToFctnSDEXEnabled(state);
            ti994a.keyboard.setMapArrowKeysToFctnSDEXEnabled(state);
        });

        var enableGoogleDrive = $("#enableGoogleDrive");
        enableGoogleDrive.bootstrapSwitch("state", settings.isGoogleDriveEnabled());
        enableGoogleDrive.on('switchChange.bootstrapSwitch', function (event, state) {
            if (state !== settings.isGoogleDriveEnabled()) {
                settings.setGoogleDriveEnabled(state);
                ti994a.setGoogleDrive(settings);
                $("#btnReset").click();
            }
        });

        var enablePixelated = $("#enablePixelated");
        enablePixelated.bootstrapSwitch("state", settings.isPixelatedEnabled());
        enablePixelated.on('switchChange.bootstrapSwitch', function (event, state) {
            if (state !== settings.isPixelatedEnabled()) {
                settings.setPixelatedEnabled(state);
                $("#canvas").toggleClass("pixelated", state);
            }
        });

        $("#btnSaveState").on("click", function () {
            if (confirm("Do you want to save the state to persistent storage?")) {
                saveState();
            }
        });
        $("#btnLoadState").on("click", function () {
            if (confirm("Do you want to restore the state from persistent storage?")) {
                loadState();
            }
        });

        ////////////////////
        // Start emulator //
        ////////////////////

        software.loadProgram("software/supercart.json", null, function (cart) {
            if (cart) {
                ti994a.loadSoftware(cart);
            }
            // Start TI
            $("#btnStart").click();
        });
    });

    /////////////////////////
    // Main pane functions //
    /////////////////////////

    function buildPreloads(list, programs) {
        var item, link, subList;
        for (var i = 0; i < programs.length; i++) {
            if (programs[i].type === Software.TYPE_GROUP) {
                item = $("<li class=\"dropdown-submenu\">");
                item.appendTo(list);
                link = $("<a href=\"#\" class=\"dropdown-toggle\" data-toggle=\"dropdown\">" + programs[i].name + "</a>");
                item.append(link);
                subList = $("<ul id=\"" + list.attr("id") + "." + i + "\" class=\"dropdown-menu\"/>");
                subList.appendTo(item);
                buildPreloads(subList, programs[i].programs);
            }
            else if (programs[i].type === Software.TYPE_DIVIDER) {
                list.append("<li class=\"divider\"></li>");
            }
            else if (programs[i].type === Software.TYPE_MORE) {
                item = $("<li></li>");
                item.appendTo(list);
                link = $("<a href=\"#\">" + programs[i].name + "</a>");
                link.appendTo(item);
                link.on("click", function () { $("#more").modal(); });
            }
            else {
                var id = list.attr("id") + "." + i;
                item = $("<li></li>");
                item.appendTo(list);
                link = $("<a id=\"" + id + "\" href=\"#\">" + programs[i].name + "</a>");
                link.appendTo(item);
                link.on("click", makeLoadSoftwareCallback(id.substr(9)));
            }
        }
    }

    function makeLoadSoftwareCallback(path) {
        return function (event) {
            event.preventDefault();
            software.getProgram(path, function (sw) {
                if (sw != null) {
                    ti994a.loadSoftware(sw);
                }
            });
        }
    }

    function buildMore() {
        var moreSelect = $("#moreSelect");
        var carts = Software.carts;
        var sortedCarts = [];
        for (var i = 0; i < carts.length; i++) {
            var cart = carts[i];
            var filename = cart[0];
            var name = cart[1] || fileToName(filename);
            sortedCarts.push({name: name, filename: filename});
        }
        sortedCarts.sort(function (c1, c2) {return c1.name > c2.name ? 1 : -1});
        for (var j in sortedCarts) {
            var sortedCart = sortedCarts[j];
            moreSelect.append("<option value=\"" + sortedCart.filename + ".rpk\">" + sortedCart.name + "</option>");
        }
        moreSelect.on("change", function () {
            $("#more").modal("hide");
            var filename = this.value;
            var name = $(this).find(":selected").text();
            software.loadRPKModuleFromURL("carts/" + filename, function (cart) {
                if (cart != null) {
                    ti994a.loadSoftware(cart);
                }
            }, function () {
                log.error("Failed to load '" + name + "' (" + filename + ").");
            });
        });
    }

    function fileToName(filename) {
        filename = filename.replace(/^(ag|as|aw|co|cy|db|dc|de|dlm|dv|fw|im|jp|mb|mi|na|ni|pb|ro|se|sf|sm|so|sp|ss|th|tv|vm|wd|wl)_/, "");
        filename = filename.replace(/_/g, " ");
        filename = filename.substr(0, 1).toUpperCase() + filename.substr(1);
        return filename;
    }

    function loadModuleFiles(files) {
        var file = files[0];
        if (file == null) {
            return;
        }
        var extension = file.name.split('.').pop();
        extension = extension ? extension.toLowerCase() : "";
        if (extension != null && extension !== "rpk" && extension !== "zip" && extension !== "bin") {
            log.error("File name extension '" + extension + "' not supported.");
            return;
        }
        if (extension === "bin") {
            software.loadModuleFromBinFile(file,
                function (cart) {
                    ti994a.loadSoftware(cart);
                },
                function (message) {
                    log.error(message);
                }
            )
        }
        else {
            software.loadRPKModuleFromFile(file,
                function (cart) {
                    ti994a.loadSoftware(cart);
                },
                function (message) {
                    log.error(message);
                }
            )
        }
    }

    function loadDiskFiles(files) {
        for (var i = 0; i < files.length; i++) {
            var file = files[i];
            if (file != null) {
                var extension = file.name.split('.').pop();
                if (extension != null && extension.toLowerCase() === "zip") {
                    zip.createReader(new zip.BlobReader(file), function (zipReader) {
                        zipReader.getEntries(function (entries) {
                            entries.forEach(function (entry) {
                                if (!entry.directory) {
                                    loadFile(entry);
                                }
                            });

                            function loadFile(entry) {
                                var blobWriter = new zip.BlobWriter();
                                entry.getData(blobWriter, function (blob) {
                                    loadTIFile(entry.filename, blob);
                                });
                            }
                        });
                    }, function (message) {
                        log.error(message);
                    });
                }
                else if (extension != null && extension.toLowerCase() === "obj") {
                    log.info("Loading object file.");
                    var reader = new FileReader();
                    reader.onload = function () {
                        var objLoader = new ObjLoader();
                        objLoader.loadObjFile(this.result);
                        ti994a.loadSoftware(objLoader.getSoftware());
                        ti994a.memory.setPADWord(0x83C0, Math.floor(Math.random() * 0xFFFF));
                    };
                    reader.onerror = function () {
                        alert(this.error.name);
                    };
                    reader.readAsText(file);
                }
                else {
                    loadTIFile(file.name, file);
                }
            }
        }
        updateDiskImageList();
    }

    function loadTIFile(filename, file) {
        var reader = new FileReader();
        reader.onload = function () {
            var diskDrive = ti994a.diskDrives[$("#diskDrive").val()];
            // reader.result contains the contents of blob as a typed array
            var fileBuffer = new Uint8Array(this.result);
            var diskImage;
            if (fileBuffer.length >= 16 && fileBuffer[0x0D] === 0x44 &&  fileBuffer[0x0E] === 0x53 && fileBuffer[0x0F] === 0x4B) {
                diskImage = diskDrive.loadDSKFile(filename, fileBuffer);
                if (diskImage) {
                    diskImages[diskImage.getName()] = diskImage;
                    updateDiskImageList(diskImage.getName());
                    diskImage.setEventHandler(
                        function (event) {
                            updateDiskImageList(diskImage.getName());
                        }
                    );
                }
            }
            else {
                diskImage = diskDrive.getDiskImage();
                if (diskImage != null) {
                    diskImage.loadTIFile(filename, fileBuffer, false);
                }
            }
        };
        reader.onerror = function () {
            alert(this.error.name);
        };
        reader.readAsArrayBuffer(file);
    }

    /////////////////////////////////
    // Disk Manager pane functions //
    /////////////////////////////////

    function saveDiskImages(diskImages, index, callback) {
        if (index === diskImages.length) {
            callback(true);
            return;
        }
        var diskImage = diskImages[index];
        database.putDiskImage(diskImage, function (ok) {
            if (ok) {
                saveDiskImages(diskImages, index + 1, callback);
            }
            else {
                callback(false);
            }
        });
    }

    function saveDiskDrives(diskDrives, index, callback) {
        if (index === diskDrives.length) {
            callback(true);
            return;
        }
        var diskDrive = diskDrives[index];
        database.putDiskDrive(diskDrive, function (ok) {
            if (ok) {
                saveDiskDrives(diskDrives, index + 1, callback);
            }
            else {
                callback(false);
            }
        });
    }

    function loadDiskDrives(diskDrives, diskImages, index, callback) {
        if (index === diskDrives.length) {
            callback(true);
            return;
        }
        var diskDriveName = diskDrives[index].getName();
        database.getDiskDrive(diskDriveName, function (diskDriveState) {
            if (diskDriveState) {
				if (diskDriveState.diskImage && diskImages[diskDriveState.diskImage]) {
					diskDrives[index].setDiskImage(diskImages[diskDriveState.diskImage]);
                    log.info("Disk image " + diskDrives[index].getDiskImage().getName() + " restored to " + diskDrives[index].getName() + ".");
                }
				else {
					diskDrives[index].setDiskImage(null);
				}
				loadDiskDrives(diskDrives, diskImages, index + 1, callback);
            }
            else {
                callback(false);
            }
        });
    }

    function updateDiskImageList(defaultDiskImageName) {
        var diskDrives = ti994a.getDiskDrives();
        var diskImageList = $("#diskImageList");
        diskImageList.empty();
        diskImageList.append("<option value=\"\">- None - </option>");
        for (var diskImageName in diskImages) {
            if (diskImages.hasOwnProperty(diskImageName)) {
                var diskDriveList = "";
                for (var i = 0; i < diskDrives.length; i++) {
                    if (diskDrives[i].getDiskImage() && diskDrives[i].getDiskImage().getName() === diskImageName) {
                        diskDriveList += (diskDriveList.length > 0 ? ", " : "") + diskDrives[i].getName();
                    }
                }
                diskImageList.append("<option data-icon=\"glyphicon-floppy-disk\" value=\"" + diskImageName + "\">" + diskImageName + (diskDriveList.length > 0 ? " (in " + diskDriveList + ")" : "") + "</option>");
            }
        }
        if (defaultDiskImageName != null) {
            diskImageList.val(defaultDiskImageName);
        }
        diskImageList.trigger("change");
    }

    function updateDiskFileTable(diskImageName) {
        var diskFileTable = $("#diskFileTable");
        diskFileTable.empty();
        var diskImage = diskImages[diskImageName];
        if (diskImage != null) {
            var files = diskImage.getFiles();
            for (var fileName in files) {
                if (files.hasOwnProperty(fileName)) {
                    var file = files[fileName];
                    var row = "";
                    row = "<tr>" +
                        "<td><input type=\"checkbox\" name=\"" + fileName + "\"/></td>" +
                        "<td>" + fileName + "</td>" +
                        "<td>" + (file.getFileType() === TI_FILE.FILE_TYPE_DATA ? "Data" : "Program") + "</td>";
                    if (file.getFileType() === TI_FILE.FILE_TYPE_DATA) {
                        row +=
                            "<td>" + (file.getDatatype() === TI_FILE.DATATYPE_DISPLAY ? "DIS" : "INT") + "</td>" +
                            "<td>" + (file.getRecordType() === TI_FILE.RECORD_TYPE_FIXED ? "FIX" : "VAR") + "</td>" +
                            "<td>" + (file.getRecordLength() > 0 ? file.getRecordLength() : "") + "</td>";
                    }
                    else {
                        row +=
                            "<td>&nbsp;</td>" +
                            "<td>&nbsp;</td>" +
                            "<td>&nbsp;</td>";
                    }
                    row += "<td>" + file.getSectorCount() + "&nbsp;("  + file.getFileSize() + ")</td>";
                    row += "</tr>";
                    diskFileTable.append(row);
                }
            }
        }
    }

    function downloadDisk() {
        var diskImageName = $("#diskImageList").val();
        if (diskImageName && diskImageName.length > 0) {
            var diskImage = diskImages[diskImageName];
            if (diskImage) {
                var imageFile = diskImage.getBinaryImage();
                var blob = new Blob([imageFile], { type: "application/octet-stream" });
                saveAs(blob, diskImageName + ".dsk");
            }
        }
    }

    function insertDisk(index) {
        var diskImageName = $("#diskImageList").val();
        if (diskImageName && diskImageName.length > 0) {
            ti994a.getDiskDrives()[index].setDiskImage(diskImages[diskImageName]);
        }
        else {
            ti994a.getDiskDrives()[index].setDiskImage(null);
        }
        updateDiskImageList(diskImageName);
    }

    function deleteDisk() {
        var diskImageName = $("#diskImageList").val();
        if (diskImageName && diskImageName.length > 0 && confirm("Are you sure you want to delete the disk '" + diskImageName + "' from memory?")) {
            var diskDrives = ti994a.getDiskDrives();
            for (var i = 0; i < diskDrives.length; i++) {
                if (diskDrives[i].getDiskImage() && diskDrives[i].getDiskImage().getName() === diskImageName) {
                    diskDrives[i].setDiskImage(null);
                }
            }
            delete diskImages[diskImageName];
            updateDiskImageList();
        }
    }

    function deleteFiles() {
        var selection = $("#diskFileTable").find("input:checked");
        var nSelected = selection.length;
        if (nSelected > 0) {
            var diskImageName = $("#diskImageList").val();
            if (diskImageName && diskImageName.length > 0 && confirm("Are you sure you want to delete the " + nSelected + " selected file" + (nSelected > 1 ? "s" : "") + " from '" + diskImageName + "'?")) {
                var diskImage = diskImages[diskImageName];
                selection.each(
                    function (index) {
                        diskImage.deleteFile(this.name);
                        if (index === nSelected - 1) {
                            updateDiskFileTable(diskImageName);
                        }
                    }
                );
            }
        }
        else {
            alert("No files selected.");
        }
    }

    /////////////////////////////////
    // Tape Manager pane functions //
    /////////////////////////////////

    function loadTapeFile(files, callback) {
        var file = files[0];
        if (file != null) {
            var extension = file.name.split('.').pop();
            if (extension != null && extension !== "wav" && extension !== "mp3" && extension !== "ogg") {
                log.error("File name extension '" + extension + "' not supported.");
                return;
            }
            var reader = new FileReader();
            reader.onload = function () {
                ti994a.tape.loadTapeFile(this.result, callback);
            };
            reader.onerror = function () {
                alert(this.error.name);
            };
            reader.readAsArrayBuffer(file);
        }
    }

    /////////////////////////////
    // Debugger pane functions //
    /////////////////////////////

    function updateDebugger(force) {
        if (activeTab && activeTab.id === "debuggerTab" || force) {
            $("#status").text(ti994a.getStatusString());
            var $memory = $("#memory");
            var viewObj;
            var pc = ti994a.getPC();
            if (ti994a.isRunning()) {
                // Running
                if (memoryView === 0) {
                    // Disassemble
                    if (memoryType === 0) {
                        // CPU
                        disassembler.setMemory(ti994a.memory);
                        viewObj = disassembler.disassemble(pc, null, 19, pc);
                    }
                    else {
                        // VDP
                        disassembler.setMemory(ti994a.vdp);
                        viewObj = disassembler.disassemble(pc, null, 19, pc);
                    }
                }
                else {
                    // Hex view
                    if (memoryType === 0) {
                        // CPU
                        viewObj = ti994a.memory.hexView(typeof(debuggerAddress) === "number" ? debuggerAddress : 0x8300, 304, debuggerAddress);
                    }
                    else {
                        // VDP
                        viewObj = ti994a.vdp.hexView(typeof(debuggerAddress) === "number" ? debuggerAddress : 0, 304, debuggerAddress);
                    }
                }
            }
            else {
                // Stopped
                if (memoryView === 0) {
                    // Disassemble
                    if (memoryType === 0) {
                        // CPU
                        disassembler.setMemory(ti994a.memory);
                        viewObj = disassembler.disassemble(0, 0x10000, null, typeof(debuggerAddress) === "number" ? debuggerAddress : pc);
                    }
                    else {
                        // VDP
                        disassembler.setMemory(ti994a.vdp);
                        viewObj = disassembler.disassemble(0, ti994a.vdp.gpu ? 0x4800 : 0x4000, null, typeof(debuggerAddress) === "number" ? debuggerAddress : pc);
                    }
                }
                else {
                    // Hex view
                    if (memoryType === 0) {
                        // CPU
                        viewObj = ti994a.memory.hexView(0, 0x10000, typeof(debuggerAddress) === "number" ? debuggerAddress : pc);
                    }
                    else {
                        // VDP
                        viewObj = ti994a.vdp.hexView(0, ti994a.vdp.gpu ? 0x4800: 0x4000, typeof(debuggerAddress) === "number" ? debuggerAddress : pc);
                    }
                }
            }
            $memory.text(viewObj.text);
            if (viewObj.anchorLine) {
                window.setTimeout(
                    function () {
                        $memory.scrollTop(viewObj.anchorLine * ($memory.prop('scrollHeight') / viewObj.lineCount)); // 1.0326
                    },
                    100
                );
            }
        }
    }

    function setBreakpoint(val) {
        ti994a.tms9900.setBreakpoint(val);
        if (ti994a.vdp.gpu) {
            ti994a.vdp.gpu.setBreakpoint(val);
        }
    }

    function onBreakpoint(cpu) {
        if (cpu.setOtherBreakpoint) {
            cpu.setOtherBreakpoint(null);
        }
        $("#btnStop").click();
    }

    /////////////////////////////
    // Keyboard pane functions //
    /////////////////////////////

    function virtualKeyPress(keyCode) {
        sound.iOSUserTriggeredSound();
        ti994a.keyboard.virtualKeyPress(keyCode);
    }

    ////////////////////////////
    // Options pane functions //
    ////////////////////////////

    function saveState() {
        if (database.isSupported()) {
            database.deleteAllDiskImages(function (success) {
                if (success) {
                    var diskImageArray = [];
                    for (var diskImageName in diskImages) {
                        if (diskImages.hasOwnProperty(diskImageName)) {
                            diskImageArray.push(diskImages[diskImageName]);
                        }
                    }
                    saveDiskImages(diskImageArray, 0, function (success) {
                        if (success) {
                            log.info("Disk images saved OK.");
                            var diskDrives = ti994a.getDiskDrives();
                            saveDiskDrives(diskDrives, 0, function (success) {
                                if (success) {
                                    log.info("Disk drives saved OK.");
                                    var state = ti994a.getState();
                                    database.putMachineState("ti994a", state, function (success) {
                                        if (success) {
                                            log.info("Machine state saved OK.");
                                        }
                                        else {
                                            log.info("Machine state could not be saved.");
                                        }
                                    });
                                }
                                else {
                                    log.info("Disk drives could not be saved.");
                                }
                            });
                        }
                        else {
                            log.info("Disk images could not be saved.");
                        }
                    });
                }
                else {
                    log.info("Could not delete old disk images.");
                }
            });
        }
    }

    function loadState() {
        var wasRunning = ti994a.isRunning();
        ti994a.stop();
        database.getDiskImages(function (dskImgs) {
            if (dskImgs && Object.keys(dskImgs).length >= 3) {
                diskImages = dskImgs;
                log.info("Disk images restored OK.");
                var diskDrives = ti994a.getDiskDrives();
                loadDiskDrives(diskDrives, dskImgs, 0, function (success) {
                    if (success) {
                        log.info("Disk drives restored OK.");
                        database.getMachineState("ti994a", function (state) {
                            if (state) {

                                var f18AEnabled = typeof(state.vdp.gpu) === "object";
                                if (f18AEnabled && !settings.isF18AEnabled()) {
                                    log.error("Please enable F18A before restoring the state");
                                    return;
                                }
                                else if (!f18AEnabled && settings.isF18AEnabled()) {
                                    log.error("Please disable F18A before restoring the state");
                                    return;
                                }

                                ti994a.restoreState(state);

                                settings.setSpeechEnabled(state.tms5220.enabled);
                                $("#enableSpeech").bootstrapSwitch("state", settings.isSpeechEnabled(), true);

                                settings.set32KRAMEnabled(state.memory.enable32KRAM);
                                $("#enable32KRAM").bootstrapSwitch("state", settings.is32KRAMEnabled(), true);

                                settings.setAMSEnabled(state.memory.enableAMS);
                                $("#enableAMS").bootstrapSwitch("state", settings.isAMSEnabled(), true);

                                settings.setGRAMEnabled(state.memory.enableGRAM);
                                $("#enableGRAM").bootstrapSwitch("state", settings.isGRAMEnabled(), true);

                                settings.setFlickerEnabled(state.vdp.enableFlicker);
                                $("#enableFlicker").bootstrapSwitch("state", settings.isFlickerEnabled(), true);

                                settings.setPCKeyboardEnabled(state.keyboard.pcKeyboardEnabled);
                                $("#enablePCKeyboard").bootstrapSwitch("state", settings.isPCKeyboardEnabled(), true);

                                settings.setMapArrowKeysToFctnSDEXEnabled(state.keyboard.mapArrowKeysToFctnSDEX);
                                $("#enableMapArrowKeysToFctnSDEX").bootstrapSwitch("state", settings.isMapArrowKeysToFctnSDEXEnabled(), true);

                                $("#btnRecord").prop("disabled", state.tape.recordPressed || state.tape.playPressed);
                                $("#btnPlay").prop("disabled", state.tape.recordPressed || state.tape.playPressed);
                                $("#btnTapeStop").prop("disabled", !(state.tape.recordPressed || state.tape.playPressed));

                                var breakpoint = $("#breakpoint");
                                if (typeof(state.tms9900.breakpoint) === "number") {
                                    breakpoint.val(state.tms9900.breakpoint.toHexWord());
                                }
                                else {
                                    var val = breakpoint.val().parseHexWord();
                                    if (typeof(val) === "number") {
                                        breakpoint.val(val.toHexWord());
                                        setBreakpoint(val);
                                    }
                                    else {
                                        breakpoint.val("");
                                        setBreakpoint(null);
                                    }
                                }

                                if (wasRunning) {
                                    ti994a.start();
                                }

                                log.info("Machine state restored OK.");
                            }
                            else {
                                log.error("Machine state could not be restored.");
                            }
                        });
                    }
                    else {
                        log.error("Disk drives could not be restored.");
                    }
                    updateDiskImageList();
                });
            }
            else {
                log.error("Disk images could not be restored.");
            }
        });
    }

})(document, window, jQuery);