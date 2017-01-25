/*
 * js99'er - TI-99/4A emulator written in JavaScript
 *
 * Created 2014 by Rasmus Moustgaard <rasmus.moustgaard@gmail.com>
 */
 
"use strict";

var TI_FILE = {};

TI_FILE.OP_CODE_OPEN = 0;
TI_FILE.OP_CODE_CLOSE = 1;
TI_FILE.OP_CODE_READ = 2;
TI_FILE.OP_CODE_WRITE = 3;
TI_FILE.OP_CODE_REWIND = 4;
TI_FILE.OP_CODE_LOAD = 5;
TI_FILE.OP_CODE_SAVE = 6;
TI_FILE.OP_CODE_DELETE = 7;
TI_FILE.OP_CODE_SCRATCH = 8;
TI_FILE.OP_CODE_STATUS = 9;

TI_FILE.FILE_TYPE_DATA = 0;
TI_FILE.FILE_TYPE_PROGRAM = 1;

TI_FILE.ACCESS_TYPE_SEQUENTIAL = 0;
TI_FILE.ACCESS_TYPE_RELATIVE = 1;

TI_FILE.RECORD_TYPE_FIXED = 0;
TI_FILE.RECORD_TYPE_VARIABLE = 1;

TI_FILE.DATATYPE_DISPLAY = 0;
TI_FILE.DATATYPE_INTERNAL = 1;

TI_FILE.OPERATION_MODE_UPDATE = 0; // Read and write
TI_FILE.OPERATION_MODE_OUTPUT = 1; // Create and write
TI_FILE.OPERATION_MODE_INPUT = 2;  // Read only
TI_FILE.OPERATION_MODE_APPEND = 3; // Add to end only

TI_FILE.OPERATION_MODES = [
    "UPDATE", "OUTPUT", "INPUT", "APPEND"
];

TI_FILE.ERROR_BAD_DEVICE_NAME = 0;
TI_FILE.ERROR_WRITE_PROTECTED = 1;
TI_FILE.ERROR_BAD_OPEN_ATTRIBUTE = 2;
TI_FILE.ERROR_ILLEGAL_OPERATION = 3;
TI_FILE.ERROR_OUT_OF_SPACE = 4;
TI_FILE.ERROR_READ_PAST_END = 5;
TI_FILE.ERROR_DEVICE_ERROR = 6;
TI_FILE.ERROR_FILE_ERROR = 7;

TI_FILE.STATUS_NO_SUCH_FILE = 0x80;
TI_FILE.STATUS_PROTECTED = 0x40;
TI_FILE.STATUS_INTERNAL = 0x10;
TI_FILE.STATUS_PROGRAM = 0x08;
TI_FILE.STATUS_VARIABLE = 0x04;
TI_FILE.STATUS_DISK_FULL = 0x02;
TI_FILE.STATUS_EOF = 0x01;


function DiskDrive(name, ram, diskImage) {
    this.name = name;
    this.ram = ram;
    this.diskImage = diskImage;
    this.catalogFile = null;
    this.log = Log.getLog();
}

DiskDrive.DSR_ROM = [
    0xAA,                           // >4000 Standard header
    0x01,                           // >4001 Version
    0x00,                           // >4002 No programs allowed in peripheral card ROMs
    0x00,                           // >4003 Not used
    0x40, 0x10,                     // >4004 Pointer to power-up list
    0x00, 0x00,                     // >4006 Pointer to program list
    0x40, 0x14,                     // >4008 Pointer to DSR list
    0x40, 0x32,                     // >400A Pointer to subprogram list
    0x00, 0x00,                     // >400C Pointer to ISR list
    0x00, 0x00,                     // >400E Pointer to ?
    // Power-up list
    0x00, 0x00,                     // >4010 Link to next power-up routine (no more)
    0x40, 0x66,                     // >4012 Address of this power-up routine
    // DSR list
    0x40, 0x1E,                     // >4014 Link to next DSR
    0x40, 0x68,                     // >4016 Address of this DSR
    0x04,                           // >4018 Name length
    0x44, 0x53, 0x4B, 0x31,         // >4019 Name "DSK1"
    0x00,                           // >401D Align to word
    0x40, 0x28,                     // >401E Link to next DSR
    0x40, 0x6C,                     // >4020 Address of this DSR
    0x04,                           // >4022 Name length
    0x44, 0x53, 0x4B, 0x32,         // >4023 Name "DSK2"
    0x00,                           // >4027 Align to word
    0x00, 0x00,                     // >4028 Link to next DSR (no more)
    0x40, 0x70,                     // >402A Address of this DSR
    0x04,                           // >402C Name length
    0x44, 0x53, 0x4B, 0x33,         // >402D Name "DSK3"
    0x00,                           // >4031 Align to word
    // Subprogram list
    // FILES
    0x40, 0x3C,                     // >4032 Link to next subprogram
    0x40, 0x74,                     // >4034 Address of FILES subprogram
    0x05,                           // >4036 Name length
    0x46, 0x49, 0x4C, 0x45, 0x53,   // >4037 Name "FILES"
    // >10
    0x40, 0x42,                     // >403C Link to next subprogram
    0x40, 0x78,                     // >403E Address of >10 subprogram
    0x01,                           // >4040 Name length
    0x10,                           // >4041 Name >10
    // >11
    0x40, 0x48,                     // >4042 Link to next subprogram
    0x40, 0x7C,                     // >4044 Address of >11 subprogram
    0x01,                           // >4046 Name length
    0x11,                           // >4047 Name >11
    // >12
    0x40, 0x4E,                     // >4048 Link to next subprogram
    0x40, 0x80,                     // >404A Address of >12 subprogram
    0x01,                           // >404C Name length
    0x12,                           // >404D Name >12
    // >13
    0x40, 0x54,                     // >404E Link to next subprogram
    0x40, 0x84,                     // >4050 Address of >13 subprogram
    0x01,                           // >4052 Name length
    0x13,                           // >4053 Name >13
    // >14
    0x40, 0x5A,                     // >4054 Link to next subprogram
    0x40, 0x88,                     // >4056 Address of >14 subprogram
    0x01,                           // >4058 Name length
    0x14,                           // >4059 Name >14
    // >15
    0x40, 0x60,                     // >405A Link to next subprogram
    0x40, 0x8C,                     // >405C Address of >15 subprogram
    0x01,                           // >405E Name length
    0x15,                           // >405F Name >15
    // >16
    0x00, 0x00,                     // >4060 Link to next subprogram (no more)
    0x40, 0x90,                     // >4062 Address of >16 subprogram
    0x01,                           // >4064 Name length
    0x16,                           // >4065 Name >16
    // Power-up routine
    0x04, 0x5B,                     // >4066 B *R11
    // DSK1 routine
    0x05, 0xCB,                     // >4068 INCT R11
    0x04, 0x5B,                     // >406A B *R11
    // DSK2 routine
    0x05, 0xCB,                     // >406C INCT R11
    0x04, 0x5B,                     // >406E B *R11
    // DSK3 routine
    0x05, 0xCB,                     // >4070 INCT R11
    0x04, 0x5B,                     // >4072 B *R11
    // FILES subprogram
    0x05, 0xCB,                     // >4074 INCT R11
    0x04, 0x5B,                     // >4076 B *R11
    // >10 subprogram
    0x05, 0xCB,                     // >4078 INCT R11
    0x04, 0x5B,                     // >407A B *R11
    // >11 subprogram
    0x05, 0xCB,                     // >407C INCT R11
    0x04, 0x5B,                     // >407E B *R11
    // >12 subprogram
    0x05, 0xCB,                     // >4080 INCT R11
    0x04, 0x5B,                     // >4082 B *R11
    // >13 subprogram
    0x05, 0xCB,                     // >4084 INCT R11
    0x04, 0x5B,                     // >4086 B *R11
    // >14 subprogram
    0x05, 0xCB,                     // >4088 INCT R11
    0x04, 0x5B,                     // >408A B *R11
    // >15 subprogram
    0x05, 0xCB,                     // >408C INCT R11
    0x04, 0x5B,                     // >408E B *R11
    // >16 subprogram
    0x05, 0xCB,                     // >4090 INCT R11
    0x04, 0x5B                      // >4092 B *R11
];

