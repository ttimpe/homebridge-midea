"use strict";





// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const request = require("request");
const traverse = require("traverse");
const crypto = require("crypto");

const ApplianceResponse = require('./ApplianceResponse.js');
const SetCommand = require('./SetCommand.js');
const PacketBuilder = require('./PacketBuilder.js');

let Service;
let Characteristic;
module.exports = function(homebridge) {
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;
	homebridge.registerAccessory('homebridge-midea', 'midea', MideaAccessory);
};


class MideaAccessory {

	constructor(log, config) {


		this.jar = request.jar();
		this.updateInterval = null;
		this.reauthInterval = null;
		this.atoken;
		this.sId;
		this.hgIdArray = [];
		this.appKey = "ff0cf6f5f0c3471de36341cab3f7a9af";

		this.baseHeader = {
			"User-Agent": "Dalvik/2.1.0 (Linux; U; Android 7.0; SM-G935F Build/NRD90M)",
		};
		this.log = log;
		this.config = config;
		this.enabledServices = [];


		this.targetTemperature = 0;
		this.indoorTemperature = 0;
		this.powerState = Characteristic.Active.INACTIVE;
		this.operationalMode = 0;

		this.informationService = new Service.AccessoryInformation();
		this.informationService
		.setCharacteristic(Characteristic.Manufacturer, 'midea')
		.setCharacteristic(Characteristic.Model, this.name)
		.setCharacteristic(Characteristic.SerialNumber, this.id)
		.setCharacteristic(Characteristic.FirmwareRevision, '0.0.1');

		this.service = new Service.HeaterCooler();




		this.thermostatService = new Service.Thermostat();

      // create handlers for required characteristics
      this.thermostatService.getCharacteristic(Characteristic.CurrentHeatingCoolingState)
      .on('get', this.handleCurrentHeatingCoolingStateGet.bind(this));

      this.thermostatService.getCharacteristic(Characteristic.TargetHeatingCoolingState)
      .on('get', this.handleTargetHeatingCoolingStateGet.bind(this))
      .on('set', this.handleTargetHeatingCoolingStateSet.bind(this));

      this.thermostatService.getCharacteristic(Characteristic.CurrentTemperature)
      .on('get', this.handleCurrentTemperatureGet.bind(this));

      this.thermostatService.getCharacteristic(Characteristic.TargetTemperature)
      .on('get', this.handleTargetTemperatureGet.bind(this))
      .on('set', this.handleTargetTemperatureSet.bind(this));

      this.thermostatService.getCharacteristic(Characteristic.TemperatureDisplayUnits)
      .on('get', this.handleTemperatureDisplayUnitsGet.bind(this))
      .on('set', this.handleTemperatureDisplayUnitsSet.bind(this));



      this.enabledServices.push(this.informationService);
      this.enabledServices.push(this.thermostatService);

      this.onReady();




  }

   /**
   * Handle requests to get the current value of the "Active" characteristic
   */
   handleActiveGet(callback) {
   	this.log.debug('Triggered GET Active, returning', this.powerState);

    // set this to a valid value for Active

    callback(null, this.powerState);
}

  /**
   * Handle requests to set the "Active" characteristic
   */
   handleActiveSet(value, callback) {
   	this.log.debug('Triggered SET Active:', value);
   	if (this.powerState != value) {
   		this.powerState = value;
   		this.sendUpdateToDevice();
   	}
   	callback(null, value);
   }




  /**
   * Handle requests to get the current value of the "Current Temperature" characteristic
   */
   handleCurrentTemperatureGet(callback) {
   	this.log('Triggered GET CurrentTemperature');

    // set this to a valid value for CurrentTemperature
    const currentValue = this.indoorTemperature;

    callback(null, currentValue);
}


/**
   * Handle requests to get the current value of the "Current Heating Cooling State" characteristic
   */
   handleCurrentHeatingCoolingStateGet(callback) {
   	this.log('Triggered GET CurrentHeatingCoolingState');

    // set this to a valid value for CurrentHeatingCoolingState

    let currentValue = 2;
    if (this.powerState === 0) {
    	currentValue = 0;
    }



    callback(null, currentValue);
}


