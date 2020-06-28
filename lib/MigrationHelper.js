"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MigrationHelper = void 0;
const fs = require('fs');
class MigrationHelper {
    constructor(log, configFilePath) {
        this.configFilePath = '';
        this.log = log;
        if (fs.existsSync(configFilePath)) {
            this.configFilePath = configFilePath;
            let file = fs.readFileSync(configFilePath);
            let config = JSON.parse(file);
            let migratedConfig = this.migrate(config);
            this.backupConfig();
            if (this.writeNewConfig(migratedConfig)) {
                this.restartHomebridge();
            }
        }
    }
    writeNewConfig(config) {
        let configString = JSON.stringify(config);
        fs.writeFile(this.configFilePath, configString, 'utf-8', (err) => {
            if (err) {
                this.log.error("Could not rewrite config file to use platform instead of accessory, please adjust your configuration manually.");
                this.log.error(err.toString());
                return false;
            }
            else {
                this.log.info("Successfully igrated configuration to platform. Killing homebridge proccess to restart it");
                return true;
            }
        });
        return false;
    }
    backupConfig() {
        let file = fs.readFileSync(this.configFilePath);
        fs.writeFile(this.configFilePath + '.bak', file, 'utf-8', (err) => {
            if (err) {
                this.log.warn("Error making backup of config");
            }
            else {
                this.log.debug("Made backup of config.json");
            }
        });
    }
    migrate(config) {
        let platformObject = {
            "platform": "midea",
            "interval": 1,
            "user": "",
            "password": ""
        };
        if (config.hasOwnProperty('platforms')) {
            for (var i = 0; i < config.platforms.length; i++) {
                if (config.platforms[i].platform == 'midea') {
                    // We already have a platform, return
                    return null;
                }
            }
        }
        else {
            // We don't even have any platforms defined, let's create a new array
            config.platforms = [];
        }
        if (config.hasOwnProperty('accessories')) {
            for (var i = 0; i < config.accessories.length; i++) {
                if (config.accessories[i].accessory === 'midea') {
                    // We have an existing installation
                    this.log.warn('Found existing Midea accessory, migrating');
                    platformObject.user = config.accessories[i].user;
                    platformObject.password = config.accessories[i].password;
                    platformObject.interval = config.accessories[i].interval;
                    // Remove accessory
                    config.accessories.splice(i, 1);
                }
            }
            config.platforms.push(platformObject);
            return config;
        }
    }
    restartHomebridge() {
        process.exit(1);
    }
}
exports.MigrationHelper = MigrationHelper;
