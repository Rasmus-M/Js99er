/*
 * js99'er - TI-99/4A emulator written in JavaScript
 *
 * Created 2014 by Rasmus Moustgaard <rasmus.moustgaard@gmail.com>
 */

'use strict';

function GoogleDrive(name, ram, path) {
    this.name = name;
    this.ram = ram;
    this.path = path;
    this.folderId = null;
    this.diskImage = new DiskImage(name);
    this.catalogFile = null;
    this.log = Log.getLog();
}

GoogleDrive.DSR_ROM = [
    0xAA,                           // >4000 Standard header
    0x01,                           // >4001 Version
    0x00,                           // >4002 No programs allowed in peripheral card ROMs
    0x00,                           // >4003 Not used
    0x40, 0x10,                     // >4004 Pointer to power-up list
    0x00, 0x00,                     // >4006 Pointer to program list
    0x40, 0x14,                     // >4008 Pointer to DSR list
    0x00, 0x00,                     // >400A Pointer to subprogram list
    0x00, 0x00,                     // >400C Pointer to ISR list
    0x00, 0x00,                     // >400E Pointer to ?
    // Power-up list
    0x00, 0x00,                     // >4010 Link to next power-up routine (no more)
    0x40, 0x32,                     // >4012 Address of this power-up routine
    // DSR list
    0x40, 0x1E,                     // >4014 Link to next DSR
    0x40, 0x34,                     // >4016 Address of this DSR
    0x04,                           // >4018 Name length
    0x47, 0x44, 0x52, 0x31,         // >4019 Name "GDR1"
    0x00,                           // >401D Align to word
    0x40, 0x28,                     // >401E Link to next DSR
    0x40, 0x38,                     // >4020 Address of this DSR
    0x04,                           // >4022 Name length
    0x47, 0x44, 0x52, 0x32,         // >4023 Name "GDR2"
    0x00,                           // >4027 Align to word
    0x00, 0x00,                     // >4028 Link to next DSR (no more)
    0x40, 0x3C,                     // >402A Address of this DSR
    0x04,                           // >402C Name length
    0x47, 0x44, 0x52, 0x33,         // >402D Name "GDR3"
    0x00,                           // >4031 Align to word
    // Power-up routine
    0x04, 0x5B,                     // >4032 B *R11
    // GDR1 routine
    0x05, 0xCB,                     // >4034 INCT R11
    0x04, 0x5B,                     // >4036 B *R11
    // GDR2 routine
    0x05, 0xCB,                     // >4038 INCT R11
    0x04, 0x5B,                     // >403A B *R11
    // GDR3 routine
    0x05, 0xCB,                     // >403C INCT R11
    0x04, 0x5B                      // >403E B *R11
];

GoogleDrive.DSR_ROM_POWER_UP = 0x4032;
GoogleDrive.DSR_ROM_GDR1 = 0x4034;
GoogleDrive.DSR_ROM_GDR2 = 0x4038;
GoogleDrive.DSR_ROM_GDR3 = 0x403C;

GoogleDrive.DSR_HOOK_START = GoogleDrive.DSR_ROM_POWER_UP;
GoogleDrive.DSR_HOOK_END = GoogleDrive.DSR_ROM_GDR3;

GoogleDrive.execute = function (pc, googleDrives, memory, callback) {
    var googleDrive = null;
    switch (pc) {
        case GoogleDrive.DSR_ROM_POWER_UP:
            GoogleDrive.powerUp();
            return false;
        case GoogleDrive.DSR_ROM_GDR1:
            googleDrive = googleDrives[0];
            break;
        case GoogleDrive.DSR_ROM_GDR2:
            googleDrive = googleDrives[1];
            break;
        case GoogleDrive.DSR_ROM_GDR3:
            googleDrive = googleDrives[2];
            break;
        default:
            return false;
    }
    if (googleDrive != null) {
        var pabAddr = memory.getPADWord(0x8356) - 14;
        var opCode = googleDrive.ram[pabAddr];
        GoogleDrive.authorize(
            opCode !== TI_FILE.OP_CODE_READ && opCode !== TI_FILE.OP_CODE_WRITE,
            function () {
                googleDrive.dsrRoutine(pabAddr, function (status, errorCode) {
                    googleDrive.log.info("Returned error code: " + errorCode + "\n");
                    googleDrive.ram[pabAddr + 1] = (googleDrive.ram[pabAddr + 1] | (errorCode << 5)) & 0xFF;
                    memory.setPADByte(0x837C, memory.getPADByte(0x837C) | status);
                    callback(true);
                });
            },
            function () {
                googleDrive.log.info("Failed opcode: " + opCode);
                googleDrive.ram[pabAddr + 1] = (googleDrive.ram[pabAddr + 1] | (TI_FILE.ERROR_DEVICE_ERROR << 5)) & 0xFF;
                memory.setPADByte(0x837C, memory.getPADByte(0x837C) | 0x20);
                callback(false);
            }
        );
        return true;
    }
    return false;
};

