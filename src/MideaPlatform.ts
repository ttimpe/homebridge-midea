import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const request = require("request");
const traverse = require("traverse");
const crypto = require("crypto");

import Utils from './Utils'
import Constants from './Constants'
import ApplianceResponse from './ApplianceResponse'
import SetCommand from './SetCommand'
import PacketBuilder from './PacketBuilder'

import { MideaAccessory } from './MideaAccessory'
import { MideaDeviceType } from './MideaDeviceType'
import { MideaErrorCodes } from './MideaErrorCodes' 





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
	public readonly accessories: PlatformAccessory[] = [];
	mideaAccessories : MideaAccessory[] = []

	// service: any
	//  fanService: any
	// informationService : any

	constructor(public readonly log: Logger, public readonly config: PlatformConfig, public readonly api : API) {

		this.jar = request.jar();



		this.baseHeader = { 'User-Agent': Constants.UserAgent }
		this.log = log;
		this.config = config;
		api.on('didFinishLaunching', () => {
			this.onReady();
		})
	}


	async onReady() {
		this.login().then(() => {
			this.log.debug("Login successful");
			this.getUserList().then(() => {
				this.updateValues();
			}).catch(() => {
				this.log.debug("Get Devices failed");
			});
			this.updateInterval = setInterval(() => {
				this.updateValues();
			}, this.config['interval'] * 60 * 1000);
		}).catch(() => {
			this.log.debug("Login failed");
		});
	}
	login() {
		return new Promise((resolve, reject) => {
			this.jar = request.jar();
			const url = "https://mapp.appsmb.com/v1/user/login/id/get";

			const form : any = {
				loginAccount: this.config['user'],
				clientType: Constants.ClientType,
				src: Constants.RequestSource,
				appId: Constants.AppId,
				format: Constants.RequestFormat,
				stamp: Utils.getStamp(),
				language: Constants.Language
			};
			const sign = this.getSign(url, form);
			form.sign = sign;

			request.post(
			{
				url: url,
				headers: this.baseHeader,
				followAllRedirects: true,
				json: true,
				form: form,
				jar: this.jar,
				gzip: true
			},
			(err :any, resp :any, body :any) => {
				if (err || (resp && resp.statusCode >= 400) || !body) {
					this.log.debug("Failed to login");
					err && this.log.debug(err);
					body && this.log.debug(JSON.stringify(body));
					resp && this.log.debug(resp.statusCode);
					reject();
					return;
				}
				this.log.debug(JSON.stringify(body));
				if (body.errorCode && body.errorCode !== "0") {
					this.log.debug(body.msg);
					this.log.debug(body.errorCode);
					reject();
					return;
				}
				if (body.result) {
					const loginId :string = body.result.loginId;
					const password : string = this.getSignPassword(loginId);
					const url = "https://mapp.appsmb.com/v1/user/login";
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

					const sign = this.getSign(url, form);
					form.sign = sign;

					request.post(
					{
						url: url,
						headers: this.baseHeader,
						followAllRedirects: true,
						json: true,
						form: form,
						jar: this.jar,
						gzip: true,
					},

					(err: any, resp: any, body: any) => {
						if (err || (resp && resp.statusCode >= 400) || !body) {
							this.log.debug("Failed to login");
							err && this.log.debug(err);
							body && this.log.debug(JSON.stringify(body));
							resp && this.log.debug(resp.statusCode);
							reject();
							return;
						}

						this.log.debug(JSON.stringify(body));
						if (body.errorCode && body.errorCode !== "0") {
							this.log.debug(body.msg);
							this.log.debug(body.errorCode);
							reject();
							return;
						}
						if (body.result) {
							this.atoken = body.result.accessToken;
							this.sessionId = body.result.sessionId;
							this.generateDataKey();
							resolve();
						}
					});
				}
			});
		});
	}
	getUserList() {
		this.log.debug('getUserList called');
		return new Promise((resolve, reject) => {
			const form :any = {
				src: Constants.RequestSource,
				format: Constants.RequestFormat,
				stamp: Utils.getStamp(),
				language: Constants.Language,
				sessionId: this.sessionId
			};
			const url = "https://mapp.appsmb.com/v1/appliance/user/list/get";
			const sign = this.getSign(url, form);
			form.sign = sign;
			request.post(
			{
				url: url,
				headers: this.baseHeader,
				followAllRedirects: true,
				json: true,
				form: form,
				jar: this.jar,
				gzip: true,
			},
			(err: any, resp: any, body: any) => {
				if (err || (resp && resp.statusCode >= 400) || !body) {
					this.log.debug("Failed to login");
					err && this.log.debug(err);
					body && this.log.debug(JSON.stringify(body));
					resp && this.log.debug(resp.statusCode);
					reject();
					return;
				}

				this.log.debug(JSON.stringify(body));
				if (body.errorCode && body.errorCode !== "0") {
					this.log.debug(body.msg);
					this.log.debug(body.errorCode);
					reject();
					return;
				}
				try {
					if (body.result && body.result.list && body.result.list.length > 0) {
						this.log.debug('getUserList result is', body.result);
						body.result.list.forEach(async (currentElement: any) => {
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
					}
					resolve();
				} catch (error) {
					this.log.debug(error);
					this.log.debug(error.stack);
					reject();
				}
			}
			);
		});
	}
	sendCommand(device
		: MideaAccessory, order: any) {
		if (device) {
			return new Promise((resolve, reject) => {
				const orderEncode = Utils.encode(order);
				const orderEncrypt = this.encryptAes(orderEncode);

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
				const url = "https://mapp.appsmb.com/v1/appliance/transparent/send";
				const sign = this.getSign(url, form);
				form.sign = sign;
				request.post(
				{
					url: url,
					headers: this.baseHeader,
					followAllRedirects: true,
					json: true,
					form: form,
					jar: this.jar,
					gzip: true,
				},
				(err: any, resp: any, body: any) => {
					if (err || (resp && resp.statusCode >= 400) || !body) {
						this.log.debug("Failed to send command");
						err && this.log.debug(err);
						body && this.log.debug(JSON.stringify(body));
						resp && this.log.debug(resp.statusCode);
						reject(err);
						return;
					}

					this.log.debug(JSON.stringify(body));
					if (body.errorCode && body.errorCode !== "0") {
						if (body.errorCode == MideaErrorCodes.DeviceUnreachable) {
							this.log.debug("Cannot reach " + device.deviceId + " " + body.msg);

							resolve();
							return;
						}
						if (body.errorCode == MideaErrorCodes.CommandNotAccepted) {
							this.log.debug("Command was not accepted by device. Command wrong or device not reachable " + device.deviceId + " " + body.msg);

							resolve();
							return;
						}
						this.log.debug("Sending failed device returns an error");
						this.log.debug(body.errorCode);
						this.log.debug(body.msg);
						reject(body.msg);
						return;
					}
					try {
						this.log.debug("send successful");

						const response :ApplianceResponse = new ApplianceResponse(Utils.decode(this.decryptAes(body.result.reply)));
						const properties = Object.getOwnPropertyNames(ApplianceResponse.prototype).slice(1);

						this.log.debug('target temperature', response.targetTemperature);

						device.targetTemperature = response.targetTemperature;
						device.indoorTemperature = response.indoorTemperature;
						device.fanSpeed = response.fanSpeed;
						device.powerState = response.powerState ? 1 : 0
						device.swingMode = response.swingMode;
						device.operationalMode = response.operationalMode;
						device.humidty = response.humidity
						device.useFahrenheit = response.tempUnit
						this.log.debug('fanSpeed is set to', response.fanSpeed);
						this.log.debug('swingMode is set to', response.swingMode);
						this.log.debug('powerState is set to', response.powerState);
						this.log.debug('operational mode is set to', response.operationalMode);
						this.log.debug('useFahrenheit is set to', response.tempUnit)

						this.log.debug('Full data is', Utils.formatResponse(response.data))

						resolve();
					} catch (error) {
						this.log.debug(body);
						this.log.debug(error);

						this.log.debug(error.stack);
						reject();
					}
				}
				);
			});
		} else {
			this.log.debug('No device specified')
		}
	}
	getSign(path: string, form: any) {
		let postfix = "/" + path.split("/").slice(3).join("/");
		// Maybe this will help, should remove any query string parameters in the URL from the sign
		postfix = postfix.split('?')[0]
		const ordered : any = {};
		Object.keys(form)
		.sort()
		.forEach(function (key: any) {
			ordered[key] = form[key];
		});
		const query = Object.keys(ordered)
		.map((key) => key + "=" + ordered[key])
		.join("&");

		return crypto
		.createHash("sha256")
		.update(postfix + query + Constants.AppKey)
		.digest("hex");
	}
	getSignPassword(loginId: string) {
		const pw = crypto.createHash("sha256").update(this.config.password).digest("hex");

		return crypto
		.createHash("sha256")
		.update(loginId + pw + Constants.AppKey)
		.digest("hex");
	}


	generateDataKey() {
		const md5AppKey = crypto.createHash("md5").update(Constants.AppKey).digest("hex");
		const decipher = crypto.createDecipheriv("aes-128-ecb", md5AppKey.slice(0, 16), "");
		const dec = decipher.update(this.atoken, "hex", "utf8");
		this.dataKey = dec;
		return dec;
	}
	decryptAes(reply: number[]) {
		if (!this.dataKey) {
			this.generateDataKey();
		}
		const decipher = crypto.createDecipheriv("aes-128-ecb", this.dataKey, "");
		const dec = decipher.update(reply, "hex", "utf8");
		return dec.split(",");
	}
	decryptAesString(reply: number[]) {
		if (!this.dataKey) {
			this.generateDataKey();
		}
		const decipher = crypto.createDecipheriv("aes-128-ecb", this.dataKey, "");
		const dec = decipher.update(reply, "hex", "utf8");
		return dec;
	}


	encryptAes(query: number[]) {
		if (!this.dataKey) {
			this.generateDataKey();
		}
		const cipher = crypto.createCipheriv("aes-128-ecb", this.dataKey, "");
		let ciph = cipher.update(query.join(","), "utf8", "hex");
		ciph += cipher.final("hex");
		return ciph;
	}
	encryptAesString(query: string) {
		if (!this.dataKey) {
			this.generateDataKey();
		}
		const cipher = crypto.createCipheriv("aes-128-ecb", this.dataKey, "");
		let ciph = cipher.update(query, "utf8", "hex");
		ciph += cipher.final("hex");
		return ciph;
	}

	updateValues() {
		const header = [90, 90, 1, 16, 89, 0, 32, 0, 80, 0, 0, 0, 169, 65, 48, 9, 14, 5, 20, 20, 213, 50, 1, 0, 0, 17, 0, 0, 0, 4, 2, 0, 0, 1, 0, 0, 0, 0, 0, 0];


		const data = header.concat(Constants.UpdateCommand);


		this.accessories.forEach((accessory: PlatformAccessory) => {
			this.log.debug('update accessory',accessory.context.deviceId)
			// this.log.debug('current ma are ', this.mideaAccessories)
			let mideaAccessory = this.mideaAccessories.find(ma => ma.deviceId == accessory.context.deviceId)
			if (mideaAccessory === undefined) {
				this.log.debug('Could not find accessory with id', accessory.context.deviceId)
				
			} else {
				this.sendCommand(mideaAccessory, data)
				.then(() => {
					this.log.debug("Update successful");
				})
				.catch((error) => {
					this.log.debug(error);
					this.log.debug("Try to relogin");
					this.login()
					.then(() => {
						this.log.debug("Login successful");

						this.sendCommand(mideaAccessory, data).catch((error) => {
							this.log.debug("update Command still failed after relogin");
						});
					})
					.catch(() => {
						this.log.debug("Login failed");
					});
				});
			}
		});

	}

	getFirmwareVersionOfDevice(device: MideaAccessory) {
		let requestObject : object = {
			applianceId: device.deviceId,
			userId: device.userId
		};
		let data = this.encryptAesString(JSON.stringify(requestObject))

		this.log.debug('encrypted string is', data);
		this.log.debug(JSON.stringify(requestObject))
		return new Promise((resolve, reject) => {

			const form :any = {
				src: Constants.RequestSource,
				format: Constants.RequestFormat,
				protoType: '0x01',
				stamp: Utils.getStamp(),
				language: Constants.Language,
				sessionId: this.sessionId,
				data: data,
				appId: Constants.AppId,
				serviceUrl: '/ota/version'
			};
			const url = "https://mapp.appsmb.com/v1/app2base/data/transmit?serviceUrl=/ota/version";
			const sign = this.getSign(url, form);

			form.sign = sign;
			delete form.serviceUrl

			this.log.debug('we are sending the following form', form)
			request.post(
			{
				url: url,
				headers: this.baseHeader,
				followAllRedirects: true,
				json: true,
				form: form,
				jar: this.jar,
				gzip: true,
				proxy: 'http://192.168.1.252:8080',
				strictSSL: false

			}, (err: any, resp: any, body: any) => {
				if (err || (resp && resp.statusCode >= 400) || !body) {
					this.log.debug("Failed to send command");
					err && this.log.debug(err);
					body && this.log.debug(JSON.stringify(body));
					resp && this.log.debug(resp.statusCode);
					reject(err);
					return;
				}
				this.log.debug(JSON.stringify(body));
				if (body.errorCode && body.errorCode !== "0") {
					if (body.errorCode == MideaErrorCodes.DeviceUnreachable) {
						this.log.debug("Cannot reach " + device.deviceId + " " + body.msg);
						resolve();
						return;
					}
					if (body.errorCode == MideaErrorCodes.CommandNotAccepted) {
						this.log.debug("Command was not accepted by device. Command wrong or device not reachable " + device.deviceId + " " + body.msg);
						resolve();
						return;
					}
					this.log.debug("Sending failed device returns an error");
					this.log.debug(body.errorCode);
					this.log.debug(body.msg);
					reject(body.msg);
					return;
				}
				try {

					let decryptedString = this.decryptAesString(body.result.returnData)
					this.log.debug('Got firmware response', decryptedString)
					let responseObject = JSON.parse(decryptedString)
					device.firmwareVersion = responseObject.result.version
					this.log.debug('got firmware version', device.firmwareVersion)

					
				/*
					this.log.debug("send successful");
					const response :ApplianceResponse = new ApplianceResponse(Utils.decode(this.decryptAes(body.result.reply)));
					const properties = Object.getOwnPropertyNames(ApplianceResponse.prototype).slice(1);
					this.log.debug('target temperature', response.targetTemperature);

					device.targetTemperature = response.targetTemperature;
					device.indoorTemperature = response.indoorTemperature;
					device.fanSpeed = response.fanSpeed;
					device.powerState = response.powerState ? 1 : 0
					device.swingMode = response.swingMode;
					device.operationalMode = response.operationalMode;
					device.humidty = response.humidity
					device.useFahrenheit = response.tempUnit
					this.log.debug('fanSpeed is set to', response.fanSpeed);
					this.log.debug('swingMode is set to', response.swingMode);
					this.log.debug('powerState is set to', response.powerState);
					this.log.debug('operational mode is set to', response.operationalMode);
					*/
					resolve();
				} catch (error) {
					this.log.debug(body);
					this.log.debug(error);
					this.log.debug(error.stack);
					reject();
				}
			}
			);
		});
	}

	sendUpdateToDevice(device?: MideaAccessory) {
		if (device) {
			const command = new SetCommand();
			command.powerState = device.powerState;
			command.targetTemperature = device.targetTemperature;
			command.swingMode = device.swingMode;
			command.fanSpeed = device.fanSpeed;
			command.operationalMode = device.operationalMode
			command.useFahrenheit = device.useFahrenheit
			//operational mode for workaround with fan only mode on device
			const pktBuilder = new PacketBuilder();
			pktBuilder.command = command;
			const data = pktBuilder.finalize();
			this.log.debug("Command: " + JSON.stringify(command));
			this.log.debug("Command + Header: " + JSON.stringify(data));
			this.sendCommand(device, data).catch((error) => {
				this.log.debug(error);
				this.log.debug("Try to relogin");
				this.login().then(() => {
					this.log.debug("Login successful");
					this.sendCommand(device, data).catch((error) => {
						this.log.debug("Command still failed after relogin");
					});
				}).catch(() => {
					this.log.debug("Login failed");
				});
			});
			//after sending, update because sometimes the api hangs
			this.updateValues();
		}
	}



	configureAccessory(accessory: PlatformAccessory) {
		this.log.info('Loading accessory from cache:', accessory.displayName);
		// add the restored accessory to the accessories cache so we can track if it has already been registered
		this.accessories.push(accessory);
	}


}









