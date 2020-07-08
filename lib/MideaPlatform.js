"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MideaPlatform = void 0;
// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const traverse = require("traverse");
const crypto = require("crypto");
const https = require('https');
const axios = require('axios').default;
const tunnel = require('tunnel');
const axiosCookieJarSupport = require('axios-cookiejar-support').default;
const tough = require('tough-cookie');
const qs = require('querystring');
const Utils_1 = __importDefault(require("./Utils"));
const Constants_1 = __importDefault(require("./Constants"));
const PacketBuilder_1 = __importDefault(require("./PacketBuilder"));
const ACSetCommand_1 = __importDefault(require("./commands/ACSetCommand"));
const DehumidifierSetCommand_1 = __importDefault(require("./commands/DehumidifierSetCommand"));
const ACApplianceResponse_1 = __importDefault(require("./responses/ACApplianceResponse"));
const DehumidifierApplianceResponse_1 = __importDefault(require("./responses/DehumidifierApplianceResponse"));
const MideaAccessory_1 = require("./MideaAccessory");
const MideaDeviceType_1 = require("./enums/MideaDeviceType");
class MideaPlatform {
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
        let agent;
        if (this.config.proxy) {
            this.log.info('Using debugging proxy specified in config.json');
            const agent = tunnel.httpsOverHttp({
                proxy: this.config.proxy,
                rejectUnauthorized: false
            });
            this.apiClient = axios.create({
                baseURL: 'https://mapp.appsmb.com/v1',
                headers: {
                    'User-Agent': Constants_1.default.UserAgent,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                jar: this.jar,
                httpsAgent: agent
            });
        }
        else {
            this.apiClient = axios.create({
                baseURL: 'https://mapp.appsmb.com/v1',
                headers: {
                    'User-Agent': Constants_1.default.UserAgent,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                jar: this.jar
            });
        }
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
            const url = '/user/login/id/get';
            const form = {
                loginAccount: this.config['user'],
                clientType: Constants_1.default.ClientType,
                src: Constants_1.default.RequestSource,
                appId: Constants_1.default.AppId,
                format: Constants_1.default.RequestFormat,
                stamp: Utils_1.default.getStamp(),
                language: Constants_1.default.Language
            };
            const sign = Utils_1.default.getSign(url, form);
            form.sign = sign;
            //this.log.debug('login request', qs.stringify(form));
            try {
                const response = await this.apiClient.post(url, qs.stringify(form));
                if (response.data) {
                    if (response.data.errorCode && response.data.errorCode != '0') {
                        this.log.debug('Login request failed with error', response.data.msg);
                    }
                    else {
                        const loginId = response.data.result.loginId;
                        const password = Utils_1.default.getSignPassword(loginId, this.config.password);
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
                        const sign = Utils_1.default.getSign(url, form);
                        form.sign = sign;
                        try {
                            const loginResponse = await this.apiClient.post(url, qs.stringify(form));
                            //this.log.debug(response);
                            if (loginResponse.data.errorCode && loginResponse.data.errorCode != '0') {
                                this.log.debug('Login request 2 returned error', loginResponse.data.msg);
                                reject();
                            }
                            else {
                                this.atoken = loginResponse.data.result.accessToken;
                                this.sessionId = loginResponse.data.result.sessionId;
                                this.dataKey = Utils_1.default.generateDataKey(this.atoken);
                                resolve();
                            }
                        }
                        catch (err) {
                            this.log.debug('Login request 2 failed with', err);
                            reject();
                        }
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
            const url = "/appliance/user/list/get";
            const sign = Utils_1.default.getSign(url, form);
            form.sign = sign;
            try {
                const response = await this.apiClient.post(url, qs.stringify(form));
                if (response.data.errorCode && response.data.errorCode != '0') {
                    this.log.error('getUserList returned error', response.data.msg);
                    reject();
                }
                else {
                    if (response.data.result && response.data.result.list && response.data.result.list.length > 0) {
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
                        resolve();
                    }
                    else {
                        this.log.error('getUserList invalid response');
                        reject();
                    }
                }
            }
            catch (err) {
                this.log.debug('getUserList error', err);
                reject();
            }
        });
    }
    async sendCommand(device, order) {
        return new Promise(async (resolve, reject) => {
            if (device) {
                const orderEncode = Utils_1.default.encode(order);
                const orderEncrypt = Utils_1.default.encryptAes(orderEncode, this.dataKey);
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
                const sign = Utils_1.default.getSign(url, form);
                form.sign = sign;
                //this.log.debug('sendCommand request', qs.stringify(form));
                try {
                    const response = await this.apiClient.post(url, qs.stringify(form));
                    if (response.data.errorCode && response.data.errorCode != '0') {
                        this.log.error('sendCommand returned error', response.data.msg);
                        reject();
                    }
                    else {
                        this.log.debug("send successful");
                        let applianceResponse;
                        if (device.deviceType == MideaDeviceType_1.MideaDeviceType.AirConditioner) {
                            applianceResponse = new ACApplianceResponse_1.default(Utils_1.default.decode(Utils_1.default.decryptAes(response.data.result.reply, this.dataKey)));
                            device.targetTemperature = applianceResponse.targetTemperature;
                            device.indoorTemperature = applianceResponse.indoorTemperature;
                            device.useFahrenheit = applianceResponse.tempUnit;
                            this.log.debug('useFahrenheit is set to', applianceResponse.tempUnit);
                            this.log.debug('ecoMode is set to', applianceResponse.ecoMode);
                            this.log.debug('target temperature', applianceResponse.targetTemperature);
                        }
                        else if (device.deviceType == MideaDeviceType_1.MideaDeviceType.Dehumidifier) {
                            applianceResponse = new DehumidifierApplianceResponse_1.default(Utils_1.default.decode(Utils_1.default.decryptAes(response.data.result.reply, this.dataKey)));
                            device.humidty = applianceResponse.humidity;
                            this.log.debug('humidity is at', device.humidty);
                        }
                        device.fanSpeed = applianceResponse.fanSpeed;
                        device.powerState = applianceResponse.powerState ? 1 : 0;
                        device.swingMode = applianceResponse.swingMode;
                        device.operationalMode = applianceResponse.operationalMode;
                        device.ecoMode = applianceResponse.ecoMode;
                        this.log.debug('fanSpeed is set to', applianceResponse.fanSpeed);
                        this.log.debug('swingMode is set to', applianceResponse.swingMode);
                        this.log.debug('powerState is set to', applianceResponse.powerState);
                        this.log.debug('operational mode is set to', applianceResponse.operationalMode);
                        this.log.debug('Full data is', Utils_1.default.formatResponse(applianceResponse.data));
                        resolve();
                    }
                }
                catch (err) {
                    this.log.error('sendCommand request failed', err);
                    reject();
                }
            }
            else {
                this.log.error('No device specified');
                reject();
            }
        });
    }
    updateValues() {
        const header = [90, 90, 1, 16, 89, 0, 32, 0, 80, 0, 0, 0, 169, 65, 48, 9, 14, 5, 20, 20, 213, 50, 1, 0, 0, 17, 0, 0, 0, 4, 2, 0, 0, 1, 0, 0, 0, 0, 0, 0];
        const data = header.concat(Constants_1.default.UpdateCommand);
        this.accessories.forEach(async (accessory) => {
            // this.log.debug('current ma are ', this.mideaAccessories)
            this.log.debug('update accessory', accessory.context.deviceId);
            // this.log.debug(JSON.stringify(this.mideaAccessories))
            let mideaAccessory = this.mideaAccessories.find(ma => ma.deviceId == accessory.context.deviceId);
            if (mideaAccessory === undefined) {
                this.log.warn('Could not find accessory with id', accessory.context.deviceId);
            }
            else {
                try {
                    if (mideaAccessory.deviceType == MideaDeviceType_1.MideaDeviceType.AirConditioner) {
                        const response = await this.sendCommand(mideaAccessory, data);
                        this.log.debug('Update successful');
                    }
                    else if (mideaAccessory.deviceType == MideaDeviceType_1.MideaDeviceType.Dehumidifier) {
                        let updateCommand = [
                            90, 90, 1, 0, 91, 0, 32, -128,
                            80, 0, 0, 0, 0, 0, 0, 0,
                            0, 0, 0, 0, -107, 97, 0, 0,
                            0, 18, 0, 0, 0, 0, 0, 0,
                            0, 0, 0, 0, 0, 0, 0, 0,
                            -86, 34, -95, 0, 0, 0, 0, 0,
                            3, 3, -56, 0, 2, 80, 127, 127,
                            0, 35, 0, 0, 0, 0, 0, 0,
                            0, 0, 64, 88, 0, 0, 0, 0,
                            16, 58, 26, 0, 0, 0, 0, 0,
                            0, 0, 0, 0, 0, 0, 0, 0,
                            0
                        ];
                        const response = await this.sendCommand(mideaAccessory, updateCommand);
                        this.log.debug('sent update command to dehumidifier');
                    }
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
                            this.log.warn("update Command still failed after relogin");
                        }
                    }
                    catch (err) {
                        this.log.warn("Login failed");
                    }
                }
            }
        });
    }
    async getFirmwareVersionOfDevice(device) {
        return new Promise(async (resolve, reject) => {
            let requestObject = {
                applianceId: device.deviceId,
                userId: device.userId
            };
            let json = JSON.stringify(requestObject);
            json = json.split(',').join(', ');
            this.log.debug('sending json', json);
            let data = Utils_1.default.encryptAesString(json, this.dataKey);
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
            const sign = Utils_1.default.getSign(url, form);
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
                if (response.data.errorCode && response.data.errorCode != '0') {
                    this.log.warn('Failed get firmware', response.data.msg);
                    reject();
                }
                else {
                    let decryptedString = Utils_1.default.decryptAesString(response.data.result.returnData, this.dataKey);
                    this.log.debug('Got firmware response', decryptedString);
                    let responseObject = JSON.parse(decryptedString);
                    device.firmwareVersion = responseObject.result.version;
                    this.log.debug('got firmware version', device.firmwareVersion);
                    resolve();
                }
                resolve();
            }
            catch (err) {
                this.log.warn('Failed get firmware', err);
                reject();
            }
        });
    }
    async sendUpdateToDevice(device) {
        if (device) {
            let command;
            if (device.deviceType == MideaDeviceType_1.MideaDeviceType.AirConditioner) {
                command = new ACSetCommand_1.default();
                command.useFahrenheit = device.useFahrenheit;
                command.targetTemperature = device.targetTemperature;
            }
            else if (device.deviceType == MideaDeviceType_1.MideaDeviceType.Dehumidifier) {
                command = new DehumidifierSetCommand_1.default();
            }
            command.powerState = device.powerState;
            command.swingMode = device.swingMode;
            command.fanSpeed = device.fanSpeed;
            command.operationalMode = device.operationalMode;
            command.ecoMode = device.ecoMode;
            //operational mode for workaround with fan only mode on device
            const pktBuilder = new PacketBuilder_1.default();
            pktBuilder.command = command;
            const data = pktBuilder.finalize();
            this.log.debug("Command: " + JSON.stringify(command));
            this.log.debug("Command + Header: " + JSON.stringify(data));
            try {
                const response = await this.sendCommand(device, data);
                this.log.debug('Sent update to device ' + device.name);
            }
            catch (err) {
                this.log.debug(err);
                this.log.warn("Trying to relogin");
                try {
                    const loginResponse = await this.login();
                    this.log.debug("Login successful");
                    try {
                        await this.sendCommand(device, data);
                    }
                    catch (err) {
                        this.log.error("Command still failed after relogin");
                    }
                }
                catch (err) {
                    this.log.error("Login failed");
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
