import { DeviceInstance, HMApi, RoomControllerInstance, SettingsFieldDef } from "../../../src/plugins.js";
import ArduinoSerialController from "../room-controllers/arduino_serial.js";
import { ArduinoCommand, PinMode, PinState } from "../arduino.js";


type InteractionStates = {
    color: HMApi.T.DeviceInteraction.State.UIColorInput,
    brightness: HMApi.T.DeviceInteraction.State.Slider,
    calib_title: HMApi.T.DeviceInteraction.State.Label,
    calib_desc: HMApi.T.DeviceInteraction.State.Label,
    red: HMApi.T.DeviceInteraction.State.Slider,
    green: HMApi.T.DeviceInteraction.State.Slider,
    blue: HMApi.T.DeviceInteraction.State.Slider,
    calib_start: HMApi.T.DeviceInteraction.State.Button,
    calib_save: HMApi.T.DeviceInteraction.State.Button,
    calib_cancel: HMApi.T.DeviceInteraction.State.Button,
    calib_reset: HMApi.T.DeviceInteraction.State.Button,
}

export class LightRGBDevice extends DeviceInstance {
    static id: `${string}:${string}` = "light:rgb";
    static super_name = "Light";
    static sub_name = "RGB";
    static icon: HMApi.T.IconName = "Lightbulb";
    static forRoomController: `${string}:${string}` | `${string}:*` | '*' = "arduino:*";
    static settingsFields: SettingsFieldDef[] = [
        {
            type: "container",
            label: "Pins",
            children: [
                {
                    id: 'pin_red',
                    type: 'number',
                    label: 'Red',
                    default: 9,
                    description: 'The Arduino pin connected to the red component',
                    min: 0,
                    max: 255,
                    required: true
                },
                {
                    id: 'pin_green',
                    type: 'number',
                    label: 'Green',
                    default: 10,
                    description: 'The Arduino pin connected to the green component',
                    min: 0,
                    max: 255,
                    required: true
                },
                {
                    id: 'pin_blue',
                    type: 'number',
                    label: 'Blue',
                    default: 11,
                    description: 'The Arduino pin connected to the blue component',
                    min: 0,
                    max: 255,
                    required: true
                },
            ]
        },
        {
            id: 'invert',
            type: 'checkbox',
            label: 'Invert pins',
            default: false,
            description: 'Currently pins will be LOW when off and HIGH when on',
            description_on_true: 'Currently pins will be HIGH when off and LOW when on',
        },
        {
            id: 'curve',
            type: 'slider',
            label: 'Brightness curve',
            default: 2,
            min: 1,
            max: 4,
            description: 'The shape of the curve that translates the brightness. Left is straight and right is curved.'
        },
        {
            type: "container",
            label: "Adjust color",
            children: [
                {
                    id: "adjust_red",
                    label: "Red",
                    type: "slider",
                    min: 1,
                    max: 100,
                    default: 100,
                    color: "red",
                    showValue: true,
                    postfix: "%"
                },
                {
                    id: "adjust_green",
                    label: "Green",
                    type: "slider",
                    min: 1,
                    max: 100,
                    default: 100,
                    color: "green",
                    showValue: true,
                    postfix: "%"
                },
                {
                    id: "adjust_blue",
                    label: "Blue",
                    type: "slider",
                    min: 1,
                    max: 100,
                    default: 100,
                    color: "blue",
                    showValue: true,
                    postfix: "%"
                },
            ]
        }
    ];
    static hasMainToggle = true;
    static interactions: Record<string, HMApi.T.DeviceInteraction.Type> = {
        "color": {
            type: "uiColorInput",
            label: "Color",
            defaultValue: "white"
        },
        "brightness": {
            type: "slider",
            label: "Brightness",
            min: 1,
            max: 255,
            step: 1,
            live: true,
        },
        "calib_title": {
            type: "label"
        },
        "calib_desc": {
            type: "label",
            size: "small",
            defaultValue: "Adjust the color components and click save"
        },
        "red": {
            type: "slider",
            label: "Red",
            min: 0,
            max: 100,
            step: 1,
            live: true,
            showValue: true,
            postfix: "%",
            color: "red"
        },
        "green": {
            type: "slider",
            label: "Green",
            min: 0,
            max: 100,
            step: 1,
            live: true,
            showValue: true,
            postfix: "%",
            color: "green"
        },
        "blue": {
            type: "slider",
            label: "Blue",
            min: 0,
            max: 100,
            step: 1,
            live: true,
            showValue: true,
            postfix: "%",
            color: "blue"
        },
        "calib_start": {
            type: "button",
            label: "Calibrate"
        },
        "calib_save": {
            type: "button",
            label: "Done",
            primary: true
        },
        "calib_cancel": {
            type: "button",
            label: "Cancel"
        },
        "calib_reset": {
            type: "button",
            label: "Reset to default",
            attention: true
        },
    };
    static defaultInteraction = "color";