DiskDrive.DSR_ROM_POWER_UP = 0x4066;
DiskDrive.DSR_ROM_DSK1 = 0x4068;
DiskDrive.DSR_ROM_DSK2 = 0x406C;
DiskDrive.DSR_ROM_DSK3 = 0x4070;
DiskDrive.DSR_ROM_FILES = 0x4074;
DiskDrive.DSR_ROM_SECTOR_IO_10 = 0x4078;
DiskDrive.DSR_ROM_FORMAT_DISK_11 = 0x407C;
DiskDrive.DSR_ROM_FILE_PROTECTION_12 = 0x4080;
DiskDrive.DSR_ROM_RENAME_FILE_13 = 0x4084;
DiskDrive.DSR_ROM_FILE_INPUT_14 = 0x4088;
DiskDrive.DSR_ROM_FILE_OUTPUT_15 = 0x408C;
DiskDrive.DSR_ROM_FILES_16  = 0x4090;

DiskDrive.DSR_HOOK_START = DiskDrive.DSR_ROM_POWER_UP;
DiskDrive.DSR_HOOK_END = DiskDrive.DSR_ROM_FILES_16;

DiskDrive.execute = function (pc, diskDrives, memory) {
    var status = 0;
    switch (pc) {
        case DiskDrive.DSR_ROM_POWER_UP:
            DiskDrive.powerUp(memory);
            break;
        case DiskDrive.DSR_ROM_DSK1:
            status = diskDrives[0].dsrRoutine(memory.getPADWord(0x8356) - 14);
            break;
        case DiskDrive.DSR_ROM_DSK2:
            status = diskDrives[1].dsrRoutine(memory.getPADWord(0x8356) - 14);
            break;
        case DiskDrive.DSR_ROM_DSK3:
            status = diskDrives[2].dsrRoutine(memory.getPADWord(0x8356) - 14);
            break;
        case DiskDrive.DSR_ROM_FILES:
            DiskDrive.setFiles(-1, memory);
            break;
        case DiskDrive.DSR_ROM_SECTOR_IO_10:
            var drive = memory.getPADByte(0x834C) - 1;
            if (drive >= 0 && drive < diskDrives.length) {
                diskDrives[drive].sectorIO(memory);
            }
            break;
        case DiskDrive.DSR_ROM_FORMAT_DISK_11:
            Log.getLog().warn("Subprogram >11: Format Disk not implemented.");
            break;
        case DiskDrive.DSR_ROM_FILE_PROTECTION_12:
            Log.getLog().warn("Subprogram >12: File Protection not implemented.");
            break;
        case DiskDrive.DSR_ROM_RENAME_FILE_13:
            Log.getLog().warn("Subprogram >13: Rename File not implemented.");
            break;
        case DiskDrive.DSR_ROM_FILE_INPUT_14:
            Log.getLog().warn("Subprogram >14: File Input not implemented.");
            break;
        case DiskDrive.DSR_ROM_FILE_OUTPUT_15:
            Log.getLog().warn("Subprogram >15: File Output not implemented.");
            break;
        case DiskDrive.DSR_ROM_FILES_16:
            DiskDrive.setFiles(memory.getPADByte(0x834C), memory);
            break;
        default:
            // Log.getLog().warn("Subprogram at " + pc.toHexWord() + " not found.");
            break;
    }
    memory.setPADByte(0x837C, memory.getPADByte(0x837C) | status);
};

DiskDrive.powerUp = function (memory) {
    Log.getLog().info("Executing disk DSR power-up routine.");
    DiskDrive.setFiles(3, memory);
};

DiskDrive.setFiles = function (nFiles, memory) {
    if (nFiles == -1) {
        // Get parameter from BASIC (code from Classic99)
        var x = memory.getPADWord(0x832c);		    // Get next basic token
        x += 7;						                // Skip "FILES"
        var vdpRAM = memory.vdp.getRAM();           // Get the VDP RAM
        var y = (vdpRAM[x] << 8) | vdpRAM[x + 1];	// Get two bytes (size of string)
        if (y == 0xc801) {                          // c8 means unquoted string, 1 is the length
            x += 2;						            // Increment pointer
            y = vdpRAM[x] - 0x30;				    // this is the number of files in ASCII
            if ((y <= 9) && (y >= 0)) {
                // valid count
                nFiles = y;
                // Try to skip the rest of the statement
                x += 3;
                memory.setPADWord(0x832c, x);    // Write new pointer
                memory.setPADWord(0x8342, 0);    // Clear 'current' token
            }
        }
    }
    if (nFiles == -1) {
        nFiles = 3;
    }
    Log.getLog().info("Executing disk DSR FILES routine (n = " + nFiles + ").");
    memory.writeWord(0x8370, 0x4000 - nFiles * 0x2B8);
    memory.writeWord(0x8350, memory.readWord(0x8350) & 0x00FF);
};

