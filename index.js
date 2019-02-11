/*
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

*/

'use strict';

const PlugwiseAPI = require('./lib/plugwise/plugwise.js');
const Anna = require('./lib/plugwise-anna/anna.js');

let Service, Characteristic;

module.exports = (homebridge) => {
	/* this is the starting point for the plugin where we register the accessory */
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;
	homebridge.registerAccessory('homebridge-anna-thermostat', 'Thermostat', Thermostat);
}

class Thermostat {
	constructor(log, config) {
		this.log = log;

		this.maxTemp = config.maxTemp || 30;
		this.minTemp = config.minTemp || 15;
		this.name = config.name || 'smile';
		this.password = config.password || null;
		this.ip = config.ip || null;
		this.annaDevice = null;
		this.log(this.ip, this.name);

		this.currentTemperature = 19;
		this.targetTemperature = 21;

		this.targetHeatingCoolingState = Characteristic.TargetHeatingCoolingState.HEAT;

		this.service = new Service.Thermostat(this.name);
	}

	getServices() {
		const informationService = new Service.AccessoryInformation()
			.setCharacteristic(Characteristic.Manufacturer, 'Plugwise')
			.setCharacteristic(Characteristic.Model, 'Anna')
			.setCharacteristic(Characteristic.SerialNumber, 'plugwise-anna-thermostat');

		this.service
			.getCharacteristic(Characteristic.CurrentTemperature)
			.on('get', this.getCurrentTemperature.bind(this));

		this.service
			.getCharacteristic(Characteristic.TargetTemperature)
			.on('get', this.getTargetTemperature.bind(this))
			.on('set', this.setTargetTemperature.bind(this));

		this.service
			.getCharacteristic(Characteristic.Name)
			.on('get', this.getName.bind(this));
		this.service.getCharacteristic(Characteristic.CurrentTemperature)
			.setProps({
				minValue: this.minTemp,
				maxValue: this.maxTemp,
				minStep: 1
			});
		this.service.getCharacteristic(Characteristic.TargetTemperature)
			.setProps({
				minValue: this.minTemp,
				maxValue: this.maxTemp,
				minStep: 1
			});

		this.service
			.getCharacteristic(Characteristic.TargetHeatingCoolingState)
			.on('get', this.getTargetHeatingCoolingState.bind(this));

		/* Return both the main service (this.service) and the informationService */
		return [informationService, this.service];
	}

	getName(callback) {
		this.log('getName : ', this.name);
		callback(null, this.name);
	}

	setupAnnaDevice() {
		return new Promise((resolve, reject) => {
			this.log('Set Anna device up');

			var device = {
				ip: this.ip,
				name: this.name,
				password: this.password
			};

			PlugwiseAPI.fetchData(device).then(devices_data => {
				for (let i in devices_data) {
					if (devices_data[i].type === 'thermostat') {
						this.log('Anna: connect to device at ' + device.ip);

						this.annaDevice = new Anna(device.password, device.ip, devices_data[i].id, device.hostname);
						resolve();
					}
				}
			});
		});
	}

	getCurrentTemperature(callback) {
		if (!this.annaDevice) {
			this.setupAnnaDevice().then(() => {
				this.log('getCurrentTemperature from Anna on: ' + this.annaDevice.ip);
				this.annaDevice._getMeasure((result) => {
					if (result) {
						this.currentTemperature = result;
						callback(null, this.currentTemperature);
					} else {
						this.log('could not fetch current temperature');
						callback('could not fetch current temperature');
					}
				});
			});
		} else {
			this.log('getCurrentTemperature from Anna on: ' + this.annaDevice.ip);
			this.annaDevice._getMeasure((result) => {
				if (result) {
					this.currentTemperature = result;
					callback(null, this.currentTemperature);
				} else {
					this.log('could not fetch current temperature');
					callback('could not fetch current temperature');
				}
			});
		}
	}

	getTargetTemperature(callback) {
		if (!this.annaDevice) {
			this.setupAnnaDevice().then(() => {
				this.log('getCurrentTemperature from Anna on: ' + this.annaDevice.ip);

				this.annaDevice._getTarget((result) => {
					if (result) {
						this.targetTemperature = result;
						callback(null, this.targetTemperature);
					} else {
						this.log('could not fetch current target temperature');
						callback('could not fetch current target temperature');
					}
				});
			});
		} else {
			this.log('getCurrentTemperature from Anna on: ' + this.annaDevice.ip);

			this.annaDevice._getTarget((result) => {
				if (result) {
					this.targetTemperature = result;
					callback(null, this.targetTemperature);
				} else {
					this.log('could not fetch current target temperature');
					callback('could not fetch current target temperature');
				}
			});
		}
	}

	setTargetTemperature(value, callback) {
		if (!this.annaDevice) {
			this.setupAnnaDevice().then(() => {
				this.log('setTargetTemperature from Anna on: ' + this.annaDevice.ip + ' to ' + value);

				this.annaDevice.setTarget(value, (err, result) => {
					if (err) {
						this.log('Error setting target temperature: %s', err);
						callback(err);
					} else {
						this.log('Target temperature set to ' + result);
						callback(null);
					}
				});
			});
		} else {
			this.log('setTargetTemperature from Anna on: ' + this.annaDevice.ip + ' to ' + value);

			this.annaDevice.setTarget(value, (err, result) => {
				if (err) {
					this.log('Error setting target temperature: %s', err);
					callback(err);
				} else {
					this.log('Target temperature set to ' + result);
					callback(null);
				}
			});
		}
	}

	getTargetHeatingCoolingState(callback) {
		if((this.currentTemperature === this.targetTemperature))
		{
			this.targetHeatingCoolingState = Characteristic.TargetHeatingCoolingState.HEAT;
		} else if (this.currentTemperature < this.targetTemperature) {
			this.targetHeatingCoolingState = Characteristic.TargetHeatingCoolingState.HEAT;
		} else {
			this.targetHeatingCoolingState = Characteristic.TargetHeatingCoolingState.COOL;
		}

		callback(null, this.targetHeatingCoolingState);
	}
}
