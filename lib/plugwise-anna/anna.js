"use strict";

var XML = require('pixl-xml');
var request = require('request');
const EventEmitter = require('events').EventEmitter;

class Anna extends EventEmitter {

	constructor(password, ip, id, hostname, callback) {
		super();

		// Store properties
		this.password = password;
		this.ip = ip;
		this.id = id;
		this.hostname = hostname;
		this.target_temperature = undefined;
		this.measure_temperature = undefined;
		this.status = undefined;

		// Start polling for data changes
		this._startPolling();

		const target = new Promise(resolve => {
			this._getTarget(target_temperature => {
				if (target_temperature) resolve(target_temperature);
				else {
					setTimeout(() => {
						this._getTarget(target_temperature => {
							if (target_temperature) resolve(target_temperature);
							else {
								setTimeout(() => {
									this._getTarget(target_temperature => {
										if (target_temperature) resolve(target_temperature);
										else resolve();
									});
								}, 1000);
							}
						});
					}, 1000);
				}
			});
		});

		const measure = new Promise(resolve => {
			this._getMeasure(measure_temperature => {
				if (measure_temperature) resolve(measure_temperature);
				else {
					setTimeout(() => {
						this._getMeasure(measure_temperature => {
							if (measure_temperature) resolve(measure_temperature);
							else {
								setTimeout(() => {
									this._getMeasure(measure_temperature => {
										if (measure_temperature) resolve(measure_temperature);
										else resolve();
									});
								}, 1000);
							}
						});
					}, 1000);
				}
			});
		});

		Promise.all([target, measure]).then(() => {
			console.log('All information loaded');
			if (typeof callback === 'function') callback()
		});
	}

	setTarget(input, callback) {
		this._limitTemperature(input, function (temperature) {
			request({
				url: this._createAPIUrl() + '/thermostat',
				timeout: 5000,
				method: 'PUT',
				body: '<thermostat_functionality><setpoint>' + temperature + '</setpoint></thermostat_functionality>',
				headers: { 'Content-Type': 'text/xml' }
			}, function (error) {
				if (error) {

					// Emit device unavailable
					if (this.status === 'wait') {
						this.status = 'offline';
						this.emit("unavailable", this);
					} else if (this.status !== 'offline' && typeof this.status !== 'undefined') {

						// Add one to status
						this.status = 'wait';
					}

					callback('Offline');
				}
				else {

					if (typeof this.status === 'undefined') {
						this.status = 'online';
						this.emit('available', this);
					}

					// Emit device available
					if (this.status === 'offline') {
						this.emit("available", this);
						this.status = 'online';
					}

					if (this.status === 'wait') this.status = 'online';

					console.log("Anna: set target temperature successful, new value " + temperature);

					// Emit realtime update
					if (temperature !== this.target_temperature) this.emit("target_temperature", this, temperature);

					// Store updated value
					this.target_temperature = temperature;

					// Return with callback
					callback(null, temperature);
				}
			}.bind(this));

		}.bind(this));
	};

	_getTarget(callback) {
		request({
			url: this._createAPIUrl(),
			timeout: 5000,
			method: 'GET',
			headers: { 'Content-Type': 'text/xml' }
		}, function (error, response, body) {
			console.log(`_getTarget() -> this.status = ${this.status}`)
			if (error) {

				// Emit device unavailable
				if (this.status === 'wait') {
					this.status = 'offline';
					this.emit("unavailable", this);
				} else if (this.status !== 'offline' && typeof this.status !== 'undefined') {

					// Add one to status
					this.status = 'wait';
				}

				callback();
			}
			else {

				if (typeof this.status === 'undefined') {
					this.status = 'online';
					this.emit('available', this);
				}

				// Emit device available
				if (this.status === 'offline') {
					this.emit("available", this);
					this.status = 'online';
				}

				if (this.status === 'wait') this.status = 'online';

				// Parse XML
				var doc;
				try {
					doc = XML.parse(body);
				} catch (err) {
					return callback(null);
				}
				if (doc) {

					if(!doc.appliance) return callback(this.target_temperature);
					if (!Array.isArray(doc.appliance)) doc.appliance = [doc.appliance];

					// Loop over all elements in the XML document
					doc.appliance.forEach(function (element) {

						// Check for Anna device
						if (element.type == 'thermostat') {

							// Check if set point temperature is provided
							if (element.actuator_functionalities
								&& element.actuator_functionalities.thermostat_functionality
								&& element.actuator_functionalities.thermostat_functionality.setpoint
							) {

								// Save target temperature
								return callback(parseFloat(element.actuator_functionalities.thermostat_functionality.setpoint));
							}
						}
					});
				}
				else {
					callback(this.target_temperature);
				}
			}
		}.bind(this));
	}