GoogleDrive.AUTHORIZED = false;

GoogleDrive.authorize = function (refresh, success, failure) {
    if (GoogleDrive.AUTHORIZED) {
        setTimeout(success);
    } else {
        Log.getLog().warn("Not signed in to Google");
        setTimeout(failure);
    }
};

GoogleDrive.powerUp = function () {
    var CLIENT_ID = "101694421528-72cnh0nor5rvoj245fispof8hdaq47i4.apps.googleusercontent.com";
    var SCOPES = 'https://www.googleapis.com/auth/drive';
    var log = Log.getLog();
    log.info("Executing Google Drive DSR power-up routine.");
    gapi.load("client:auth2", function() {
        log.info("Google library loaded");
        gapi.client.init({
            clientId: CLIENT_ID,
            scope: SCOPES
        }).then(function () {
            log.info("Google client init OK");
            var authInstance = gapi.auth2.getAuthInstance();
            if (authInstance.isSignedIn.get()) {
                log.info("Already signed in.");
                GoogleDrive.AUTHORIZED = true;
            } else {
                authInstance.signIn();
                authInstance.isSignedIn.listen(function (isSignedIn) {
                    log.info("Signed in: " + isSignedIn);
                    GoogleDrive.AUTHORIZED = isSignedIn;
                });
            }
        });
    });
};

