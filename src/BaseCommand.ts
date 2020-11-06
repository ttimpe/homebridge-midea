import crc8 from './crc8';

import { MideaDeviceType } from './enums/MideaDeviceType';

export default class BaseCommand {
    data : any[]
    device_type: MideaDeviceType
    
    constructor(device_type: MideaDeviceType) {

        this.device_type = device_type

        if (device_type == MideaDeviceType.AirConditioner) {
           this.data = [170, 35, 172, 0, 0, 0, 0, 0, 3, 2, 64, 67, 70, 102, 127, 127, 0, 48, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
           
        } else if (device_type == MideaDeviceType.Dehumidifier) {
            this.data = [170, 34, 161, 0, 0, 0, 0, 0, 3, 2, 72, 67, 3, 208, 127, 127, 0, 50, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        } else {
            this.data = [90, 90, 1, 0, 91, 0, 32, 0, 10, 0, 0, 0, 10, 10, 10, 3, 2, 11, 18, 20, 218, 73, 0, 0, 0, 16, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        }
    }

    finalize() {
        // Add the CRC8
        this.data[this.data.length - 1] = crc8.calculate(this.data.slice(16));
        
        // Set the length of the command data
        this.data[0x01] = this.data.length;

        return this.data;
    }
}
