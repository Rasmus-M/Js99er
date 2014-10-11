/*
 * js99'er - TI-99/4A emulator written in JavaScript
 *
 * Created 2014 by Rasmus Moustgaard <rasmus.moustgaard@gmail.com>
 */

function Log(id) {

    this.debugEnabled = false;

	this.buffer = "";
	this.bufferCount = 0;
	this.bufferSize = 20;

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
 * Log error message.
 * @param message error message
 */
Log.prototype.error = function (message) {
    alert(message);
};

/**
 * Log warning message.
 * @param message warning message
 */
Log.prototype.warn = function (message) {
    this.print("*** Warning *** " + message);
};

/**
 * Log information message.
 * @param message information message
 */
Log.prototype.info = function (message) {
    this.print(message);
};

/**
 * Log debug message.
 * @param message fatal message
 */
Log.prototype.debug = function (message) {
    if (this.debugEnabled) {
        this.print("Debug: " + message);
    }
};

