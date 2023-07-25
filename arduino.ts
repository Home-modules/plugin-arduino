import { registerRoomController, registerDeviceType } from "../../src/plugins.js";
import { LightStandardDevice } from "./device-types/light_standard.js";
import ArduinoSerialController from "./room-controllers/arduino_serial.js";
import { ThermometerDHTDevice } from "./device-types/thermometer_dht.js";
import { LightDimmableDevice } from "./device-types/light_dimmable.js";
import { LightRGBDevice } from "./device-types/light_rgb.js";

export enum ArduinoCommand {
    pinMode = 0,
    digitalWrite = 1,
    digitalRead = 2,
    analogWrite = 3,
    analogRead = 4,
    listenPin = 5,
    DHT11 = 50,
    DHT21 = 51,
    DHT22 = 52,
}

export enum ArduinoEvent {
    start = 0,
    pinChange = 1
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
registerDeviceType(LightRGBDevice);
registerDeviceType(ThermometerDHTDevice);

export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));