DiskDrive.prototype = {

    getName: function () {
        return this.name;
    },

    dsrRoutine: function (pabAddr) {
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

        this.log.info(
            fileName + ": " +
            TI_FILE.OPERATION_MODES[operationMode] + ", " +
            (accessType == TI_FILE.ACCESS_TYPE_RELATIVE ? "RELATIVE" : "SEQUENTIAL") + ", " +
            (datatype == TI_FILE.DATATYPE_DISPLAY ? "DISPLAY" : "INTERNAL") + ", " +
            (recordType == TI_FILE.RECORD_TYPE_FIXED ? "FIXED" : "VARIABLE") + ", " +
             recordLength
        );
        // this.log.info("File name: " + fileName);
        // this.log.info("Operation mode: " + TI_FILE.OPERATION_MODES[operationMode]);
        // this.log.info("Access type: " + (accessType == TI_FILE.ACCESS_TYPE_RELATIVE ? "RELATIVE" : "SEQUENTIAL"));
        // this.log.info("Datatype: " + (datatype == TI_FILE.DATATYPE_DISPLAY ? "DISPLAY" : "INTERNAL"));
        // this.log.info("Record type: " + (recordType == TI_FILE.RECORD_TYPE_FIXED ? "FIXED" : "VARIABLE"));
        // this.log.info("Record length: " + recordLength);
        // this.log.info("Character count: " + characterCount);
        // this.log.info("Record number: " + recordNumber);

        var errorCode = 0;
        var status = 0;
        if (this.diskImage != null) {
            if (fileName.substr(0, this.name.length + 1) == this.name + ".") {
                fileName = fileName.substr(this.name.length + 1);
                var file, record;
                switch (opCode) {
                    case TI_FILE.OP_CODE_OPEN:
                        this.log.info("Op-code " + opCode + ": OPEN");
                        if (operationMode == TI_FILE.OPERATION_MODE_OUTPUT || operationMode == TI_FILE.OPERATION_MODE_UPDATE) {
                            // Create a new file
                            if (recordLength == 0) {
                                recordLength = 128;
                                // Write default record length to PAB
                                this.ram[pabAddr + 4] = recordLength;
                            }
                            file = this.diskImage.getFile(fileName);
                            if (file == null || operationMode == TI_FILE.OPERATION_MODE_OUTPUT) {
                                file = new DiskFile(fileName, TI_FILE.FILE_TYPE_DATA, recordType, recordLength, datatype);
                                this.diskImage.putFile(file);
                            }
                        }
                        else {
                            if (fileName.length > 0) {
                                // Open existing file
                                file = this.diskImage.getFile(fileName);
                                if (file == null) {
                                    errorCode = TI_FILE.ERROR_FILE_ERROR;
                                    break;
                                }
                                if (file.getOperationMode() != -1 || file.getFileType() == TI_FILE.FILE_TYPE_PROGRAM || file.getRecordType() != recordType || file.getRecordLength() != recordLength && recordLength != 0) {
                                    errorCode = TI_FILE.ERROR_BAD_OPEN_ATTRIBUTE;
                                    break;
                                }
                                if (recordLength == 0) {
                                    recordLength = file.getRecordLength();
                                    this.ram[pabAddr + 4] = recordLength;
                                }
                            }
                            else if (operationMode == TI_FILE.OPERATION_MODE_INPUT) {
                                // Catalog
                                file = this.createCatalogFile();
                                this.catalogFile = file;
                                if (recordLength == 0) {
                                    recordLength = 38;
                                    this.ram[pabAddr + 4] = recordLength;
                                }
                            }
                            else {
                                errorCode = TI_FILE.ERROR_ILLEGAL_OPERATION;
                                break;
                            }
                        }
                        file.open(operationMode, accessType);
                        break;
                    case TI_FILE.OP_CODE_CLOSE:
                        this.log.info("Op-code " + opCode + ": CLOSE");
                        if (fileName.length > 0) {
                            file = this.diskImage.getFile(fileName);
                            if (file != null) {
                                if (file.getFileType() == TI_FILE.FILE_TYPE_DATA) {
                                    if (file.getOperationMode() == operationMode) {
                                        file.close();
                                    }
                                    else {
                                        errorCode = TI_FILE.ERROR_ILLEGAL_OPERATION;
                                    }
                                }
                                else {
                                    errorCode = TI_FILE.ERROR_FILE_ERROR;
                                }
                            }
                            else {
                                errorCode = TI_FILE.ERROR_FILE_ERROR;
                            }
                        }
                        else {
                            this.catalogFile = null;
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
                                if (fileName.length > 0) { // && file.getAccessType() == TI_FILE.ACCESS_TYPE_RELATIVE
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
                                                break;
                                            case TI_FILE.OPERATION_MODE_OUTPUT:
                                            case TI_FILE.OPERATION_MODE_APPEND:
                                                errorCode = TI_FILE.ERROR_ILLEGAL_OPERATION;
                                                break;
                                        }
                                    }
                                    else {
                                        errorCode = TI_FILE.ERROR_ILLEGAL_OPERATION;
                                    }
                                }
                                else {
                                    this.log.info("EOF - close file.");
                                    file.close();
                                    errorCode = TI_FILE.ERROR_READ_PAST_END;
                                }
                            }
                            else {
                                errorCode = TI_FILE.ERROR_FILE_ERROR;
                            }
                        }
                        else {
                            errorCode = TI_FILE.ERROR_FILE_ERROR;
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
                                            break;
                                        case TI_FILE.OPERATION_MODE_OUTPUT:
                                        case TI_FILE.OPERATION_MODE_APPEND:
                                            if (file.isEOF()) {
                                                file.putRecord(record);
                                            }
                                            else {
                                                errorCode = TI_FILE.ERROR_ILLEGAL_OPERATION;
                                            }
                                            break;
                                        case TI_FILE.OPERATION_MODE_INPUT:
                                            errorCode = TI_FILE.ERROR_ILLEGAL_OPERATION;
                                            break;
                                    }
                                    this.ram[pabAddr + 6] = (file.getRecordPointer() & 0xFF00) >> 8;
                                    this.ram[pabAddr + 7] = file.getRecordPointer() & 0x00FF;
                                    this.diskImage.setBinaryImage(null); // Invalidate binary image on write
                                }
                                else {
                                    errorCode = TI_FILE.ERROR_ILLEGAL_OPERATION;
                                }
                            }
                            else {
                                errorCode = TI_FILE.ERROR_FILE_ERROR;
                            }
                        }
                        else {
                            errorCode = TI_FILE.ERROR_FILE_ERROR;
                        }
                        break;
                    case TI_FILE.OP_CODE_REWIND:
                        this.log.info("Op-code " + opCode + ": REWIND");
                        file = this.diskImage.getFile(fileName);
                        if (file != null) {
                            if (file.getOperationMode() == operationMode) {
                                if (file.getFileType() != TI_FILE.FILE_TYPE_PROGRAM) {
                                    file.rewind();
                                }
                                else {
                                    errorCode = TI_FILE.ERROR_FILE_ERROR;
                                }
                            }
                            else {
                                errorCode = TI_FILE.ERROR_ILLEGAL_OPERATION;
                            }
                        }
                        else {
                            errorCode = TI_FILE.ERROR_FILE_ERROR;
                        }
                        break;
                    case TI_FILE.OP_CODE_LOAD:
                        this.log.info("Op-code " + opCode + ": LOAD");
                        file = this.diskImage.getFile(fileName);
                        if (file != null) {
                            if (file.getFileType() == TI_FILE.FILE_TYPE_PROGRAM) {
                                var loadBuffer = file.getProgram();
                                for (i = 0; i < Math.min(recordNumber, loadBuffer.length); i++) {
                                    this.ram[dataBufferAddress + i] = loadBuffer[i];
                                }
                            }
                            else {
                                errorCode = TI_FILE.ERROR_FILE_ERROR;
                            }
                        }
                        else {
                            errorCode = TI_FILE.ERROR_FILE_ERROR;
                        }
                        break;
                    case TI_FILE.OP_CODE_SAVE:
                        this.log.info("Op-code " + opCode + ": SAVE");
                        file = this.diskImage.getFile(fileName);
                        if (file == null) {
                            file = new DiskFile(fileName, TI_FILE.FILE_TYPE_PROGRAM, 0, 0, 0);
                            this.diskImage.putFile(file);
                        }
                        var saveBuffer = [];
                        for (i = 0; i < recordNumber; i++) {
                            saveBuffer[i] = this.ram[dataBufferAddress + i];
                        }
                        file.setProgram(saveBuffer);
                        this.diskImage.setBinaryImage(null); // Invalidate binary image on write
                        break;
                    case TI_FILE.OP_CODE_DELETE:
                        this.log.info("Op-code " + opCode + ": DELETE");
                        file = this.diskImage.getFile(fileName);
                        if (file != null) {
                            this.diskImage.deleteFile(fileName);
                        }
                        else {
                            errorCode = TI_FILE.ERROR_FILE_ERROR;
                        }
                        break;
                    case TI_FILE.OP_CODE_SCRATCH:
                        this.log.info("Op-code " + opCode + ": SCRATCH");
                        file = this.diskImage.getFile(fileName);
                        if (file != null) {
                            if (file.getFileType() == TI_FILE.FILE_TYPE_DATA) {
                                if (file.getOperationMode() == operationMode && file.getAccessType() == TI_FILE.ACCESS_TYPE_RELATIVE) {
                                    file.setRecordPointer(recordNumber);
                                    switch (file.getOperationMode()) {
                                        case TI_FILE.OPERATION_MODE_UPDATE:
                                            if (file.getRecord() != null) {
                                                file.deleteRecord();
                                                this.diskImage.setBinaryImage(null); // Invalidate binary image on write
                                            }
                                            else {
                                                errorCode = TI_FILE.ERROR_ILLEGAL_OPERATION;
                                            }
                                            break;
                                        case TI_FILE.OPERATION_MODE_OUTPUT:
                                        case TI_FILE.OPERATION_MODE_INPUT:
                                        case TI_FILE.OPERATION_MODE_APPEND:
                                            errorCode = TI_FILE.ERROR_ILLEGAL_OPERATION;
                                            break;
                                    }
                                }
                                else {
                                    errorCode = TI_FILE.ERROR_ILLEGAL_OPERATION;
                                }
                            }
                            else {
                                errorCode = TI_FILE.ERROR_FILE_ERROR;
                            }
                        }
                        else {
                            errorCode = TI_FILE.ERROR_FILE_ERROR;
                        }
                        break;
                    case TI_FILE.OP_CODE_STATUS:
                        this.log.info("Op-code " + opCode + ": STATUS");
                        var fileStatus = 0;
                        file = this.diskImage.getFile(fileName);
                        if (file != null) {
                            if (file.getDatatype() == TI_FILE.DATATYPE_INTERNAL) {
                                fileStatus |= TI_FILE.STATUS_INTERNAL;
                            }
                            if (file.getFileType() == TI_FILE.FILE_TYPE_PROGRAM) {
                                fileStatus |= TI_FILE.STATUS_PROGRAM;
                            }
                            if (file.getRecordType() == TI_FILE.RECORD_TYPE_VARIABLE) {
                                fileStatus |= TI_FILE.STATUS_VARIABLE;
                            }
                            if (file.isEOF()) {
                                fileStatus |= TI_FILE.STATUS_EOF;
                            }

                        }
                        else {
                            fileStatus |= TI_FILE.STATUS_NO_SUCH_FILE;
                        }
                        this.ram[pabAddr + 8] = fileStatus;
                        break;
                    default:
                        this.log.error("Unknown DSR op-code: " + opCode);
                        errorCode = TI_FILE.ERROR_ILLEGAL_OPERATION;
                }
            }
            else {
                status = 0x20;
            }
        }
        else {
            errorCode = TI_FILE.ERROR_DEVICE_ERROR;
        }
        this.log.info("Returned error code: " + errorCode + "\n");
        this.ram[pabAddr + 1] = (this.ram[pabAddr + 1] | (errorCode << 5)) & 0xFF;
        return status;
    },

    sectorIO: function (memory) {
        var read = (memory.getPADWord(0x834C) & 0x0F) != 0;
        var bufferAddr = memory.getPADWord(0x834E);
        var sectorNo = memory.getPADWord(0x8350);
        this.log.info("Sector I/O drive " + this.name + ", read: " + read + ", bufferAddr: " + bufferAddr.toHexWord() + ", sectorNo: " + sectorNo.toHexWord());
        if (this.diskImage != null) {
            if (read) {
                var sector = this.diskImage.readSector(sectorNo);
                for (var i = 0; i < 256; i++) {
                    this.ram[bufferAddr + i] = sector[i];
                }
                memory.setPADWord(0x834A, sectorNo);
                memory.setPADWord(0x8350, 0);
            }
            else {
                // Write not implemented:
                this.log.warn("Sector write not implemented.");
            }
        }
    },

    getDiskImage: function () {
        return this.diskImage;
    },

    setDiskImage: function (diskImage) {
        this.diskImage = diskImage;
    },

    createCatalogFile: function () {
        var catFile = new DiskFile("CATALOG", TI_FILE.FILE_TYPE_DATA, TI_FILE.RECORD_TYPE_FIXED, 38, TI_FILE.DATATYPE_INTERNAL);
        catFile.open(TI_FILE.OPERATION_MODE_OUTPUT, TI_FILE.ACCESS_TYPE_SEQUENTIAL);
        var data = [];
        var n = 0;
        n = this.writeAsString(data, n, this.diskImage.getName());
        n = this.writeAsFloat(data, n, 0);
        n = this.writeAsFloat(data, n, 1440); // Number of sectors on disk
        n = this.writeAsFloat(data, n, 1311); // Number of free sectors;
        catFile.putRecord(new FixedRecord(data, 38));
        var files = this.diskImage.getFiles();
        for (var fileName in files) {
            if (files.hasOwnProperty(fileName)) {
                var file = files[fileName];
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

    loadDSKFromURL: function (url, onLoad) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'arraybuffer';
        var self = this;
        xhr.onload = function (e) {
            self.loadDSKFile("", new Uint8Array(this.response))
            if (onLoad) {
                onLoad();
            }
        };
        xhr.send();
    },

    loadDSKFile: function (dskFileName, fileBuffer) {
        var volumeName = "";
        for (var i = 0; i < 10; i++) {
            var ch = fileBuffer[i];
            if (ch >= 32 && ch < 128) {
                volumeName += String.fromCharCode(ch);
            }
        }
        volumeName = volumeName.trim();
        this.log.info("Volume name: " + volumeName);
        var diskImage = new DiskImage(volumeName);
        var totalSectors = (fileBuffer[0x0A] << 8) + fileBuffer[0x0B];
        this.log.info("Total sectors: " + totalSectors);
        for (var fileDescriptorIndex = 0; fileDescriptorIndex < 128; fileDescriptorIndex++) {
            var fileDescriptorSectorNo = (fileBuffer[0x100 + fileDescriptorIndex * 2] << 8) + fileBuffer[0x100 + fileDescriptorIndex * 2 + 1];
            if (fileDescriptorSectorNo != 0) {
                var fileDescriptorRecord = fileDescriptorSectorNo * 256;
                var fileName = "";
                for (i = 0; i < 10; i++) {
                    ch = fileBuffer[fileDescriptorRecord + i];
                    if (ch >= 32 && ch < 128) {
                        fileName += String.fromCharCode(ch);
                    }
                }
                fileName = fileName.trim();
                this.log.info("File name: " + fileName);
                var statusFlags = fileBuffer[fileDescriptorRecord + 0x0C];
                var recordType = (statusFlags & 0x80) >> 7;
                var datatype = (statusFlags & 0x02) >> 1;
                var fileType = (statusFlags & 0x01);
                // this.log.info("Status flags: " + statusFlags.toString(2).padl("0", 8));
                var recordsPerSector = fileBuffer[fileDescriptorRecord + 0x0D];
                // this.log.info("Records per sector: " + recordsPerSector);
                var sectorsAllocated = (fileBuffer[fileDescriptorRecord + 0x0E] << 8) + fileBuffer[fileDescriptorRecord + 0x0F];
                // this.log.info("Sectors allocated: " + sectorsAllocated);
                var endOfFileOffset = fileBuffer[fileDescriptorRecord + 0x10];
                // this.log.info("EOF offset: " + endOfFileOffset);
                var recordLength = fileBuffer[fileDescriptorRecord + 0x11];
                // this.log.info("Logical record length: " + recordLength);
                var fileLength = fileType == TI_FILE.FILE_TYPE_PROGRAM ? (sectorsAllocated - 1) * 256 + (endOfFileOffset == 0 ? 256 : endOfFileOffset) : recordLength * sectorsAllocated * recordsPerSector;
                this.log.info(
                    (fileType == TI_FILE.FILE_TYPE_DATA ? "DATA" : "PROGRAM") + ": " +
                    (fileType == TI_FILE.FILE_TYPE_DATA ?
                        (datatype == TI_FILE.DATATYPE_DISPLAY ? "DISPLAY" : "INTERNAL") + ", " +
                        (recordType == TI_FILE.RECORD_TYPE_FIXED ? "FIXED" : "VARIABLE") + ", " +
                        recordLength + ", "
                        : ""
                    ) + "file length = " + fileLength
                );
                var diskFile;
                if (fileType == TI_FILE.FILE_TYPE_DATA) {
                    diskFile = new DiskFile(fileName, fileType, recordType, recordLength, datatype);
                }
                else {
                    diskFile = new DiskFile(fileName, fileType, 0, 0, 0);
                }
                diskFile.open(TI_FILE.OPERATION_MODE_OUTPUT, TI_FILE.ACCESS_TYPE_SEQUENTIAL);
                var program = [];
                var sectorsLeft = sectorsAllocated;
                var nLast = -1;
                for (var dataChainPointerIndex = 0; dataChainPointerIndex < 0x4C; dataChainPointerIndex++) {
                    var dataChainPointer = fileDescriptorRecord + 0x1C + 3 * dataChainPointerIndex;
                    var m = ((fileBuffer[dataChainPointer + 1] & 0x0F) << 8) | fileBuffer[dataChainPointer];
                    var n = (fileBuffer[dataChainPointer + 2] << 4) | ((fileBuffer[dataChainPointer + 1] & 0xF0) >> 4);
                    if (m != 0) {
                        // this.log.info("Data chain pointer index " + dataChainPointerIndex);
                        if (totalSectors > 1600) {
                            // For high capacity disks (> 1600 sectors) multiply by sectors/AU
                            m *= 2;
                        }
                        var startSector = m;
                        var endSector = m + n - (nLast + 1);
                        // this.log.info("Sectors " + startSector + " to " + endSector);
                        nLast = n;
                        for (var sector = startSector; sector <= endSector; sector++) {
                            sectorsLeft--;
                            if (fileType == TI_FILE.FILE_TYPE_DATA) {
                                // Data
                                if (recordType == TI_FILE.RECORD_TYPE_FIXED) {
                                    for (var record = 0; record < recordsPerSector; record++) {
                                        var data = [];
                                        for (i = 0; i < recordLength; i++) {
                                            data.push(fileBuffer[sector * 256 + record * recordLength + i]);
                                        }
                                        diskFile.putRecord(new FixedRecord(data, recordLength));
                                    }
                                }
                                else {
                                    i = sector * 256;
                                    recordLength = fileBuffer[i++];
                                    // TODO: Correct to stop loading if recordLength is zero?
                                    while (recordLength != 0xFF && recordLength != 0) {
                                        data = [];
                                        for (var j = 0; j < recordLength; j++) {
                                            data[j] = fileBuffer[i++];
                                        }
                                        diskFile.putRecord(new VariableRecord(data));
                                        recordLength = fileBuffer[i++];
                                    }
                                    if (recordLength == 0) {
                                        this.log.info("Missing EOF marker.");
                                    }
                                }
                            }
                            else {
                                // Program
                                for (i = 0; i < ((sectorsLeft > 0 || endOfFileOffset == 0) ? 256 : endOfFileOffset); i++) {
                                    program.push(fileBuffer[sector * 256 + i]);
                                }
                            }
                        }
                    }
                }
                diskFile.close();
                if (fileType == TI_FILE.FILE_TYPE_PROGRAM) {
                    diskFile.setProgram(program);
                }
                diskImage.putFile(diskFile);
            }
        }
        this.setDiskImage(diskImage);
        diskImage.setBinaryImage(fileBuffer);
        return diskImage;
    },

    getState: function () {
        return {
            name: this.name,
            diskImage: this.diskImage != null ? this.diskImage.getName() : null
        };
    },

    setRAM: function (ram) {
        this.ram = ram;
    }
};

function DiskImage(name) {
    this.name = name;
    this.files = {};
    this.binaryImage = null;
    this.log = Log.getLog();
}

DiskImage.prototype = {

    getName: function () {
        return this.name;
    },

    getFiles: function () {
        return this.files;
    },

    getFilesArray: function () {
        var filesArray = [];
        for (var fileName in this.files) {
            if (this.files.hasOwnProperty(fileName)) {
                filesArray.push(this.files[fileName]);
            }
        }
        return filesArray;
    },

    putFile: function (file) {
        this.files[file.getName()] = file;
        this.setBinaryImage(null); // Invalidate binary image on write
    },

    getFile: function (fileName) {
        return this.files[fileName];
    },

    deleteFile: function (fileName) {
        delete this.files[fileName];
        this.setBinaryImage(null); // Invalidate binary image on write
    },

    loadTIFile: function (fileName, fileBuffer, ignoreTIFileName) {
        if (fileBuffer != null && fileBuffer.length > 0x80) {
            var sectors;
            var flags;
            var recsPerSector;
            var eofOffset;
            var recordLength;
            var recordType;
            var datatype;
            var fileType;
            var fileLength;
            var sectorOffset;
            var pcFormat = false;
            var id = "";
            for (var i = 1; i < 8; i++) {
                id += String.fromCharCode(fileBuffer[i]);
            }
            if (fileBuffer[0] == 0x07 && id == "TIFILES") {
                var tiFileName = "";
                if (!ignoreTIFileName && fileBuffer[0x10] != 0xCA) {
                    for (i = 0x10; i < 0x1A; i++) {
                        if (fileBuffer[i] >= 32 && fileBuffer[i] < 128) {
                            tiFileName += String.fromCharCode(fileBuffer[i]);
                        }
                    }
                    tiFileName = tiFileName.trim();
                }
                if (tiFileName.length > 0) {
                    this.log.info("TI name is '" + tiFileName + "'.");
                }
                else {
                    for (i = 0; i < fileName.length; i++) {
                        if (fileName.charAt(i).match(/[0-9A-Za-z_\-]/) && tiFileName.length < 10) {
                            tiFileName += fileName.charAt(i);
                        }
                    }
                }
                sectors = fileBuffer[0x8] << 8 | fileBuffer[0x9];
                flags = fileBuffer[0xA];
                recsPerSector = fileBuffer[0xB];
                eofOffset = fileBuffer[0xC];
                recordLength = fileBuffer[0xD];
                recordType = (flags & 0x80) >> 7;
                datatype = (flags & 0x02) >> 1;
                fileType = (flags & 0x01);
                fileLength = sectors * 256  - (eofOffset > 0 ? 256 - eofOffset : 0);
                sectorOffset = 0x80;
            }
            else if ((String.fromCharCode(fileBuffer[0]) + id).trim().toUpperCase() == fileName.substr(0, 8).trim().toUpperCase()) {
                tiFileName = "";
                for (i = 0; i < 10; i++) {
                    if (fileBuffer[i] >= 32 && fileBuffer[i] < 128) {
                        tiFileName += String.fromCharCode(fileBuffer[i]);
                    }
                }
                tiFileName = tiFileName.trim();
                this.log.info(fileName + " looks like a V9T9 file.");
                flags = fileBuffer[0x0C];
                recordType = (flags & 0x80) >> 7;
                datatype = (flags & 0x02) >> 1;
                fileType = (flags & 0x01);
                recsPerSector = fileBuffer[0x0D];
                sectors = (fileBuffer[0x0E] << 8) + fileBuffer[0x0F];
                eofOffset = fileBuffer[0x10];
                recordLength = fileBuffer[0x11];
                fileLength = sectors * 256  - (eofOffset > 0 ? 256 - eofOffset : 0);
                sectorOffset = 0x80;
            }
            else {
                this.log.warn(fileName + " is not in TIFILES or V9T9 format. Assuming D/F 80.");
                tiFileName = "";
                for (i = 0; i < fileName.length; i++) {
                    if (fileName.charAt(i).match(/[0-9A-Za-z_\-]/) && fileName.length < 10) {
                        tiFileName += fileName.charAt(i);
                    }
                }
                recordType = TI_FILE.RECORD_TYPE_FIXED;
                datatype = TI_FILE.DATATYPE_DISPLAY;
                fileType = TI_FILE.FILE_TYPE_DATA;
                recsPerSector = 3;
                sectors = Math.floor(fileBuffer.length / 256);
                recordLength = 80;
                fileLength = fileBuffer.length;
                sectorOffset = 0;
                pcFormat = true;
            }
            this.log.info("Loading '" + fileName + "' to " + this.name + " ...");
            this.log.info(
                (fileType == TI_FILE.FILE_TYPE_DATA ? "DATA" : "PROGRAM") + ": " +
                (fileType == TI_FILE.FILE_TYPE_DATA ?
                    (datatype == TI_FILE.DATATYPE_DISPLAY ? "DISPLAY" : "INTERNAL") + ", " +
                    (recordType == TI_FILE.RECORD_TYPE_FIXED ? "FIXED" : "VARIABLE") + ", " +
                    recordLength + ", "
                    : ""
                ) + "file length = " + fileLength
            );
            this.log.info();
            if (fileBuffer.length >= sectorOffset + fileLength) {
                var file;
                if (fileType == TI_FILE.FILE_TYPE_DATA) {
                    file = new DiskFile(tiFileName, fileType, recordType, recordLength, datatype);
                    file.open(TI_FILE.OPERATION_MODE_OUTPUT, TI_FILE.ACCESS_TYPE_SEQUENTIAL);
                    var sector, rec, data;
                    if (recordType == TI_FILE.RECORD_TYPE_FIXED) {
                        if (!pcFormat) {
                            for (sector = 0; sector < sectors; sector++) {
                                for (rec = 0; rec < recsPerSector; rec++) {
                                    if (sector * 256 + rec * recordLength < fileLength) {
                                        data = [];
                                        for (i = 0; i < recordLength; i++) {
                                            data[i] = fileBuffer[sectorOffset + sector * 256 + rec * recordLength + i];
                                        }
                                        file.putRecord(new FixedRecord(data, recordLength));
                                    }
                                }
                            }
                        }
                        else {
                            data = [];
                            i = 0;
                            while (i < fileBuffer.length) {
                                data.push(fileBuffer[i++]);
                                if (data.length == recordLength) {
                                    file.putRecord(new FixedRecord(data, recordLength));
                                    data = [];
                                    if (fileBuffer[i] == 0xd || fileBuffer[i + 1] == 0xa) {
                                        i += 2;
                                    }
                                }
                            }
                            if (data.length > 0) {
                                file.putRecord(new FixedRecord(data, recordLength));
                            }
                        }
                    }
                    else {
                        this.log.info("Sectors=" + sectors);
                        for (sector = 0; sector < sectors; sector++) {
                            i = sectorOffset + sector * 256;
                            var sectorBytesLeft = 256;
                            recordLength = fileBuffer[i++];
                            sectorBytesLeft--;
                            while (recordLength != 0xFF && sectorBytesLeft > 0) {
                                data = [];
                                for (var j = 0; j < recordLength && sectorBytesLeft > 0; j++) {
                                    data[j] = fileBuffer[i++];
                                    sectorBytesLeft--;
                                }
                                file.putRecord(new VariableRecord(data));
                                if (sectorBytesLeft > 0) {
                                    recordLength = fileBuffer[i++];
                                    sectorBytesLeft--;
                                }
                                else {
                                    recordLength = 0xFF;
                                }
                            }
                        }
                        this.log.info(file.getRecordCount() + " records read.");
                    }
                    file.close();
                }
                else {
                    file = new DiskFile(tiFileName, fileType, 0, 0, 0);
                    var program = [];
                    for (i = 0; i < fileLength; i++) {
                        program[i] = fileBuffer[sectorOffset + i];
                    }
                    file.setProgram(program);
                }
                this.putFile(file);
                this.setBinaryImage(null); // Invalidate binary image on write
                return file;
            }
            else {
                this.log.error(fileName + " is too short.");
                return null;
            }
        }
        this.log.warn(fileName + " is not in TIFILES format.");
        return null;
    },

    saveTIFile: function (fileName) {
        var file = this.getFile(fileName);
        if (file != null) {
            var data = [];
            var n = 0;
            // ID
            n = this.writeByte(data, n, 0x07);
            n = this.writeString(data, n, "TIFILES");
            // Total number of sectors
            n = this.writeWord(data, n, file.getSectorCount());
            // Flags
            n = this.writeByte(data, n, (file.getRecordType() << 7) | (file.getDatatype() << 1) | file.getFileType());
            // #Rec/sect
            n = this.writeByte(data, n, file.getFileType() == TI_FILE.FILE_TYPE_DATA && file.getRecordLength() > 0 ? Math.floor(256 / (file.getRecordLength() + (file.getRecordType() == TI_FILE.RECORD_TYPE_VARIABLE ? 1 : 0))) : 0);
            // EOF offset
            n = this.writeByte(data, n, file.getEOFOffset());
            // Record length
            n = this.writeByte(data, n, file.getRecordLength());
            // #Level 3 records
            n = this.writeLEWord(data, n, file.getFileType() == TI_FILE.FILE_TYPE_DATA ? (file.getRecordType() == TI_FILE.RECORD_TYPE_FIXED ? file.getRecordCount() : file.getSectorCount()) : 0);
            // File name
            n = this.writeString(data, n, fileName, 10);
            // Padding
            for (; n < 128; n++) {
                data[n] = 0;
            }
            // Content
            if (file.getFileType() == TI_FILE.FILE_TYPE_DATA) {
                var records = file.getRecords();
                var recordCount = file.getRecordCount();
                var recData;
                if (file.getRecordType() == TI_FILE.RECORD_TYPE_FIXED) {
                    var recordPerSector = Math.floor(256 / file.getRecordLength());
                    var recCnt = 0;
                    for (i = 0; i < recordCount; i++) {
                        recData = records[i].getData();
                        for (var j = 0; j < recData.length; j++) {
                            n = this.writeByte(data, n, recData[j]);
                        }
                        recCnt++;
                        if (recCnt == recordPerSector) {
                            while ((n & 0xFF) != 0) {
                                n = this.writeByte(data, n, 0);
                            }
                            recCnt = 0;
                        }
                    }
                }
                else {
                    var sectorBytesLeft = 256;
                    for (i = 0; i < recordCount; i++) {
                        recData = records[i].getData();
                        if (sectorBytesLeft <= recData.length) {
                            if (sectorBytesLeft > 0) {
                                n = this.writeByte(data, n, 0xFF);
                                sectorBytesLeft--;
                                while (sectorBytesLeft > 0) {
                                    n = this.writeByte(data, n, 0);
                                    sectorBytesLeft--;
                                }
                            }
                            sectorBytesLeft = 256;
                        }
                        n = this.writeByte(data, n, recData.length);
                        sectorBytesLeft--;
                        for (j = 0; j < recData.length; j++) {
                            n = this.writeByte(data, n, recData[j]);
                            sectorBytesLeft--;
                        }
                    }
                    if (sectorBytesLeft > 0) {
                        n = this.writeByte(data, n, 0xFF);
                        sectorBytesLeft--;
                        while (sectorBytesLeft > 0) {
                            n = this.writeByte(data, n, 0);
                            sectorBytesLeft--;
                        }
                    }
                    this.log.info(recordCount + " records written.");
                }
            }
            else {
                var program = file.getProgram();
                for (var i = 0; i < program.length; i++, n++) {
                    data[n] = program[i];
                }
            }
            return new Uint8Array(data);
        }
        else {
            return null;
        }
    },

    readSector: function (sectorNo) {
        var sector = new Uint8Array(256);
        var tiDiskImage = this.getBinaryImage();
        var sectorOffset = 256 * sectorNo;
        for (var i = 0; i < 256; i++) {
            sector[i] = tiDiskImage[sectorOffset + i];
        }
        return sector;
    },

    getBinaryImage: function () {
        if (this.binaryImage == null) {
            this.binaryImage = this.createBinaryImage();
        }
        return this.binaryImage;
    },

    setBinaryImage: function (binaryImage) {
        this.binaryImage = binaryImage;
    },

    createBinaryImage: function () {
        var n, i, j;
        var dskImg = new Uint8Array(1440 * 256);
        // Volume Information Block
        n = 0;
        n = this.writeString(dskImg, n, this.name, 10); // Volume name
        n = this.writeWord(dskImg, n, 1440); // Total sectors
        n = this.writeByte(dskImg, n, 18); // Sectors per track
        n = this.writeString(dskImg, n, "DSK", 3); // ID
        n = this.writeByte(dskImg, n, 0x20); // Protection
        n = this.writeByte(dskImg, n, 40); // Tracks per side
        n = this.writeByte(dskImg, n, 2); // Number of sides
        n = this.writeByte(dskImg, n, 2); // Density
        // Allocation bit map
        this.writeByte(dskImg, 0x38, 0x03); // Reserve sectors 0 and 1
        for (i = 0xEC; i <= 0xFF; i++) { // Unused map entries
            dskImg[i] = 0xFF;
        }
        var files = this.getFilesArray();
        var fileCount = Math.min(files.length, 127);
        var nextDataSectorNo = 2 + fileCount;
        for (var f = 0; f < fileCount; f++) {
            var file = files[f];
            // File Descriptor Index Record
            this.writeWord(dskImg, 256 + 2 * f, 2 + f);
            // File Descriptor Record
            var fileDescriptorAddr = (2 + f) * 256;
            n = fileDescriptorAddr;
            // Name
            n = this.writeString(dskImg, n, file.getName(), 10);
            // Extended record length
            n = this.writeWord(dskImg, n, 0);
            // Status flags
            n = this.writeByte(dskImg, n, (file.getRecordType() << 7) | (file.getDatatype() << 1) | file.getFileType());
            // Records per sector
            n = this.writeByte(dskImg, n, file.getFileType() == TI_FILE.FILE_TYPE_DATA ? Math.floor(256 / (file.getRecordLength() + (file.getRecordType() == TI_FILE.RECORD_TYPE_VARIABLE ? 1 : 0))) : 0);
            // Sectors allocated
            n = this.writeWord(dskImg, n, file.getSectorCount());
            // End of file offset
            n = this.writeByte(dskImg, n, file.getEOFOffset());
            // Record length
            n = this.writeByte(dskImg, n, file.getFileType() == TI_FILE.FILE_TYPE_DATA ? file.getRecordLength() : 0);
            // Number of level 3 records
            n = this.writeLEWord(dskImg, n, file.getFileType() == TI_FILE.FILE_TYPE_DATA ? (file.getRecordType() == TI_FILE.RECORD_TYPE_FIXED ? file.getRecordCount() : file.getSectorCount()) : 0);
            // Data sectors
            var startSectorNo = nextDataSectorNo;
            var sectorNo = startSectorNo;
            n = sectorNo * 256;
            if (file.getFileType() == TI_FILE.FILE_TYPE_DATA) {
                var records = file.getRecords();
                var recordCount = file.getRecordCount();
                var data;
                if (file.getRecordType() == TI_FILE.RECORD_TYPE_FIXED) {
                    var recordPerSector = Math.floor(256 / file.getRecordLength());
                    var recCnt = 0;
                    for (i = 0; i < recordCount; i++) {
                        data = records[i].getData();
                        for (j = 0; j < data.length; j++) {
                            n = this.writeByte(dskImg, n, data[j]);
                        }
                        recCnt++;
                        if (recCnt == recordPerSector) {
                            sectorNo++;
                            n = sectorNo * 256;
                            recCnt = 0;
                        }
                    }
                    if (recCnt == 0) {
                        sectorNo--;
                    }
                }
                else {
                    var sectorBytesLeft = 256;
                    for (i = 0; i < recordCount; i++) {
                        data = records[i].getData();
                        if (sectorBytesLeft <= data.length) {
                            if (sectorBytesLeft > 0) {
                                n = this.writeByte(dskImg, n, 0xFF);
                                sectorBytesLeft--;
                                while (sectorBytesLeft > 0) {
                                    n = this.writeByte(dskImg, n, 0);
                                    sectorBytesLeft--;
                                }
                            }
                            sectorNo++;
                            n = sectorNo * 256;
                            sectorBytesLeft = 256;
                        }
                        n = this.writeByte(dskImg, n, data.length);
                        sectorBytesLeft--;
                        for (j = 0; j < data.length; j++) {
                            n = this.writeByte(dskImg, n, data[j]);
                            sectorBytesLeft--;
                        }
                    }
                    if (sectorBytesLeft > 0) {
                        n = this.writeByte(dskImg, n, 0xFF);
                        sectorBytesLeft--;
                        while (sectorBytesLeft > 0) {
                            n = this.writeByte(dskImg, n, 0);
                            sectorBytesLeft--;
                        }
                    }
                    if (sectorBytesLeft == 256) {
                        sectorNo--;
                    }
                }
            }
            else {
                // Program
                var program = file.getProgram();
                for (i = 0; i < program.length; i++) {
                    n = this.writeByte(dskImg, n, program[i]);
                }
                sectorNo += Math.floor(program.length / 256) - (program.length % 256 == 0 ? 1 : 0);
            }
            nextDataSectorNo = sectorNo + 1;
            // Data chain pointer block
            var sectorCount = sectorNo - startSectorNo;
            n = fileDescriptorAddr + 0x1C;
            n = this.writeByte(dskImg, n, startSectorNo & 0x00FF);
            n = this.writeByte(dskImg, n, ((sectorCount & 0x000F) << 4) | ((startSectorNo & 0x0F00) >> 8));
            n = this.writeByte(dskImg, n, (sectorCount & 0x0FF0) >> 4);
            // Allocation bit map
            for (i = startSectorNo; i <= sectorNo; i++) {
                dskImg[0x38 + (i >> 3)] |= (1 << (i & 7));
            }
			dskImg[0x38 + ((f + 2) >> 3)] |= (1 << ((f + 2) & 7));
        }
        return dskImg;
    },

    writeString: function (data, n, str, padLen) {
        for (var i = 0; i < str.length; i++) {
            data[n++] = str.charCodeAt(i);
        }
        for (i = 0; i < padLen - str.length; i++) {
            data[n++] = 0x20;
        }
        return n;
    },

    writeByte: function (data, n, b) {
        data[n++] = b & 0x00FF;
        return n;
    },

    writeWord: function (data, n, w) {
        data[n++] = (w & 0xFF00) >> 8;
        data[n++] = w & 0x00FF;
        return n;
    },

    writeLEWord: function (data, n, w) {
        data[n++] = w & 0x00FF;
        data[n++] = (w & 0xFF00) >> 8;
        return n;
    },

    getState: function () {
        var files = {};
        for (var fileName in this.files) {
            if (this.files.hasOwnProperty(fileName)) {
                files[fileName] = this.files[fileName].getState();
            }
        }
        return {
            name: this.name,
            files: files
        };
    },

    setState: function (state) {
        this.name = state.name;
        var files = {};
        for (var fileName in state.files) {
            if (state.files.hasOwnProperty(fileName)) {
                var file = new DiskFile(fileName);
                file.setState(state.files[fileName]);
                files[fileName] = file;
            }
        }
        this.files = files;
    }
};

function DiskFile(name, fileType, recordType, recordLength, datatype) {
    this.name = name;
    this.fileType = fileType;
    this.recordType = recordType;
    this.recordLength = recordLength;
    this.datatype = datatype;
    this.operationMode = -1;
    this.recordPointer = -1;
    this.records = [];
    this.program = null;
}

DiskFile.prototype = {

    getName: function () {
        return this.name;
    },

    getFileType: function () {
        return this.fileType;
    },

    getRecordType: function () {
        return this.recordType;
    },

    getRecordLength: function () {
        return this.recordLength;
    },

    getSectorCount: function () {
        var sectors = 0;
        if (this.getFileType() == TI_FILE.FILE_TYPE_DATA) {
            if (this.getRecordType() == TI_FILE.RECORD_TYPE_FIXED) {
                var recsPerSector = Math.floor(256 / this.recordLength);
                sectors = Math.floor(this.records.length / recsPerSector) + (this.records.length % recsPerSector == 0 ? 0 : 1);
            }
            else {
                sectors = 1;
                var sectorBytesLeft = 256;
                for (var i = 0; i < this.records.length; i++) {
                    var recordSize = this.records[i].getData().length + 1;
                    if (sectorBytesLeft >= recordSize) {
                        sectorBytesLeft -= recordSize;
                    }
                    else {
                        sectors++;
                        sectorBytesLeft = 256 - recordSize;
                    }
                }
            }
        }
        else {
            sectors = Math.floor((this.program.length) / 256) + (this.program.length % 256 == 0 ? 0 : 1);
        }
        return sectors;
    },

    getEOFOffset: function () {
        var eofOffset = 0;
        if (this.getFileType() == TI_FILE.FILE_TYPE_DATA) {
            if (this.getRecordType() == TI_FILE.RECORD_TYPE_FIXED) {
                var recsPerSector = Math.floor(256 / this.recordLength);
                eofOffset = (this.getRecordCount() % recsPerSector) * this.recordLength;
            }
            else {
                var sectorBytesLeft = 256;
                for (var i = 0; i < this.records.length; i++) {
                    var recordSize = this.records[i].getData().length + 1;
                    if (sectorBytesLeft >= recordSize) {
                        sectorBytesLeft -= recordSize;
                    }
                    else {
                        sectorBytesLeft = 256 - recordSize;
                    }
                }
                eofOffset = 256 - sectorBytesLeft;
            }
        }
        else {
            eofOffset = this.program.length % 256;
        }
        return eofOffset;
    },

    getFileSize: function () {
        if (this.fileType == TI_FILE.FILE_TYPE_DATA) {
            if (this.recordType == TI_FILE.RECORD_TYPE_FIXED) {
                return this.recordLength * this.records.length;
            }
            else {
                var length = 0;
                for (var i = 0; i < this.records.length; i++) {
                    length += this.records[i].getData().length + 1;
                }
                return length;
            }
        }
        else {
            return this.program.length;
        }
    },

    getDatatype: function () {
        return this.datatype;
    },

    getOperationMode: function () {
        return this.operationMode;
    },

    getAccessType: function () {
        return this.accessType;
    },

    getRecordPointer: function () {
        return this.recordPointer;
    },

    setRecordPointer: function (recordPointer) {
        this.recordPointer = recordPointer;
    },

    rewind: function () {
        this.recordPointer = 0;
    },

	open: function (operationMode, accessType) {
		this.operationMode = operationMode;
		this.recordPointer = 0;
		this.accessType = accessType;
	},
	
    getRecord: function () {
        return this.records[this.recordPointer++];
    },

    putRecord: function (record) {
        return this.records[this.recordPointer++] = record;
    },

    deleteRecord: function () {
        delete this.records[this.recordPointer];
    },

    setProgram: function (program) {
        this.program = program;
    },

    getProgram: function () {
        return this.program;
    },

	close: function () {
		this.operationMode = -1;
		this.recordPointer = -1;
	},

    getRecords: function () {
        return this.records;
    },

    getRecordCount: function () {
        return this.records.length;
    },

    isEOF: function () {
        return this.recordPointer >= this.getRecordCount();
    },

    getState: function () {
        if (this.fileType == TI_FILE.FILE_TYPE_DATA) {
            var records = [];
            for (var i = 0; i < this.records.length; i++) {
                records[i] = this.records[i].getState();
            }
            return {
                name: this.name,
                fileType: this.fileType,
                recordType: this.recordType,
                recordLength: this.recordLength,
                datatype: this.datatype,
                records: records

            };
        }
        else {
            return {
                name: this.name,
                fileType: this.fileType,
                program: this.program
            };
        }
    },

    setState: function (state) {
        this.name = state.name;
        this.fileType = state.fileType;
        if (state.fileType == TI_FILE.FILE_TYPE_DATA) {
            this.recordType = state.recordType;
            this.recordLength = state.recordLength;
            this.datatype = state.datatype;
            var records = [];
            for (var i = 0; i < state.records.length; i++) {
                var record;
                if (this.recordType == TI_FILE.RECORD_TYPE_FIXED) {
                    record = new FixedRecord();
                }
                else {
                    record = new VariableRecord(state.records[i].data);
                }
                record.setState(state.records[i]);
                records[i] = record;
            }
            this.records = records;
        }
        else {
            this.program = state.program;
            this.recordType = 0;
            this.recordLength = 0;
            this.datatype = 0;
        }
    },

    toString: function () {
        var s = "";
        var i;
        if (this.fileType == TI_FILE.FILE_TYPE_DATA) {
            for (i = 0; i < this.records.length; i++) {
                s += "Record " + i + ": ";
                var data = this.records[i].getData();
                for (var j = 0; j < data.length; j++) {
                    if (false && this.datatype == TI_FILE.DATATYPE_DISPLAY) {
                        s += String.fromCharCode(data[j]);
                    }
                    else {
                        s += data[j].toHexByteShort();
                    }
                }
                s += "\n";
            }
        }
        else {
            for (i = 0; i < this.program.length; i++) {
                if (i % 32 == 0) {
                    s += i.toHexWord() + " ";
                }
                s += this.program[i].toHexByteShort();
                if (i % 8 == 7) {
                    s += " ";
                }
                if (i % 32 == 31) {
                    s += "\n";
                }
            }
        }
        return s;
    }
};

function Record() {
    this.data = [];
}

Record.prototype = {

    getData: function () {
        return this.data;
    },

    getState: function () {
        return {
            data: this.data
        };
    },

    setState: function (state) {
        this.data = state.data;
    }
};

function FixedRecord(data, length) {

    Record.apply(this);

    var i;
    if (typeof(data) === "string") {
        for (i = 0; i < length; i++) {
            this.data[i] = data.length > i ? data.charCodeAt(i) : 0;
        }
    }
    else if (typeof(data) === "object") {
        for (i = 0; i < length; i++) {
            this.data[i] = data.length > i ? data[i] : 0;
        }
    }
}
FixedRecord.prototype = new Record();
FixedRecord.prototype.constructor = FixedRecord;

function VariableRecord(data) {

    Record.apply(this);

    if (typeof(data) === "string") {
        for (var i = 0; i < data.length; i++) {
            this.data[i] = data.charCodeAt(i);
        }
    }
    else if (typeof(data) === "object") {
        this.data = data;
    }
}
VariableRecord.prototype = new Record();
VariableRecord.prototype.constructor = VariableRecord;
