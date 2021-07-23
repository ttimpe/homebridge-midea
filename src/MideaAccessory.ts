import { Service, PlatformAccessory, CharacteristicValue, CharacteristicSetCallback, CharacteristicGetCallback } from 'homebridge';
import { MideaPlatform } from './MideaPlatform'
import { MideaDeviceType } from './enums/MideaDeviceType'
import { MideaSwingMode } from './enums/MideaSwingMode'
import { MideaOperationalMode } from './enums/MideaOperationalMode'

export class MideaAccessory {

	public deviceId: string = ''
	public deviceType: MideaDeviceType = MideaDeviceType.AirConditioner
	public targetTemperature: number = 0
	public indoorTemperature: number = 0
	public useFahrenheit: boolean = false

	public fanSpeed: number = 0
	public fanOnlyMode: boolean = false
	public fanOnlyModeName: string = ''
	public temperatureSteps: number = 0.5
	public powerState: any
	public supportedSwingMode: MideaSwingMode = MideaSwingMode.None
	public operationalMode: number = MideaOperationalMode.Off
	public swingMode: number = 0
	public ecoMode: boolean = false
	public name: string = ''
	public currentHumidity: number = 0
	public targetHumidity: number = 0
	public waterLevel: number = 0
	public userId: string = ''
	public firmwareVersion: string = '1.0.0'

	private service!: Service
	private fanService!: Service

	constructor(
		private readonly platform: MideaPlatform,
		private readonly accessory: PlatformAccessory,
		private _deviceId: string,
		private _deviceType: MideaDeviceType,
		private _name: string,
		private _userId: string
	) {
		this.deviceId = _deviceId
		this.deviceType = _deviceType
		this.name = _name
		this.userId = _userId

		// Check for device specific overrides
		var smode = this.platform.getDeviceSpecificOverrideValue(this.deviceId, 'supportedSwingMode');

		if (smode) {
			switch (smode) {
				case 'Vertical':
					this.supportedSwingMode = MideaSwingMode.Vertical;
					break;
				case 'Horizontal':
					this.supportedSwingMode = MideaSwingMode.Horizontal;
					break;
				case 'Both':
					this.supportedSwingMode = MideaSwingMode.Both;
					break;
				default:
					this.supportedSwingMode = MideaSwingMode.None;
					break;
			}
		}

		var tsteps = this.platform.getDeviceSpecificOverrideValue(this.deviceId, 'temperatureSteps');
		if (tsteps) {
			this.temperatureSteps = tsteps;
		}


		this.platform.log.debug('created device', this.name, 'with id', this.deviceId, 'and type', this.deviceType)
		this.accessory.getService(this.platform.Service.AccessoryInformation)!
			.setCharacteristic(this.platform.Characteristic.Manufacturer, 'Midea/Inventor')
			.setCharacteristic(this.platform.Characteristic.FirmwareRevision, '1.0.0')
			.setCharacteristic(this.platform.Characteristic.Model, 'Air Conditioner')
			.setCharacteristic(this.platform.Characteristic.SerialNumber, this.deviceId)

		this.platform.log.debug("Device type is ", this.deviceType)
		switch (this.deviceType) {

			case MideaDeviceType.Dehumidifier: {
				this.accessory.getService(this.platform.Service.AccessoryInformation)!.setCharacteristic(this.platform.Characteristic.Model, 'Dehumidifier')
				this.service = this.accessory.getService(this.platform.Service.HumidifierDehumidifier) || this.accessory.addService(this.platform.Service.HumidifierDehumidifier)
			}
			break
			
			case MideaDeviceType.AirConditioner: {
				this.service = this.accessory.getService(this.platform.Service.HeaterCooler) || this.accessory.addService(this.platform.Service.HeaterCooler)

				if (this.platform.getDeviceSpecificOverrideValue(this.deviceId, 'fanOnlyMode') == true) {
					this.fanService = this.accessory.getService(this.platform.Service.Fanv2) || this.accessory.addService(this.platform.Service.Fanv2);
					this.fanService.setCharacteristic(this.platform.Characteristic.Name, this.platform.getDeviceSpecificOverrideValue(this.deviceId, 'fanOnlyModeName') || 'Fan');

				}
			}
			break
			
			default: {
				this.platform.log.error('Unsupported device type ', MideaDeviceType[this.deviceType])
				return
			}

		}
		this.service.setCharacteristic(this.platform.Characteristic.Name, this.name)


		this.service.getCharacteristic(this.platform.Characteristic.Active)
			.on('get', this.handleActiveGet.bind(this))
			.on('set', this.handleActiveSet.bind(this));


		switch (this.deviceType) {
			case MideaDeviceType.Dehumidifier: {

				this.service.getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity)
					.on('get', this.handleCurrentRelativeHumidityGet.bind(this));
				this.service.getCharacteristic(this.platform.Characteristic.TargetRelativeHumidity)
					.on('set', this.handleTargetRelativeHumiditySet.bind(this))

				this.service.getCharacteristic(this.platform.Characteristic.CurrentHumidifierDehumidifierState)
					.on('get', this.handleCurrentHumidifierDehumidifierStateGet.bind(this))

				this.service.getCharacteristic(this.platform.Characteristic.TargetHumidifierDehumidifierState)
					.on('get', this.handleTargetHumidifierDehumidifierStateGet.bind(this))
					.on('set', this.handleTargetHumidifierDehumidifierStateSet.bind(this))

				this.service.getCharacteristic(this.platform.Characteristic.RelativeHumidityDehumidifierThreshold)
					.on('get', this.handleRelativeDehumidifierThresholdGet.bind(this))
					.on('set', this.handleRelativeDehumidifierThresholdSet.bind(this))

				this.service.getCharacteristic(this.platform.Characteristic.RelativeHumidityHumidifierThreshold)
					.on('get', this.handleRelativeHumidifierThresholdGet.bind(this))
					.on('set', this.handleRelativeHumidifierThresholdSet.bind(this))

				this.service.getCharacteristic(this.platform.Characteristic.WaterLevel).
					on('get', this.handleWaterLevelGet.bind(this))
			}
			break

			case MideaDeviceType.AirConditioner: {
				this.service.getCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState)
					.on('get', this.handleCurrentHeatingCoolingStateGet.bind(this));

				this.service.getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState)
					.on('get', this.handleTargetHeatingCoolingStateGet.bind(this))
					.on('set', this.handleTargetHeatingCoolingStateSet.bind(this))
					.setProps({
						validValues: [
							this.platform.Characteristic.TargetHeatingCoolingState.AUTO,
							this.platform.Characteristic.TargetHeatingCoolingState.COOL,
							this.platform.Characteristic.TargetHeatingCoolingState.OFF
						]
					})

