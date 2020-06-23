"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MideaPlatform = void 0;
// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const request = require("request");
const traverse = require("traverse");
const crypto = require("crypto");
const Utils_1 = __importDefault(require("./Utils"));
const Constants_1 = __importDefault(require("./Constants"));
const ApplianceResponse_1 = __importDefault(require("./ApplianceResponse"));
const SetCommand_1 = __importDefault(require("./SetCommand"));
const PacketBuilder_1 = __importDefault(require("./PacketBuilder"));
const MideaAccessory_1 = require("./MideaAccessory");
class MideaPlatform {
    // service: any
    //  fanService: any
    // informationService : any
    constructor(log, config, api) {
        this.log = log;
        this.config = config;
        this.api = api;
        this.Service = this.api.hap.Service;
        this.Characteristic = this.api.hap.Characteristic;
        this.updateInterval = null;
        this.reauthInterval = null;
        this.atoken = '';
        this.sId = '';
        this.dataKey = '';
        this.accessories = [];
        this.jar = request.jar();
        this.baseHeader = { 'User-Agent': Constants_1.default.UserAgent };
        this.log = log;
        this.config = config;
        // if (config.model) {
        //   this.name = config.model;
        // }
        // if (config.id) {
        //   this.id = config.id;
        // }
        // this.fanOnlyMode = config.fanOnlyMode || false;
        // this.fanOnlyModeName = config.fanOnlyModeName || 'Fan Only Mode';
        // this.temperatureSteps = config.temperatureSteps || 0.5;
        // // values from device are 0.0="Off",12.0="Vertical",3.0="Horizontal",15.0="Both"
        // switch (config.supportedSwingMode) {
        //   case 'Vertical':
        //   this.supportedSwingMode = 12;
        //   break;
        //   case 'Horizontal':
        //   this.supportedSwingMode = 3;
        //   break;
        //   case 'Both':
        //   this.supportedSwingMode = 15;
        //   break;
        //   default:
        //   this.supportedSwingMode = 0;
        //   break;
        // }
        // this.service = new Service.HeaterCooler();
        // this.fanService = new Service.Fanv2();
        // this.fanService.setCharacteristic(Characteristic.Name, this.fanOnlyModeName);
        // // create handlers for required characteristics
        // // for fan only mode
        // this.fanService.getCharacteristic(Characteristic.Active)
        // .on('get', this.handleFanActiveGet.bind(this))
        // .on('set', this.handleFanActiveSet.bind(this));
        // this.enabledServices.push(this.informationService);
        // this.enabledServices.push(this.service);
        // if (config.fanOnlyMode) {
        //   this.enabledServices.push(this.fanService);
        // }
        this.onReady();
    }
    //   /***
    // /**
    //    * Handle requests to get the current value of the "swingMode" characteristic
    //    */
    //    handleSwingModeGet(callback: Function) {
    //      this.log.debug('Triggered GET swingMode');
    //      // set this to a valid value for swingMode
    //      // values from device are 0.0="Off",12.0="Vertical",3.0="Horizontal",15.0="Both"
    //      let currentValue = Characteristic.SwingMode.disabled
    //      if (this.swingMode != 0 ){
    //        currentValue = Characteristic.SwingMode.enabled
    //      }
    //      callback(null, currentValue);
    //    }
    // 	/**
    // 	* Handle requests to set the "swingMode" characteristic
    // 	*/
    // 	handleSwingModeSet(value: number, callback: Function) {
    // 		this.log.debug('Triggered SET swingMode:', value);
    // 		// convert this.swingMode to a 0/1
    // 		var currentSwingMode = this.swingMode!=0?1:0
    // 		if (currentSwingMode != value) {
    // 			if(value == 0){
    // 				this.swingMode = 0;
    // 			}
    // 			else {
    // 				this.swingMode = this.supportedSwingMode;
    // 			}
    // 			this.sendUpdateToDevice();
    // 		}
    // 		callback(null, value);
    // 	}
    //    /**
    //    * Handle requests to get the current value of the "RotationSpeed" characteristic
    //    */
    //    handleRotationSpeedGet(callback: Function) {
    //      this.log.debug('Triggered GET RotationSpeed');
    //      // set this to a valid value for RotationSpeed
    //      // values from device are 20.0="Silent",40.0="Low",60.0="Medium",80.0="High",102.0="Auto"
    //      // convert to good usable slider in homekit in percent
    //      let currentValue = 0;
    //      if (this.fanSpeed == 40) {
    //        currentValue = 25;
    //      }
    //      else if (this.fanSpeed == 60){
    //        currentValue = 50;
    //      }
    //      else if (this.fanSpeed == 80){
    //        currentValue = 75;
    //      }
    //      else {
    //        currentValue = 100;
    //      }
    //      callback(null, currentValue);
    //    }
    // 	/**
    // 	* Handle requests to set the "RotationSpeed" characteristic
    // 	*/
    // 	handleRotationSpeedSet(value: number, callback: Function) {
    // 		this.log.debug('Triggered SET RotationSpeed:', value);
    // 		if (this.fanSpeed != value) {
    // 			// transform values in percent
    // 			// values from device are 20.0="Silent",40.0="Low",60.0="Medium",80.0="High",102.0="Auto"
    // 			// Silent are not now available in devices?
    // 			if (value <= 25) {
    // 				value = 40;
    // 			}
    // 			else if (value <= 50){
    // 				value = 60;
    // 			}
    // 			else if (value <= 75){
    // 				value = 80;
    // 			}
    // 			else {
    // 				value = 102;
    // 			}
    // 			this.fanSpeed = value;
    // 			this.sendUpdateToDevice();
    // 		}
    // 		callback(null, value);
    // 	}
    // 	/**
    // 	 * Handle requests to get the current value of the "On" characteristic
    // 	 */
    //    handleFanActiveGet(callback: Function) {
    //      this.log.debug('Triggered GET Fan');
    //      // workaround to get the "fan only mode" from device
    //      // device operation values are 1.0="Auto",2.0="Cool",3.0="Dry",4.0="Heat",5.0="Fan"
    //      // set this to a valid value for Active
    //      if (this.operationalMode == 5) {
    //        callback(null, Characteristic.Active.ACTIVE);
    //      } else {
    //        callback(null, Characteristic.Active.INACTIVE);
    //      }
    //    }
    // /**
    // * Handle requests to set the "On" characteristic
    // */
    // handleFanActiveSet(value: number, callback: Function) {
    // 	this.log.debug('Triggered SET Fan:', value);
    // 	// workaround to get the "fan only mode" from device
    // 	// device operation values are 1.0="Auto",2.0="Cool",3.0="Dry",4.0="Heat",5.0="Fan"
    // 	if (value == Characteristic.Active.ACTIVE) {
    // 		this.operationalMode = 5;	
    // 	}
    // 	else {
    // 		//if (Characteristic.CurrentHeatingCoolingState.COOL){
    //        //	this.operationalMode = 2;
    //        //}
    //        //else if (Characteristic.CurrentHeatingCoolingState.AUTO){
    //          ////normaly to 1, but we only want to cool
    //          //this.operationalMode = 1;
    //          //	this.operationalMode = 2;
    //          //}
    //          //else if (Characteristic.CurrentHeatingCoolingState.HEAT){
    //            ////normaly to 4, but we only want to cool
    //            //this.operationalMode = 4;
    //            //	this.operationalMode = 2;
    //            //}
    //            // set default to mode "2" if it is off
    //            //else {
    //              this.operationalMode = 2;
    //            }
    //            this.sendUpdateToDevice();
    //            callback(null, value);
    //          }
    //          */
    async onReady() {
        this.login()
            .then(() => {
            this.log.debug("Login successful");
            this.getUserList()
                .then(() => {
                this.updateValues();
            })
                .catch(() => {
                this.log.debug("Get Devices failed");
            });
            this.updateInterval = setInterval(() => {
                this.updateValues();
            }, this.config['interval'] * 60 * 1000);
        })
            .catch(() => {
            this.log.debug("Login failed");
        });
    }
    login() {
        return new Promise((resolve, reject) => {
            this.jar = request.jar();
            const url = "https://mapp.appsmb.com/v1/user/login/id/get";
            const form = {
                loginAccount: this.config['user'],
                clientType: "1",
                src: "17",
                appId: "1117",
                format: "2",
                stamp: Utils_1.default.getStamp(),
                language: "de_DE",
            };
            const sign = this.getSign(url, form);
            form.sign = sign;
            request.post({
                url: url,
                headers: this.baseHeader,
                followAllRedirects: true,
                json: true,
                form: form,
                jar: this.jar,
                gzip: true
            }, (err, resp, body) => {
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
                    const loginId = body.result.loginId;
                    const password = this.getSignPassword(loginId);
                    const url = "https://mapp.appsmb.com/v1/user/login";
                    const form = {
                        loginAccount: this.config['user'],
                        src: "17",
                        format: "2",
                        stamp: Utils_1.default.getStamp(),
                        language: "de_DE",
                        password: password,
                        clientType: "1",
                        appId: "1117",
                    };
                    const sign = this.getSign(url, form);
                    form.sign = sign;
                    request.post({
                        url: url,
                        headers: this.baseHeader,
                        followAllRedirects: true,
                        json: true,
                        form: form,
                        jar: this.jar,
                        gzip: true,
                    }, (err, resp, body) => {
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
                            this.sId = body.result.sessionId;
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
            const form = {
                src: "17",
                format: "2",
                stamp: Utils_1.default.getStamp(),
                language: "de_DE",
                sessionId: this.sId,
            };
            const url = "https://mapp.appsmb.com/v1/appliance/user/list/get";
            const sign = this.getSign(url, form);
            form.sign = sign;
            request.post({
                url: url,
                headers: this.baseHeader,
                followAllRedirects: true,
                json: true,
                form: form,
                jar: this.jar,
                gzip: true,
            }, (err, resp, body) => {
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
                        body.result.list.forEach(async (currentElement) => {
                            const uuid = this.api.hap.uuid.generate(currentElement.id);
                            const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);
                            if (existingAccessory) {
                                this.log.debug('Restoring cached accessory', existingAccessory.displayName);
                                if (existingAccessory.context.device.hasOwnProperty('id')) {
                                    this.log.debug('Device ' + existingAccessory.displayName + ' has no context, recreating');
                                    this.api.unregisterPlatformAccessories('homebridge-midea', 'midea', [existingAccessory]);
                                    const accessory = new this.api.platformAccessory(currentElement.name, uuid);
                                    accessory.context.device = new MideaAccessory_1.MideaAccessory(this, accessory);
                                    this.api.registerPlatformAccessories('homebridge-midea', 'midea', [accessory]);
                                }
                            }
                            else {
                                this.log.debug('Adding new device:', currentElement.name);
                                const accessory = new this.api.platformAccessory(currentElement.name, uuid);
                                accessory.context.device = new MideaAccessory_1.MideaAccessory(this, accessory);
                                this.api.registerPlatformAccessories('homebridge-midea', 'midea', [accessory]);
                            }
                        });
                    }
                    resolve();
                }
                catch (error) {
                    this.log.debug(error);
                    this.log.debug(error.stack);
                    reject();
                }
            });
        });
    }
    sendCommand(device, order) {
        return new Promise((resolve, reject) => {
            const orderEncode = Utils_1.default.encode(order);
            const orderEncrypt = this.encryptAes(orderEncode);
            const form = {
                applianceId: device.deviceId,
                src: "17",
                format: "2",
                funId: "FC02",
                order: orderEncrypt,
                stamp: Utils_1.default.getStamp(),
                language: "de_DE",
                sessionId: this.sId,
            };
            const url = "https://mapp.appsmb.com/v1/appliance/transparent/send";
            const sign = this.getSign(url, form);
            form.sign = sign;
            request.post({
                url: url,
                headers: this.baseHeader,
                followAllRedirects: true,
                json: true,
                form: form,
                jar: this.jar,
                gzip: true,
            }, (err, resp, body) => {
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
                    if (body.errorCode === "3123") {
                        this.log.debug("Cannot reach " + device.deviceId + " " + body.msg);
                        resolve();
                        return;
                    }
                    if (body.errorCode === "3176") {
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
                    const response = new ApplianceResponse_1.default(Utils_1.default.decode(this.decryptAes(body.result.reply)));
                    const properties = Object.getOwnPropertyNames(ApplianceResponse_1.default.prototype).slice(1);
                    this.log.debug('target temperature', response.targetTemperature);
                    device.targetTemperature = response.targetTemperature;
                    device.indoorTemperature = response.indoorTemperature;
                    device.fanSpeed = response.fanSpeed;
                    device.powerState = response.powerState ? 1 : 0;
                    device.swingMode = response.swingMode;
                    device.operationalMode = response.operationalMode;
                    this.log.debug('fanSpeed is set to', response.fanSpeed);
                    this.log.debug('swingMode is set to', response.swingMode);
                    this.log.debug('powerState is set to', response.powerState);
                    this.log.debug('operational mode is set to', response.operationalMode);
                    resolve();
                }
                catch (error) {
                    this.log.debug(body);
                    this.log.debug(error);
                    this.log.debug(error.stack);
                    reject();
                }
            });
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
            .update(postfix + query + Constants_1.default.AppKey)
            .digest("hex");
    }
    getSignPassword(loginId) {
        const pw = crypto.createHash("sha256").update(this.config.password).digest("hex");
        return crypto
            .createHash("sha256")
            .update(loginId + pw + Constants_1.default.AppKey)
            .digest("hex");
    }
    generateDataKey() {
        const md5AppKey = crypto.createHash("md5").update(Constants_1.default.AppKey).digest("hex");
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
        const data = header.concat(Constants_1.default.UpdateCommand);
        this.accessories.forEach((accessory) => {
            this.log.debug('update accessory', accessory.context.device.deviceId);
            this.sendCommand(accessory.context.device.deviceId, data)
                .then(() => {
                this.log.debug("Update successful");
            })
                .catch((error) => {
                this.log.debug(error);
                this.log.debug("Try to relogin");
                this.login()
                    .then(() => {
                    this.log.debug("Login successful");
                    this.sendCommand(accessory.context.device, data).catch((error) => {
                        this.log.debug("update Command still failed after relogin");
                    });
                })
                    .catch(() => {
                    this.log.debug("Login failed");
                });
            });
        });
    }
    sendUpdateToDevice(device) {
        const command = new SetCommand_1.default();
        command.powerState = device.powerState;
        command.targetTemperature = device.targetTemperature;
        command.swingMode = device.swingMode;
        command.fanSpeed = device.fanSpeed;
        command.operationalMode = device.operationalMode;
        //operational mode for workaround with fan only mode on device
        const pktBuilder = new PacketBuilder_1.default();
        pktBuilder.command = command;
        const data = pktBuilder.finalize();
        this.log.debug("Command: " + JSON.stringify(command));
        this.log.debug("Command + Header: " + JSON.stringify(data));
        this.sendCommand(device, data).catch((error) => {
            this.log.debug(error);
            this.log.debug("Try to relogin");
            this.login()
                .then(() => {
                this.log.debug("Login successful");
                this.sendCommand(device, data).catch((error) => {
                    this.log.debug("Command still failed after relogin");
                });
            })
                .catch(() => {
                this.log.debug("Login failed");
            });
        });
        //after sending, update because sometimes the api hangs
        this.updateValues();
    }
    configureAccessory(accessory) {
        this.log.info('Loading accessory from cache:', accessory.displayName);
        // add the restored accessory to the accessories cache so we can track if it has already been registered
        this.accessories.push(accessory);
    }
}
exports.MideaPlatform = MideaPlatform;
