"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const crc8_1 = __importDefault(require("./crc8"));
const MideaDeviceType_1 = require("./enums/MideaDeviceType");
class BaseCommand {
    constructor(device_type = 0xac) {
        this.device_type = MideaDeviceType_1.MideaDeviceType.AirConditioner;
        this.device_type = device_type;
        if (device_type == MideaDeviceType_1.MideaDeviceType.AirConditioner) {
            this.data = [170, 35, 172, 0, 0, 0, 0, 0, 3, 2, 64, 67, 70, 102, 127, 127, 0, 48, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        }
        else {
            this.data = [90, 90, 1, 0, 89, 0, 32, 0, 1, 0, 0, 0, 39, 36, 17, 9, 13, 10, 18, 20, 218, 73, 0, 0, 0, 16, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        }
        this.data[0x02] = device_type;
    }
    finalize() {
        // Add the CRC8
        this.data[this.data.length - 1] = crc8_1.default.calculate(this.data.slice(16));
        // Set the length of the command data
        this.data[0x01] = this.data.length;
        return this.data;
    }
}
exports.default = BaseCommand;
