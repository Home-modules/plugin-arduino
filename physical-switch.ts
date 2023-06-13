import { SettingsFieldDef } from "../../src/plugins.js";
import { ArduinoCommand, PinMode, ArduinoEvent, PinState } from "./arduino.js";
import ArduinoSerialController from "./room-controllers/arduino_serial.js";

export const simplePhysicalSwitchSettingsFields: SettingsFieldDef[] = [
    // {
    //     id: 'physical-switch',
    //     type: 'number',
    //     label: "Physical switch pin (optional)",
    //     description: 'An optional physical switch connected to GND. Set to -1 to disable.',
    //     default: -1,
    //     min: -1,
    //     max: 100,
    //     scrollable: true
    // }
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
                ]
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

    constructor(public roomController: ArduinoSerialController, public settings: SwitchSettings, public onToggle: () => void) {
        roomController.on(ArduinoEvent.pinChange, this.onPinChanged.bind(this));
    }

    setting<T extends slice<keyof SwitchSettings>>(name: T): SwitchSettings[unslice<T>] { return this.settings[("physical_switch_" + name) as unslice<T>];}

    async init() {
        await this.roomController.sendCommand(ArduinoCommand.pinMode, this.setting("pin"), PinMode.INPUT_PULLUP);
        await this.roomController.sendCommand(ArduinoCommand.listenPin, this.setting("pin"), 1 /*true*/);
    }

    async dispose() {
        await this.roomController.sendCommand(ArduinoCommand.listenPin, this.setting("pin"), 0 /*false*/);
    }

    onPinChanged(data: Buffer) {
        const pin = data[0];
        const state: PinState = data[1];
        if (pin === this.setting("pin")) {
            if (this.setting("type") === "mom") {
                if(
                    state === (this.setting("invert") ? PinState.HIGH : PinState.LOW) && 
                    Date.now() - this.lastPinChange > 100 // More than 100ms elapsed, used to debounce
                ) {
                    this.onToggle();
                }
            } else {
                this.onToggle();
            }
            this.lastPinChange = Date.now();
        }
    }
}