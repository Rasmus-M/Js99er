/*
 * js99'er - TI-99/4A emulator written in JavaScript
 *
 * Created 2014 by Rasmus Moustgaard <rasmus.moustgaard@gmail.com>
 */

'use strict';

function TMS5220() {

    this.address = 0;
    this.nybbleNo = 0;
    this.log = Log.getLog();
}

TMS5220.RESIDENT_VOCABULARY = {
    0x56B3: "Ready to start",
    0x1FCD: "Completed",
    0x30FA: "Good word",
    0x1A8F: "Base"
};

TMS5220.prototype =  {

    writeSpeechData: function(b) {
        var cmd = (b & 0xF0) >> 4;
        var nybble = (b & 0x0F);
        if (cmd == 4) {
            if (this.nybbleNo < 4) {
                this.address |= (nybble << 16);
                this.address >>= 4;
                this.nybbleNo++;
            }
            else {
                // 5th nybble
                this.log.info("Speech address set to " + this.address.toHexWord());
                this.nybbleNo = 0;
            }
        }
        else if (cmd == 5) {
            var text = TMS5220.RESIDENT_VOCABULARY[this.address];
            this.log.info("Resident speech: " + (text != null ? text : this.address.toHexWord()));
        }
        else if (cmd == 6) {
            this.log.info("Direct speech");
        }
    },

    readSpeechData: function() {
        // this.log.info("Read speech data");
        return 0;
    }
};