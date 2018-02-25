/*
 * js99'er - TI-99/4A emulator written in JavaScript
 *
 * Created 2014 by Rasmus Moustgaard <rasmus.moustgaard@gmail.com>
*/

function Joystick(column, index) {
    this.column = column;
    this.index = index;
    window.addEventListener("gamepadconnected", this.gamepadConnected);
    window.addEventListener("gamepaddisconnected", this.gamepadDisconnected);
    window.setInterval(this.update.bind(this), 17);
    this.log = Log.getLog();
}

Joystick.prototype.gamepadConnected = function (e) {
    if (this.index === null || !navigator.getGamepads()[this.index]) {
        var gamepad = e.gamepad;
        if (gamepad.id.toLowerCase().indexOf("unknown") === -1) {
            this.index = gamepad.index;
            this.log.info("Gamepad connected, index = " + this.index);
        }
    }
};

Joystick.prototype.gamepadDisconnected = function (e) {
    var gamepad = e.gamepad;
    if (gamepad.index === this.index) {
        this.log.info("Gamepad disconnected, index = " + this.index);
        this.index = null;
    }
};

Joystick.prototype.update = function () {
    if (this.index !== null) {
        var gamepad = navigator.getGamepads()[this.index];
        if (gamepad && gamepad.connected) {
            this.column[3] = gamepad.buttons[0].pressed;
            var axis0 = gamepad.axes[0];
            this.column[4] = axis0 < -0.1;      // Left
            this.column[5] = axis0 > 0.1;       // Right
            var axis1 = gamepad.axes[1];
            this.column[6] = axis1 > 0.1;       // Down
            this.column[7] = axis1 < -0.1;      // Up
        }
    }
};

Joystick.prototype.getState = function () {
    return {
        column: this.column
    };
};

Joystick.prototype.restoreState = function (state) {
    this.column = state.column;
};