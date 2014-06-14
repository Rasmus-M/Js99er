 /*
 * js99'er - TI-99/4A emulator written in JavaScript
 *
 * Created 2014 by Rasmus Moustgaard <rasmus.moustgaard@gmail.com>
 */

"use strict"; 
 
(function(document, window, $) {

    var ti994a;
    var diskImages;
    var software;
    var database;
    var log;
    var settings;

    $(document).ready(function() {

        // Init

        settings = new Settings(true);
        diskImages = {
            FLOPPY1: new DiskImage("FLOPPY1"),
            FLOPPY2: new DiskImage("FLOPPY2"),
            FLOPPY3: new DiskImage("FLOPPY3")
        };
        ti994a = new TI994A(document, document.getElementById("canvas"), diskImages, settings);
        software = new Software();
        log = Log.getLog();
        database = new Database();
        if (!database.isSupported()) {
            $("#btnSave").css("visibility", "hidden");
            $("#btnLoad").css("visibility", "hidden");
        }

        // Build UI
        $("#canvas").on("click", function(evt) {
            var rect = this.getBoundingClientRect();
            var scale = this.clientHeight == 240 ? 1 : 2;
            var tiX = Math.floor((evt.clientX - rect.left) / scale);
            var tiY = Math.floor((evt.clientY - rect.top) / scale);
            var charCode = ti994a.vdp.getCharAt(tiX, tiY);
            if (charCode > 0) {
                ti994a.keyboard.simulateKeyPress(charCode >= 128 ? charCode - 96 : charCode);
            }
        });
        $("#btnStart").on("click", function() {
            $("#btnStart").prop("disabled", true);
            $("#btnFast").prop("disabled", true);
            $("#btnStep").prop("disabled", true);
            $("#btnStop").prop("disabled", false);
            ti994a.start(false);
        });
        $("#btnFast").on("click", function() {
            $("#btnStart").prop("disabled", true);
            $("#btnFast").prop("disabled", true);
            $("#btnStep").prop("disabled", true);
            $("#btnStop").prop("disabled", false);
            ti994a.start(true);
        });
        $("#btnStep").on("click", function() {
            ti994a.frame();
        });
        $("#btnStop").on("click", function() {
            $("#btnStart").prop("disabled", false);
            $("#btnStep").prop("disabled", false);
            $("#btnFast").prop("disabled", false);
            $("#btnStop").prop("disabled", true);
            ti994a.stop();
            updateStatus();
        });
        $("#btnReset").on("click", function() {
            ti994a.reset(true);
            if (!ti994a.isRunning()) {
                $("#btnStart").click();
            }
        });

        $("#btnLeft").on("mousedown", function() { ti994a.keyboard.simulateKeyDown(37); }).on("mouseup", function() { ti994a.keyboard.simulateKeyUp(37); });
        $("#btnUp").on("mousedown", function() { ti994a.keyboard.simulateKeyDown(38); }).on("mouseup", function() { ti994a.keyboard.simulateKeyUp(38); });
        $("#btnDown").on("mousedown", function() { ti994a.keyboard.simulateKeyDown(40); }).on("mouseup", function() { ti994a.keyboard.simulateKeyUp(40); });
        $("#btnRight").on("mousedown", function() { ti994a.keyboard.simulateKeyDown(39); }).on("mouseup", function() { ti994a.keyboard.simulateKeyUp(39); });
        $("#btnFire").on("mousedown", function() { ti994a.keyboard.simulateKeyDown(9); }).on("mouseup", function() { ti994a.keyboard.simulateKeyUp(9); });


        $("#btnSave").on("click", function() {
            if (confirm("Do you want to save the disk state to persistent storage?")) {
                saveState();
            }
        });
        $("#btnLoad").on("click", function() {
            if (confirm("Do you want to restore the disk state from persistent storage?")) {
                loadState();
            }
        });

        buildPreloads($("#preloads"), software.getPrograms());

        $("#fileInputModule").on("change", function() {
            var file = this.files[0];
            if (file == null) {
                return;
            }
            var extension = file.name.split('.').pop();
            if (extension != null && extension.toLowerCase() != "rpk" && extension.toLowerCase() != "zip") {
                log.error("File name extension '" + extension + "' not supported.");
                return;
            }
            software.loadRPKModuleFromFile(file,
                function(cart) {
                    ti994a.loadSoftware(cart);
                },
                function(message) {
                    log.error(message);
                }
            )
         });

        $("#fileInputDisk").on("change", function() {
            for (var i = 0; i < this.files.length; i++) {
                var file = this.files[i];
                if (file != null) {
                    var extension = file.name.split('.').pop();
                    if (extension != null && extension.toLowerCase() == "zip") {
                        zip.createReader(new zip.BlobReader(file), function(zipReader) {
                            zipReader.getEntries(function(entries) {
                                entries.forEach(function(entry) {
                                    if (!entry.directory) {
                                        loadFile(entry);
                                    }
                                });

                                function loadFile(entry) {
                                    var blobWriter = new zip.BlobWriter();
                                    entry.getData(blobWriter, function(blob) {
                                        loadTIFile(entry.filename, blob);
                                    });
                                }
                            });
                        }, function(message) {
                            log.error(message);
                        });
                    }
                    else {
                        loadTIFile(file.name, file);
                    }
                }
            }
            updateDiskImageList();
        });

        $("#insertDSK0").on("click", function() { insertDisk(0); });
        $("#insertDSK1").on("click", function() { insertDisk(1); });
        $("#insertDSK2").on("click", function() { insertDisk(2); });
        $("#btnDeleteDisk").on("click", deleteDisk);
        $("#btnDeleteFiles").on("click", deleteFiles);

        $(".selectpicker").selectpicker();
        $("ul.dropdown-menu [data-toggle=dropdown]").multilevelDropdown();

        var enableSound = $("#enableSound");
        enableSound.bootstrapSwitch("state", settings.isSoundEnabled());
        enableSound.on('switchChange.bootstrapSwitch', function(event, state) {
            settings.setSoundEnabled(state);
            ti994a.tms9919.setSoundEnabled(state);
        });

        var enable32KRAM = $("#enable32KRAM");
        enable32KRAM.bootstrapSwitch("state", settings.is32KRAMEnabled());
        enable32KRAM.on('switchChange.bootstrapSwitch', function(event, state) {
            settings.set32KRAMEnabled(state);
            ti994a.memory.set32KRAMEnabled(state);
        });

        var enableF18A = $("#enableF18A");
        enableF18A.bootstrapSwitch("state", settings.isF18AEnabled());
        enableF18A.on('switchChange.bootstrapSwitch', function(event, state) {
            settings.setF18AEnabled(state);
            var running =  ti994a.isRunning();
            ti994a.stop();
            ti994a = new TI994A(document, document.getElementById("canvas"), diskImages, settings);
            if (running) {
                ti994a.start();
            }
        });

        updateDiskImageList();

        // Status update
        window.setInterval(updateStatus, 100);


        software.loadProgram("software/editor-assembler.json", null, function(cart) {
            if (cart != null) {
                ti994a.loadSoftware(cart);
            }
            // Start TI
            $("#btnStart").click();
        });
    });

    function buildPreloads(list, programs) {
        for (var i = 0; i < programs.length; i++) {
            if (programs[i].type == Software.TYPE_GROUP) {
                var item = $("<li class=\"dropdown-submenu\">");
                item.appendTo(list);
                item.append("<a href=\"#\" class=\"dropdown-toggle\" data-toggle=\"dropdown\">" + programs[i].name + "</a>");
                var subList = $("<ul id=\"" + list.attr("id") + "." + i + "\" class=\"dropdown-menu\"/>");
                subList.appendTo(item);
                buildPreloads(subList, programs[i].programs);
            }
            else if (programs[i].type == Software.TYPE_DIVIDER) {
                list.append("<li class=\"divider\"></li>");
            }
            else {
                var id = list.attr("id") + "." + i;
                item = $("<li></li>");
                item.appendTo(list);
                var link = $("<a id=\"" + id + "\" href=\"#\">" + programs[i].name + "</a>");
                link.appendTo(item);
                link.on("click", makeLoadSoftwareCallback(id.substr(9)));
            }
        }
    }

    function makeLoadSoftwareCallback(path) {
        return function(event) {
            event.preventDefault();
            software.getProgram(path, function(sw) {
                if (sw != null) {
                    ti994a.loadSoftware(sw);
                }
            });
        }
    }

    function updateStatus() {
        $("#status").text(ti994a.getStatusString());
    }

    function loadTIFile(filename, file) {
        var reader = new FileReader();
        reader.onload = function() {
            var diskDrive = ti994a.diskDrives[$("#diskDrive").val()];
            // reader.result contains the contents of blob as a typed array
            var fileBuffer = new Uint8Array(this.result);
            var diskImage;
            if (fileBuffer.length >= 16 && fileBuffer[0x0D] == 0x44 &&  fileBuffer[0x0E] == 0x53 && fileBuffer[0x0F] == 0x4B) {
                diskImage  = diskDrive.loadDSKFile(filename, fileBuffer);
                if (diskImage) {
                    diskImages[diskImage.getName()] = diskImage;
                    updateDiskImageList();
                }
            }
            else {
                diskImage = diskDrive.getDiskImage();
                if (diskImage != null) {
                    diskImage.loadTIFile(filename, fileBuffer);
                }
            }
        };
        reader.readAsArrayBuffer(file);
    }

    function saveState() {
        if (database.isSupported()) {
            database.deleteAllDiskImages(function(success) {
                    if (success) {
                        var diskImageArray = [];
                        for (var diskImageName in diskImages) {
                            if (diskImages.hasOwnProperty(diskImageName)) {
                                diskImageArray.push(diskImages[diskImageName]);
                            }
                        }
                        saveDiskImages(diskImageArray, 0, function(success) {
                            if (success) {
                                log.info("Disk images saved OK.");
                                var diskDrives = ti994a.getDiskDrives();
                                saveDiskDrives(diskDrives, 0, function(success) {
                                    if (success) {
                                        log.info("Disk drives saved OK.");
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
                }
            );
        }
    }

    function saveDiskImages(diskImages, index, callback) {
        if (index == diskImages.length) {
            callback(true);
            return;
        }
        var diskImage = diskImages[index];
        database.putDiskImage(diskImage, function(ok) {
            if (ok) {
                saveDiskImages(diskImages, index + 1, callback);
            }
            else {
                callback(false);
            }
        });
    }

    function saveDiskDrives(diskDrives, index, callback) {
        if (index == diskDrives.length) {
            callback(true);
            return;
        }
        var diskDrive = diskDrives[index];
        database.putDiskDrive(diskDrive, function(ok) {
            if (ok) {
                saveDiskDrives(diskDrives, index + 1, callback);
            }
            else {
                callback(false);
            }
        });
    }

    function loadState() {
		database.getDiskImages(function(dskImgs) {
			if (dskImgs && Object.keys(dskImgs).length >= 3) {
                diskImages = dskImgs;
                log.info("Disk images restored OK.");
                var diskDrives = ti994a.getDiskDrives();
				loadDiskDrives(diskDrives, dskImgs, 0, function(success) {
					if (success) {
                        log.info("Disk drives restored OK.");
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

    function loadDiskDrives(diskDrives, diskImages, index, callback) {
        if (index == diskDrives.length) {
            callback(true);
            return;
        }
        var diskDriveName = diskDrives[index].getName();
        database.getDiskDrive(diskDriveName, function(diskDriveState) {
            if (diskDriveState) {
				if (diskDriveState.diskImage && diskImages[diskDriveState.diskImage]) {
					diskDrives[index].setDiskImage(diskImages[diskDriveState.diskImage]);
                    log.info("Disk images " + diskDrives[index].getDiskImage().getName() + " restored to " + diskDrives[index].getName() + ".");
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
                    if (diskDrives[i].getDiskImage() && diskDrives[i].getDiskImage().getName() == diskImageName) {
                        diskDriveList += (diskDriveList.length > 0 ? ", " : "") + diskDrives[i].getName();
                    }
                }
                diskImageList.append("<option data-icon=\"glyphicon-floppy-disk\" value=\"" + diskImageName + "\">" + diskImageName + (diskDriveList.length > 0 ? " (in " + diskDriveList + ")" : "") + "</option>");
            }
        }
        if (defaultDiskImageName != null) {
            diskImageList.val(defaultDiskImageName);
        }
        diskImageList.on("change", function() { updateDiskFileTable(this.value); });
        diskImageList.on("change");
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
                        "<td>" + (file.getFileType() == TI_FILE.FILE_TYPE_DATA ? "Data" : "Program") + "</td>";
                    if (file.getFileType() == TI_FILE.FILE_TYPE_DATA) {
                        row +=
                            "<td>" + (file.getDatatype() == TI_FILE.DATATYPE_DISPLAY ? "DIS" : "INT") + "</td>" +
                            "<td>" + (file.getRecordType() == TI_FILE.RECORD_TYPE_FIXED ? "FIX" : "VAR") + "</td>" +
                            "<td>" + (file.getRecordLength() > 0 ? file.getRecordLength() : "") + "</td>";
                    }
                    else {
                        row +=
                            "<td>&nbsp;</td>" +
                            "<td>&nbsp;</td>" +
                            "<td>&nbsp;</td>";
                    }
                    row += "<td>" + file.getSectorCount() + " ("  + file.getFileSize() + ")</td>";
                    row += "</tr>";
                    diskFileTable.append(row);
                }
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
                if (diskDrives[i].getDiskImage() && diskDrives[i].getDiskImage().getName() == diskImageName) {
                    diskDrives[i].setDiskImage(null);
                }
            }
            delete diskImages[diskImageName];
            updateDiskImageList();
        }
    }

    function deleteFiles() {
        var nSelected = $("input:checked").length;
        if (nSelected > 0) {
            var diskImageName = $("#diskImageList").val();
            if (diskImageName && diskImageName.length > 0 && confirm("Are you sure you want to delete the " + nSelected + " selected file" + (nSelected > 1 ? "s" : "") + " from '" + diskImageName + "'?")) {
                var diskImage = diskImages[diskImageName];
                $("input:checked").each(
                    function(index) {
                        diskImage.deleteFile(this.name);
                        if (index == nSelected - 1) {
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

})(document, window, jQuery);