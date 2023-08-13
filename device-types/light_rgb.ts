import { DeviceInstance, HMApi, RoomControllerInstance, SettingsFieldDef } from "../../../src/plugins.js";
import ArduinoSerialController from "../room-controllers/arduino_serial.js";
import { ArduinoCommand, PinMode, PinState } from "../arduino.js";

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
    }
    static defaultInteraction = "color";

    override interactionStates: Record<string, HMApi.T.DeviceInteraction.State | undefined> = {
        "color": <HMApi.T.DeviceInteraction.State.UIColorInput>{ color: "white" },
        "brightness": <HMApi.T.DeviceInteraction.State.Slider>{ value: 255 },
        "red": <HMApi.T.DeviceInteraction.State.Slider>{ value: 100 },
        "green": <HMApi.T.DeviceInteraction.State.Slider>{ value: 100 },
        "blue": <HMApi.T.DeviceInteraction.State.Slider>{ value: 100 },
    };


    constructor(properties: HMApi.T.Device, roomController: RoomControllerInstance) {
        super(properties, roomController);
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
                break;
            case "color": {
                const colorName = (this.interactionStates.color as HMApi.T.DeviceInteraction.State.UIColorInput).color;
                const rgb = (<Record<HMApi.T.UIColorWithWhite, [number, number, number]>>{
                    "white": [100, 100, 100],
                    "red": [100, 0, 0],
                    "orange": [100, 75, 0],
                    "yellow": [100, 100, 25],
                    "green": [0, 100, 0],
                    "blue": [0, 0, 100],
                    "purple": [75, 0, 100],
                    "pink": [100, 75, 75],
                    "brown": [80, 42, 16],
                })[colorName];
                await Promise.all([
                    this.sendInteractionAction("red", { "type": "setSliderValue", "value": rgb[0] }),
                    this.sendInteractionAction("green", { "type": "setSliderValue", "value": rgb[1] }),
                    this.sendInteractionAction("blue", { "type": "setSliderValue", "value": rgb[2] }),
                ]);
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
}
