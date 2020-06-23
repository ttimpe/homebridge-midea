import { Service, PlatformAccessory, CharacteristicValue, CharacteristicSetCallback, CharacteristicGetCallback } from 'homebridge';
import { MideaPlatform } from './MideaPlatform';
export declare class MideaAccessory {
    private readonly platform;
    private readonly accessory;
    deviceId: string;
    targetTemperature: number;
    indoorTemperature: number;
    fanSpeed: number;
    fanOnlyMode: boolean;
    fanOnlyModeName: string;
    temperatureSteps: number;
    powerState: number;
    supportedSwingMode: number;
    operationalMode: number;
    swingMode: number;
    name: string;
    service: Service;
    constructor(platform: MideaPlatform, accessory: PlatformAccessory);
    /**
    * Handle requests to get the current value of the "Active" characteristic
    */
    handleActiveGet(callback: CharacteristicGetCallback): void;
    /**
     * Handle requests to set the "Active" characteristic
     */
    handleActiveSet(value: any, callback: CharacteristicSetCallback): void;
    /**
     * Handle requests to get the current value of the "Current Temperature" characteristic
     */
    handleCurrentTemperatureGet(callback: CharacteristicGetCallback): void;
    /**
       * Handle requests to get the current value of the "Current Heating Cooling State" characteristic
       */
    handleCurrentHeatingCoolingStateGet(callback: CharacteristicSetCallback): void;
    /**
     * Handle requests to get the current value of the "Target Heating Cooling State" characteristic
     */
    handleTargetHeatingCoolingStateGet(callback: CharacteristicGetCallback): void;
    /**
     * Handle requests to set the "Target Heating Cooling State" characteristic
     */
    handleTargetHeatingCoolingStateSet(value: CharacteristicValue, callback: CharacteristicSetCallback): void;
    /**
     * Handle requests to get the current value of the "Target Temperature" characteristic
     */
    handleCoolingThresholdTemperatureGet(callback: CharacteristicSetCallback): void;
    /**
     * Handle requests to set the "Target Temperature" characteristic
     */
    handleCoolingThresholdTemperatureSet(value: any, callback: CharacteristicSetCallback): void;
    /**
     * Handle requests to get the current value of the "Temperature Display Units" characteristic
     */
    handleTemperatureDisplayUnitsGet(callback: CharacteristicSetCallback): void;
    /**
     * Handle requests to set the "Temperature Display Units" characteristic
     */
    handleTemperatureDisplayUnitsSet(value: CharacteristicValue, callback: CharacteristicSetCallback): void;
}
