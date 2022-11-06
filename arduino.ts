import { registerRoomController, registerDeviceType } from "../../src/plugins.js";
import { LightStandardDevice } from "hmp-arduino/device-types/light_standard.js";
import ArduinoSerialController from "hmp-arduino/room-controllers/arduino_serial.js";
import { ThermometerDHTDevice } from "hmp-arduino/device-types/thermometer_dht.js";
import { LightDimmableDevice } from "hmp-arduino/device-types/light_dimmable.js";

export enum ArduinoCommand {
    pinMode = 0,
    digitalWrite = 1,
    digitalRead = 2,
    analogWrite = 3,
    analogRead = 4,
    DHT11 = 50,
    DHT21 = 51,
    DHT22 = 52,
}

export enum PinMode {
    INPUT = 0,
    OUTPUT = 1,
    INPUT_PULLUP = 2
}

export enum PinState {
    LOW = 0,
    HIGH = 1
}

registerRoomController(ArduinoSerialController);
registerDeviceType(LightStandardDevice);
registerDeviceType(LightDimmableDevice);
registerDeviceType(ThermometerDHTDevice);

