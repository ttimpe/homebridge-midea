"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const SetCommand_1 = __importDefault(require("../SetCommand"));
class DehumidifierSetCommand extends SetCommand_1.default {
    get targetHumidity() {
        return this.data[0x07] & 127;
    }
    set targetHumidity(value) {
        this.data[0x07] = value & 127;
        this.data[0x08] = 0 & 15;
    }
}
exports.default = DehumidifierSetCommand;
