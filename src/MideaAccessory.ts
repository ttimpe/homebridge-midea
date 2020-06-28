import { Service, PlatformAccessory, CharacteristicValue, CharacteristicSetCallback, CharacteristicGetCallback } from 'homebridge';
import { MideaPlatform } from './MideaPlatform'
import { MideaDeviceType } from './MideaDeviceType'
import { MideaSwingMode } from './MideaSwingMode'
export class MideaAccessory {

	

	public deviceId: string = ''
	public deviceType :MideaDeviceType = MideaDeviceType.AirConditioner
	public targetTemperature : number = 0
	public indoorTemperature: number = 0
	public useFahrenheit: boolean = false
	public fanSpeed: number = 0
	public fanOnlyMode : boolean = false
	public fanOnlyModeName : string = ''
	public temperatureSteps: number = 0.5
	public powerState : any
	public supportedSwingMode : MideaSwingMode = MideaSwingMode.None
	public operationalMode : number = 0
	public swingMode :number = 0
	public name: string = ''
	public humidty: number = 0


	private service: Service


	constructor(
		private readonly platform: MideaPlatform,
		private readonly accessory: PlatformAccessory,
		private _deviceId: string,
		private _deviceType: MideaDeviceType,
		private _name : string
		) {
		this.deviceId = _deviceId
		this.deviceType = _deviceType
		this.name = _name

		// Check for device specific overrides
		if (platform.config.devices && platform.config.devices[this.deviceId]) {
			if (platform.config.devices[this.deviceId].hasOwnProperty('supportedSwingMode')) {
				switch (platform.config.devices[this.deviceId].supportedSwingMode) {
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
			if (platform.config.devices[this.deviceId].hasOwnProperty('temperatureSteps')) {
				this.temperatureSteps = platform.config.devices[this.deviceId].temperatureSteps;
			}

		}


		this.platform.log.debug('created device', this.name,'with id', this.deviceId, 'and type', this.deviceType)

		this.accessory.getService(this.platform.Service.AccessoryInformation)!
		.setCharacteristic(this.platform.Characteristic.Manufacturer, 'midea')
		.setCharacteristic(this.platform.Characteristic.FirmwareRevision, '0.0.1')
		.setCharacteristic(this.platform.Characteristic.Model, 'Air Conditioner')
		.setCharacteristic(this.platform.Characteristic.SerialNumber, this.deviceId);


		switch (this.deviceType) {
			case MideaDeviceType.Dehumidifier: {
				this.accessory.getService(this.platform.Service.AccessoryInformation)!.setCharacteristic(this.platform.Characteristic.Model, 'Dehumidifier')
				this.service = this.accessory.getService(this.platform.Service.HumidifierDehumidifier) || this.accessory.addService(this.platform.Service.HumidifierDehumidifier)
			}
			break
			case MideaDeviceType.AirConditioner: {
				this.service = this.accessory.getService(this.platform.Service.HeaterCooler) || this.accessory.addService(this.platform.Service.HeaterCooler)
			}
			break
			default: {
				this.platform.log.error('Unsupported device type ', MideaDeviceType[this.deviceType])
			}
			break;

		}
		this.service.setCharacteristic(this.platform.Characteristic.Name, this.name)


		this.service.getCharacteristic(this.platform.Characteristic.Active)
		.on('get', this.handleActiveGet.bind(this))
		.on('set', this.handleActiveSet.bind(this));


		switch (this.deviceType) {
			case MideaDeviceType.Dehumidifier: {
				this.service.getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity)
				.on('get', this.handleCurrentRelativeHumidityGet.bind(this));


				this.service.getCharacteristic(this.platform.Characteristic.CurrentHumidifierDehumidifierState)
				.on('get', this.handleCurrentHumidifierDehumidifierStateGet.bind(this))

				this.service.getCharacteristic(this.platform.Characteristic.TargetHumidifierDehumidifierState)
				.on('get', this.handleTargetHumidifierDehumidifierStateGet.bind(this))
				.on('set', this.handleTargetHumidifierDehumidifierStateSet.bind(this))



			}
			break
			case MideaDeviceType.AirConditioner: {
				this.service.getCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState)
				.on('get', this.handleCurrentHeatingCoolingStateGet.bind(this));

				this.service.getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState)
				.on('get', this.handleTargetHeatingCoolingStateGet.bind(this))
				.on('set', this.handleTargetHeatingCoolingStateSet.bind(this))
				.setProps({
					validValues:[
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
					minStep: this.temperatureSteps
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
   	callback(null, value);
   	this.platform.sendUpdateToDevice(this);

   }
   //    * Handle requests to get the current value of the "swingMode" characteristic
   handleSwingModeGet(callback: CharacteristicGetCallback) {
   	this.platform.log.debug('Triggered GET swingMode');

   	// set this to a valid value for swingMode
   	// values from device are 0.0="Off",12.0="Vertical",3.0="Horizontal",15.0="Both"

   	let currentValue = this.platform.Characteristic.SwingMode.SWING_DISABLED
   	if (this.swingMode != 0 ){
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
   	var currentSwingMode = this.swingMode!=0?1:0
   	if (currentSwingMode != value) {
   		if(value == 0){
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
		else if (this.fanSpeed == 60){
			currentValue = 50;
		}
		else if (this.fanSpeed == 80){
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
			else if (value <= 50){
				value = 60;
			}
			else if (value <= 75){
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
		if (this.operationalMode == 5) {
			callback(null, this.platform.Characteristic.Active.ACTIVE);
		} else {
			callback(null, this.platform.Characteristic.Active.INACTIVE);
		}
	}

	/**
	* Handle requests to set the "On" characteristic
	*/
	handleFanActiveSet(value: number, callback: CharacteristicSetCallback) {
		this.platform.log.debug('Triggered SET Fan:', value);
		// workaround to get the "fan only mode" from device
		// device operation values are 1.0="Auto",2.0="Cool",3.0="Dry",4.0="Heat",5.0="Fan"
		if (value == this.platform.Characteristic.Active.ACTIVE) {
			this.operationalMode = 5;	
		}

		else {
			//				if (Characteristic.CurrentHeatingCoolingState.COOL){
				//				this.operationalMode = 2;
				//				}
				//				else if (Characteristic.CurrentHeatingCoolingState.AUTO){
					//					// normaly to 1, but we only want to cool
					//					this.operationalMode = 1;
					//					this.operationalMode = 2;
					//				}
					//			else if (Characteristic.CurrentHeatingCoolingState.HEAT){
						//				normaly to 4, but we only want to cool
						//				this.operationalMode = 4;
						//				this.operationalMode = 2;
						//			}
						//			set default to mode "2" if it is off
						//			else {
							//				this.operationalMode = 2;
							//			}
						}
						this.platform.sendUpdateToDevice(this);
						callback(null, value);
					}


					// HumidifierDehumidifier

					handleCurrentRelativeHumidityGet(callback: CharacteristicGetCallback) {
						this.platform.log.debug('Triggered GET CurrentRelativeHumidity')
						callback(null, this.humidty)
					}

					handleTargetHumidifierDehumidifierStateGet(callback: CharacteristicGetCallback) {
						this.platform.log.debug('Triggered GET TargetHumidifierDehumidifierState')
						callback(null, 1)
					}
					handleTargetHumidifierDehumidifierStateSet(value: any, callback: CharacteristicSetCallback) {
						this.platform.log.debug('Triggered SET TargetHumidifierDehumidifierState')
						callback(null, value)
					}

					handleCurrentHumidifierDehumidifierStateGet(callback: CharacteristicGetCallback) {
						this.platform.log.debug('Triggered GET CurrentHumidifierDehumidifierState')
						callback(null, 1)
					}


				}