	_getMeasure(callback) {

		// Make API request
		request({
			url: this._createAPIUrl(),
			timeout: 5000,
			method: 'GET',
			headers: { 'Content-Type': 'text/xml' }
		}, function (error, response, body) {
			console.log(`_getMeasure() -> this.status = ${this.status}`)

			if (error) {

				// Emit device unavailable
				if (this.status === 'wait') {
					this.status = 'offline';
					this.emit("unavailable", this);
				} else if (this.status !== 'offline' && typeof this.status !== 'undefined') {

					// Add one to status
					this.status = 'wait';
				}

				callback();
			}
			else {

				if (typeof this.status === 'undefined') {
					this.status = 'online';
					this.emit('available', this);
				}

				// Emit device available
				if (this.status === 'offline') {
					this.emit("available", this);
					this.status = 'online';
				}

				if (this.status === 'wait') this.status = 'online';

				// Parse XML
				var doc;
				try {
					doc = XML.parse(body);
				} catch (err) {
					return callback(err);
				}
				if (doc) {

					if(!doc.appliance) return callback(this.target_temperature);
					if (!Array.isArray(doc.appliance)) doc.appliance = [doc.appliance];

					// Loop over all elements in the XML document
					doc.appliance.forEach(function (element) {

						// Check if measured temperature is provided
						if (element.logs && element.logs.point_log) {
							var temp_data = element.logs.point_log.filter(function (x) {
								return x.type === 'temperature'
							})[0];

							if (temp_data && temp_data.period
								&& temp_data.period.measurement
								&& temp_data.period.measurement._Data) {

								// Return with callback
								return callback(parseFloat(temp_data.period.measurement._Data));
							}
						}
					});
				}
				else {
					callback(this.measure_temperature);
				}
			}
		}.bind(this));
	}

	_startPolling() {

		// Fill initial values
		this._updateTemperatureValues();

		this.pollInterval = setInterval(() => {

			// Update values
			this._updateTemperatureValues();

		}, 15000);
	}

	_updateTemperatureValues() {

		// Fetch target temperature
		this._getTarget((target_temperature) => {
			if (target_temperature) {
				const newValue = parseFloat(parseFloat(target_temperature).toFixed(1));

				// If value differs from previous
				if (!isNaN(newValue) && this.target_temperature !== newValue && this.target_temperature !== undefined) {

					console.log("Anna: target temperature changed to " + newValue);

					// Emit event
					this.emit("target_temperature", this, newValue);
				}

				// Update value
				if (!isNaN(newValue)) this.target_temperature = newValue;
			}
		});

		// Fetch measure temperature
		this._getMeasure((measure_temperature) => {
			if (measure_temperature) {

				const newValue = parseFloat(parseFloat(measure_temperature).toFixed(1));

				// If value differs from previous
				if (!isNaN(newValue) && this.measure_temperature !== newValue && this.measure_temperature !== undefined) {

					console.log("Anna: measure temperature changed to " + newValue);

					// Emit event
					this.emit("measure_temperature", this, newValue);
				}

				// Update value
				if (!isNaN(newValue)) this.measure_temperature = newValue;
			}
		});
	}

	_limitTemperature(temperature, callback) {

		if (temperature > 30) {
			return callback(30);
		}
		else if (temperature < 4) {
			return callback(4);
		}
		else {
			callback(Math.round(temperature * 2) / 2);
		}
	}

	_createAPIUrl() {
		return 'http://smile:' + this.password + '@' + this.ip + '/core/appliances;id=' + this.id;
	}

	remove() {
		if (this.pollInterval) clearInterval(this.pollInterval);
	}
}

module.exports = Anna;