  /**
   * Handle requests to get the current value of the "Target Heating Cooling State" characteristic
   */
   handleTargetHeatingCoolingStateGet(callback) {
   	this.log('Triggered GET TargetHeatingCoolingState');

    // set this to a valid value for TargetHeatingCoolingState
    let currentValue = 2;
    if (this.powerState === 0) {
    	currentValue = 0;
    }
    callback(null, currentValue);
}

  /**
   * Handle requests to set the "Target Heating Cooling State" characteristic
   */
   handleTargetHeatingCoolingStateSet(value, callback) {
   	this.log('Triggered SET TargetHeatingCoolingState:', value);

   	switch (value) {
   		case 0:
   		this.powerState = 0;
   		break;
   		default:
   		this.powerState = 1;
   		break;
   	}
   	this.sendUpdateToDevice();
   	callback(null, value);
   }

  /**
   * Handle requests to get the current value of the "Target Temperature" characteristic
   */
   handleTargetTemperatureGet(callback) {
   	this.log('Triggered GET TargetTemperature');

    // set this to a valid value for TargetTemperature
    const currentValue = this.targetTemperature;

    callback(null, currentValue);
}

  /**
   * Handle requests to set the "Target Temperature" characteristic
   */
   handleTargetTemperatureSet(value, callback) {
   	this.log('Triggered SET TargetTemperature:', value);
   	if (this.targetTemperature != value) {
   		this.targetTemperature = value;
   		this.sendUpdateToDevice();
   	}
   	callback(null, value);
   }

  /**
   * Handle requests to get the current value of the "Temperature Display Units" characteristic
   */
   handleTemperatureDisplayUnitsGet(callback) {
   	this.log('Triggered GET TemperatureDisplayUnits');

    // set this to a valid value for TemperatureDisplayUnits
    const currentValue = 1;

    callback(null, currentValue);
}

  /**
   * Handle requests to set the "Temperature Display Units" characteristic
   */
   handleTemperatureDisplayUnitsSet(value, callback) {
   	this.log('Triggered SET TemperatureDisplayUnits:', value);

   	callback(null);
   }



