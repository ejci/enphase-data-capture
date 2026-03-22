const { InfluxDB, Point } = require('@influxdata/influxdb-client');
const axios = require('axios');
const logger = require('./logger');
const CONFIG = require('./config');

let writeApi;

/**
 * Initializes the InfluxDB Write API.
 * 
 * @param {string} url - The InfluxDB base URL.
 * @param {string} token - The authentication token.
 * @param {string} org - The InfluxDB organization.
 * @param {string} bucket - The InfluxDB bucket.
 * @returns {void}
 */
function initInflux(url, token, org, bucket) {
    if (url) {
        const client = new InfluxDB({ url, token });
        writeApi = client.getWriteApi(org, bucket);
    } else {
        writeApi = null;
    }
}

// Perform initial setup
initInflux(CONFIG.INFLUX_URL, CONFIG.INFLUX_TOKEN, CONFIG.INFLUX_ORG, CONFIG.INFLUX_BUCKET);

/**
 * Checks if the InfluxDB instance is reachable via its `/health` endpoint.
 * 
 * @returns {Promise<boolean>} True if the connection is successful, false otherwise.
 */
async function checkConnection() {
    try {
        logger.info({ influxUrl: CONFIG.INFLUX_URL }, 'Checking InfluxDB health');
        const response = await axios.get(`${CONFIG.INFLUX_URL}/health`, {
            timeout: 5000
        });

        if (response.status === 200) {
            logger.info({ influxUrl: CONFIG.INFLUX_URL }, 'InfluxDB is available');
            return true;
        } else {
            logger.warn({ influxUrl: CONFIG.INFLUX_URL, status: response.status }, 'InfluxDB returned unexpected status');
            return false;
        }

    } catch (error) {
        logger.warn({ influxUrl: CONFIG.INFLUX_URL, err: error.message }, 'InfluxDB is not available — data will be buffered');
        return false;
    }
}

/**
 * Maps the raw Envoy data to InfluxDB Points and writes them.
 * 
 * @param {Array<Object>} inverterData - Array of inverter data objects.
 * @returns {void}
 */
function writeMeasurement(inverterData) {
    if (!writeApi) return;

    const points = inverterData.map(inv => {
        return new Point('inverter_production')
            .tag('serialNumber', inv.serialNumber)
            .floatField('lastReportWatts', inv.lastReportWatts)
            .floatField('maxReportWatts', inv.maxReportWatts);
    });

    points.forEach(p => writeApi.writePoint(p));
}

/**
 * Logs an error locally and attempts to write it to InfluxDB as well.
 * 
 * @param {string} context - The context where the error occurred (e.g., 'Polling Data').
 * @param {Error|string} error - The error or error message to log.
 * @returns {void}
 */
function logError(context, error) {
    logger.error({ context, err: error.message || String(error) }, 'Application error');

    if (writeApi) {
        const point = new Point('application_errors')
            .tag('service', 'enphase-data-capture')
            .tag('context', context)
            .stringField('message', error.message || String(error));
        writeApi.writePoint(point);
    }
}

module.exports = {
    checkConnection,
    writeMeasurement,
    logError,
    initInflux // Exported for unit tests
};
