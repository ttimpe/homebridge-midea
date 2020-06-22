import BaseCommand from './BaseCommand';
export default class SetCommand extends BaseCommand {
    constructor(device_type?: number);
    get audibleFeedback(): boolean;
    set audibleFeedback(feedbackEnabled: boolean);
    get powerState(): number;
    set powerState(state: number);
    get targetTemperature(): number;
    set targetTemperature(temperatureCelsius: number);
    get operationalMode(): number;
    set operationalMode(mode: number);
    get fanSpeed(): number;
    set fanSpeed(speed: number);
    get ecoMode(): boolean;
    set ecoMode(ecoModeEnabled: boolean);
    get swingMode(): any;
    set swingMode(mode: any);
    get turboMode(): boolean;
    set turboMode(turboModeEnabled: boolean);
}
