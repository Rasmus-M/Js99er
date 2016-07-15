/*
 * js99'er - TI-99/4A emulator written in JavaScript
 *
 * Created 2014 by Rasmus Moustgaard <rasmus.moustgaard@gmail.com>
 */

 "use strict";
 
Database.NAME = "js99er";
Database.VERSION = 2;
Database.DISK_DRIVES_STORE = "diskDrives";
Database.DISK_IMAGES_STORE = "diskImages";
Database.BINARY_FILE_STORE = "binaryFiles";

function Database(callback) {

	this.db = null;
    this.supported = false;
	this.log = Log.getLog();
	
	this.supported = this.open(callback);
}

Database.prototype = {

	open: function (callback) {
        var that = this;
        if (window.indexedDB) {
            var request = indexedDB.open(Database.NAME, Database.VERSION);

            request.onupgradeneeded = function (e) {
                // Only called when Database.VERSION changes

                var db = e.target.result;

                e.target.transaction.onerror = function (e) {
                    that.log.error(e.value);
                };

                if (!db.objectStoreNames.contains(Database.DISK_DRIVES_STORE)) {
                    db.createObjectStore(Database.DISK_DRIVES_STORE, { keyPath: "name" });
                }
                if (!db.objectStoreNames.contains(Database.DISK_IMAGES_STORE)) {
                    db.createObjectStore(Database.DISK_IMAGES_STORE, { keyPath: "name" });
                }
                if (db.objectStoreNames.contains(Database.BINARY_FILE_STORE)) {
                    db.deleteObjectStore(Database.BINARY_FILE_STORE);
                }
                db.createObjectStore(Database.BINARY_FILE_STORE, { keyPath: "name" });
            };

            request.onsuccess = function (e) {
                that.log.info("Database opened OK.");
                that.db = e.target.result;
                if (callback) callback(true);
            };

            request.onerror = function (e) {
                this.log.info("Database could not be opened.");
                that.log.error(e.value);
                that.db = null;
                if (callback) callback(false);
            };

            return true;
        }
        else {
            that.log.warn("IndexedDB not supported by this browser.");
            return false;
        }
    },

    isSupported: function () {
        return this.supported;
    },

	getDiskDrive: function (name, callback) {
		if (this.db != null && name != null) {
            var that = this;

            var trans = this.db.transaction([Database.DISK_DRIVES_STORE], "readonly");
			var store = trans.objectStore(Database.DISK_DRIVES_STORE);

			var request = store.get(name);

			request.onsuccess = function (e) {
                if (callback) callback(e.target.result);
			};

			request.onerror = function (e) {
				that.log.error(e.value);
                if (callback) callback(false);
			};
		}
        else {
            if (callback) callback(false);
        }
	},

	putDiskDrive: function (diskDrive, callback) {
		if (this.db != null) {
            var that = this;

            var trans = this.db.transaction([Database.DISK_DRIVES_STORE], "readwrite");
			var store = trans.objectStore(Database.DISK_DRIVES_STORE);

			var request = store.put(diskDrive.getState());

			request.onsuccess = function (e) {
                if (callback) callback(true);
			};

			request.onerror = function (e) {
				that.log.error(e.value);
                if (callback) callback(false);
			};
		}
        else {
            if (callback) callback(false);
        }
    },
	
	getDiskImages: function (callback) {
		if (this.db != null) {
            var that = this;

            var diskImages = {};
			var trans = this.db.transaction([Database.DISK_IMAGES_STORE], "readonly");
			var store = trans.objectStore(Database.DISK_IMAGES_STORE);

			// Get everything in the store;
			var cursorRequest = store.openCursor();

			cursorRequest.onsuccess = function (e) {
				var cursor = e.target.result;
				if (cursor) {
                    var state = cursor.value;
                    var diskImage = new DiskImage(state.name);
                    diskImage.setState(state);
					diskImages[state.name] = diskImage;

					cursor.continue();
				}
				else {
                    if (callback) callback(diskImages);
				}
			};
  
			cursorRequest.onerror = function (e) {
				that.log.error(e.value);
                if (callback) callback(false);
			};
		}
        else {
            if (callback) callback(false);
        }
    },

	getDiskImage: function (name, callback) {
		if (this.db != null && name != null) {
            var that = this;

            var trans = this.db.transaction([Database.DISK_IMAGES_STORE], "readonly");
			var store = trans.objectStore(Database.DISK_IMAGES_STORE);

			var request = store.get(name);

			request.onsuccess = function (e) {
                var state = e.target.result;
                var diskImage = new DiskImage(state.name);
                diskImage.setState(state);
                if (callback) callback(diskImage);
			};

			request.onerror = function (e) {
				that.log.error(e.value);
                if (callback) callback(false);
			};
		}
        else {
            if (callback) callback(false);
        }
    },

	putDiskImage: function (diskImage, callback) {
		if (this.db != null) {
            var that = this;

            var trans = this.db.transaction([Database.DISK_IMAGES_STORE], "readwrite");
			var store = trans.objectStore(Database.DISK_IMAGES_STORE);

			var request = store.put(diskImage.getState());

			request.onsuccess = function (e) {
                if (callback) callback(true);
			};

			request.onerror = function (e) {
				that.log.error(e.value);
				if (callback) callback(false);
			};
		}
        else {
            if (callback) callback(false);
        }
    },
	
	deleteDiskImage: function (name, callback) {
		if (this.db != null && name != null) {
            var that = this;

            var trans = this.db.transaction([Database.DISK_IMAGES_STORE], "readwrite");
			var store = trans.objectStore(Database.DISK_IMAGES_STORE);

			var request = store.delete(diskImage);

			request.onsuccess = function (e) {
                if (callback) callback(true);
			};

			request.onerror = function (e) {
				that.log.error(e.value);
                if (callback) callback(false);
			};
		}
        else {
            if (callback) callback(false);
        }
    },

    deleteAllDiskImages: function (callback) {
        if (this.db != null) {
            var that = this;

            var trans = this.db.transaction([Database.DISK_IMAGES_STORE], "readwrite");
            var store = trans.objectStore(Database.DISK_IMAGES_STORE);

            // Get everything in the store;
            var cursorRequest = store.openCursor();

            cursorRequest.onsuccess = function (e) {
                var cursor = e.target.result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                }
                else {
                    if (callback) callback(true);
                }
            };

            cursorRequest.onerror = function (e) {
                that.log.error(e.value);
                if (callback) callback(false);
            };
        }
        else {
            if (callback) callback(false);
        }
    },

    getBinaryFile: function (name, callback) {
        if (this.db != null && name != null) {
            var that = this;

            var trans = this.db.transaction([Database.BINARY_FILE_STORE], "readonly");
            var store = trans.objectStore(Database.BINARY_FILE_STORE);


            var request = store.get(name);

            request.onsuccess = function (e) {
                var obj = e.target.result;
                if (obj) {
                    if (callback) callback(obj.binaryFile);
                }
                else {
                    if (callback) callback(false);
                }
            };

            request.onerror = function (e) {
                that.log.error(e.value);
                if (callback) callback(false);
            };
        }
        else {
            if (callback) callback(false);
        }
    },

    putBinaryFile: function (name, binaryFile, callback) {
        if (this.db != null) {
            var that = this;

            var trans = this.db.transaction([Database.BINARY_FILE_STORE], "readwrite");
            var store = trans.objectStore(Database.BINARY_FILE_STORE);

            var request = store.put({name: name, binaryFile: binaryFile});

            request.onsuccess = function (e) {
                if (callback) callback(true);
            };

            request.onerror = function (e) {
                that.log.error(e.value);
                if (callback) callback(false);
            };
        }
        else {
            if (callback) callback(false);
        }
    }
};

