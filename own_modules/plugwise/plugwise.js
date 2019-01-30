"use strict";

var XML = require('pixl-xml');
var request = require('request');
var mdns = require('mdns-js');

class PlugwiseAPI {

	constructor() {

		this.devices = {
			'stretch': [],
			'smile': []
		}
	}

	fetchData(device) {
		return new Promise((resolve, reject) => {
			var url = `http://${device.name}:${device.password}@${device.ip}/core/appliances`;

			// Make request to Plugwise API
			request({ url: url, method: 'GET', timeout: 15000 }, function (error, response, body) {

				// Catch errors
				if (error) return reject(error);
				if (response == "undefined") return reject("device_unavailable");
				if (response.statusCode == "401") return reject("auth_error");

				// Collect results
				var devices = [];

				// Parse XML
				var doc;
				try {
					doc = XML.parse(body);
				} catch (err) {
					return reject(err);
				}
				if (doc) {

					// Parse into right format
					if (doc.appliance instanceof Array) doc = doc.appliance;
					else if (doc.appliance instanceof Object) doc = [doc.appliance];

					// Check for array
					if (!Array.isArray(doc)) return reject('Invalid data provided in doc');

					// Loop over all elements in the XML document
					doc.forEach(function (element) {

						// Check for Anna device
						if (element.type == 'thermostat') {

							let device = {
								type: 'thermostat',
								id: element.id,
								name: element.name
							};

							// Check if set point temperature is provided
							if (element.actuator_functionalities
								&& element.actuator_functionalities.thermostat_functionality
								&& element.actuator_functionalities.thermostat_functionality.setpoint
							) {

								// Save target temperature
								device.target_temperature = parseFloat(element.actuator_functionalities.thermostat_functionality.setpoint);
							}

							// Check if measured temperature is provided
							if (element.logs && element.logs.point_log) {
								var temp_data = element.logs.point_log.filter(function (x) {
									return x.type === 'temperature'
								})[0];

								if (temp_data && temp_data.period
									&& temp_data.period.measurement
									&& temp_data.period.measurement._Data) {

									// Save measure temperature
									device.measure_temperature = parseFloat(temp_data.period.measurement._Data)
								}
							}

							// Check if set point temperature is provided
							if (element.actuator_functionalities
								&& element.actuator_functionalities.toggle_functionality
								&& element.actuator_functionalities.toggle_functionality.state
							) {
								device.onoff = (element.actuator_functionalities.toggle_functionality.state === "on")
							}

							return devices.push(device);
						}

						// Check for a Plug device
						if (element.actuators && element.actuators.relay && element.actuators.relay.id) {
							return devices.push({ type: 'plug', id: element.id, name: element.name });
						}
					}, this);

					// Done
					resolve(devices);
				}
			});
		});
	}

	discoverDevices(device_type) {

		return new Promise(resolve => {

			var debouncer = {};

			var browser = mdns.createBrowser(mdns.tcp("plugwise"));

			this.devices[device_type] = [];

			console.log(`Plugwise: start discovering ${device_type} devices`);

			// When browser is ready
			browser.on('ready', onReady.bind(this));

			function onReady() {

				// Resolve after three seconds
				setTimeout(() => {

					for (let i in debouncer) {
						debouncer[i].fn(debouncer[i].data);
					}

					console.log(`Plugwise: done discovering, found ${this.devices[device_type].length} devices`);

					// Return result
					resolve(this.devices[device_type]);

					// Remove event listener
					browser.removeListener("update", parseDevice);
					browser.removeListener("ready", onReady);
					//browser.removeListeners();
				}, 5000);

				// Start discovery
				browser.discover();
			}

			// Listen for found devices
			var success = false;
			browser.on('update', data => debouncer[data.addresses[0]] = { fn: parseDevice.bind(this), data: data });

			function parseDevice(data) {

				// Only add devices of desired category
				if (data.txt && data.txt[0].indexOf(device_type) > -1 && this.devices[device_type].indexOf(data) === -1) {

					console.log(`Plugwise: found device on ${data.addresses[0]}`);

					// Store device
					this.devices[device_type].push(data);

					// Mark success
					success = true;
				}
			}
		});
	};
}

module.exports = new PlugwiseAPI();
