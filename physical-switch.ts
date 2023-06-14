import { SettingsFieldDef } from "../../src/plugins.js";
import { ArduinoCommand, PinMode, ArduinoEvent } from "./arduino.js";
import ArduinoSerialController from "./room-controllers/arduino_serial.js";

export const simplePhysicalSwitchSettingsFields: SettingsFieldDef[] = [
    {
        type: "container",
        label: "Physical switch",
        children: [
            {
                type: "checkbox",
                id: "physical_switch_enable",
                label: "Enable"
            },
            {
                type: "number",
                id: "physical_switch_pin",
                label: "Pin",
                description: 'The pin to which the switch is attached',
                default: 0,
                min: 0,
                max: 255,
                scrollable: true
            },
            {
                type: "checkbox",
                id: "physical_switch_invert",
                label: "Invert state",
                description: "Switch connected to VCC, HIGH = pressed, LOW = not pressed",
                description_on_true: "Switch connected to GND, LOW = pressed, HIGH = not pressed, pullup recommended",
                default: true,
            },
            {
                type: "checkbox",
                id: "physical_switch_pullup",
                label: "Enable pullup",
                description: "Enables the built-in pullup resistor on the pin",
                default: true,
                condition: {
                    type: "compare",
                    a: { type: "fieldValue", id: "physical_switch_invert" },
                    op: "==",
                    b: true
                }
            },
            {
                type: "radio",
                id: "physical_switch_type",
                label: "Switch type",
                options: {
                    "toggle": "Toggle",
                    "mom": "Momentary"
                },
                default: "toggle"
            },
            {
                type: "select",
                id: "physical_switch_mom_type",
                label: "Behavior",
                options: [
                    { value: "toggle", label: "Press to toggle" },
                    { value: "hold", label: "Hold to turn on" },
                    { value: "mixed", label: "Hybrid" }
                ],
                default: "toggle",
                condition: {
                    type: "compare",
                    a: {type: "fieldValue", id: "physical_switch_type"},
                    op: "==",
                    b: "mom"
                }
            }
        ]
    }
];

export type SwitchSettings = {
    physical_switch_enable: boolean,
    physical_switch_pin: number,
    physical_switch_invert: boolean,
    physical_switch_pullup: boolean,
    physical_switch_type: "toggle" | "mom",
    physical_switch_mom_type: "toggle" | "hold" | "mixed"
}

type slice<T extends string> = T extends `physical_switch_${infer K}` ? K : never;
type unslice<T extends string> = `physical_switch_${T}`

export class SimplePhysicalSwitch {
    lastPinChange: number = Number.NEGATIVE_INFINITY;
    lastPress: number = Number.NEGATIVE_INFINITY;
    lastRelease: number = Number.NEGATIVE_INFINITY;

    constructor(public getState: ()=>boolean, public roomController: ArduinoSerialController, public settings: SwitchSettings, public onToggle: () => void) {
        roomController.on(ArduinoEvent.pinChange, this.onPinChanged.bind(this));
    }

    setting<T extends slice<keyof SwitchSettings>>(name: T): SwitchSettings[unslice<T>] { return this.settings[("physical_switch_" + name) as unslice<T>]; }

    async init() {
        const enablePullup = this.setting("invert") && this.setting("pullup");
        await this.roomController.sendCommand(ArduinoCommand.pinMode, this.setting("pin"), enablePullup ? PinMode.INPUT_PULLUP : PinMode.INPUT);
        await this.roomController.sendCommand(ArduinoCommand.listenPin, this.setting("pin"), 1 /*true*/);
    }

    async dispose() {
        await this.roomController.sendCommand(ArduinoCommand.listenPin, this.setting("pin"), 0 /*false*/);
    }

    onPinChanged(data: Buffer) {
        const pin = data[0];
        const pressed = Boolean(data[1]) !== this.setting("invert");
        if (pin === this.setting("pin")) {
            if (this.setting("type") === "mom") {
                switch (this.setting("mom_type")) {

                    // Toggle the device on click
                    case "toggle": {
                        if (pressed && Date.now() - this.lastPress > 100 /*debounce*/) {
                            this.onToggle();
                        }
                    }

                    // Hold the button to keep the device on
                    case "hold": {
                        if(
                            this.getState() !== pressed &&
                            Date.now() - (pressed ? this.lastPress : this.lastRelease) > 100 // debounce
                        ) 
                            this.onToggle();
                    }

                    // Hold to turn on, 
                    case "mixed": {
                        if(pressed && Date.now() - this.lastPress > 100 /*debounce*/) { // Press
                            this.onToggle(); // Press always toggles
                        }
                        if((!pressed) && Date.now() - this.lastRelease > 100 /*debounce*/) { // Release
                            if(Date.now() - this.lastPress > 300) { // Held down for over 300ms
                                if(this.getState()) this.onToggle(); // Turn off but not on
                            }
                        }
                    }
                }
            } else {
                if(Date.now() - this.lastPinChange > 100)
                    this.onToggle();
            }
            this.lastPinChange = Date.now();
            if(pressed) this.lastPress = Date.now();
            else this.lastRelease = Date.now();
        }
    }
}