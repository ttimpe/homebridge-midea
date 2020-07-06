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
const https = require('https');
const axios = require('axios').default;
const axiosCookieJarSupport = require('axios-cookiejar-support').default;
const tough = require('tough-cookie');
const qs = require('querystring');
const Utils_1 = __importDefault(require("./Utils"));
const Constants_1 = __importDefault(require("./Constants"));
const ApplianceResponse_1 = __importDefault(require("./ApplianceResponse"));
const SetCommand_1 = __importDefault(require("./SetCommand"));
const PacketBuilder_1 = __importDefault(require("./PacketBuilder"));
const MideaAccessory_1 = require("./MideaAccessory");
const MideaDeviceType_1 = require("./enums/MideaDeviceType");
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
        this.sessionId = '';
        this.dataKey = '';
        this.accessories = [];
        this.mideaAccessories = [];
        axiosCookieJarSupport(axios);
        this.jar = new tough.CookieJar();
        this.apiClient = axios.create({
            baseURL: 'https://mapp.appsmb.com/v1',
            headers: {
                'User-Agent': Constants_1.default.UserAgent,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        this.log = log;
        this.config = config;
        api.on('didFinishLaunching', () => {
            this.onReady();
        });
    }
    async onReady() {
        try {
            await this.login();
            this.log.debug('Login successful');
            try {
                await this.getUserList();
                this.updateValues();
            }
            catch (err) {
                this.log.debug('getUserList failed');
            }
            this.updateInterval = setInterval(() => {
                this.updateValues();
            }, this.config['interval'] * 60 * 1000);
        }
        catch (err) {
            this.log.debug('Login failed');
        }
    }
    async login() {
        return new Promise(async (resolve, reject) => {
            const url = "/user/login/id/get";
            const form = {
                loginAccount: this.config['user'],
                clientType: Constants_1.default.ClientType,
                src: Constants_1.default.RequestSource,
                appId: Constants_1.default.AppId,
                format: Constants_1.default.RequestFormat,
                stamp: Utils_1.default.getStamp(),
                language: Constants_1.default.Language
            };
            const sign = this.getSign(url, form);
            form.sign = sign;
            //this.log.debug('login request', qs.stringify(form));
            try {
                const response = await this.apiClient.post(url, qs.stringify(form));
                this.log.debug(response);
                if (response.data) {
                    const loginId = response.data.result.loginId;
                    const password = this.getSignPassword(loginId);
                    const url = "/user/login";
                    const form = {
                        loginAccount: this.config['user'],
                        src: Constants_1.default.RequestSource,
                        format: Constants_1.default.RequestFormat,
                        stamp: Utils_1.default.getStamp(),
                        language: Constants_1.default.Language,
                        password: password,
                        clientType: Constants_1.default.ClientType,
                        appId: Constants_1.default.AppId,
                    };
                    const sign = this.getSign(url, form);
                    form.sign = sign;
                    //this.log.debug('login request 2', qs.stringify(form));
                    try {
                        const loginResponse = await this.apiClient.post(url, qs.stringify(form));
                        //this.log.debug(response);
                        this.atoken = loginResponse.data.result.accessToken;
                        this.sessionId = loginResponse.data.result.sessionId;
                        this.generateDataKey();
                        resolve();
                    }
                    catch (err) {
                        this.log.debug('Login request 2 failed with', err);
                        reject();
                    }
                }
            }
            catch (err) {
                this.log.debug('Login request failed with', err);
                reject();
            }
        });
    }
    async getUserList() {
        this.log.debug('getUserList called');
        return new Promise(async (resolve, reject) => {
            const form = {
                src: Constants_1.default.RequestSource,
                format: Constants_1.default.RequestFormat,
                stamp: Utils_1.default.getStamp(),
                language: Constants_1.default.Language,
                sessionId: this.sessionId
            };
            const url = "/user/list/get";
            const sign = this.getSign(url, form);
            form.sign = sign;
            try {
                const response = await this.apiClient.post(url, qs.stringify(form));
                if (response.data.result && response.data.result.list && response.data.result.list.length > 0) {
                    //	this.log.debug('getUserList result is', response.data.result);
                    response.data.result.list.forEach(async (currentElement) => {
                        if (parseInt(currentElement.type) == MideaDeviceType_1.MideaDeviceType.AirConditioner || parseInt(currentElement.type) == MideaDeviceType_1.MideaDeviceType.Dehumidifier) {
                            const uuid = this.api.hap.uuid.generate(currentElement.id);
                            const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);
                            if (existingAccessory) {
                                this.log.debug('Restoring cached accessory', existingAccessory.displayName);
                                existingAccessory.context.deviceId = currentElement.id;
                                existingAccessory.context.deviceType = parseInt(currentElement.type);
                                existingAccessory.context.name = currentElement.name;
                                this.api.updatePlatformAccessories([existingAccessory]);
                                var ma = new MideaAccessory_1.MideaAccessory(this, existingAccessory, currentElement.id, parseInt(currentElement.type), currentElement.name, currentElement.userId);
                                this.mideaAccessories.push(ma);
                            }
                            else {
                                this.log.debug('Adding new device:', currentElement.name);
                                const accessory = new this.api.platformAccessory(currentElement.name, uuid);
                                accessory.context.deviceId = currentElement.id;
                                accessory.context.name = currentElement.name;
                                accessory.context.deviceType = parseInt(currentElement.type);
                                var ma = new MideaAccessory_1.MideaAccessory(this, accessory, currentElement.id, parseInt(currentElement.type), currentElement.name, currentElement.userId);
                                this.api.registerPlatformAccessories('homebridge-midea', 'midea', [accessory]);
                                this.mideaAccessories.push(ma);
                            }
                            // this.log.debug('mideaAccessories now contains', this.mideaAccessories)
                        }
                        else {
                            this.log.warn('Device ' + currentElement.name + ' is of unsupported type ' + MideaDeviceType_1.MideaDeviceType[parseInt(currentElement.type)]);
                            this.log.warn('Please open an issue on GitHub with your specific device model');
                        }
                    });
                }
                resolve();
            }
            catch (err) {
                this.log.debug('getUserList error', err);
                reject();
            }
        });
        /*
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
                            
                        } catch (error) {
                            this.log.debug(error);
                            this.log.debug(error.stack);
                            reject();
                        }
                    }
                    );
                });
                */
    }
    async sendCommand(device, order) {
        return new Promise(async (resolve, reject) => {
            if (device) {
                const orderEncode = Utils_1.default.encode(order);
                const orderEncrypt = this.encryptAes(orderEncode);
                const form = {
                    applianceId: device.deviceId,
                    src: Constants_1.default.RequestSource,
                    format: Constants_1.default.RequestFormat,
                    funId: "FC02",
                    order: orderEncrypt,
                    stamp: Utils_1.default.getStamp(),
                    language: Constants_1.default.Language,
                    sessionId: this.sessionId,
                };
                const url = "/appliance/transparent/send";
                const sign = this.getSign(url, form);
                form.sign = sign;
                //this.log.debug('sendCommand request', qs.stringify(form));
                try {
                    const response = this.apiClient.post(url, qs.stringify(form));
                    this.log.debug("send successful");
                    const applianceResponse = new ApplianceResponse_1.default(Utils_1.default.decode(this.decryptAes(response.data.result.reply)));
                    const properties = Object.getOwnPropertyNames(ApplianceResponse_1.default.prototype).slice(1);
                    this.log.debug('target temperature', applianceResponse.targetTemperature);
                    device.targetTemperature = applianceResponse.targetTemperature;
                    device.indoorTemperature = applianceResponse.indoorTemperature;
                    device.fanSpeed = applianceResponse.fanSpeed;
                    device.powerState = applianceResponse.powerState ? 1 : 0;
                    device.swingMode = applianceResponse.swingMode;
                    device.operationalMode = applianceResponse.operationalMode;
                    device.humidty = applianceResponse.humidity;
                    device.useFahrenheit = applianceResponse.tempUnit;
                    device.ecoMode = applianceResponse.ecoMode;
                    this.log.debug('fanSpeed is set to', applianceResponse.fanSpeed);
                    this.log.debug('swingMode is set to', applianceResponse.swingMode);
                    this.log.debug('powerState is set to', applianceResponse.powerState);
                    this.log.debug('operational mode is set to', applianceResponse.operationalMode);
                    this.log.debug('useFahrenheit is set to', applianceResponse.tempUnit);
                    this.log.debug('ecoMode is set to', applianceResponse.ecoMode);
                    this.log.debug('Full data is', Utils_1.default.formatResponse(applianceResponse.data));
                    resolve();
                }
                catch (err) {
                    this.log.debug('sendCommand request failed', err);
                    reject();
                }
            }
            else {
                this.log.debug('No device specified');
                reject();
            }
        });
        /*
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
                                
                            } catch (error) {
                                this.log.debug(body);
                                this.log.debug(error);
        
                                this.log.debug(error.stack);
                                reject();
                            }
                        }
                        );
                    });
                    */
    }
    getSign(path, form) {
        let postfix = "/v1" + path;
        // Maybe this will help, should remove any query string parameters in the URL from the sign
        this.log.debug('signing url', postfix);
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
    decryptAesString(reply) {
        if (!this.dataKey) {
            this.generateDataKey();
        }
        const decipher = crypto.createDecipheriv("aes-128-ecb", this.dataKey, "");
        const dec = decipher.update(reply, "hex", "utf8");
        return dec;
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
    encryptAesString(query) {
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
        const data = header.concat(Constants_1.default.UpdateCommand);
        this.accessories.forEach(async (accessory) => {
            this.log.debug('update accessory', accessory.context.deviceId);
            // this.log.debug('current ma are ', this.mideaAccessories)
            let mideaAccessory = this.mideaAccessories.find(ma => ma.deviceId == accessory.context.deviceId);
            if (mideaAccessory === undefined) {
                this.log.debug('Could not find accessory with id', accessory.context.deviceId);
            }
            else {
                try {
                    const response = await this.sendCommand(mideaAccessory, data);
                    this.log.debug('Update successful');
                }
                catch (err) {
                    this.log.debug(err);
                    this.log.debug("Try to relogin");
                    try {
                        const loginResponse = await this.login();
                        this.log.debug("Login successful");
                        try {
                            const commandResponse = await this.sendCommand(mideaAccessory, data);
                        }
                        catch (err) {
                            this.log.debug("update Command still failed after relogin");
                        }
                    }
                    catch (err) {
                        this.log.debug("Login failed");
                    }
                }
            }
        });
    }
    async getFirmwareVersionOfDevice(device) {
        return new Promise(async (resolve, reject) => {
            let requestObject = {
                applianceId: device.deviceId
            };
            let json = JSON.stringify(requestObject);
            json = json.split(',').join(', ');
            this.log.debug('sending json', json);
            let data = this.encryptAesString(json);
            this.log.debug('firmware req: encrypted string is', data);
            const form = {
                appId: Constants_1.default.AppId,
                data: data,
                format: Constants_1.default.RequestFormat,
                language: Constants_1.default.Language,
                protoType: '0x01',
                serviceUrl: '/ota/version',
                sessionId: this.sessionId,
                src: Constants_1.default.RequestSource,
                stamp: Utils_1.default.getStamp()
            };
            const url = "/app2base/data/transmit?serviceUrl=/ota/version";
            const sign = this.getSign(url, form);
            form.sign = sign;
            let formQS = qs.stringify(form);
            formQS = formQS.split('%2F').join('/');
            const goodString = formQS.split('&').sort().map((val) => {
                let [k, v] = val.split('=');
                return [k, v.split(',').sort().join(',')].join('=');
            }).join('&');
            this.log.debug('we are sending the following form', goodString);
            try {
                const response = await this.apiClient.post(url, goodString);
                this.log.debug(response.data);
                let decryptedString = this.decryptAesString(response.data.result.returnData);
                this.log.debug('Got firmware response', decryptedString);
                let responseObject = JSON.parse(decryptedString);
                device.firmwareVersion = responseObject.result.version;
                this.log.debug('got firmware version', device.firmwareVersion);
                resolve();
            }
            catch (err) {
                this.log.debug('Failed get firmware', err);
                reject();
            }
        });
    }
    async sendUpdateToDevice(device) {
        if (device) {
            const command = new SetCommand_1.default();
            command.powerState = device.powerState;
            command.targetTemperature = device.targetTemperature;
            command.swingMode = device.swingMode;
            command.fanSpeed = device.fanSpeed;
            command.operationalMode = device.operationalMode;
            command.useFahrenheit = device.useFahrenheit;
            command.ecoMode = device.ecoMode;
            //operational mode for workaround with fan only mode on device
            const pktBuilder = new PacketBuilder_1.default();
            pktBuilder.command = command;
            const data = pktBuilder.finalize();
            this.log.debug("Command: " + JSON.stringify(command));
            this.log.debug("Command + Header: " + JSON.stringify(data));
            try {
                const response = await this.sendCommand(device, data);
            }
            catch (err) {
                this.log.debug(err);
                this.log.debug("Try to relogin");
                try {
                    const loginResponse = await this.login();
                    this.log.debug("Login successful");
                    try {
                        await this.sendCommand(device, data);
                    }
                    catch (err) {
                        this.log.debug("Command still failed after relogin");
                    }
                }
                catch (err) {
                    this.log.debug("Login failed");
                }
            }
            //after sending, update because sometimes the api hangs
            this.updateValues();
        }
    }
    getDeviceSpecificOverrideValue(deviceId, key) {
        if (this.config) {
            if (this.config.hasOwnProperty('devices')) {
                for (let i = 0; i < this.config.devices.length; i++) {
                    if (this.config.devices[i].deviceId == deviceId) {
                        return this.config.devices[i][key];
                    }
                }
            }
        }
        return null;
    }
    configureAccessory(accessory) {
        this.log.info('Loading accessory from cache:', accessory.displayName);
        // add the restored accessory to the accessories cache so we can track if it has already been registered
        this.accessories.push(accessory);
    }
}
exports.MideaPlatform = MideaPlatform;