GoogleDrive.prototype = {

    getFolderId: function (callback) {
        if (this.folderId != null) {
            callback(this.folderId);
        }
        else {
            this.getOrCreateFolder(this.path.split("/"), "root", function (id) {
                this.folderId = id;
                callback(id);
            }.bind(this));
        }
    },

    dsrRoutine: function (pabAddr, callback) {
        this.log.info("Executing DSR routine for " + this.name + ", PAB in " + pabAddr.toHexWord() + ".");
        var i;
        var opCode = this.ram[pabAddr];
        var flagStatus = this.ram[pabAddr + 1];
        var dataBufferAddress = this.ram[pabAddr + 2] << 8 | this.ram[pabAddr + 3];
        var recordLength = this.ram[pabAddr + 4];
        var characterCount = this.ram[pabAddr + 5];
        var recordNumber = this.ram[pabAddr + 6] << 8 | this.ram[pabAddr + 7];
        var screenOffset = this.ram[pabAddr + 8];
        var fileNameLength = this.ram[pabAddr + 9];
        var fileName = "";
        for (i = 0; i < fileNameLength; i++) {
            fileName += String.fromCharCode(this.ram[pabAddr + 10 + i]);
        }
        var recordType = (flagStatus & 0x10) >> 4;
        var datatype = (flagStatus & 0x08) >> 3;
        var operationMode = (flagStatus & 0x06) >> 1;
        var accessType = flagStatus & 0x01;

        this.log.debug(
                fileName + ": " +
                TI_FILE.OPERATION_MODES[operationMode] + ", " +
                (accessType == TI_FILE.ACCESS_TYPE_RELATIVE ? "RELATIVE" : "SEQUENTIAL") + ", " +
                (datatype == TI_FILE.DATATYPE_DISPLAY ? "DISPLAY" : "INTERNAL") + ", " +
                (recordType == TI_FILE.RECORD_TYPE_FIXED ? "FIXED" : "VARIABLE") + ", " +
                recordLength
        );

        this.getFolderId(function (parent) {
            if (parent != null) {
                if (fileName.substr(0, this.name.length + 1) == this.name + ".") {
                    fileName = fileName.substr(this.name.length + 1);
                    var file, record;
                    switch (opCode) {
                        case TI_FILE.OP_CODE_OPEN:
                            this.log.info("Op-code " + opCode + ": OPEN");
                            if (operationMode == TI_FILE.OPERATION_MODE_OUTPUT) {
                                // Create a new file
                                if (recordLength == 0) {
                                    recordLength = 128;
                                    // Write default record length to PAB
                                    this.ram[pabAddr + 4] = recordLength;
                                }
                                file = new DiskFile(fileName, TI_FILE.FILE_TYPE_DATA, recordType, recordLength, datatype);
                                this.diskImage.putFile(file);
                                file.open(operationMode, accessType);
                                callback(0, 0);
                            }
                            else {
                                if (fileName.length > 0) {
                                    // Open existing file
                                    this.findFile(fileName, parent, function (id) {
                                        if (id != null) {
                                            this.getFileContent(id, function (data) {
                                                file = this.diskImage.loadTIFile(fileName, data, true);
                                                if (file != null) {
                                                    if (file.getOperationMode() != -1 || file.getFileType() == TI_FILE.FILE_TYPE_PROGRAM || file.getRecordType() != recordType || file.getRecordLength() != recordLength && recordLength != 0) {
                                                        callback(0, TI_FILE.ERROR_BAD_OPEN_ATTRIBUTE);
                                                        return;
                                                    }
                                                    if (recordLength == 0) {
                                                        recordLength = file.getRecordLength();
                                                        this.ram[pabAddr + 4] = recordLength;
                                                    }
                                                    file.open(operationMode, accessType);
                                                    callback(0, 0);
                                                }
                                                else {
                                                    callback(0, TI_FILE.ERROR_FILE_ERROR);
                                                }
                                            }.bind(this));
                                        }
                                        else {
                                            callback(0, TI_FILE.ERROR_FILE_ERROR);
                                        }
                                    }.bind(this));
                                }
                                else if (operationMode == TI_FILE.OPERATION_MODE_INPUT) {
                                    // Catalog
                                    this.getFileContents(parent, function (files) {
                                        file = this.createCatalogFile(files);
                                        this.catalogFile = file;
                                        if (recordLength == 0) {
                                            recordLength = 38;
                                            this.ram[pabAddr + 4] = recordLength;
                                        }
                                        file.open(operationMode, accessType);
                                        callback(0, 0);
                                     }.bind(this));
                                }
                                else {
                                    callback(0, TI_FILE.ERROR_ILLEGAL_OPERATION);
                                }
                            }
                            break;
                        case TI_FILE.OP_CODE_CLOSE:
                            this.log.info("Op-code " + opCode + ": CLOSE");
                            if (fileName.length > 0) {
                                file = this.diskImage.getFile(fileName);
                                if (file != null) {
                                    if (file.getFileType() == TI_FILE.FILE_TYPE_DATA) {
                                        if (file.getOperationMode() == operationMode) {
                                            // Save file if it's a write
                                            if (file.getOperationMode() != TI_FILE.OPERATION_MODE_INPUT) {
                                                file.close();
                                                this.log.info("Saving to Google Drive");
                                                var fileData = this.diskImage.saveTIFile(fileName);
                                                if (fileData != null) {
                                                    this.insertOrUpdateFile(fileName, parent, fileData, function (file) {
                                                        // console.log(file);
                                                        callback(0, 0);
                                                    })
                                                }
                                                else {
                                                    callback(0, TI_FILE.ERROR_FILE_ERROR);
                                                }
                                            }
                                            else {
                                                file.close();
                                                callback(0, 0);
                                            }
                                        }
                                        else {
                                            callback(0, TI_FILE.ERROR_ILLEGAL_OPERATION);
                                        }
                                    }
                                    else {
                                        callback(0, TI_FILE.ERROR_FILE_ERROR);
                                    }
                                }
                                else {
                                    callback(0, TI_FILE.ERROR_FILE_ERROR);
                                }
                            }
                            else {
                                this.catalogFile = null;
                                callback(0, 0);
                            }
                            break;
                        case TI_FILE.OP_CODE_READ:
                            this.log.info("Op-code " + opCode + ": READ");
                            if (fileName.length > 0) {
                                file = this.diskImage.getFile(fileName);
                            }
                            else {
                                // Catalog
                                file = this.catalogFile;
                            }
                            if (file != null) {
                                if (file.getFileType() == TI_FILE.FILE_TYPE_DATA) {
                                    if (file.getAccessType() == TI_FILE.ACCESS_TYPE_RELATIVE && fileName.length > 0) {
                                        file.setRecordPointer(recordNumber);
                                    }
                                    record = file.getRecord();
                                    if (record != null) {
                                        if (file.getOperationMode() == operationMode) {
                                            switch (file.getOperationMode()) {
                                                case TI_FILE.OPERATION_MODE_UPDATE:
                                                case TI_FILE.OPERATION_MODE_INPUT:
                                                    var recordData = record.getData();
                                                    var bytesToRead = Math.min(recordData.length, recordLength);
                                                    for (i = 0; i < bytesToRead; i++) {
                                                        this.ram[dataBufferAddress + i] = recordData[i];
                                                    }
                                                    this.ram[pabAddr + 5] = bytesToRead;
                                                    this.ram[pabAddr + 6] = (file.getRecordPointer() & 0xFF00) >> 8;
                                                    this.ram[pabAddr + 7] = file.getRecordPointer() & 0x00FF;
                                                    callback(0,0);
                                                    break;
                                                case TI_FILE.OPERATION_MODE_OUTPUT:
                                                case TI_FILE.OPERATION_MODE_APPEND:
                                                    callback(0, TI_FILE.ERROR_ILLEGAL_OPERATION);
                                                    break;
                                            }
                                        }
                                        else {
                                            callback(0, TI_FILE.ERROR_ILLEGAL_OPERATION);
                                        }
                                    }
                                    else {
                                        this.log.info("EOF - close file.");
                                        file.close();
                                        callback(0, TI_FILE.ERROR_READ_PAST_END);
                                    }
                                }
                                else {
                                    callback(0, TI_FILE.ERROR_FILE_ERROR);
                                }
                            }
                            else {
                                callback(0, TI_FILE.ERROR_FILE_ERROR);
                            }
                            break;
                        case TI_FILE.OP_CODE_WRITE:
                            this.log.info("Op-code " + opCode + ": WRITE");
                            file = this.diskImage.getFile(fileName);
                            if (file != null) {
                                if (file.getFileType() == TI_FILE.FILE_TYPE_DATA) {
                                    if (file.getOperationMode() == operationMode) {
                                        if (file.getAccessType() == TI_FILE.ACCESS_TYPE_RELATIVE) {
                                            file.setRecordPointer(recordNumber);
                                        }
                                        var bytesToWrite = recordType == TI_FILE.RECORD_TYPE_FIXED ? recordLength : characterCount;
                                        var writeBuffer = [];
                                        for (i = 0; i < bytesToWrite; i++) {
                                            writeBuffer[i] = this.ram[dataBufferAddress + i];
                                        }
                                        if (recordType == TI_FILE.RECORD_TYPE_FIXED) {
                                            record = new FixedRecord(writeBuffer, recordLength);
                                        }
                                        else {
                                            record = new VariableRecord(writeBuffer);
                                        }
                                        switch (file.getOperationMode()) {
                                            case TI_FILE.OPERATION_MODE_UPDATE:
                                                file.putRecord(record);
                                                callback(0, 0);
                                                break;
                                            case TI_FILE.OPERATION_MODE_OUTPUT:
                                            case TI_FILE.OPERATION_MODE_APPEND:
                                                if (file.isEOF()) {
                                                    file.putRecord(record);
                                                    callback(0, 0);
                                                }
                                                else {
                                                    callback(0, TI_FILE.ERROR_ILLEGAL_OPERATION);
                                                }
                                                break;
                                            case TI_FILE.OPERATION_MODE_INPUT:
                                                callback(0, TI_FILE.ERROR_ILLEGAL_OPERATION);
                                                break;
                                        }
                                        this.ram[pabAddr + 6] = (file.getRecordPointer() & 0xFF00) >> 8;
                                        this.ram[pabAddr + 7] = file.getRecordPointer() & 0x00FF;
                                    }
                                    else {
                                        callback(0, TI_FILE.ERROR_ILLEGAL_OPERATION);
                                    }
                                }
                                else {
                                    callback(0, TI_FILE.ERROR_FILE_ERROR);
                                }
                            }
                            else {
                                callback(0, TI_FILE.ERROR_FILE_ERROR);
                            }
                            break;
                        case TI_FILE.OP_CODE_REWIND:
                            this.log.info("Op-code " + opCode + ": REWIND");
                            file = this.diskImage.getFile(fileName);
                            if (file != null) {
                                if (file.getOperationMode() == operationMode) {
                                    if (file.getFileType() != TI_FILE.FILE_TYPE_PROGRAM) {
                                        file.rewind();
                                        callback(0, 0);
                                    }
                                    else {
                                        callback(0, TI_FILE.ERROR_FILE_ERROR);
                                    }
                                }
                                else {
                                    callback(0, TI_FILE.ERROR_ILLEGAL_OPERATION);
                                }
                            }
                            else {
                                callback(0, TI_FILE.ERROR_FILE_ERROR);
                            }
                            break;
                        case TI_FILE.OP_CODE_LOAD:
                            this.log.info("Op-code " + opCode + ": LOAD");
                            this.findFile(fileName, parent, function (id) {
                                if (id != null) {
                                    this.getFileContent(id, function (data) {
                                        file = this.diskImage.loadTIFile(fileName, data, true);
                                        if (file != null && file.getFileType() == TI_FILE.FILE_TYPE_PROGRAM) {
                                            var loadBuffer = file.getProgram();
                                            for (i = 0; i < Math.min(recordNumber, loadBuffer.length); i++) {
                                                this.ram[dataBufferAddress + i] = loadBuffer[i];
                                            }
                                            callback(0, 0);
                                        }
                                        else {
                                            callback(0, TI_FILE.ERROR_FILE_ERROR);
                                        }
                                    }.bind(this));
                                }
                                else {
                                    callback(0, TI_FILE.ERROR_FILE_ERROR);
                                }
                            }.bind(this));
                            break;
                        case TI_FILE.OP_CODE_SAVE:
                            this.log.info("Op-code " + opCode + ": SAVE");
                            var programBuffer = new Uint8Array(recordNumber);
                            for (i = 0; i < recordNumber; i++) {
                                programBuffer[i] = this.ram[dataBufferAddress + i];
                            }
                            file = new DiskFile(fileName, TI_FILE.FILE_TYPE_PROGRAM, 0, 0, 0);
                            file.setProgram(programBuffer);
                            this.diskImage.putFile(file);
                            var saveBuffer = this.diskImage.saveTIFile(fileName);
                            if (saveBuffer != null) {
                                this.insertOrUpdateFile(fileName, parent, saveBuffer, function (file) {
                                    // console.log(file);
                                    callback(0, 0);
                                });
                            }
                            else {
                                callback(0, TI_FILE.ERROR_FILE_ERROR);
                            }
                            break;
                        case TI_FILE.OP_CODE_DELETE:
                            this.log.info("Op-code " + opCode + ": DELETE");
                            //                        file = this.diskImage.getFile(fileName);
                            //                        if (file != null) {
                            //                            this.diskImage.deleteFile(fileName);
                            //                        }
                            //                        else {
                            //                            errorCode = TI_FILE.ERROR_FILE_ERROR;
                            //                        }
                            callback(0, TI_FILE.ERROR_FILE_ERROR);
                            break;
                        case TI_FILE.OP_CODE_SCRATCH:
                            this.log.info("Op-code " + opCode + ": SCRATCH");
                            //                        file = this.diskImage.getFile(fileName);
                            //                        if (file != null) {
                            //                            if (file.getFileType() == TI_FILE.FILE_TYPE_DATA) {
                            //                                if (file.getOperationMode() == operationMode && file.getAccessType() == TI_FILE.ACCESS_TYPE_RELATIVE) {
                            //                                    file.setRecordPointer(recordNumber);
                            //                                    switch (file.getOperationMode()) {
                            //                                        case TI_FILE.OPERATION_MODE_UPDATE:
                            //                                            if (file.getRecord() != null) {
                            //                                                file.deleteRecord();
                            //                                            }
                            //                                            else {
                            //                                                errorCode = TI_FILE.ERROR_ILLEGAL_OPERATION;
                            //                                            }
                            //                                            break;
                            //                                        case TI_FILE.OPERATION_MODE_OUTPUT:
                            //                                        case TI_FILE.OPERATION_MODE_INPUT:
                            //                                        case TI_FILE.OPERATION_MODE_APPEND:
                            //                                            errorCode = TI_FILE.ERROR_ILLEGAL_OPERATION;
                            //                                            break;
                            //                                    }
                            //                                }
                            //                                else {
                            //                                    errorCode = TI_FILE.ERROR_ILLEGAL_OPERATION;
                            //                                }
                            //                            }
                            //                            else {
                            //                                errorCode = TI_FILE.ERROR_FILE_ERROR;
                            //                            }
                            //                        }
                            //                        else {
                            //                            errorCode = TI_FILE.ERROR_FILE_ERROR;
                            //                        }
                            callback(0, TI_FILE.ERROR_FILE_ERROR);
                            break;
                        case TI_FILE.OP_CODE_STATUS:
                            this.log.info("Op-code " + opCode + ": STATUS");
                            //                        var fileStatus = 0;
                            //                        file = this.diskImage.getFile(fileName);
                            //                        if (file != null) {
                            //                            if (file.getDatatype() == TI_FILE.DATATYPE_INTERNAL) {
                            //                                fileStatus |= TI_FILE.STATUS_INTERNAL;
                            //                            }
                            //                            if (file.getFileType() == TI_FILE.FILE_TYPE_PROGRAM) {
                            //                                fileStatus |= TI_FILE.STATUS_PROGRAM;
                            //                            }
                            //                            if (file.getRecordType() == TI_FILE.RECORD_TYPE_VARIABLE) {
                            //                                fileStatus |= TI_FILE.STATUS_VARIABLE;
                            //                            }
                            //                            if (file.isEOF()) {
                            //                                fileStatus |= TI_FILE.STATUS_EOF;
                            //                            }
                            //
                            //                        }
                            //                        else {
                            //                            fileStatus |= TI_FILE.STATUS_NO_SUCH_FILE;
                            //                        }
                            //                        this.ram[pabAddr + 8] = fileStatus;
                            callback(0, TI_FILE.ERROR_FILE_ERROR);
                            break;
                        default:
                            this.log.error("Unknown DSR op-code: " + opCode);
                            callback(0, TI_FILE.ERROR_ILLEGAL_OPERATION);
                    }
                }
                else {
                    callback(0x20, TI_FILE.ERROR_DEVICE_ERROR);
                }
            }
            else {
                callback(0x20, TI_FILE.ERROR_DEVICE_ERROR);
            }
        }.bind(this));
    },

    createCatalogFile: function (files) {
        var catFile = new DiskFile("CATALOG", TI_FILE.FILE_TYPE_DATA, TI_FILE.RECORD_TYPE_FIXED, 38, TI_FILE.DATATYPE_INTERNAL);
        catFile.open(TI_FILE.OPERATION_MODE_OUTPUT, TI_FILE.ACCESS_TYPE_SEQUENTIAL);
        var data = [];
        var n = 0;
        n = this.writeAsString(data, n, this.diskImage.getName());
        n = this.writeAsFloat(data, n, 0);
        n = this.writeAsFloat(data, n, 1440); // Number of sectors on disk
        n = this.writeAsFloat(data, n, 1311); // Number of free sectors;
        catFile.putRecord(new FixedRecord(data, 38));
        for (var i = 0; i < files.length; i++) {
            var fileName = files[i].name;
            var file = this.diskImage.loadTIFile(fileName, files[i].data, true);
            var type = 0;
            if (file.getFileType() == TI_FILE.FILE_TYPE_PROGRAM) {
                type = 5;
            }
            else {
                type = 1; // DF
                if (file.getDatatype() == TI_FILE.DATATYPE_INTERNAL) {
                    type += 2;
                }
                if (file.getRecordType() == TI_FILE.RECORD_TYPE_VARIABLE) {
                    type += 1;
                }
            }
            n = 0;
            n = this.writeAsString(data, n, fileName);
            n = this.writeAsFloat(data, n, type);
            n = this.writeAsFloat(data, n, file.getSectorCount());
            n = this.writeAsFloat(data, n, file.getRecordLength());
            catFile.putRecord(new FixedRecord(data, 38));
        }
        n = 0;
        n = this.writeAsString(data, n, "");
        n = this.writeAsFloat(data, n, 0);
        n = this.writeAsFloat(data, n, 0);
        n = this.writeAsFloat(data, n, 0);
        catFile.putRecord(new FixedRecord(data, 38));
        catFile.close();
        // this.log.info(catFile.toString());
        return catFile;
    },

    writeAsString: function (data, n, str) {
        data[n++] = str.length;
        for (var i = 0; i < str.length; i++) {
            data[n++] = str.charCodeAt(i);
        }
        return n;
    },

    // Translated from Classic99
    writeAsFloat: function (data, n, val) {
        var word = [0, 0];
        // First write a size byte of 8
        data[n++] = 8;
        // Translation of the TICC code, we can do better later ;)
        // Basically, we get the exponent and two bytes, and the rest are zeros
        var tmp = val;
        if (val < 0) {
            val = -val;
        }
        if (val >= 100) {
            word[0] = Math.floor(val / 100) | 0x4100; // 0x41 is the 100s counter, not sure how this works with 10,000, maybe it doesn't?
            word[1] = Math.floor(val % 100);
        }
        else {
            if (val == 0) {
                word[0] = 0;
            }
            else {
                word[0] = val | 0x4000;
            }
            word[1] = 0;
        }
        if (tmp < 0) {
            word[0] = ((~word[0]) + 1) & 0xFFFF;
        }
        data[n++] = (word[0] >>> 8) & 0xff;
        data[n++] = word[0] & 0xff;
        data[n++] = word[1] & 0xff;
        // and five zeros
        for (var i = 0; i < 5; i++) {
            data[n++] = 0;
        }
        return n;
    },

    getFiles: function (parent, callback) {
        var request = gapi.client.request({
            'path': '/drive/v2/files',
            'method': 'GET',
            'params': {'q': "mimeType != 'application/vnd.google-apps.folder' and '" + parent + "' in parents and trashed = false"}
        });
        request.execute(function (result) {
            callback(result.items)
        });
    },

    findFile: function (fileName, parent, callback) {
        var request = gapi.client.request({
            'path': '/drive/v2/files',
            'method': 'GET',
            'params': {'q': "mimeType != 'application/vnd.google-apps.folder' and title = '" + fileName + "' and '" + parent + "' in parents and trashed = false"}
        });

        request.execute(function (result) {
            // console.log(result);
            var items = result.items;
            var id = items.length > 0 ? items[0].id : null;
            this.log.info("findFile '" + fileName + "': " + id);
            callback(id);
        }.bind(this));
    },

    getFile: function (fileId, callback) {
        var request = gapi.client.request({
            'path': '/drive/v2/files/' + fileId,
            'method': 'GET'
        });
        request.execute(callback);
    },

    getFileContents: function (parent, callback) {
        var that = this;
        var files = [];
        this.getFiles(parent, function (items) {
            _getFileContents(items, function () {
                callback(files);
            })
        });
        function _getFileContents(items, callback) {
            if (items.length) {
                var item = items.shift();
                that.getFileContent(item.id, function (data) {
                    files.push({id: item.id, name: item.title, data: data});
                    _getFileContents(items, callback);
                })
            }
            else {
                callback();
            }
        }
    },

    getFileContent: function (fileId, callback) {
        this.getFile(fileId, function (file) {
            if (file.downloadUrl) {
                this.log.info("getFileContent: " + file.title);
                var accessToken = gapi.auth.getToken().access_token;
                var xhr = new XMLHttpRequest();
                xhr.open('GET', file.downloadUrl);
                xhr.setRequestHeader('Authorization', 'Bearer ' + accessToken);
                xhr.responseType = "arraybuffer";
                xhr.onload = function () {
                    if (this.status == 200) {
                        callback(new Uint8Array(this.response));
                    }
                };
                xhr.onerror = function () {
                    callback(null);
                };
                xhr.send();
            } else {
                callback(null);
            }
        }.bind(this));
    },

    insertOrUpdateFile: function (fileName, parent, fileData, callback) {
        this.findFile(fileName, parent, function (fileId) {
            if (fileId == null) {
                this.insertFile(fileName, parent, fileData, callback);
            }
            else {
                this.updateFile(fileId, fileData, callback);
            }
        }.bind(this));
    },

    insertFile: function (fileName, parent, fileData, callback) {
        var boundary = '-------314159265358979323846';
        var delimiter = "\r\n--" + boundary + "\r\n";
        var close_delim = "\r\n--" + boundary + "--";

        var reader = new FileReader();
        reader.readAsBinaryString(new Blob([fileData]));
        reader.onload = function (e) {
            var contentType = "application/octet-stream";
            var metadata = {
                'title': fileName,
                'mimeType': contentType,
                'parents': [{'id': parent}]
            };

            var base64Data = btoa(reader.result);
            var multipartRequestBody =
                delimiter +
                'Content-Type: application/json\r\n\r\n' +
                JSON.stringify(metadata) +
                delimiter +
                'Content-Type: ' + contentType + '\r\n' +
                'Content-Transfer-Encoding: base64\r\n' +
                '\r\n' +
                base64Data +
                close_delim;

            var request = gapi.client.request({
                'path': '/upload/drive/v2/files',
                'method': 'POST',
                'params': {'uploadType': 'multipart'},
                'headers': {
                    'Content-Type': 'multipart/mixed; boundary="' + boundary + '"'
                },
                'body': multipartRequestBody});

            request.execute(callback);
        }
    },

    updateFile: function (fileId, fileData, callback) {
        var boundary = '-------314159265358979323846';
        var delimiter = "\r\n--" + boundary + "\r\n";
        var close_delim = "\r\n--" + boundary + "--";

        var reader = new FileReader();
        reader.readAsBinaryString(new Blob([fileData]));
        reader.onload = function (e) {
            this.getFile(fileId, function (metadata) {
                var contentType = "application/octet-stream";
                var base64Data = btoa(reader.result);
                var multipartRequestBody =
                    delimiter +
                    'Content-Type: application/json\r\n\r\n' +
                    JSON.stringify(metadata) +
                    delimiter +
                    'Content-Type: ' + contentType + '\r\n' +
                    'Content-Transfer-Encoding: base64\r\n' +
                    '\r\n' +
                    base64Data +
                    close_delim;

                var request = gapi.client.request({
                    'path': '/upload/drive/v2/files/' + fileId,
                    'method': 'PUT',
                    'params': {'uploadType': 'multipart', 'alt': 'json'},
                    'headers': {
                        'Content-Type': 'multipart/mixed; boundary="' + boundary + '"'
                    },
                    'body': multipartRequestBody});

                request.execute(callback);
            });
        }.bind(this);
    },

    getOrCreateFolder: function (path, parent, callback) {
        if (path.length > 0) {
            this.getFolder(path[0], parent, function (id) {
                if (id == null) {
                    this.createFolder(path[0], parent, function (id) {
                        this.getOrCreateFolder(path.splice(1), id, callback);
                    }.bind(this))
                }
                else {
                    this.getOrCreateFolder(path.splice(1), id, callback);
                }
            }.bind(this));
        }
        else {
            callback(parent);
        }
    },

    createFolder: function (folderName, parent, callback) {
        var metadata = {
            'title': folderName,
            'parents': [{'id': parent}],
            'mimeType': 'application/vnd.google-apps.folder'
        };

        var request = gapi.client.request({
            'path': '/drive/v2/files',
            'method': 'POST',
            'body': JSON.stringify(metadata)
        });

        request.execute(function (result) {
            var id = result.id;
            this.log.info("createFolder '" + folderName + "': " + id);
            callback(id);
        }.bind(this));
    },

    getFolder: function (folderName, parent, callback) {
        var request = gapi.client.request({
            'path': '/drive/v2/files',
            'method': 'GET',
            'params': {'q': "mimeType = 'application/vnd.google-apps.folder' and title = '" + folderName + "' and '" + parent + "' in parents and trashed = false"}
        });

        request.execute(function (result) {
            var items = result.items;
            var id = items.length > 0 ? items[0].id : null;
            this.log.info("getFolder '" + folderName + "': " + id);
            // console.log(result);
            callback(id);
        }.bind(this));
    },

    setRAM: function (ram) {
        this.ram = ram;
    }
};