    static events: HMApi.T.Automation.DeviceEvent[] = [
        { id: "on", name: "Turned on" },
        { id: "off", name: "Turned off" },
        { id: "toggle", name: "Toggled" },
    ];
    static override actions: { id: string; name: string; fields: SettingsFieldDef[]; }[] = [
        {
            id: "set-brightness",
            name: "Set brightness",
            fields: [
                {
                    id: "brightness",
                    type: "slider",
                    label: "Brightness",
                    min: 0,
                    max: 255,
                    default: 255,
                }
            ]
        },
        {
            id: "set-color",
            name: "Set color",
            fields: [
                {
                    id: "mode",
                    type: "radio",
                    label: "Mode",
                    options: {
                        "preset": "Presets",
                        "custom": "Custom"
                    },
                    default: "preset"
                },
                {
                    id: "color",
                    type: "select",
                    label: "Color",
                    options: [
                        { value: "white", label: "White" },
                        { value: "red", label: "Red" },
                        { value: "orange", label: "Orange" },
                        { value: "yellow", label: "Yellow" },
                        { value: "green", label: "Green" },
                        { value: "blue", label: "Blue" },
                        { value: "purple", label: "Purple" },
                        { value: "pink", label: "Pink" },
                        { value: "brown", label: "Brown" }
                    ],
                    default: "white",
                    condition: { type: "compare", op: "==", a: { type: "fieldValue", id: "mode" }, b: "preset" }
                },
                {
                    id: "red",
                    type: "slider",
                    label: "Red",
                    color: "red",
                    min: 0,
                    max: 100,
                    default: 100,
                    showValue: true,
                    postfix: "%",
                    condition: { type: "compare", op: "==", a: { type: "fieldValue", id: "mode" }, b: "custom" }
                },
                {
                    id: "green",
                    type: "slider",
                    label: "Green",
                    color: "green",
                    min: 0,
                    max: 100,
                    default: 100,
                    showValue: true,
                    postfix: "%",
                    condition: { type: "compare", op: "==", a: { type: "fieldValue", id: "mode" }, b: "custom" }
                },
                {
                    id: "blue",
                    type: "slider",
                    label: "Blue",
                    color: "blue",
                    min: 0,
                    max: 100,
                    default: 100,
                    showValue: true,
                    postfix: "%",
                    condition: { type: "compare", op: "==", a: { type: "fieldValue", id: "mode" }, b: "custom" }
                },
            ]
        }
    ];

    static defaultCalibrations: Record<HMApi.T.UIColorWithWhite, [number, number, number]> = {
        "white": [100, 100, 100],
        "red": [100, 0, 0],
        "orange": [100, 75, 0],
        "yellow": [100, 100, 25],
        "green": [0, 100, 0],
        "blue": [0, 0, 100],
        "purple": [75, 0, 100],
        "pink": [100, 75, 75],
        "brown": [80, 42, 16],
    };
    calibrations = {...LightRGBDevice.defaultCalibrations};
    calibrating: HMApi.T.UIColorWithWhite | undefined;

