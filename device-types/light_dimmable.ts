import { DeviceInstance, HMApi, RoomControllerInstance, SettingsFieldDef } from "../../../src/plugins.js";
import ArduinoSerialController from "../room-controllers/arduino_serial.js";
import { ArduinoCommand, PinMode } from "../arduino.js";

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
        },
        {
            id: 'curve',
            type: 'slider',
            label: 'Brightness curve',
            default: 2,
            min: 1,
            max: 4,
            description: 'The shape of the curve that translates the brightness. Left is straight and right is curved.'
        }
    ];
    static hasMainToggle = true;
    static interactions: Record<string, HMApi.T.DeviceInteraction.Type> = {
        "brightness": {
            type: "slider",
            label: "Brightness",
            min: 1,
            max: 255,
            step: 1,
            live: true,
        }
    };
    static defaultInteraction = "brightness";
    
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
        }
    ];

    override interactionStates: Record<string, HMApi.T.DeviceInteraction.State | undefined> = {
        "brightness": <HMApi.T.DeviceInteraction.State.Slider>{
            value: 255
        }
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
        await this.roomController.sendCommand(ArduinoCommand.pinMode, this.settings.pin as number, PinMode.OUTPUT);
        await this.setPinValue();
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
        await this.setPinValue();
    }

    override async sendInteractionAction(interactionId: string, action: HMApi.T.DeviceInteraction.Action): Promise<void> {
        await super.sendInteractionAction(interactionId, action);

        if (interactionId == 'brightness') {
            await this.setPinValue();
        }
    }

    async setPinValue() {
        let res: number|undefined = 0;
        if (this.mainToggleState) {
            res = (this.interactionStates.brightness as HMApi.T.DeviceInteraction.State.Slider | undefined)?.value;
            if (res === undefined) res = 255;
            const curve = this.settings.curve as number || 2;
            res = (((--res) / 255) ** curve) * 255 + 1;
        }
        res = this.settings.invert ? 255 - res : res;
        await this.roomController.sendCommand(ArduinoCommand.analogWrite, this.settings.pin as number, res);
    }

    async performAction(id: string, settings: Record<string, string | number | boolean>): Promise<void> {
        if (id === "set-brightness") {
            const brightness = settings.brightness as number;
            this.interactionStates.brightness = { value: brightness };
            await this.setPinValue();
        }
    }
}
