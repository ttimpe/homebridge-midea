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
const MideaDeviceType_1 = require("./MideaDeviceType");
const MideaErrorCodes_1 = require("./MideaErrorCodes");
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
        this.jar = request.jar();
        this.baseHeader = { 'User-Agent': Constants_1.default.UserAgent };
        this.log = log;
        this.config = config;
        api.on('didFinishLaunching', () => {
            this.onReady();
        });
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
            const form = {
                src: Constants_1.default.RequestSource,
                format: Constants_1.default.RequestFormat,
                stamp: Utils_1.default.getStamp(),
                language: Constants_1.default.Language,
                sessionId: this.sessionId
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
                            if (currentElement.type == MideaDeviceType_1.MideaDeviceType.AirConditioner || currentElement.type == MideaDeviceType_1.MideaDeviceType.Dehumidifier) {
                                const uuid = this.api.hap.uuid.generate(currentElement.id);
                                const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);
                                if (existingAccessory) {
                                    this.log.debug('Restoring cached accessory', existingAccessory.displayName);
                                    existingAccessory.context.deviceId = currentElement.id;
                                    existingAccessory.context.deviceType = parseInt(currentElement.type);
                                    existingAccessory.context.name = currentElement.name;
                                    this.api.updatePlatformAccessories([existingAccessory]);
                                    var ma = new MideaAccessory_1.MideaAccessory(this, existingAccessory, currentElement.id, currentElement.type, currentElement.name);
                                    this.mideaAccessories.push(ma);
                                }
                                else {
                                    this.log.debug('Adding new device:', currentElement.name);
                                    const accessory = new this.api.platformAccessory(currentElement.name, uuid);
                                    accessory.context.deviceId = currentElement.id;
                                    accessory.context.name = currentElement.name;
                                    accessory.context.deviceType = parseInt(currentElement.type);
                                    var ma = new MideaAccessory_1.MideaAccessory(this, accessory, currentElement.id, currentElement.type, currentElement.name);
                                    this.api.registerPlatformAccessories('homebridge-midea', 'midea', [accessory]);
                                    this.mideaAccessories.push(ma);
                                }
                                this.log.debug('mideaAccessories now contains', this.mideaAccessories);
                            }
                            else {
                                this.log.warn('Device ' + currentElement.name + ' is of unsupported type ' + MideaDeviceType_1.MideaDeviceType[currentElement.type]);
                                this.log.warn('Please open an issue on GitHub with your specific device model');
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
        if (device) {
            return new Promise((resolve, reject) => {
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
                        if (body.errorCode == MideaErrorCodes_1.MideaErrorCodes.DeviceUnreachable) {
                            this.log.debug("Cannot reach " + device.deviceId + " " + body.msg);
                            resolve();
                            return;
                        }
                        if (body.errorCode == MideaErrorCodes_1.MideaErrorCodes.CommandNotAccepted) {
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
                        device.humidty = response.humidity;
                        device.useFahrenheit = response.tempUnit;
                        this.log.debug('fanSpeed is set to', response.fanSpeed);
                        this.log.debug('swingMode is set to', response.swingMode);
                        this.log.debug('powerState is set to', response.powerState);
                        this.log.debug('operational mode is set to', response.operationalMode);
                        this.log.debug('useFahrenheit is set to', response.tempUnit);
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
        else {
            this.log.debug('No device specified');
        }
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
            this.log.debug('update accessory', accessory.context.deviceId);
            this.log.debug('current ma are ', this.mideaAccessories);
            let mideaAccessory = this.mideaAccessories.find(ma => ma.deviceId == accessory.context.deviceId);
            if (mideaAccessory) {
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
            else {
                this.log.debug('Could not find accessory with id', accessory.context.deviceId);
            }
        });
    }
    getFirmwareVersionOfDevice(device) {
        return new Promise((resolve, reject) => {
            const form = {
                applianceId: device.deviceId,
                src: Constants_1.default.RequestSource,
                format: Constants_1.default.RequestFormat,
                protoType: '0x01',
                stamp: Utils_1.default.getStamp(),
                language: Constants_1.default.Language,
                sessionId: this.sessionId,
                data: {}
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
                    if (body.errorCode == MideaErrorCodes_1.MideaErrorCodes.DeviceUnreachable) {
                        this.log.debug("Cannot reach " + device.deviceId + " " + body.msg);
                        resolve();
                        return;
                    }
                    if (body.errorCode == MideaErrorCodes_1.MideaErrorCodes.CommandNotAccepted) {
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
                    device.humidty = response.humidity;
                    device.useFahrenheit = response.tempUnit;
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
    sendUpdateToDevice(device) {
        if (device) {
            const command = new SetCommand_1.default();
            command.powerState = device.powerState;
            command.targetTemperature = device.targetTemperature;
            command.swingMode = device.swingMode;
            command.fanSpeed = device.fanSpeed;
            command.operationalMode = device.operationalMode;
            command.useFahrenheit = device.useFahrenheit;
            //operational mode for workaround with fan only mode on device
            const pktBuilder = new PacketBuilder_1.default();
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
    configureAccessory(accessory) {
        this.log.info('Loading accessory from cache:', accessory.displayName);
        // add the restored accessory to the accessories cache so we can track if it has already been registered
        this.accessories.push(accessory);
    }
}
exports.MideaPlatform = MideaPlatform;