    override interactionStates: Record<string, HMApi.T.DeviceInteraction.State | undefined> = {
        "color": { color: "white" },
        "brightness": { value: 255 },
        "calib_title": { visible: false },
        "calib_desc": { visible: false },
        "red": { value: 100 },
        "green": { value: 100 },
        "blue": { value: 100 },
        "calib_start": { visible: true },
        "calib_save": { visible: false },
        "calib_cancel": { visible: false },
        "calib_reset": { visible: false },
    };


    constructor(properties: HMApi.T.Device, roomController: RoomControllerInstance) {
        super(properties, roomController);

        const calibs = this.extraData.calibrations as (typeof this.calibrations) | undefined;
        if (calibs)
            this.calibrations = calibs;

        this.getInteractionState('red').value = this.calibrations.white[0];
        this.getInteractionState('green').value = this.calibrations.white[1];
        this.getInteractionState('blue').value = this.calibrations.white[2];
    }

    override get roomController() {
        const c = super.roomController;
        if (c instanceof ArduinoSerialController) {
            return c;
        } else {
            throw new Error("Room controller is not an ArduinoSerialController"); // This error will crash hub. The reason for doing this is that things have gone too wrong for other means of error handling to be used.
        }
    }

    override async init() {
        await super.init();
        await this.roomController.sendCommand(ArduinoCommand.pinMode, this.settings.pin_red as number, PinMode.OUTPUT);
        await this.roomController.sendCommand(ArduinoCommand.pinMode, this.settings.pin_green as number, PinMode.OUTPUT);
        await this.roomController.sendCommand(ArduinoCommand.pinMode, this.settings.pin_blue as number, PinMode.OUTPUT);
        await this.setPinValues();
    }

    override async dispose() {
        if (this.mainToggleState) this.toggleMainToggle();
        // await this.physicalSwitch?.dispose();
        await super.dispose();
    }

    override async toggleMainToggle(): Promise<void> {
        await super.toggleMainToggle();
        this.fireEvent('toggle');
        this.fireEvent(this.mainToggleState ? 'on' : 'off');
        await this.setPinValues();
    }

    override async sendInteractionAction(interactionId: string, action: HMApi.T.DeviceInteraction.Action): Promise<void> {
        await super.sendInteractionAction(interactionId, action);

        switch (interactionId) {
            case "brightness":
                await this.setPinValues();
                break;
            case "red":
            case "green":
            case "blue":
                await this.setPinValue(interactionId);
                this.getInteractionState("color").color = undefined;
                if (!this.calibrating) {
                    this.getInteractionState("calib_start").visible = false;
                }
                break;
            case "color": {
                const colorName = this.getInteractionState("color").color;
                if (!colorName)
                    break;
                this.setCalibrating(false);
                const rgb = this.calibrations[colorName];
                this.getInteractionState("red").value = rgb[0];
                this.getInteractionState("green").value = rgb[1];
                this.getInteractionState("blue").value = rgb[2];
                await this.setPinValues();
                break;
            }
            case "calib_start": {
                if (this.getInteractionState("color").color) {
                    this.setCalibrating(true);
                }
                break;
            }
            case "calib_save": {
                const calibrating = this.calibrating;
                if (calibrating) {
                    this.setCalibrating(false);
                    this.calibrations[calibrating] = [
                        this.getInteractionState("red").value,
                        this.getInteractionState("green").value,
                        this.getInteractionState("blue").value,
                    ];
                    this.sendInteractionAction("color", { type: "setUIColorInputValue", color: calibrating });
                    this.writeExtraData({ calibrations: this.calibrations });
                }
                break;
            }
            case "calib_cancel": {
                const calibrating = this.calibrating;
                if (calibrating) {
                    this.setCalibrating(false);
                    this.sendInteractionAction("color", { type: "setUIColorInputValue", color: calibrating });
                }
                break;
            }
            case "calib_reset": {
                const calibrating = this.calibrating;
                if (calibrating) {
                    this.setCalibrating(false);
                    this.calibrations[calibrating] = LightRGBDevice.defaultCalibrations[calibrating];
                    this.sendInteractionAction("color", { type: "setUIColorInputValue", color: calibrating });
                    this.writeExtraData({ calibrations: this.calibrations });
                }
                break;
            }
        }
    }

