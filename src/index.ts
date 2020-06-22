
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


let Service :any ;
let Characteristic :any;

export default function(homebridge : any) {
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;
	homebridge.registerAccessory('homebridge-midea', 'midea', MideaAccessory);
};


class MideaAccessory {
  jar : any
  updateInterval :any = null
  reauthInterval :any = null
  atoken: string = ''
  sId: string = ''
  hgIdArray: any
  dataKey : string = ''
  baseHeader : object
  log: any
  config: any
  enabledServices : any[] = []
  swingMode :number = 0
  name: string = ''
  id: string = ''
  deviceId: any
  targetTemperature : number = 0
  indoorTemperature: number = 0
  fanSpeed: number = 0
  fanOnlyMode : boolean
  fanOnlyModeName : string
  temperatureSteps: number
  powerState : number = 0


  supportedSwingMode : number = 0
  operationalMode : number = 0

  service: any
  fanService: any
  informationService : any

  constructor(log: any, config: any) {


    this.jar = request.jar();



    this.baseHeader = { 'User-Agent': Constants.UserAgent }
    this.log = log;
    this.config = config;
    
    if (config.model) {
      this.name = config.model;
    }
    if (config.id) {
      this.id = config.id;
    }



    this.fanOnlyMode = config.fanOnlyMode || false;
    this.fanOnlyModeName = config.fanOnlyModeName || 'Fan Only Mode';
    this.temperatureSteps = config.temperatureSteps || 0.5;

    // values from device are 0.0="Off",12.0="Vertical",3.0="Horizontal",15.0="Both"
    switch (config.supportedSwingMode) {
      case 'Vertical':
      this.supportedSwingMode = 12;
      break;
      case 'Horizontal':
      this.supportedSwingMode = 3;
      break;
      case 'Both':
      this.supportedSwingMode = 15;
      break;
      default:
      this.supportedSwingMode = 0;
      break;
    }

    this.informationService = new Service.AccessoryInformation();
    this.informationService
    .setCharacteristic(Characteristic.Manufacturer, 'midea')
    .setCharacteristic(Characteristic.FirmwareRevision, '0.0.1')
    .setCharacteristic(Characteristic.Model, this.name)
    .setCharacteristic(Characteristic.SerialNumber, this.id);



    this.service = new Service.HeaterCooler();
    this.fanService = new Service.Fanv2();
    this.fanService.setCharacteristic(Characteristic.Name, this.fanOnlyModeName);

    // create handlers for required characteristics
    this.service.getCharacteristic(Characteristic.Active)
    .on('get', this.handleActiveGet.bind(this))
    .on('set', this.handleActiveSet.bind(this));

    this.service.getCharacteristic(Characteristic.CurrentHeatingCoolingState)
    .on('get', this.handleCurrentHeatingCoolingStateGet.bind(this));

    this.service.getCharacteristic(Characteristic.TargetHeatingCoolingState)
    .on('get', this.handleTargetHeatingCoolingStateGet.bind(this))
    .on('set', this.handleTargetHeatingCoolingStateSet.bind(this));

    this.service.getCharacteristic(Characteristic.CurrentTemperature)
    .on('get', this.handleCurrentTemperatureGet.bind(this));

    this.service.getCharacteristic(Characteristic.CoolingThresholdTemperature)
    .on('get', this.handleCoolingThresholdTemperatureGet.bind(this))
    .on('set', this.handleCoolingThresholdTemperatureSet.bind(this))
    .setProps({
      minStep: this.temperatureSteps
    });

    this.service.getCharacteristic(Characteristic.TemperatureDisplayUnits)
    .on('get', this.handleTemperatureDisplayUnitsGet.bind(this))
    .on('set', this.handleTemperatureDisplayUnitsSet.bind(this));

    this.service.getCharacteristic(Characteristic.SwingMode)
    .on('get', this.handleSwingModeGet.bind(this))
    .on('set', this.handleSwingModeSet.bind(this));

    this.service.getCharacteristic(Characteristic.RotationSpeed)
    .on('get', this.handleRotationSpeedGet.bind(this))
    .on('set', this.handleRotationSpeedSet.bind(this));

    // for fan only mode
    this.fanService.getCharacteristic(Characteristic.Active)
    .on('get', this.handleFanActiveGet.bind(this))
    .on('set', this.handleFanActiveSet.bind(this));

    this.enabledServices.push(this.informationService);
    this.enabledServices.push(this.service);


    if (config.fanOnlyMode) {
      this.enabledServices.push(this.fanService);
    }

    this.onReady();




  }

   /**
   * Handle requests to get the current value of the "Active" characteristic
   */
   handleActiveGet(callback: Function) {
   	this.log.debug('Triggered GET Active, returning', this.powerState);

     // set this to a valid value for Active
     if (this.powerState) {
       callback(null, Characteristic.Active.ACTIVE);
     } else {
       callback(null, Characteristic.Active.INACTIVE);
     }

   }

