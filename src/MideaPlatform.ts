import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
import { AxiosError } from 'axios';
// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const traverse = require("traverse");
const crypto = require("crypto");
const https = require('https');


const axios = require('axios').default

const tunnel = require('tunnel');

const axiosCookieJarSupport =  require('axios-cookiejar-support').default;
const tough = require('tough-cookie');

const qs = require('querystring');

import Utils from './Utils'
import Constants from './Constants'
import ApplianceResponse from './ApplianceResponse'
import SetCommand from './SetCommand'
import PacketBuilder from './PacketBuilder'

import ACSetCommand from './commands/ACSetCommand';
import DehumidifierSetCommand from './commands/DehumidifierSetCommand';

import ACApplianceResponse from './responses/ACApplianceResponse'
import DehumidifierApplianceResponse from './responses/DehumidifierApplianceResponse'

import { MideaAccessory } from './MideaAccessory'
import { MideaDeviceType } from './enums/MideaDeviceType'
import { MideaErrorCodes } from './enums/MideaErrorCodes' 





export class MideaPlatform implements DynamicPlatformPlugin {


	public readonly Service: typeof Service = this.api.hap.Service;
	public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;
	jar : any
	updateInterval :any = null
	reauthInterval :any = null
	atoken: string = ''
	sessionId: string = ''
	dataKey : string = ''
	baseHeader : object
	apiClient: any;
	public readonly accessories: PlatformAccessory[] = [];
	mideaAccessories : MideaAccessory[] = []



	constructor(public readonly log: Logger, public readonly config: PlatformConfig, public readonly api : API) {

		axiosCookieJarSupport(axios);
		this.jar = new tough.CookieJar()
		let agent :any;
		if (this.config.proxy) {
			this.log.info('Using debugging proxy specified in config.json')
			const agent = tunnel.httpsOverHttp({
				proxy: this.config.proxy,
				rejectUnauthorized: false
			})
			this.apiClient = axios.create({
				baseURL: 'https://mapp.appsmb.com/v1',
				headers: {
					'User-Agent': Constants.UserAgent,
					'Content-Type': 'application/x-www-form-urlencoded'
				},
				jar: this.jar,
				httpsAgent: agent
			})
		} else {
			this.apiClient = axios.create({
				baseURL: 'https://mapp.appsmb.com/v1',
				headers: {
					'User-Agent': Constants.UserAgent,
					'Content-Type': 'application/x-www-form-urlencoded'
				},
				jar: this.jar
			})
		}



		this.log = log;
		this.config = config;
		api.on('didFinishLaunching', () => {
			this.onReady();
		})
	}


