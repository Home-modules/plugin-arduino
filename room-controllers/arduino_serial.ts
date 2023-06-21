import { ReadlineParser, SerialPort } from "serialport";
import { HMApi, Log, RoomControllerInstance, SettingsFieldDef } from "../../../src/plugins.js";
import arduinoBoards from "../boards.js";
import { ArduinoCommand, ArduinoEvent } from "../arduino.js";

const log = new Log("controllers/arduino:serial");

const correctArduinoVersion = 'arduino:serial 0.0.1';

export default class ArduinoSerialController extends RoomControllerInstance {
    static id: `${string}:${string}` = "arduino:serial";
    static super_name = "Arduino";
    static sub_name = "Serial";
    static settingsFields: SettingsFieldDef[] = [
        {
            id: "port",
            type: 'select',
            label: "Serial port",
            required: true,
            allowCustomValue: true,
            checkCustomValue: true,
            options: {
                isLazy: true,
                loadOn: "render",
                refreshOnOpen: true,
                fallbackTexts: {
                    whenLoading: "Scanning...",
                    whenEmpty: "No serial ports found",
                    whenError: "Could not scan for serial ports",
                },
                showRefreshButton: [true, {
                    whenEmpty: "Refresh ports",
                    whenNormal: "Refresh ports",
                    whenLoading: "Scanning"
                }],
                callback: async () => {
                    const ports = await SerialPort.list();
                    return ports.map(port => ({
                        value: port.path,
                        label: port.path,
                        subtext: arduinoBoards[port.vendorId + '-' + port.productId]
                    }));
                },
            }
        },
        {
            id: "baudrate",
            type: 'number',
            label: "Baud rate",
            required: true,
            default: 9600,
            min: 300,
            max: 115200,
            min_error: "Baud rate too low, performance will be affected",
            max_error: "Baud rate too high, reliability will be affected",
            postfix: "bps",
            placeholder: "9600",
            scrollable: false
        }
    ];


    serialPort: SerialPort;
    parser: ReadlineParser;
    eventListeners: Record<number, ((data: Buffer) => void)[]> = {};

    on(event: number, listemer: (data: Buffer) => void) {
        if (this.eventListeners[event]) {
            this.eventListeners[event].push(listemer);
        } else {
            this.eventListeners[event] = [listemer];
        }
    }

    constructor(properties: HMApi.T.Room) {
        super(properties, false);

        this.serialPort = new SerialPort({
            path: properties.controllerType.settings.port as string,
            baudRate: properties.controllerType.settings.baudrate as number,
            autoOpen: false,
        });

        this.parser = this.serialPort.pipe(new ReadlineParser({
            encoding: 'hex',
            delimiter: '0d0a' // \r\n
        }));

        this.instantiateDevices();
    }

    async init() {
        this.serialPort.on('close', () => {
            log.w('Serial port closed', this.initialized);
            if (this.initialized) {
                this.disable("Serial port closed");
            }
        });
        await new Promise<void>((resolve) => {
            this.serialPort.open((error) => {
                log.i('Opened serial port', this.serialPort.path);
                if (error) {
                    this.disable(error.message);
                    resolve();
                } else {

                    // Set flags
                    this.serialPort.set({
                        dtr: true
                    });
                    setTimeout(() => {
                        this.serialPort.set({
                            dtr: false
                        });
                    }, 500);

                    let receivedMessage = false;

                    this.parser.on('data', (data: string) => {
                        const buffer = Buffer.from(data, 'hex');
                        log.i(this.id, 'Data received from Arduino:', buffer.toString(), buffer);

                        if (buffer[0] === ArduinoEvent.start) {
                            receivedMessage = true;
                            const arduinoVersion = buffer.slice(1).toString();
                            if (arduinoVersion !== correctArduinoVersion) {
                                this.disable(`The firmware on the Room Controller is incompatible (expected '${correctArduinoVersion}', got '${arduinoVersion}')`);
                                if(this.serialPort.isOpen) this.serialPort.close();
                            }
                            resolve();
                            return;
                        }
                        const event = buffer[0];
                        const rest = buffer.slice(1);
                        this.eventListeners[event]?.forEach(listemer => listemer(rest));
                    });

                    setTimeout(() => {
                        if (!receivedMessage) {
                            this.disable("No response from room controller (timeout of 5 seconds exceeded)");
                            if(this.serialPort.isOpen) this.serialPort.close();
                            resolve();
                        }
                    }, 5000);
                }
            });
        });
        return super.init();
    }

    async dispose(): Promise<void> {
        await super.dispose();
        if (this.serialPort.isOpen) {
            await new Promise<void>((resolve) => {
                this.serialPort.close(() => resolve());
            });
        }
        this.serialPort.destroy();
    }

    static async validateSettings(settings: Record<string, string | number | boolean>): Promise<string | void> {
        const port = settings["port"] as string;
        const ports = (await SerialPort.list()).map(p => p.path);
        if (!ports.includes(port)) {
            return "Port does not exist / is disconnected";
        }
    }

    /**
     * Sends a command to the Arduino board.
     * @param command The command to send
     * @param pin The pin to use
     * @param value The parameter for the command
     */
    async sendCommand(command: ArduinoCommand, pin: number, value?: number) {
        const port = this.settings.port as string;
        const serial = this.serialPort;
        log.i('Sending command to', serial.path, command, pin, value);
        if (serial.isOpen) {
            await new Promise<void>((resolve) => {
                serial.write((
                    value === undefined ?
                        [command, pin] :
                        [command, pin, value]
                ), error => {
                    if (error) {
                        this.disable(error.message);
                    }
                    resolve();
                });
            });
        } else {
            this.disable(`Port ${port} is closed. Please restart the room controller.`);
        }
    }

    lastCommandId = 1;

    /**
     * Sends a command and wait for the response from the Arduino board.
     * @param command The command to send
     * @param pin The pin to use
     */
    async sendCommandWithResponse(command: ArduinoCommand, pin: number) {
        const commandId = ((this.lastCommandId++) % 246) + 10; // 10-255
        this.sendCommand(command, pin, commandId);
        return new Promise<Buffer>((resolve) => {
            this.on(commandId, (data: Buffer) => {
                resolve(data);
                delete this.eventListeners[commandId];
            });
        });
    }
}