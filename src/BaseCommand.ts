import crc8 from './crc8';
export default class BaseCommand {
    data : any[]
    constructor(device_type = 0xac) {

        this.data = [170, 35, 172, 0, 0, 0, 0, 0, 3, 2, 64, 67, 70, 102, 127, 127, 0, 48, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        this.data[0x02] = device_type;
    }

    finalize() {
        // Add the CRC8
        this.data[this.data.length - 1] = crc8.calculate(this.data.slice(16));
        // Set the length of the command data
        this.data[0x01] = this.data.length;
        return this.data;
    }
}
