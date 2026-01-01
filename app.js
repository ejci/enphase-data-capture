const CONFIG = require('./config');
const influx = require('./influx');
const enphase = require('./enphase');

// Override console methods to include timestamps
const originalLog = console.log;
const originalError = console.error;

console.log = (...args) => {
    originalLog(new Date().toISOString(), ...args);
};

console.error = (...args) => {
    originalError(new Date().toISOString(), ...args);
};

/**
 * Main polling logic
 */
async function pollData() {
    try {
        console.log('Polling data...');

        const inverters = await enphase.getInverterData();
        console.log(`Received data for ${inverters.length} inverters.`);

        influx.writeMeasurement(inverters);
        console.log('Data pushed to InfluxDB.');

    } catch (error) {
        influx.logError('Polling Data', error);
    }
}

// Main Execution
async function main() {
    console.log('Starting Enphase Data Capture...');

    // Health Check
    await influx.checkConnection();

    // Initial Run
    await pollData();

    // Schedule
    setInterval(pollData, CONFIG.POLL_INTERVAL);
}

main();
