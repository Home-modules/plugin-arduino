import { DeviceInstance, HMApi, Log, RoomControllerInstance, SettingsFieldDef } from "../../../src/plugins.js";
import ArduinoSerialController from "../room-controllers/arduino_serial.js";
import { ArduinoCommand, PinMode, PinState } from "../arduino.js";
import { SimplePhysicalSwitch, simplePhysicalSwitchSettingsFields, SwitchSettings } from "../physical-switch.js";

const log = new Log('light:standard')

export class LightStandardDevice extends DeviceInstance {
    static id: `${string}:${string}` = "light:standard";
    static super_name = "Light";
    static sub_name = "Standard";
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
        ...simplePhysicalSwitchSettingsFields
    ];
    static hasMainToggle = true;

    physicalSwitch?: SimplePhysicalSwitch;

    constructor(properties: HMApi.T.Device, roomController: RoomControllerInstance) {
        super(properties, roomController);
        if (properties.params['physical_switch_enable']) {
            this.physicalSwitch = new SimplePhysicalSwitch(
                ()=> this.mainToggleState,
                this.roomController,
                properties.params as SwitchSettings,
                async () => {
                    await this.toggleMainToggle();
                    await this.updateState(false);
                }
            );
        }
    }

    get roomController() {
        const c = super.roomController;
        if (c instanceof ArduinoSerialController) {
            return c;
        } else {
            log.e("Room controller is not an ArduinoSerialController", c);
            throw new Error("Room controller is not an ArduinoSerialController"); // This error will crash hub. The reason for doing this is that things have gone too wrong for other means of error handling to be used.
        }
    }

    async init() {
        await super.init();
        await this.roomController.sendCommand(ArduinoCommand.pinMode, this.settings.pin as number, PinMode.OUTPUT);
        await this.roomController.sendCommand(ArduinoCommand.digitalWrite, this.settings.pin as number, this.computePinState(this.mainToggleState));
        await this.physicalSwitch?.init();
    }

    async toggleMainToggle(): Promise<void> {
        await super.toggleMainToggle();
        await this.roomController.sendCommand(ArduinoCommand.digitalWrite, this.settings.pin as number, this.computePinState(this.mainToggleState));
    }

    async dispose() {
        await this.roomController.sendCommand(ArduinoCommand.digitalWrite, this.settings.pin as number, this.computePinState(false));
        await this.physicalSwitch?.dispose();
    }

    computePinState(state: boolean): PinState {
        return this.settings.invert ? (
            state ? PinState.LOW : PinState.HIGH
        ) : (
            state ? PinState.HIGH : PinState.LOW
        );
    }
}
