# homebridge-anna

Supports the Plugwise Anna thermostat on the HomeBridge Platform

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
                "name": "smile",
                "ip": "192.168.1.123",
                "password": "pass",
                "maxTemp": "26",
                "minTemp": "15"
            }
        ],

        "platforms":[]
    }
```

# Inspired

This plugin is inspired on homebridge-thermostat