	async onReady() {
		try {
			await this.login()
			this.log.debug('Login successful')
			try {
				await this.getUserList()
				this.updateValues()
			} catch (err) {
				this.log.debug('getUserList failed')
			}
			this.updateInterval = setInterval(() => {
				this.updateValues();
			}, this.config['interval'] * 60 * 1000);
		} catch (err) {
			this.log.debug('Login failed')
		}
		
	}
	async login() {
		return new Promise(async (resolve, reject) => {
			const url = '/user/login/id/get';

			const form : any = {
				loginAccount: this.config['user'],
				clientType: Constants.ClientType,
				src: Constants.RequestSource,
				appId: Constants.AppId,
				format: Constants.RequestFormat,
				stamp: Utils.getStamp(),
				language: Constants.Language
			};
			const sign = Utils.getSign(url, form);
			form.sign = sign;
			//this.log.debug('login request', qs.stringify(form));
			
			try {
				const response = await this.apiClient.post(url, qs.stringify(form))

				
				if (response.data) {

					if (response.data.errorCode && response.data.errorCode != '0') {
						this.log.debug('Login request failed with error',response.data.msg)
					} else {

						const loginId :string = response.data.result.loginId;
						const password : string = Utils.getSignPassword(loginId, this.config.password);
						const url = "/user/login";
						const form :any = {
							loginAccount: this.config['user'],
							src: Constants.RequestSource,
							format: Constants.RequestFormat,
							stamp: Utils.getStamp(),
							language: Constants.Language,
							password: password,
							clientType: Constants.ClientType,
							appId: Constants.AppId,
						};

						const sign = Utils.getSign(url, form);
						form.sign = sign;
						try {
							const loginResponse = await this.apiClient.post(url, qs.stringify(form));

							//this.log.debug(response);
							if (loginResponse.data.errorCode && loginResponse.data.errorCode != '0') {
								this.log.debug('Login request 2 returned error', loginResponse.data.msg);
								reject();
							} else {
								this.atoken = loginResponse.data.result.accessToken;
								this.sessionId = loginResponse.data.result.sessionId;
								this.dataKey = Utils.generateDataKey(this.atoken);
								resolve();
							}
						} catch (err) {
							this.log.debug('Login request 2 failed with', err)
							reject();
						}
					}

				}

			} catch(err) {
				this.log.debug('Login request failed with', err);
				reject();
			}
		});
	}
	async getUserList() {
		this.log.debug('getUserList called');
		return new Promise(async (resolve, reject) => {
			const form :any = {
				src: Constants.RequestSource,
				format: Constants.RequestFormat,
				stamp: Utils.getStamp(),
				language: Constants.Language,
				sessionId: this.sessionId
			};
			const url = "/appliance/user/list/get";
			const sign = Utils.getSign(url, form);
			form.sign = sign;
			try {
				const response = await this.apiClient.post(url, qs.stringify(form))

				if (response.data.errorCode && response.data.errorCode != '0') {
					this.log.error('getUserList returned error', response.data.msg);
					reject();
				} else {
					if (response.data.result && response.data.result.list && response.data.result.list.length > 0) {
						response.data.result.list.forEach(async (currentElement: any) => {
							if (parseInt(currentElement.type) == MideaDeviceType.AirConditioner || parseInt(currentElement.type) == MideaDeviceType.Dehumidifier) {
								const uuid = this.api.hap.uuid.generate(currentElement.id)
								const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid)

								if (existingAccessory) {
									this.log.debug('Restoring cached accessory', existingAccessory.displayName)
									existingAccessory.context.deviceId = currentElement.id
									existingAccessory.context.deviceType = parseInt(currentElement.type)
									existingAccessory.context.name = currentElement.name
									this.api.updatePlatformAccessories([existingAccessory])

									var ma = new MideaAccessory(this, existingAccessory, currentElement.id, parseInt(currentElement.type), currentElement.name, currentElement.userId)
									this.mideaAccessories.push(ma)
								} else {
									this.log.debug('Adding new device:', currentElement.name)
									const accessory = new this.api.platformAccessory(currentElement.name, uuid)
									accessory.context.deviceId = currentElement.id
									accessory.context.name = currentElement.name
									accessory.context.deviceType = parseInt(currentElement.type)
									var ma = new MideaAccessory(this, accessory, currentElement.id, parseInt(currentElement.type), currentElement.name, currentElement.userId)
									this.api.registerPlatformAccessories('homebridge-midea', 'midea', [accessory])

									this.mideaAccessories.push(ma)
								}
								// this.log.debug('mideaAccessories now contains', this.mideaAccessories)
							} else {
								this.log.warn('Device ' + currentElement.name + ' is of unsupported type ' + MideaDeviceType[parseInt(currentElement.type)])
								this.log.warn('Please open an issue on GitHub with your specific device model')
							}
						});
						resolve();

					} else {
						this.log.error('getUserList invalid response');
						reject();
					}
				}

			} catch(err) {
				this.log.debug('getUserList error', err);
				reject();
			}

		});
	}
	async sendCommand(device: MideaAccessory, order: any) {
		return new Promise(async (resolve, reject) => {
			if (device) {


				const orderEncode = Utils.encode(order);
				const orderEncrypt = Utils.encryptAes(orderEncode, this.dataKey);

				const form :any = {
					applianceId: device.deviceId,
					src: Constants.RequestSource,
					format:	Constants.RequestFormat,
					funId: "FC02", //maybe it is also "0000"
					order: orderEncrypt,
					stamp: Utils.getStamp(),
					language: Constants.Language,
					sessionId: this.sessionId,
				};
				const url = "/appliance/transparent/send";
				const sign = Utils.getSign(url, form);
				form.sign = sign;

				//this.log.debug('sendCommand request', qs.stringify(form));
				try {
					const response = await this.apiClient.post(url, qs.stringify(form))

					if (response.data.errorCode && response.data.errorCode != '0') {
						this.log.error('sendCommand returned error', response.data.msg)
						reject();
					} else {

						this.log.debug("send successful");
						let applianceResponse : any
						if (device.deviceType == MideaDeviceType.AirConditioner) {
							applianceResponse = new ACApplianceResponse(Utils.decode(Utils.decryptAes(response.data.result.reply, this.dataKey)));
							device.targetTemperature = applianceResponse.targetTemperature;
							device.indoorTemperature = applianceResponse.indoorTemperature;
							device.useFahrenheit = applianceResponse.tempUnit

							this.log.debug('useFahrenheit is set to', applianceResponse.tempUnit)
							this.log.debug('ecoMode is set to', applianceResponse.ecoMode)
							this.log.debug('target temperature', applianceResponse.targetTemperature);

						} else if (device.deviceType == MideaDeviceType.Dehumidifier) {
							applianceResponse = new DehumidifierApplianceResponse(Utils.decode(Utils.decryptAes(response.data.result.reply, this.dataKey)));
							device.humidty = applianceResponse.humidity
							this.log.debug('humidity is at', device.humidty)

						}
						device.fanSpeed = applianceResponse.fanSpeed;
						device.powerState = applianceResponse.powerState ? 1 : 0
						device.swingMode = applianceResponse.swingMode;
						device.operationalMode = applianceResponse.operationalMode;

						device.ecoMode = applianceResponse.ecoMode

						this.log.debug('fanSpeed is set to', applianceResponse.fanSpeed);
						this.log.debug('swingMode is set to', applianceResponse.swingMode);
						this.log.debug('powerState is set to', applianceResponse.powerState);
						this.log.debug('operational mode is set to', applianceResponse.operationalMode);


						this.log.debug('Full data is', Utils.formatResponse(applianceResponse.data))

						resolve();
					}

				} catch(err) {
					this.log.error('sendCommand request failed', err);
					reject();

				}
			} else {
				this.log.error('No device specified');
				reject();
			}
		});
	}

	updateValues() {
		const header = [90, 90, 1, 16, 89, 0, 32, 0, 80, 0, 0, 0, 169, 65, 48, 9, 14, 5, 20, 20, 213, 50, 1, 0, 0, 17, 0, 0, 0, 4, 2, 0, 0, 1, 0, 0, 0, 0, 0, 0];


		const data = header.concat(Constants.UpdateCommand);


		this.accessories.forEach(async (accessory: PlatformAccessory) => {
			// this.log.debug('current ma are ', this.mideaAccessories)
			this.log.debug('update accessory',accessory.context.deviceId)
			// this.log.debug(JSON.stringify(this.mideaAccessories))
			let mideaAccessory = this.mideaAccessories.find(ma => ma.deviceId == accessory.context.deviceId)
			if (mideaAccessory === undefined) {
				this.log.warn('Could not find accessory with id', accessory.context.deviceId)
			} else {
				try {
					if (mideaAccessory.deviceType == MideaDeviceType.AirConditioner) {
						const response = await this.sendCommand(mideaAccessory, data)
						this.log.debug('Update successful')
					} else if (mideaAccessory.deviceType == MideaDeviceType.Dehumidifier) {
						
						let updateCommand = [90, 90, 1, 0, 89, 0, 32, 0, 1, 0, 0, 0, 39, 36, 17, 9, 13, 10, 18, 20, 218, 73, 0, 0, 0, 16, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 170, 32, 161, 0, 0, 0, 0, 0, 3, 3, 65, 33, 0, 255, 3, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 36, 164, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
						const response = await this.sendCommand(mideaAccessory, updateCommand)
						this.log.debug('sent update command to dehumidifier')
					}
					
				} catch (err) {
					this.log.debug(err);
					this.log.debug("Try to relogin");
					try {
						const loginResponse = await this.login();
						this.log.debug("Login successful");
						try {
							const commandResponse = await this.sendCommand(mideaAccessory, data)
						} catch (err) {
							this.log.warn("update Command still failed after relogin");
						}
					} catch (err) {
						this.log.warn("Login failed");
					}

				}
			}
		});
	}

	async getFirmwareVersionOfDevice(device: MideaAccessory) {
		return new Promise(async (resolve, reject) => {
			let requestObject : object = {
				applianceId: device.deviceId,
				userId: device.userId
			};
			let json = JSON.stringify(requestObject);
			json = json.split(',').join(', ');
			this.log.debug('sending json', json);
			let data = Utils.encryptAesString(json, this.dataKey);

			this.log.debug('firmware req: encrypted string is', data);
			const form :any = {
				appId: Constants.AppId,
				data: data,
				format: Constants.RequestFormat,
				language: Constants.Language,
				protoType: '0x01',
				serviceUrl: '/ota/version',
				sessionId: this.sessionId,
				src: Constants.RequestSource,
				stamp: Utils.getStamp()
			};
			const url = "/app2base/data/transmit?serviceUrl=/ota/version";
			const sign = Utils.getSign(url, form);

			form.sign = sign;
			let formQS = qs.stringify(form);
			formQS = formQS.split('%2F').join('/');
			const goodString = formQS.split('&').sort().map((val :any) => {
				let [k,v] = val.split('=');
				return [k, v.split(',').sort().join(',')].join('=');
			}).join('&');

			this.log.debug('we are sending the following form', goodString)
			try {
				const response = await this.apiClient.post(url, goodString)

				this.log.debug(response.data);
				if (response.data.errorCode && response.data.errorCode != '0') { 
					this.log.warn('Failed get firmware', response.data.msg);
					reject();		
				} else {
					let decryptedString = Utils.decryptAesString(response.data.result.returnData, this.dataKey)
					this.log.debug('Got firmware response', decryptedString)
					let responseObject = JSON.parse(decryptedString)
					device.firmwareVersion = responseObject.result.version
					this.log.debug('got firmware version', device.firmwareVersion)
					resolve();
				}
				resolve();
			} catch(err) {
				this.log.warn('Failed get firmware', err);
				reject();
			}





		});
	}

	async sendUpdateToDevice(device?: MideaAccessory) {
		if (device) {

			let command : any
			if (device.deviceType == MideaDeviceType.AirConditioner) {
				command = new ACSetCommand();
				command.useFahrenheit = device.useFahrenheit
				command.targetTemperature = device.targetTemperature;

			} else if (device.deviceType == MideaDeviceType.Dehumidifier) {
				command = new DehumidifierSetCommand()
			}
			command.powerState = device.powerState;
			command.swingMode = device.swingMode;
			command.fanSpeed = device.fanSpeed;
			command.operationalMode = device.operationalMode

			command.ecoMode = device.ecoMode
			//operational mode for workaround with fan only mode on device
			const pktBuilder = new PacketBuilder();
			pktBuilder.command = command;
			const data = pktBuilder.finalize();
			this.log.debug("Command: " + JSON.stringify(command));
			this.log.debug("Command + Header: " + JSON.stringify(data));
			try {
				const response = await this.sendCommand(device, data)
				this.log.debug('Sent update to device '+ device.name)
			} catch (err) {
				this.log.debug(err);
				this.log.warn("Trying to relogin");
				try {
					const loginResponse = await this.login()
					this.log.debug("Login successful");
					try {
						await this.sendCommand(device, data)
					} catch (err) {
						this.log.error("Command still failed after relogin");

					}
				} catch(err) {
					this.log.error("Login failed");
				}
			}
			//after sending, update because sometimes the api hangs
			this.updateValues();
		}
	}

	getDeviceSpecificOverrideValue(deviceId: string, key: string) {
		if (this.config) {
			if (this.config.hasOwnProperty('devices')) {
				for (let i=0; i<this.config.devices.length; i++) {
					if (this.config.devices[i].deviceId == deviceId) {
						return this.config.devices[i][key];
					}
				}
			}
		}
		return null;
	}


	configureAccessory(accessory: PlatformAccessory) {
		this.log.info('Loading accessory from cache:', accessory.displayName);
		// add the restored accessory to the accessories cache so we can track if it has already been registered
		this.accessories.push(accessory);
	}


}









