# homebridge-anna

Supports the Plugwise Anna thermostat (Up to legacy version 1.8) on the HomeBridge Platform. If you are on a higher version than v1.8, this plugin will not work!

# Installation

1. Install homebridge using: npm install -g homebridge
2. Install this plugin using: npm install -g homebridge-anna
3. Update your configuration file. See bellow for a sample.

# Configuration

Configuration sample:

 ```
    {
        "bridge": {
            ...
        },

        "description": "...",

        "accessories": [
            {
                "accessory": "Thermostat",
                "name": "Thermostaat",
                "ip": "192.168.1.123",
                "password": "pass",
                "maxTemp": "26", #in celsius
                "minTemp": "15", #in celsius
                "interval": "3000" #in milliseconds, 3 seconds by default
            }
        ],

        "platforms":[]
    }
```
