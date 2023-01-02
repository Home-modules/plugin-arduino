import { ArduinoCommand, PinMode, ArduinoEvent } from "./arduino.js";
import ArduinoSerialController from "./room-controllers/arduino_serial.js";

export class SimplePhysicalSwitch {
    constructor(public roomController: ArduinoSerialController, public pin: number, public onToggle: ()=> void) {
        roomController.on(ArduinoEvent.pinChange, this.onPinChanged.bind(this));
    }

    async init() {
        await this.roomController.sendCommand(ArduinoCommand.pinMode, this.pin, PinMode.INPUT_PULLUP);
        await this.roomController.sendCommand(ArduinoCommand.listenPin, this.pin, 1 /*true*/);
    }

    async dispose() {
        await this.roomController.sendCommand(ArduinoCommand.listenPin, this.pin, 0 /*false*/);
    }

    onPinChanged(data: Buffer) {
        const pin = data[0];
        if (pin === this.pin) {
            this.onToggle();
        }
    }
}