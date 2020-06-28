import { API } from 'homebridge'
import { MideaPlatform } from './MideaPlatform'
export = (api: API) => {
  api.registerPlatform('midea', MideaPlatform);
}

