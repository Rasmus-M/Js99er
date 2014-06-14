/**
 * TOYOSHIMA-HOUSE Library for JavaScript
 */

/**
 * Log prototype
 *
 * This prototype provide common log interfaces.
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 *
 */

/**
 * Log prototype function. This prototype provide three kinds of Log
 * mechanisms. User can specify its type by id argument.
 * @param id Log type
 *     undefined: Use native console.log if it's available.
 *     null: Eliminate all logs.
 *     <string>: Output as pre element under DOM object which has <string> id.
 * @param reverse logging order
 *     true: Newer logs will be added to tail.
 *     false: Newer logs will be added to head.
 */
function Log (id, reverse, buffered) {
    this.lastLevel = "";
    this.reverse = reverse;
	
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
		else if (buffered) {
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
		else {
			this.print = function (object) {
				var element;
				if (object instanceof Object) {
					element = document.createElement('pre');
					var text = object.toString();
					var textNode = document.createTextNode(text);
					element.appendChild(textNode);
					var title = "";
					for (var item in object) {
						title += item + ":" + object[item] + "; \n";
					}
					element.setAttribute('title', title);
				} else {
					element = document.createTextNode(object + "\n");
				}
				if (this.reverse && this.framePre.firstChild) {
					this.framePre.insertBefore(element, this.framePre.firstChild);
				}
				else {
					this.framePre.appendChild(element);
					this.framePre.scrollTop = this.framePre.scrollHeight;
				}
			};
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
        Log.log = new Log("log", false, true);
    }
    return Log.log;
};

/**
 * Log fatal message.
 * @param message fatal message
 */
Log.prototype.fatal = function (message) {
//    if (this.LastLevel != "FATAL") {
//        this.LastLevel = "FATAL";
//        this.print("*FATAL*");
//    }
    this.print(message);
};

/**
 * Log error message.
 * @param message error message
 */
Log.prototype.error = function (message) {
//    if (this.LastLevel != "ERROR") {
//        this.LastLevel = "ERROR";
//        this.print("*ERROR*");
//    }
    this.print(message);
};

/**
 * Log warning message.
 * @param message warning message
 */
Log.prototype.warn = function (message) {
//    if (this.LastLevel != "WARN") {
//        this.LastLevel = "WARN";
//        this.print("*WARN*");
//    }
    this.print(message);
};

/**
 * Log information message.
 * @param message information message
 */
Log.prototype.info = function (message) {
//    if (this.LastLevel != "INFO") {
//        this.LastLevel = "INFO";
//        this.print("*INFO*");
//    }
    this.print(message);
};