     async onReady() {

     	this.login()
     	.then(() => {
     		this.log("Login successful");
     		this.getUserList()
     		.then(() => {
     			this.updateValues();
     		})
     		.catch(() => {
     			this.log("Get Devices failed");
     		});
     		this.updateInterval = setInterval(() => {
     			this.updateValues();
     		}, this.config['interval'] * 60 * 1000);
     	})
     	.catch(() => {
     		this.log("Login failed");
     	});

     }
     login() {
     	return new Promise((resolve, reject) => {
     		this.jar = request.jar();
     		const form = {
     			loginAccount: this.config['user'],
     			clientType: "1",
     			src: "17",
     			appId: "1117",
     			format: "2",
     			stamp: this.getStamp(),
     			language: "de_DE",
     		};
     		const url = "https://mapp.appsmb.com/v1/user/login/id/get";
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
     		(err, resp, body) => {
     			if (err || (resp && resp.statusCode >= 400) || !body) {
     				this.log("Failed to login");
     				err && this.log(err);
     				body && this.log(JSON.stringify(body));
     				resp && this.log(resp.statusCode);
     				reject();
     				return;
     			}
     			this.log(JSON.stringify(body));
     			if (body.errorCode && body.errorCode !== "0") {
     				this.log(body.msg);
     				this.log(body.errorCode);
     				reject();
     				return;
     			}
     			if (body.result) {
     				const loginId = body.result.loginId;
     				const password = this.getSignPassword(loginId);
     				const form = {
     					loginAccount: this.config['user'],
     					src: "17",
     					format: "2",
     					stamp: this.getStamp(),
     					language: "de_DE",
     					password: password,
     					clientType: "1",
     					appId: "1117",
     				};
     				const url = "https://mapp.appsmb.com/v1/user/login";
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
     				(err, resp, body) => {
     					if (err || (resp && resp.statusCode >= 400) || !body) {
     						this.log("Failed to login");
     						err && this.log(err);
     						body && this.log(JSON.stringify(body));
     						resp && this.log(resp.statusCode);
     						reject();
     						return;
     					}
     					this.log(JSON.stringify(body));
     					if (body.errorCode && body.errorCode !== "0") {
     						this.log(body.msg);
     						this.log(body.errorCode);
     						reject();
     						return;
     					}
     					if (body.result) {
     						this.atoken = body.result.accessToken;
     						this.sId = body.result.sessionId;
     						this.generateDataKey();
     						resolve();
     					}
     				}
     				);
     			}
     		}
     		);
     	});
     }
     getUserList() {
     	this.log('getUserList called');
     	return new Promise((resolve, reject) => {
     		const form = {
     			src: "17",
     			format: "2",
     			stamp: this.getStamp(),
     			language: "de_DE",
     			sessionId: this.sId,
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
     		(err, resp, body) => {
     			if (err || (resp && resp.statusCode >= 400) || !body) {
     				this.log("Failed to login");
     				err && this.log(err);
     				body && this.log(JSON.stringify(body));
     				resp && this.log(resp.statusCode);
     				reject();
     				return;
     			}

     			this.log(JSON.stringify(body));
     			if (body.errorCode && body.errorCode !== "0") {
     				this.log(body.msg);
     				this.log(body.errorCode);
     				reject();
     				return;
     			}
     			try {
     				if (body.result && body.result.list && body.result.list.length > 0) {
     					this.log('getUserList result is', body.result);
     					body.result.list.forEach(async (currentElement) => {
     						this.hgIdArray.push(currentElement.id);


     					});
     				}
     				resolve();
     			} catch (error) {
     				this.log(error);
     				this.log(error.stack);
     				reject();
     			}
     		}
     		);
     	});
     }
     sendCommand(applianceId, order) {
     	return new Promise((resolve, reject) => {
     		const orderEncode = this.encode(order);
     		const orderEncrypt = this.encryptAes(orderEncode);

     		const form = {
     			applianceId: applianceId,
     			src: "17",
     			format: "2",
                funId: "FC02", //maybe it is also "0000"
                order: orderEncrypt,
                stamp: this.getStamp(),
                language: "de_DE",
                sessionId: this.sId,
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
            (err, resp, body) => {
            	if (err || (resp && resp.statusCode >= 400) || !body) {
            		this.log("Failed to send command");
            		err && this.log(err);
            		body && this.log(JSON.stringify(body));
            		resp && this.log(resp.statusCode);
            		reject(err);
            		return;
            	}

            	this.log(JSON.stringify(body));
            	if (body.errorCode && body.errorCode !== "0") {
            		if (body.errorCode === "3123") {
            			this.log("Cannot reach " + applianceId + " " + body.msg);

            			resolve();
            			return;
            		}
            		if (body.errorCode === "3176") {
            			this.log("Command was not accepted by device. Command wrong or device not reachable " + applianceId + " " + body.msg);

            			resolve();
            			return;
            		}
            		this.log("Sending failed device returns an error");
            		this.log(body.errorCode);
            		this.log(body.msg);
            		reject(body.msg);
            		return;
            	}
            	try {
            		this.log("send successful");

            		const response = new ApplianceResponse(this.decode(this.decryptAes(body.result.reply)));
            		const properties = Object.getOwnPropertyNames(ApplianceResponse.prototype).slice(1);

            		this.log('target temperature', response.targetTemperature);

            		this.targetTemperature = response.targetTemperature;
            		this.indoorTemperature = response.indoorTemperature;
            		this.powerState = response.powerState;
            		this.log('operational mode is set to', response.operationalMode);


            		this.operationalMode = response.operationalMode;

            		properties.forEach((element) => {
            			let value = response[element];

            			if (typeof value === "object" && value !== null) {
            				value = JSON.stringify(value);
            			}

            		});
            		resolve();
            	} catch (error) {
            		this.log(error);

            		this.log(error.stack);
            		reject();
            	}
            }
            );
        });
     }
     getSign(path, form) {
     	const postfix = "/" + path.split("/").slice(3).join("/");
     	const ordered = {};
     	Object.keys(form)
     	.sort()
     	.forEach(function (key) {
     		ordered[key] = form[key];
     	});
     	const query = Object.keys(ordered)
     	.map((key) => key + "=" + ordered[key])
     	.join("&");

     	return crypto
     	.createHash("sha256")
     	.update(postfix + query + this.appKey)
     	.digest("hex");
     }
     getSignPassword(loginId) {
     	const pw = crypto.createHash("sha256").update(this.config.password).digest("hex");

     	return crypto
     	.createHash("sha256")
     	.update(loginId + pw + this.appKey)
     	.digest("hex");
     }
     getStamp() {
     	const date = new Date();
     	return date.toISOString().slice(0, 19).replace(/-/g, "").replace(/:/g, "").replace(/T/g, "");
     }

     generateDataKey() {
     	const md5AppKey = crypto.createHash("md5").update(this.appKey).digest("hex");
     	const decipher = crypto.createDecipheriv("aes-128-ecb", md5AppKey.slice(0, 16), "");
     	const dec = decipher.update(this.atoken, "hex", "utf8");
     	this.dataKey = dec;
     	return dec;
     }
     decryptAes(reply) {
     	if (!this.dataKey) {
     		this.generateDataKey();
     	}
     	const decipher = crypto.createDecipheriv("aes-128-ecb", this.dataKey, "");
     	const dec = decipher.update(reply, "hex", "utf8");
     	return dec.split(",");
     }
     encode(data) {
     	const normalized = [];
     	for (let b of data) {
     		b = parseInt(b);
     		if (b >= 128) {
     			b = b - 256;
     		}
     		normalized.push(b);
     	}
     	return normalized;
     }
     decode(data) {
     	const normalized = [];
     	for (let b of data) {
     		b = parseInt(b);
     		if (b < 0) {
     			b = b + 256;
     		}
     		normalized.push(b);
     	}
     	return normalized;
     }
     encryptAes(query) {
     	if (!this.dataKey) {
     		this.generateDataKey();
     	}
     	const cipher = crypto.createCipheriv("aes-128-ecb", this.dataKey, "");
     	let ciph = cipher.update(query.join(","), "utf8", "hex");
     	ciph += cipher.final("hex");
     	return ciph;
     }

     updateValues() {
     	const header = [90, 90, 1, 16, 89, 0, 32, 0, 80, 0, 0, 0, 169, 65, 48, 9, 14, 5, 20, 20, 213, 50, 1, 0, 0, 17, 0, 0, 0, 4, 2, 0, 0, 1, 0, 0, 0, 0, 0, 0];
     	const updateCommand = [
     	170,
     	32,
     	172,
     	0,
     	0,
     	0,
     	0,
     	0,
     	0,
     	3,
     	65,
     	129,
     	0,
     	255,
     	3,
     	255,
     	0,
     	2,
     	0,
     	0,
     	0,
     	0,
     	0,
     	0,
     	0,
     	0,
     	0,
     	0,
     	0,
     	0,
     	3,
     	205,
     	156,
     	16,
     	184,
     	113,
     	186,
     	162,
     	129,
     	39,
     	12,
     	160,
     	157,
     	100,
     	102,
     	118,
     	15,
     	154,
     	166,
     	];

     	const data = header.concat(updateCommand);
     	this.hgIdArray.forEach((element) => {
     		this.sendCommand(element, data)
     		.then(() => {
     			this.log("Update successful");
     		})
     		.catch((error) => {
     			this.log(error);
     			this.log("Try to relogin");
     			this.login()
     			.then(() => {
     				this.log("Login successful");
     				this.sendCommand(element, data).catch((error) => {
     					this.log("update Command still failed after relogin");
     				});
     			})
     			.catch(() => {
     				this.log("Login failed");
     			});
     		});
     	});
     }


     sendUpdateToDevice() {
     	const command = new SetCommand();
     	command.powerState = this.powerState;
     	command.targetTemperature = this.targetTemperature;
     	const pktBuilder = new PacketBuilder();
     	pktBuilder.command = command;
     	const data = pktBuilder.finalize();
     	this.log("Command: " + JSON.stringify(command));
     	this.log("Command + Header: " + JSON.stringify(data));
     	this.sendCommand(this.hgIdArray[0], data).catch((error) => {
     		this.log(error);
     		this.log("Try to relogin");
     		this.login()
     		.then(() => {
     			this.log("Login successful");
     			this.sendCommand(this.deviceId, data).catch((error) => {
     				this.log("Command still failed after relogin");
     			});
     		})
     		.catch(() => {
     			this.log("Login failed");
     			this.setState("info.connection", false, true);
     		});
     	});
     }




     getServices() {
     	return this.enabledServices;
     }
 }









