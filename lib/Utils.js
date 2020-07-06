"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Utils – Utility functions
const crypto = require("crypto");
const Constants_1 = __importDefault(require("./Constants"));
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
    // Returns a timestamp in the format YYYYMMDDHHmmss
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
    static getSign(path, form) {
        let postfix = "/v1" + path;
        // Maybe this will help, should remove any query string parameters in the URL from the sign
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
    static decryptAes(reply, dataKey) {
        const decipher = crypto.createDecipheriv("aes-128-ecb", dataKey, "");
        const dec = decipher.update(reply, "hex", "utf8");
        return dec.split(",");
    }
    static decryptAesString(reply, dataKey) {
        const decipher = crypto.createDecipheriv("aes-128-ecb", dataKey, "");
        const dec = decipher.update(reply, "hex", "utf8");
        return dec;
    }
    static encryptAes(query, dataKey) {
        const cipher = crypto.createCipheriv("aes-128-ecb", dataKey, "");
        let ciph = cipher.update(query.join(","), "utf8", "hex");
        ciph += cipher.final("hex");
        return ciph;
    }
    static encryptAesString(query, dataKey) {
        const cipher = crypto.createCipheriv("aes-128-ecb", dataKey, "");
        let ciph = cipher.update(query, "utf8", "hex");
        ciph += cipher.final("hex");
        return ciph;
    }
    static getSignPassword(loginId, password) {
        const pw = crypto.createHash("sha256").update(password).digest("hex");
        return crypto
            .createHash("sha256")
            .update(loginId + pw + Constants_1.default.AppKey)
            .digest("hex");
    }
    static generateDataKey(accessToken) {
        const md5AppKey = crypto.createHash("md5").update(Constants_1.default.AppKey).digest("hex");
        const decipher = crypto.createDecipheriv("aes-128-ecb", md5AppKey.slice(0, 16), "");
        const dec = decipher.update(accessToken, "hex", "utf8");
        return dec;
    }
}
exports.default = Utils;
