/*
 * js99'er - TI-99/4A emulator written in JavaScript
 *
 * Created 2014 by Rasmus Moustgaard <rasmus.moustgaard@gmail.com>
*/

function Keyboard() {
    this.columns = new Array(9);
    this.joystickActive = 0;
    this.reset();
    this.log = Log.getLog();
}

Keyboard.prototype = {

    reset: function() {
        for (var col = 0; col < 8; col++) {
            this.columns[col] = [];
            for (var addr = 3; addr <= 10; addr++) {
                this.columns[col][addr] = false;
            }
        }
        this.alphaLock = true;
    },

    /*
     Column             0	    1	2	3	4	5	6	    7	    A-lock
     R12  addr	Pin #	12	    13	14	15	9	8	J1	    J2	    6
     >0006	3    5/J4	=	    .	,	M	N	/	Fire	Fire
     >0008	4    4/J5	Space	L	K	J	H	;	Left	Left
     >000A	5    1/J9	Enter	O	I	U	Y	P	Right	Right
     >000C	6    2/J8           9	8	7	6	0	Down	Down
     >000E	7    7/J3	Fctn	2	3	4	5	1	Up	    Up	    A-lock
     >0010	8    3	    Shift	S	D	F	G	A
     >0012	9    10	    Ctrl	W	E	R	T	Q
     >0014  10   11             X	C	V	B	Z
     */

    keyEvent: function(evt, down) {

        switch (evt.keyCode) {
            // Column 0
            case 187: // + -> =
                this.columns[0][3] = down;
                break;
            case 32: // Space
                this.columns[0][4] = down;
                break;
            case 13: // Enter
                this.columns[0][5] = down;
                break;
            case 18: // Alt -> Fctn
                this.columns[0][7] = down;
                break;
            case 16: // Shift
                this.columns[0][8] = down;
                break;
            case 17: // Ctrl
                this.columns[0][9] = down;
                break;
            // Column 1
            case 190: // .
                this.columns[1][3] = down;
                break;
            case 76: // L
                this.columns[1][4] = down;
                break;
            case 79: // O
                this.columns[1][5] = down;
                break;
            case 57: // 9
                this.columns[1][6] = down;
                break;
            case 50: // 2
                this.columns[1][7] = down;
                break;
            case 83: // S
                this.columns[1][8] = down;
                break;
            case 87: // W
                this.columns[1][9] = down;
                break;
            case 88: // X
                this.columns[1][10] = down;
                break;
            // Column 2
            case 188: // ,
                this.columns[2][3] = down;
                break;
            case 75: // K
                this.columns[2][4] = down;
                break;
            case 73: // I
                this.columns[2][5] = down;
                break;
            case 56: // 8
                this.columns[2][6] = down;
                break;
            case 51: // 3
                this.columns[2][7] = down;
                break;
            case 68: // D
                this.columns[2][8] = down;
                break;
            case 69: // E
                this.columns[2][9] = down;
                break;
            case 67: // C
                this.columns[2][10] = down;
                break;
            // Column 3
            case 77: // M
                this.columns[3][3] = down;
                break;
            case 74: // J
                this.columns[3][4] = down;
                break;
            case 85: // U
                this.columns[3][5] = down;
                break;
            case 55: // 7
                this.columns[3][6] = down;
                break;
            case 52: // 4
                this.columns[3][7] = down;
                break;
            case 70: // F
                this.columns[3][8] = down;
                break;
            case 82: // R
                this.columns[3][9] = down;
                break;
            case 86: // V
                this.columns[3][10] = down;
                break;
            // Column 4
            case 78: // N
                this.columns[4][3] = down;
                break;
            case 72: // H
                this.columns[4][4] = down;
                break;
            case 89: // Y
                this.columns[4][5] = down;
                break;
            case 54: // 6
                this.columns[4][6] = down;
                break;
            case 53: // 5
                this.columns[4][7] = down;
                break;
            case 71: // G
                this.columns[4][8] = down;
                break;
            case 84: // T
                this.columns[4][9] = down;
                break;
            case 66: // B
                this.columns[4][10] = down;
                break;
            // Column 5
            case 189: // - -> /
            case 191:
                this.columns[5][3] = down;
                break;
            case 186: // < -> ;
                this.columns[5][4] = down;
                break;
            case 80: // P
                this.columns[5][5] = down;
                break;
//            case 48: // 0
//                this.columns[5][6] = down;
//                break;
            case 49: // 1
                this.columns[5][7] = down;
                break;
            case 65: // A
                this.columns[5][8] = down;
                break;
            case 81: // Q
                this.columns[5][9] = down;
                break;
            case 90: // Z
                this.columns[5][10] = down;
                break;
            // Column 6
            case 9:  // Tab -> J1 Fire
                this.columns[6][3] = down;
                break;
            case 37:  // Left arrow -> J1 Left
                this.columns[6][4] = down;
                if (this.joystickActive == 0) {
                    // Left arrow
                    this.columns[0][7] = down; // Fctn
                    this.columns[1][8] = down; // S
                }
                break;
            case 39:  // Right arrow -> J1 Right
                this.columns[6][5] = down;
                if (this.joystickActive == 0) {
                    // Right arrow
                    this.columns[0][7] = down; // Fctn
                    this.columns[2][8] = down; // D
                }
                break;
            case 40:  // Down arrow -> J1 Down
                this.columns[6][6] = down;
                if (this.joystickActive == 0) {
                    // Down arrow
                    this.columns[0][7] = down; // Fctn
                    this.columns[1][10] = down; // X
                }
                break;
            case 38:  // Up arrow -> J1 Up
                this.columns[6][7] = down;
                if (this.joystickActive == 0) {
                    // Up arrow
                    this.columns[0][7] = down; // Fctn
                    this.columns[2][9] = down; // E
                }
                break;
            // Column 7
            case 20:  // Caps lock -> Alpha lock
                if (down) {
                    this.alphaLock = !this.alphaLock;
                }
                break;
            // Other
            case 8: // Backspace
                this.columns[0][7] = down; // Fctn
                this.columns[1][8] = down; // S
                break;
            case 46: // Delete
                this.columns[0][7] = down; // Fctn
                this.columns[5][7] = down; // 1
                break;
            case 27: // Escape
                this.columns[0][7] = down; // Fctn
                this.columns[1][6] = down; // 9
                break;
            case 219: // [
                this.columns[0][7] = down; // Fctn
                this.columns[3][9] = down; // R
                break;
            case 221: // ]
                this.columns[0][7] = down; // Fctn
                this.columns[4][9] = down; // T
                break;
            case 222: // "
                this.columns[0][7] = down; // Fctn
                this.columns[5][5] = down; // P
                break;
            default:
                return; //browser should handle key event
        }
        // Allow Ctrl + Shift + I (Developer console) or Ctrl + C (copy)
        if (!(this.columns[0][8] && this.columns[0][9] && this.columns[2][5]) && !(this.columns[0][9] && this.columns[2][10])) {
            // Else prevent normal browser handling
            evt.preventDefault();
        }
    },

    keyPressEvent: function(evt) {
        switch (evt.charCode) {
            case 61: // =
                this.columns[0][3] = true; // =/+
                this.columns[0][8] = false; // Shift up
                var that = this;
                window.setTimeout(function() {
                    that.columns[0][3] = false;
                }, 200);
                break;
            case 43: // +
                this.columns[0][3] = true; // =/+
                this.columns[0][8] = true; // Shift down
                var that = this;
                window.setTimeout(function() {
                    that.columns[0][3] = false;
                    that.columns[0][8] = false;
                }, 200);

                break;
        }
    },

    keyPress: function() {

    },

    isKeyDown: function(col, addr) {
        if (col == 6 && this.joystickActive == 0) {
            this.joystickActive = 128;
            this.columns[0][7] = false;  // Fctn
            this.columns[1][8] = false;  // S
            this.columns[2][8] = false;  // D
            this.columns[1][10] = false; // X
            this.columns[2][9] = false;  // E
        }
        else if (this.joystickActive > 0) {
            this.joystickActive--;
        }
        return this.columns[col][addr];
    },

    isAlphaLockDown: function() {
        return this.alphaLock;
    },

    simulateKeyPress: function(keyCode) {
        this.keyEvent({keyCode: keyCode, preventDefault: function() {}}, true);
        var that = this;
        window.setTimeout(function() {
            that.keyEvent({keyCode: keyCode, preventDefault: function() {}}, false);
        }, 200);
    },

    simulateKeyDown: function(keyCode) {
        this.keyEvent({keyCode: keyCode, preventDefault: function() {}}, true);
    },

    simulateKeyUp: function(keyCode) {
        this.keyEvent({keyCode: keyCode, preventDefault: function() {}}, false);
    }
};
