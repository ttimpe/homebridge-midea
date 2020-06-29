"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Utils {
    static encode(data) {
        const normalized = [];
        for (let b of data) {
            if (b >= 128) {
                b = b - 256;
            }
            normalized.push(b);
        }
        return normalized;
    }
    static decode(data) {
        const normalized = [];
        for (let b of data) {
            if (b < 0) {
                b = b + 256;
            }
            normalized.push(b);
        }
        return normalized;
    }
    static getStamp() {
        const date = new Date();
        return date.toISOString().slice(0, 19).replace(/-/g, "").replace(/:/g, "").replace(/T/g, "");
    }
    static formatResponse(arr) {
        let output = [];
        for (var i = 0; i < arr.length; i++) {
            let intValue = parseInt(arr[i]);
            output.push((intValue).toString(2));
        }
        return output;
    }
}
exports.default = Utils;
