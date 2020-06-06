# homebridge-midea

Homebridge plugin to control Midea AC units. Still in early development.


## Configuration

Add this to the accessories array in your config.json:

	{
	    "accessory": "midea",
	    "user": "MIDEA_ACCOUNT_EMAIL",
	    "password": "MIDEA_PASSWORD",
	    "name": "NAME",
	    "interval": 1
	}

## Notes

As of now, this plugin just uses the first device in your account and doesn't care about anything else. The goal is to make this into a platform plugin to allow all of your Midea devices to be shown in HomeKit but this requires more knowledge of other device types.


## Credits
This plugin would not have been possible without the fundamentals that the Midea iobroker plugin and all of the other Midea API clients in Ruby and Python provided.