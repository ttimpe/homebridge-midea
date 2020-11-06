"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const SetCommand_1 = __importDefault(require("../SetCommand"));
const MideaDeviceType_1 = require("../enums/MideaDeviceType");
class DehumidifierSetCommand extends SetCommand_1.default {
    constructor(device_type = MideaDeviceType_1.MideaDeviceType.Dehumidifier) {
        super(device_type);
    }
    get targetHumidity() {
        return this.data[0x07] & 127;
    }
    set targetHumidity(value) {
        this.data[0x07] = value & 127;
        this.data[0x08] = 0 & 15;
    }
    get powerState() {
        return this.data[0x0b] & 0x01;
    }
    set powerState(state) {
        this.data[0x0b] &= ~0x01; // Clear the power bit
        this.data[0x0b] |= state ? 0x01 : 0;
    }
}
exports.default = DehumidifierSetCommand;
