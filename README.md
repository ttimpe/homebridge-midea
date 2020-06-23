# homebridge-midea

Homebridge plugin to control Midea AC units. Still in early development.


## Configuration

Add this to the accessories array in your config.json:

	{
	    "platform": "midea",
	    "user": "MIDEA_ACCOUNT_EMAIL",
	    "password": "MIDEA_PASSWORD",
	    "name": "NAME",
	    "interval": 1,
        "supportedSwingMode": "Vertical",
        "fanOnlyMode": true,
        "fanOnlyModeName": "Lüftermodus",
        "temperatureSteps": 1,
        "model": "comfee",
        "id": "12345"
	}

## Optional Configuration Values

### supportedSwingMode

"Off", "Vertical", "Horizontal", "Both"
You have to select which type your device supports

### fanOnlyMode

If your device support "Fan only mode" you can set it to "true", default is "false".
Because homekit does not support this, we did a workaround. A additional fan device is available you can activate.

### fanOnlyModeName

Name of the Homekit Device for the Fan only mode. Default name is "Fan only mode".

### temperatureSteps

Temperature steps that the device supports. Default is 0.5

### model & id

Information that you can find in the homekit accessory

## Usage

Rotation Speed/Swing mode can set in the homekit device when you swipe up tp the device settings.
Rotation Speed values are:
0 : device off
-25%: Low 
-50%: Middle
-75%: High
-100%: Auto


## Notes

As of now, this plugin just uses the first device in your account and doesn't care about anything else. The goal is to make this into a platform plugin to allow all of your Midea devices to be shown in HomeKit but this requires more knowledge of other device types.


## Credits
This plugin would not have been possible without the fundamentals that the Midea iobroker plugin and all of the other Midea API clients in Ruby and Python provided.