				this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
					.on('get', this.handleCurrentTemperatureGet.bind(this));

				this.service.getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
					.on('get', this.handleCoolingThresholdTemperatureGet.bind(this))
					.on('set', this.handleCoolingThresholdTemperatureSet.bind(this))
					.setProps({
						minStep: this.temperatureSteps,
						minValue: 17,
						maxValue: 35
					});

				this.service.getCharacteristic(this.platform.Characteristic.TemperatureDisplayUnits)
					.on('get', this.handleTemperatureDisplayUnitsGet.bind(this))
					.on('set', this.handleTemperatureDisplayUnitsSet.bind(this));



				this.service.getCharacteristic(this.platform.Characteristic.SwingMode)
					.on('get', this.handleSwingModeGet.bind(this))
					.on('set', this.handleSwingModeSet.bind(this));

				this.service.getCharacteristic(this.platform.Characteristic.RotationSpeed)
					.on('get', this.handleRotationSpeedGet.bind(this))
					.on('set', this.handleRotationSpeedSet.bind(this));

				if (this.fanService != undefined) {
					// for fan only mode
					this.fanService.getCharacteristic(this.platform.Characteristic.Active)
						.on('get', this.handleFanActiveGet.bind(this))
						.on('set', this.handleFanActiveSet.bind(this));
				}

			}
			break
			
			default: {
				this.platform.log.warn('Unsupported device type', MideaDeviceType[this.deviceType])
			}
		}
	}

	/**
	* Handle requests to get the current value of the "Active" characteristic
	*/
	handleActiveGet(callback: CharacteristicGetCallback) {
		this.platform.log.debug('Triggered GET Active, returning', this.powerState);

		// set this to a valid value for Active
		if (this.powerState == 1) {
			callback(null, this.platform.Characteristic.Active.ACTIVE);
		} else {
			callback(null, this.platform.Characteristic.Active.INACTIVE);
		}

	}

	/**
	 * Handle requests to set the "Active" characteristic
	 */
	handleActiveSet(value: any, callback: CharacteristicSetCallback) {
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
	handleCurrentTemperatureGet(callback: CharacteristicGetCallback) {
		this.platform.log.debug('Triggered GET CurrentTemperature');

		// set this to a valid value for CurrentTemperature
		const currentValue = this.indoorTemperature;

		callback(null, currentValue);
	}

	/**
	   * Handle requests to get the current value of the "Current Heating Cooling State" characteristic
	   */
	handleCurrentHeatingCoolingStateGet(callback: CharacteristicSetCallback) {
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
	handleTargetHeatingCoolingStateGet(callback: CharacteristicGetCallback) {
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
	handleTargetHeatingCoolingStateSet(value: CharacteristicValue, callback: CharacteristicSetCallback) {
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
	handleCoolingThresholdTemperatureGet(callback: CharacteristicSetCallback) {
		this.platform.log.debug('Triggered GET handleCoolingThresholdTemperature');

		// set this to a valid value for TargetTemperature
		const currentValue = this.targetTemperature;

		callback(null, currentValue);
	}

	/**
	 * Handle requests to set the "Target Temperature" characteristic
	 */
	handleCoolingThresholdTemperatureSet(value: any, callback: CharacteristicSetCallback) {
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
	handleTemperatureDisplayUnitsGet(callback: CharacteristicSetCallback) {
		this.platform.log.debug('Triggered GET TemperatureDisplayUnits');

		// set this to a valid value for TemperatureDisplayUnits
		if (this.useFahrenheit) {
			callback(null, this.platform.Characteristic.TemperatureDisplayUnits.FAHRENHEIT)
		} else {
			callback(null, this.platform.Characteristic.TemperatureDisplayUnits.CELSIUS)

		}
	}

	/**
	 * Handle requests to set the "Temperature Display Units" characteristic
	 */
	handleTemperatureDisplayUnitsSet(value: CharacteristicValue, callback: CharacteristicSetCallback) {
		this.platform.log.debug('Triggered SET TemperatureDisplayUnits:', value);
		if (value == this.platform.Characteristic.TemperatureDisplayUnits.FAHRENHEIT) {
			this.useFahrenheit = true;
		} else {
			this.useFahrenheit = false;
		}
		callback(null, value);
		this.platform.sendUpdateToDevice(this);

	}

	//    * Handle requests to get the current value of the "swingMode" characteristic
	handleSwingModeGet(callback: CharacteristicGetCallback) {
		this.platform.log.debug('Triggered GET swingMode');

		// set this to a valid value for swingMode
		// values from device are 0.0="Off",12.0="Vertical",3.0="Horizontal",15.0="Both"

		let currentValue = this.platform.Characteristic.SwingMode.SWING_DISABLED
		if (this.swingMode != 0) {
			currentValue = this.platform.Characteristic.SwingMode.SWING_ENABLED
		}
		callback(null, currentValue);
	}

	// 	/**
	// 	* Handle requests to set the "swingMode" characteristic
	// 	*/
	handleSwingModeSet(value: CharacteristicValue, callback: CharacteristicSetCallback) {
		this.platform.log.debug('Triggered SET swingMode:', value);

		// convert this.swingMode to a 0/1
		var currentSwingMode = this.swingMode != 0 ? 1 : 0
		if (currentSwingMode != value) {
			if (value == 0) {
				this.swingMode = 0;
			}
			else {
				this.swingMode = this.supportedSwingMode;
			}

			this.platform.sendUpdateToDevice(this);
		}
		callback(null, value);
	}

	/**
	* Handle requests to get the current value of the "RotationSpeed" characteristic
	*/
	handleRotationSpeedGet(callback: CharacteristicGetCallback) {
		this.platform.log.debug('Triggered GET RotationSpeed');
		// set this to a valid value for RotationSpeed
		// values from device are 20.0="Silent",40.0="Low",60.0="Medium",80.0="High",102.0="Auto"
		// convert to good usable slider in homekit in percent
		let currentValue = 0;
		if (this.fanSpeed == 40) {
			currentValue = 25;
		}
		else if (this.fanSpeed == 60) {
			currentValue = 50;
		}
		else if (this.fanSpeed == 80) {
			currentValue = 75;
		}
		else {
			currentValue = 100;
		}
		callback(null, currentValue);
	}

	/**
	* Handle requests to set the "RotationSpeed" characteristic
	*/
	handleRotationSpeedSet(value: CharacteristicValue, callback: CharacteristicSetCallback) {
		this.platform.log.debug('Triggered SET RotationSpeed:', value);
		if (this.fanSpeed != value) {
			// transform values in percent
			// values from device are 20.0="Silent",40.0="Low",60.0="Medium",80.0="High",102.0="Auto"
			// Silent are not now available in devices?
			if (value <= 25) {
				value = 40;
			}
			else if (value <= 50) {
				value = 60;
			}
			else if (value <= 75) {
				value = 80;
			}
			else {
				value = 102;
			}

			this.fanSpeed = value;
			this.platform.sendUpdateToDevice(this);
		}
		callback(null, value);
	}
	/**
	* Handle requests to get the current value of the "On" characteristic
	*/
	handleFanActiveGet(callback: CharacteristicGetCallback) {
		this.platform.log.debug('Triggered GET Fan');
		// workaround to get the "fan only mode" from device
		// device operation values are 1.0="Auto",2.0="Cool",3.0="Dry",4.0="Heat",5.0="Fan"
		// set this to a valid value for Active
		if (this.operationalMode == MideaOperationalMode.FanOnly) {
			callback(null, this.platform.Characteristic.Active.ACTIVE);
		} else {
			callback(null, this.platform.Characteristic.Active.INACTIVE);
		}
	}

	/**
	* Handle requests to set the "On" characteristic
	*/
	handleFanActiveSet(value: CharacteristicValue, callback: CharacteristicSetCallback) {
		this.platform.log.debug('Triggered SET Fan:', value);
		// workaround to get the "fan only mode" from device
		// device operation values are 1.0="Auto",2.0="Cool",3.0="Dry",4.0="Heat",5.0="Fan"
		if (value == this.platform.Characteristic.Active.ACTIVE) {
			this.operationalMode = MideaOperationalMode.FanOnly;
		}

		else {

			this.operationalMode = MideaOperationalMode.Cooling;

		}
		this.platform.sendUpdateToDevice(this);
		callback(null, value);
	}


	// HumidifierDehumidifier

	// TODO implement Auto (should map to Smart mode) and HUMIDIFIER_OR_DEHUMIDIFIER/HUMIDIFIER/DEHUMIDIFIER (should map to Target mode) - do not map to dry (can't handle fan speed) or maybe play with pre-setting a fan speed combination
	// From Homebridge:
	// export declare class TargetHumidifierDehumidifierState extends Characteristic {
	// 	/**
	// 	 * @deprecated Removed in iOS 11. Use HUMIDIFIER_OR_DEHUMIDIFIER instead.
	// 	 */
	// 	static readonly AUTO = 0;
	// 	static readonly HUMIDIFIER_OR_DEHUMIDIFIER = 0;
	// 	static readonly HUMIDIFIER = 1;
	// 	static readonly DEHUMIDIFIER = 2;
	// 	static readonly UUID: string;
	// 	constructor();
	// }

	handleCurrentRelativeHumidityGet(callback: CharacteristicGetCallback) {
		this.platform.log.debug(`Triggered GET CurrentRelativeHumidity (currently set to ${this.currentHumidity})`)
		callback(null, this.currentHumidity)
	}
	handleTargetRelativeHumiditySet(value: any, callback: CharacteristicSetCallback) {
		this.platform.log.debug(`Triggered SET TargetRelativeHumidity (currently set to ${this.currentHumidity})`)
		callback(null, this.targetHumidity);
		this.targetHumidity = value
		this.platform.sendUpdateToDevice(this);
	}


	handleCurrentHumidifierDehumidifierStateGet(callback: CharacteristicGetCallback) {
		this.platform.log.debug('Triggered GET CurrentHumidifierDehumidifierState')
		callback(null, this.operationalMode)
	}


	handleTargetHumidifierDehumidifierStateGet(callback: CharacteristicGetCallback) {
		this.platform.log.debug('Triggered GET TargetHumidifierDehumidifierState')
		callback(null, this.operationalMode)
	}
	handleTargetHumidifierDehumidifierStateSet(value: any, callback: CharacteristicSetCallback) {
		this.platform.log.debug('Triggered SET TargetHumidifierDehumidifierState')
		callback(null, this.operationalMode)
		// this.operationalMode = value
		// this.platform.sendUpdateToDevice(this);
	}


	handleRelativeDehumidifierThresholdGet(callback: CharacteristicGetCallback) {
		this.platform.log.debug('Triggered GET RelativeDehumidifierThreshold. Humidity:', this.targetHumidity)
		callback(null, this.targetHumidity)
	}
	handleRelativeDehumidifierThresholdSet(value: any, callback: CharacteristicSetCallback) {
		this.platform.log.debug('Triggered SET RelativeDehumidifierThreshold. Target Humidity:', value);
		callback(null, this.targetHumidity);
		this.targetHumidity = value
		this.platform.sendUpdateToDevice(this);
	}

	handleRelativeHumidifierThresholdGet(callback: CharacteristicGetCallback) {
		this.platform.log.debug('Triggered GET RelativeHumidifierThreshold. Humidity:', this.targetHumidity)
		callback(null, this.targetHumidity)
	}
	handleRelativeHumidifierThresholdSet(value: any, callback: CharacteristicSetCallback) {
		this.platform.log.debug('Triggered SET RelativeHumidifierThreshold. Target Humidity:', value)
		callback(null, this.targetHumidity);
		this.targetHumidity = value
		this.platform.sendUpdateToDevice(this);
	}

	handleWaterLevelGet(callback: CharacteristicGetCallback) {
		this.platform.log.debug(`Triggered GET WaterLevel. WaterLevel: ${this.waterLevel}`)
		callback(null, this.waterLevel)
	}

}