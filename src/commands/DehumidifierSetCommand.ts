import SetCommand from '../SetCommand';

export default class DehumidifierSetCommand extends SetCommand {
	get targetHumidity() {
		return this.data[0x07] & 127
	}

	set targetHumidity(value: number) {
		this.data[0x07] = value & 127
		this.data[0x08] = 0 & 15
	}


}