  /**
   * Handle requests to set the "Active" characteristic
   */
   handleActiveSet(value: number, callback: Function) {
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
   handleCurrentTemperatureGet(callback: Function) {
   	this.log('Triggered GET CurrentTemperature');

     // set this to a valid value for CurrentTemperature
     const currentValue = this.indoorTemperature;

     callback(null, currentValue);
   }


/**
   * Handle requests to get the current value of the "Current Heating Cooling State" characteristic
   */
   handleCurrentHeatingCoolingStateGet(callback: Function) {
   	this.log('Triggered GET CurrentHeatingCoolingState');

     // set this to a valid value for CurrentHeatingCoolingState

     let currentValue = Characteristic.CurrentHeatingCoolingState.COOL;
     if (this.powerState == Characteristic.Active.INACTIVE) {
       currentValue = Characteristic.CurrentHeatingCoolingState.OFF;
     }



     callback(null, currentValue);
   }


  /**
   * Handle requests to get the current value of the "Target Heating Cooling State" characteristic
   */
   handleTargetHeatingCoolingStateGet(callback: Function) {
   	this.log('Triggered GET TargetHeatingCoolingState while powerState is', this.powerState);

     // set this to a valid value for TargetHeatingCoolingState
     let currentValue = Characteristic.TargetHeatingCoolingState.COOL;
     if (this.powerState == Characteristic.Active.INACTIVE) {
       currentValue = Characteristic.TargetHeatingCoolingState.OFF;
     }
     callback(null, currentValue);
   }

  /**
   * Handle requests to set the "Target Heating Cooling State" characteristic
   */
   handleTargetHeatingCoolingStateSet(value: number, callback: Function) {
   	this.log('Triggered SET TargetHeatingCoolingState:', value);

   	switch (value) {
   		case Characteristic.CurrentHeatingCoolingState.OFF:
   		this.powerState = Characteristic.Active.INACTIVE;
   		break;
   		default:
   		this.powerState = Characteristic.Active.ACTIVE;
   		break;
   	}
   	this.sendUpdateToDevice();
   	callback(null, value);
   }

  /**
   * Handle requests to get the current value of the "Target Temperature" characteristic
   */
   handleCoolingThresholdTemperatureGet(callback: Function) {
   	this.log('Triggered GET handleCoolingThresholdTemperature');

     // set this to a valid value for TargetTemperature
     const currentValue = this.targetTemperature;

     callback(null, currentValue);
   }

  /**
   * Handle requests to set the "Target Temperature" characteristic
   */
   handleCoolingThresholdTemperatureSet(value: number, callback: Function) {
   	this.log('Triggered SET handleCoolingThresholdTemperature:', value);
   	if (this.targetTemperature != value) {
   		this.targetTemperature = value;
   		this.sendUpdateToDevice();
   	}
   	callback(null, value);
   }

  /**
   * Handle requests to get the current value of the "Temperature Display Units" characteristic
   */
   handleTemperatureDisplayUnitsGet(callback: Function) {
   	this.log('Triggered GET TemperatureDisplayUnits');

     // set this to a valid value for TemperatureDisplayUnits
     const currentValue = Characteristic.TemperatureDisplayUnits.CELSIUS;

     callback(null, currentValue);
   }

  /**
   * Handle requests to set the "Temperature Display Units" characteristic
   */
   handleTemperatureDisplayUnitsSet(value: number, callback: Function) {
   	this.log('Triggered SET TemperatureDisplayUnits:', value);

   	callback(null);
   }

   /**
   * Handle requests to get the current value of the "swingMode" characteristic
   */
   handleSwingModeGet(callback: Function) {
     this.log('Triggered GET swingMode');

     // set this to a valid value for swingMode
     // values from device are 0.0="Off",12.0="Vertical",3.0="Horizontal",15.0="Both"

     let currentValue = Characteristic.SwingMode.disabled
     if (this.swingMode != 0 ){
       currentValue = Characteristic.SwingMode.enabled
     }

     callback(null, currentValue);
   }

	/**
	* Handle requests to set the "swingMode" characteristic
	*/
	handleSwingModeSet(value: number, callback: Function) {
		this.log('Triggered SET swingMode:', value);

		// convert this.swingMode to a 0/1
		var currentSwingMode = this.swingMode!=0?1:0

		if (currentSwingMode != value) {
			if(value == 0){
				this.swingMode = 0;
			}
			else {
				this.swingMode = this.supportedSwingMode;
			}

			this.sendUpdateToDevice();
		}
		callback(null, value);
	}


   /**
   * Handle requests to get the current value of the "RotationSpeed" characteristic
   */
   handleRotationSpeedGet(callback: Function) {
     this.log('Triggered GET RotationSpeed');

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
	handleRotationSpeedSet(value: number, callback: Function) {
		this.log('Triggered SET RotationSpeed:', value);

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
			this.sendUpdateToDevice();
		}
		callback(null, value);
	}

	/**
	 * Handle requests to get the current value of the "On" characteristic
	 */
   handleFanActiveGet(callback: Function) {
     this.log('Triggered GET Fan');

     // workaround to get the "fan only mode" from device
     // device operation values are 1.0="Auto",2.0="Cool",3.0="Dry",4.0="Heat",5.0="Fan"

     // set this to a valid value for Active
     if (this.operationalMode == 5) {
       callback(null, Characteristic.Active.ACTIVE);
     } else {
       callback(null, Characteristic.Active.INACTIVE);
     }

   }

	/**
	* Handle requests to set the "On" characteristic
	*/
	handleFanActiveSet(value: number, callback: Function) {
		this.log('Triggered SET Fan:', value);
		
		// workaround to get the "fan only mode" from device
		// device operation values are 1.0="Auto",2.0="Cool",3.0="Dry",4.0="Heat",5.0="Fan"
		if (value == Characteristic.Active.ACTIVE) {
			this.operationalMode = 5;	
		}

		else {
			//if (Characteristic.CurrentHeatingCoolingState.COOL){
        //	this.operationalMode = 2;
        //}
        //else if (Characteristic.CurrentHeatingCoolingState.AUTO){
          ////normaly to 1, but we only want to cool
          //this.operationalMode = 1;
          //	this.operationalMode = 2;
          //}
          //else if (Characteristic.CurrentHeatingCoolingState.HEAT){
            ////normaly to 4, but we only want to cool
            //this.operationalMode = 4;
            //	this.operationalMode = 2;
            //}
            // set default to mode "2" if it is off
            //else {
              this.operationalMode = 2;

            }

            this.sendUpdateToDevice();
            callback(null, value);
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
              const url = "https://mapp.appsmb.com/v1/user/login/id/get";

              const form : any = {
                loginAccount: this.config['user'],
                clientType: "1",
                src: "17",
                appId: "1117",
                format: "2",
                stamp: Utils.getStamp(),
                language: "de_DE",
               
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
              (err :any, resp :any, body :any) => {
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
                  const loginId :string = body.result.loginId;
                  const password : string = this.getSignPassword(loginId);
                  const url = "https://mapp.appsmb.com/v1/user/login";

                  const form :any = {
                    loginAccount: this.config['user'],
                    src: "17",
                    format: "2",
                    stamp: Utils.getStamp(),
                    language: "de_DE",
                    password: password,
                    clientType: "1",
                    appId: "1117",
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
              const form :any = {
                src: "17",
                format: "2",
                stamp: Utils.getStamp(),
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
              (err: any, resp: any, body: any) => {
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
                    body.result.list.forEach(async (currentElement: any) => {
                      this.hgIdArray.push(currentElement.id);

                      // write device information to informationService
                      // not shown in homekit info - dont know why
                      this.informationService
                      .setCharacteristic(Characteristic.Model, currentElement.name)
                      .setCharacteristic(Characteristic.SerialNumber, currentElement.id);
                      //this.log("--------", this.informationService.getCharacteristic(Characteristic.SerialNumber).value);

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
          sendCommand(applianceId: string, order: any) {
            return new Promise((resolve, reject) => {
              const orderEncode = Utils.encode(order);
              const orderEncrypt = this.encryptAes(orderEncode);

              const form :any = {
                applianceId: applianceId,
                src: "17",
                format: "2",
                funId: "FC02", //maybe it is also "0000"
                order: orderEncrypt,
                stamp: Utils.getStamp(),
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
              (err: any, resp: any, body: any) => {
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

                  const response :ApplianceResponse = new ApplianceResponse(Utils.decode(this.decryptAes(body.result.reply)));
                  const properties = Object.getOwnPropertyNames(ApplianceResponse.prototype).slice(1);

                  this.log('target temperature', response.targetTemperature);

                  this.targetTemperature = response.targetTemperature;
                  this.indoorTemperature = response.indoorTemperature;
                  this.fanSpeed = response.fanSpeed;
                  this.powerState = response.powerState ? 1 : 0
                  this.swingMode = response.swingMode;
                  this.operationalMode = response.operationalMode;
                  this.log('fanSpeed is set to', response.fanSpeed);
                  this.log('swingMode is set to', response.swingMode);
                  this.log('powerState is set to', response.powerState);
                  this.log('operational mode is set to', response.operationalMode);



                  
                  resolve();
                } catch (error) {
                  this.log(body);
                  this.log(error);

                  this.log(error.stack);
                  reject();
                }
              }
              );
            });
          }
          getSign(path: string, form: any) {
            const postfix = "/" + path.split("/").slice(3).join("/");
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


          encryptAes(query: number[]) {
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


            const data = header.concat(Constants.UpdateCommand);

            this.hgIdArray.forEach((element: any) => {
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
            command.swingMode = this.swingMode;
            command.fanSpeed = this.fanSpeed;
            command.operationalMode = this.operationalMode
            //operational mode for workaround with fan only mode on device
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
              });
            });
            //after sending, update because sometimes the api hangs
            this.updateValues();
          }




          getServices() {
            return this.enabledServices;
          }
        }