    async setPinValues() {
        return Promise.all([
            this.setPinValue("red"),
            this.setPinValue("green"),
            this.setPinValue("blue")
        ]);
    }

    async setPinValue(color: "red" | "green" | "blue") {
        const pin = this.getSetting(`pin_${color}`, 9);
        const adjust = this.getSetting(`adjust_${color}`, 100) / 100;
        let brightness = (this.interactionStates.brightness as HMApi.T.DeviceInteraction.State.Slider | undefined)?.value;
        if (brightness === undefined) brightness = 255;
        let colorInt = (this.interactionStates[color] as HMApi.T.DeviceInteraction.State.Slider | undefined)?.value;
        if (colorInt === undefined) colorInt = 100;
        colorInt /= 100;

        let res = 0;
        if (this.mainToggleState && colorInt > 0 && brightness > 0) {
            const curve = this.settings.curve as number || 2;
            res = (((--brightness) / 255) ** curve) * 255 + 1;
            res *= colorInt * adjust;
        }
        res = this.settings.invert ? 255 - res : res;
        await this.roomController.sendCommand(ArduinoCommand.analogWrite, pin, Math.round(res));
    }

    getSetting<T extends (typeof this.settings)[string]>(name: string, fallback: T): T {
        let val = this.settings[name];
        if (val === undefined)
            val = fallback;
        return val as T;
    }

    getInteractionState<T extends keyof InteractionStates>(name: T) {
        return this.interactionStates[name] as InteractionStates[T];
    }

    setCalibrating(isCalibrating: boolean) {
        const color = this.getInteractionState("color").color;
        this.getInteractionState("color").visible = !isCalibrating;
        this.getInteractionState("brightness").visible = !isCalibrating;
        this.getInteractionState("calib_start").visible = (!isCalibrating) && (!!color);
        this.getInteractionState("calib_save").visible = isCalibrating;
        this.getInteractionState("calib_cancel").visible = isCalibrating;
        this.getInteractionState("calib_reset").visible = isCalibrating;
        this.getInteractionState("calib_title").visible = isCalibrating;
        this.getInteractionState("calib_title").text = isCalibrating ? `Calibrating ${color![0].toUpperCase() + color!.slice(1)}` : "";
        this.getInteractionState("calib_desc").visible = isCalibrating;
        this.calibrating = isCalibrating ? color : undefined;
    }

    async performAction(id: string, settings: Record<string, string | number | boolean>): Promise<void> {
        if (this.calibrating) return;
        if (id === "set-brightness") {
            const brightness = settings.brightness as number;
            this.interactionStates.brightness = { value: brightness };
            await this.setPinValues();
        }
        else if (id === "set-color") {
            const mode = settings.mode as 'preset' | 'custom';
            if (mode === 'preset') {
                this.sendInteractionAction("color", { type: "setUIColorInputValue", color: settings.color as HMApi.T.UIColorWithWhite });
            } else {
                this.interactionStates.red = { value: settings.red as number };
                this.interactionStates.green = { value: settings.green as number };
                this.interactionStates.blue = { value: settings.blue as number };
                await this.setPinValues();
                this.getInteractionState("color").color = undefined;
                this.getInteractionState("calib_start").visible = false;
            }
        }
    }
}
