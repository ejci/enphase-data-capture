const logger = require('./logger');
const CONFIG = require('./config');
const influx = require('./influx');
const enphase = require('./enphase');

/**
 * Main polling logic
 */
async function pollData() {
    try {
        logger.info('Polling data...');

        const inverters = await enphase.getInverterData();
        logger.info({ inverterCount: inverters.length }, 'Received inverter data');

        influx.writeMeasurement(inverters);
        logger.info('Data pushed to InfluxDB');

    } catch (error) {
        influx.logError('Polling Data', error);
    }
}

// Main Execution
async function main() {
    logger.info('Starting Enphase Data Capture...');

    // Health Check
    await influx.checkConnection();

    // Initial Run
    await pollData();

    // Schedule
    setInterval(pollData, CONFIG.ENPHASE_POLL_INTERVAL);
}

main();
