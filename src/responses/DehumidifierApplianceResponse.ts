import ApplianceResponse from '../ApplianceResponse';

export default class DehumidifierApplianceResponse extends ApplianceResponse {
	    // Byte 0x0d
    get currentHumidity() {
        return this.data[0x10];
    }

    get targetHumidity() {
    	return this.data[0x07];
    }

    get waterLevel() {
    	return this.data[0x0a] & 127;

    }
}