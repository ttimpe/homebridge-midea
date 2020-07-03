"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const crc8_1 = __importDefault(require("./crc8"));
class BaseCommand {
    constructor(device_type = 0xac) {
        this.data = [170, 35, 172, 0, 0, 0, 0, 0, 3, 2, 64, 67, 70, 102, 127, 127, 0, 48, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
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
