/*
 * js99'er - TI-99/4A emulator written in JavaScript
 *
 * Created 2014 by Rasmus Moustgaard <rasmus.moustgaard@gmail.com>
 */

function Log(id) {

    this.minLevel = Log.LEVEL_INFO;

	this.buffer = "";
	this.bufferCount = 0;
	this.bufferSize = 20;

    this.msgMap = {};

    // Set default log scheme.
    this.print = function (object) { /* Do nothing. */ };

    if (id == undefined) {
        // Try to use native console.
        if (console) {
            this.print = function (object) {
                console.log(object);
            }
        }
    } else if (id != null) {
        // Try to output under specified DOM object.
        this.framePre = typeof(document) === "object" ? document.getElementById(id) : null;
        if (this.framePre == null || this.framePre == undefined) {
            if (console) {
                this.print = function(object) {
                    console.log(object);
                };
            }
            return;
        }
		else {
			this.print = function(object) {
				if (object != null) {
					this.buffer += object + "\n";
					this.bufferCount++;
				}
				if (this.bufferCount >= this.bufferSize && this.buffer.length > 0) {
                    var buffer = this.buffer;
                    var framePre = this.framePre;
                    window.setTimeout(
                        function() {
                            framePre.appendChild(document.createTextNode(buffer));
                            framePre.scrollTop = framePre.scrollHeight;
                        },
                        10
                    );
                    this.buffer = "";
                    this.bufferCount = 0;
					this.framePre.appendChild(document.createTextNode(this.buffer));
					this.framePre.scrollTop = this.framePre.scrollHeight;
                    // this.framePre.innerHTML = this.buffer;
					this.buffer = "";
					this.bufferCount = 0;
				}
			};
			var that = this;
			setInterval(function() { that.flushBuffer() }, 1000);
		}
    }
	
	this.flushBuffer = function() {
		this.bufferCount = this.bufferSize;
		this.print(null);
	};
}

Log.LEVEL_DEBUG = 0;
Log.LEVEL_INFO = 1;
Log.LEVEL_WARNING = 2;
Log.LEVEL_ERROR = 3;
Log.LEVEL_NONE = 4;

Log.log = null;

/**
 * Set default log instance.
 * @param newLog Log instance to set
 */
Log.setLog = function (newLog) {
    Log.log = newLog;
};

/**
 * Get default log instance.
 * @return default Log instance
 */
Log.getLog = function () {
    if (Log.log == null) {
        Log.log = new Log("log");
    }
    return Log.log;
};


/**
 * Set minimum log level.
 * @param level Log level to set
 */
Log.prototype.setMinLevel = function(level) {
    this.minLevel = level;
};

/**
 * Log error message.
 * @param message error message
 */
Log.prototype.error = function (message) {
    if (Log.ERROR >= this.minLevel) {
        alert(message);
    }
};

/**
 * Log warning message.
 * @param message warning message
 */
Log.prototype.warn = function (message) {
    if (Log.LEVEL_WARNING >= this.minLevel) {
        this.print("*** Warning *** " + message);
    }
};

/**
 * Log information message.
 * @param message information message
 */
Log.prototype.info = function (message) {
    if (Log.LEVEL_INFO >= this.minLevel) {
        var count = this.msgMap[message];
        if (count == null) {
            count = 1;
        }
        else {
            count++;
        }
        this.msgMap[message] = count;
        if (count < 64) {
            this.print(message);
        }
        else if (count == 64 || (count & 255) == 0) {
            this.print(message + " (suppressing most messages)");
        }
    }
};

/**
 * Log debug message.
 * @param message fatal message
 */
Log.prototype.debug = function (message) {
    if (Log.LEVEL_DEBUG >= this.minLevel) {
        this.print("Debug: " + message);
    }
};
