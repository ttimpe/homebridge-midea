import SetCommand from '../SetCommand'

export default class ACSetCommand extends SetCommand {
	 get targetTemperature() {
        return this.data[0x0c] & 0x1f;
    }

    set targetTemperature(temperatureCelsius: number) {
        this.data[0x0c] &= ~0x1f; // Clear the temperature bits
        this.data[0x0c] |= (temperatureCelsius & 0xf) | ((temperatureCelsius << 4) & 0x10);
    }

	get turboMode() {
        return this.data[0x14] > 0;
    }

    set turboMode(turboModeEnabled: boolean) {
        this.data[0x14] = turboModeEnabled ? 0x02 : 0;
    }

   get useFahrenheit() {
       if (this.data[0x14] & (1 << 2)) {
           return true;
        } else {
            return false;
        }
        return true;
    }
    set useFahrenheit(useFahrenheit : boolean) {
      // this.flipBitOfByte(this.data[0x14], 2)
      var mask = 1 << 2
      if (useFahrenheit == true) {
         this.data[0x14] |= mask

      } else {
          this.data[0x14] &= ~mask;
      }
     }
       
}