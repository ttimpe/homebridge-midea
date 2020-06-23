"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MideaAccessory = void 0;
class MideaAccessory {
    constructor(platform, accessory) {
        this.platform = platform;
        this.accessory = accessory;
        this.deviceId = '';
        this.deviceType = 0xAC;
        this.targetTemperature = 0;
        this.indoorTemperature = 0;
        this.fanSpeed = 0;
        this.fanOnlyMode = false;
        this.fanOnlyModeName = '';
        this.temperatureSteps = 1;
        this.powerState = 0;
        this.supportedSwingMode = 0;
        this.operationalMode = 0;
        this.swingMode = 0;
        this.name = '';
        this.deviceId = this.accessory.context.device.id;
        this.deviceType = this.accessory.context.device.type;
        this.name = this.accessory.context.name;
        this.platform.log.debug('created device', this.name, 'with id', this.deviceId, 'and type', this.deviceType);
        this.accessory.getService(this.platform.Service.AccessoryInformation)
            .setCharacteristic(this.platform.Characteristic.Manufacturer, 'midea')
            .setCharacteristic(this.platform.Characteristic.FirmwareRevision, '0.0.1')
            .setCharacteristic(this.platform.Characteristic.Model, 'AC')
            .setCharacteristic(this.platform.Characteristic.SerialNumber, this.accessory.context.device.id.toString());
        this.service = this.accessory.getService(this.platform.Service.HeaterCooler) || this.accessory.addService(this.platform.Service.HeaterCooler);
        this.service.setCharacteristic(this.platform.Characteristic.Name, this.name);
        this.service.getCharacteristic(this.platform.Characteristic.Active)
            .on('get', this.handleActiveGet.bind(this))
            .on('set', this.handleActiveSet.bind(this));
        this.service.getCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState)
            .on('get', this.handleCurrentHeatingCoolingStateGet.bind(this));
        this.service.getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState)
            .on('get', this.handleTargetHeatingCoolingStateGet.bind(this))
            .on('set', this.handleTargetHeatingCoolingStateSet.bind(this));
        this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
            .on('get', this.handleCurrentTemperatureGet.bind(this));
        this.service.getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
            .on('get', this.handleCoolingThresholdTemperatureGet.bind(this))
            .on('set', this.handleCoolingThresholdTemperatureSet.bind(this))
            .setProps({
            minStep: this.temperatureSteps
        });
        this.service.getCharacteristic(this.platform.Characteristic.TemperatureDisplayUnits)
            .on('get', this.handleTemperatureDisplayUnitsGet.bind(this))
            .on('set', this.handleTemperatureDisplayUnitsSet.bind(this));
        /*
                this.service.getCharacteristic(Characteristic.SwingMode)
                .on('get', this.handleSwingModeGet.bind(this))
                .on('set', this.handleSwingModeSet.bind(this));
        
                this.service.getCharacteristic(Characteristic.RotationSpeed)
                .on('get', this.handleRotationSpeedGet.bind(this))
                .on('set', this.handleRotationSpeedSet.bind(this));
        
        */
    }
    /**
    * Handle requests to get the current value of the "Active" characteristic
    */
    handleActiveGet(callback) {
        this.platform.log.debug('Triggered GET Active, returning', this.powerState);
        // set this to a valid value for Active
        if (this.powerState) {
            callback(null, this.platform.Characteristic.Active.ACTIVE);
        }
        else {
            callback(null, this.platform.Characteristic.Active.INACTIVE);
        }
    }
    /**
     * Handle requests to set the "Active" characteristic
     */
    handleActiveSet(value, callback) {
        this.platform.log.debug('Triggered SET Active:', value);
        if (this.powerState != value) {
            this.powerState = value;
            this.platform.sendUpdateToDevice(this);
        }
        callback(null, value);
    }
    /**
     * Handle requests to get the current value of the "Current Temperature" characteristic
     */
    handleCurrentTemperatureGet(callback) {
        this.platform.log.debug('Triggered GET CurrentTemperature');
        // set this to a valid value for CurrentTemperature
        const currentValue = this.indoorTemperature;
        callback(null, currentValue);
    }
    /**
       * Handle requests to get the current value of the "Current Heating Cooling State" characteristic
       */
    handleCurrentHeatingCoolingStateGet(callback) {
        this.platform.log.debug('Triggered GET CurrentHeatingCoolingState');
        // set this to a valid value for CurrentHeatingCoolingState
        let currentValue = this.platform.Characteristic.CurrentHeatingCoolingState.COOL;
        if (this.powerState == this.platform.Characteristic.Active.INACTIVE) {
            currentValue = this.platform.Characteristic.CurrentHeatingCoolingState.OFF;
        }
        callback(null, currentValue);
    }
    /**
     * Handle requests to get the current value of the "Target Heating Cooling State" characteristic
     */
    handleTargetHeatingCoolingStateGet(callback) {
        this.platform.log.debug('Triggered GET TargetHeatingCoolingState while powerState is', this.powerState);
        // set this to a valid value for TargetHeatingCoolingState
        let currentValue = this.platform.Characteristic.TargetHeatingCoolingState.COOL;
        if (this.powerState == this.platform.Characteristic.Active.INACTIVE) {
            currentValue = this.platform.Characteristic.TargetHeatingCoolingState.OFF;
        }
        callback(null, currentValue);
    }
    /**
     * Handle requests to set the "Target Heating Cooling State" characteristic
     */
    handleTargetHeatingCoolingStateSet(value, callback) {
        this.platform.log.debug('Triggered SET TargetHeatingCoolingState:', value);
        switch (value) {
            case this.platform.Characteristic.CurrentHeatingCoolingState.OFF:
                this.powerState = this.platform.Characteristic.Active.INACTIVE;
                break;
            default:
                this.powerState = this.platform.Characteristic.Active.ACTIVE;
                break;
        }
        this.platform.sendUpdateToDevice(this);
        callback(null, value);
    }
    /**
     * Handle requests to get the current value of the "Target Temperature" characteristic
     */
    handleCoolingThresholdTemperatureGet(callback) {
        this.platform.log.debug('Triggered GET handleCoolingThresholdTemperature');
        // set this to a valid value for TargetTemperature
        const currentValue = this.targetTemperature;
        callback(null, currentValue);
    }
    /**
     * Handle requests to set the "Target Temperature" characteristic
     */
    handleCoolingThresholdTemperatureSet(value, callback) {
        this.platform.log.debug('Triggered SET handleCoolingThresholdTemperature:', value);
        if (this.targetTemperature != value) {
            this.targetTemperature = value;
            this.platform.sendUpdateToDevice(this);
        }
        callback(null, value);
    }
    /**
     * Handle requests to get the current value of the "Temperature Display Units" characteristic
     */
    handleTemperatureDisplayUnitsGet(callback) {
        this.platform.log.debug('Triggered GET TemperatureDisplayUnits');
        // set this to a valid value for TemperatureDisplayUnits
        const currentValue = this.platform.Characteristic.TemperatureDisplayUnits.CELSIUS;
        callback(null, currentValue);
    }
    /**
     * Handle requests to set the "Temperature Display Units" characteristic
     */
    handleTemperatureDisplayUnitsSet(value, callback) {
        this.platform.log.debug('Triggered SET TemperatureDisplayUnits:', value);
        callback(null);
    }
}
exports.MideaAccessory = MideaAccessory;
