import { DeviceInstance, HMApi, SettingsFieldDef } from "../../../src/plugins.js";
import ArduinoSerialController from "../room-controllers/arduino_serial.js";
import { ArduinoCommands, PinMode, PinState } from "hmp-arduino/arduino.js";

export class LightDimmableDevice extends DeviceInstance {
    static id: `${string}:${string}` = "light:dimmable";
    static super_name = "Light";
    static sub_name = "Dimmable";
    static icon: HMApi.T.IconName = "Lightbulb";
    static forRoomController: `${string}:${string}` | `${string}:*` | '*' = "arduino:*";
    static settingsFields: SettingsFieldDef[] = [
        {
            id: 'pin',
            type: 'number',
            label: 'Pin',
            default: 13,
            description: 'The Arduino pin on which the light is connected to',
            min: 0,
            max: 255,
            required: true
        },
        {
            id: 'invert',
            type: 'checkbox',
            label: 'Invert control pin',
            default: false,
            description: 'Currently pin will be LOW when off and HIGH when on',
            description_on_true: 'Currently pin will be HIGH when off and LOW when on',
        }
    ];
    static hasMainToggle = true;
    static interactions: Record<string, HMApi.T.DeviceInteraction.Type> = {
        "brightness": {
            type: "slider",
            label: "Brightness",
            min: 0,
            max: 255,
            step: 1,
            live: true,
        }
    }
    static defaultInteraction = "brightness";

    override interactionStates: Record<string, HMApi.T.DeviceInteraction.State | undefined> = {
        "brightness": <HMApi.T.DeviceInteraction.State.Slider>{
            value: 255
        }
    };


    constructor(properties: HMApi.T.Device, roomId: string) {
        super(properties, roomId);
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
        await this.roomController.sendCommand(ArduinoCommands.pinMode, this.settings.pin as number, PinMode.OUTPUT);
        await this.setPinValue();
    }

    override async toggleMainToggle(): Promise<void> {
        await super.toggleMainToggle();
        await this.setPinValue();
    }

    override async sendInteractionAction(interactionId: string, action: HMApi.T.DeviceInteraction.Action): Promise<void> {
        await super.sendInteractionAction(interactionId, action);

        if (interactionId == 'brightness') {
            await this.setPinValue();
        }
    }

    async setPinValue() {
        let res = this.mainToggleState ? (this.interactionStates.brightness as HMApi.T.DeviceInteraction.State.Slider | undefined)?.value : 0;
        if (res === undefined) res = 255;
        res = this.settings.invert ? 255 - res : res;
        await this.roomController.sendCommand(ArduinoCommands.analogWrite, this.settings.pin as number, res);
    }
}
