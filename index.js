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

"use strict";

var PlugwiseAPI = require('plugwise');
var Anna = require('plugwise-anna');
var Service, Characteristic;

module.exports = function(homebridge){
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory('homebridge-anna-thermostat', 'Thermostat', Thermostat);
};

function Thermostat(log, config) {
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

	this.service = new Service.Thermostat(this.name);
}

Thermostat.prototype = {
	//Start
	identify: function(callback) {
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

                    var formatted_device = {
                        name: 'Anna',
                        data: {
                            ip: device.ip,
                            id: devices_data[i].id,
                            hostname: device.hostname,
                            password: device.password
                        }
                    };

                    this.annaDevice = new Anna(device.password, device.ip, devices_data[i].id, device.hostname);
                    callback(null);
                }
            }
        });
	},
	getCurrentTemperature: function(callback) {
		this.log('getCurrentTemperature from Anna on: ' + this.annaDevice.ip);

        this.annaDevice._getMeasure(function (result) {
            if(result)
            {
                this.currentTemperature = result;
                callback(null, this.currentTemperature);
            }
            else {
                this.log('could not fetch current temperature');
                callback('could not fetch current temperature');
            }
        });
	},
	getTargetTemperature: function(callback) {
        this.log('getCurrentTemperature from Anna on: ' + this.annaDevice.ip);

        this.annaDevice._getTarget(function (result) {
            if(result)
            {
                this.targetTemperature = result;
                callback(null, this.targetTemperature);
            }
            else {
                this.log('could not fetch current target temperature');
                callback('could not fetch current target temperature');
            }
        });
	},
	setTargetTemperature: function(value, callback) {
		this.log('setTargetTemperature from Anna on: ' this.annaDevice.ip + ' to ' + value);

        this.annaDevice.setTarget(value, function (err, result) {
            if(err)
            {
                this.log('Error setting target temperature: %s', err);
				callback(err);
            }
            else {
                this.log('Target temperature set to ' + result);
				callback(null);
            }
        });
	},
	getName: function(callback) {
		this.log('getName : ', this.name);
		callback(null, this.name);
	},

	getServices: function() {
		var informationService = new Service.AccessoryInformation();

		informationService
			.setCharacteristic(Characteristic.Manufacturer, 'Plugwise')
			.setCharacteristic(Characteristic.Model, 'Anna')
			.setCharacteristic(Characteristic.SerialNumber, '1337');

		// Required Characteristics
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
		this.log(this.minTemp);
		return [informationService, this.service];
	}
};
