/*
{
    "bridge": {
    	...
    },

    "description": "...",

    "accessories": [
        {
            "accessory": "Thermostat",
            "name": "Thermostat",
            "ip": "192.168.1.123",
            "password": "pass",
            "maxTemp": "26",
            "minTemp": "15",
            "interval": "3000"
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
	homebridge.registerAccessory('homebridge-anna', 'Thermostat', Thermostat);
}

class Thermostat {
	constructor(log, config) {
		this.log = log;

		this.maxTemp = config.maxTemp || 30;
		this.minTemp = config.minTemp || 15;
		this.name = config.name || 'smile';
		this.password = config.password || null;
		this.interval = config.interval || 3000;
		this.ip = config.ip || null;
		this.annaDevice = null;
		this.log(this.ip, this.name);

		this.currentTemperature = 19;
		this.targetTemperature = 21;

		this.targetHeatingCoolingState = Characteristic.TargetHeatingCoolingState.HEAT;

		this.service = new Service.Thermostat(this.name);

		this.updateTimer = setInterval(() => {
			this.updateTemps();
		}, this.interval);

		this.updateTemps();
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
			.on('get', this.getTargetHeatingCoolingState.bind(this))
			.on('set', this.setTargetHeatingCoolingState.bind(this));

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
				name: 'smile',
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

	updateTemps() {
		if (!this.annaDevice) {
			this.setupAnnaDevice().then(() => {
				this.log('getCurrentTemperature from Anna on: ' + this.annaDevice.ip);
				this.annaDevice._getMeasure((result) => {
					if (result) {
						this.currentTemperature = result;
					} else {
						this.log('could not fetch current temperature');
					}
				});

				this.log('getCurrentTargetTemperature from Anna on: ' + this.annaDevice.ip);
				this.annaDevice._getTarget((result) => {
					if (result) {
						this.targetTemperature = result;
					} else {
						this.log('could not fetch current target temperature');
					}
				});
			});
		} else {
			this.log('getCurrentTemperature from Anna on: ' + this.annaDevice.ip);
			this.annaDevice._getMeasure((result) => {
				if (result) {
					this.currentTemperature = result;
				} else {
					this.log('could not fetch current temperature');
				}
			});

			this.log('getCurrentTargetTemperature from Anna on: ' + this.annaDevice.ip);
			this.annaDevice._getTarget((result) => {
				if (result) {
					this.targetTemperature = result;
				} else {
					this.log('could not fetch current target temperature');
				}
			});
		}
	}

	getCurrentTemperature(callback) {
		callback(null, this.currentTemperature);
	}

	getTargetTemperature(callback) {
		callback(null, this.targetTemperature);
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
		callback(null, this.targetHeatingCoolingState);
	}

	setTargetHeatingCoolingState(value, callback) {
		this.targetHeatingCoolingState = value;

		callback(null, this.targetHeatingCoolingState);
	}
}
