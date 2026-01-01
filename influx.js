const { InfluxDB, Point } = require('@influxdata/influxdb-client');
const axios = require('axios');
const CONFIG = require('./config');

let writeApi;

if (CONFIG.INFLUX_URL) {
    const client = new InfluxDB({ url: CONFIG.INFLUX_URL, token: CONFIG.INFLUX_TOKEN });
    writeApi = client.getWriteApi(CONFIG.INFLUX_ORG, CONFIG.INFLUX_BUCKET);
}

async function checkConnection() {
    try {
        console.log(`Checking InfluxDB health at ${CONFIG.INFLUX_URL}/health...`);
        // Using axios for simple health check as per previous logic, 
        // though client library has ping, the previous implementation used axios and worked well.
        // We will stick to axios for the raw health endpoint check to be consistent with previous verification.
        const response = await axios.get(`${CONFIG.INFLUX_URL}/health`, {
            timeout: 5000
        });

        if (response.status === 200) {
            console.log(`InfluxDB is available at ${CONFIG.INFLUX_URL}.`);
            return true;
        } else {
            console.error(`WARNING: InfluxDB at ${CONFIG.INFLUX_URL} returned status ${response.status}.`);
            return false;
        }

    } catch (error) {
        console.error(`WARNING: InfluxDB at ${CONFIG.INFLUX_URL} is not available: ${error.message}. Data will be buffered.`);
        return false;
    }
}

function writeMeasurement(inverterData) {
    if (!writeApi) return;

    const points = inverterData.map(inv => {
        return new Point('inverter_production')
            .tag('serialNumber', inv.serialNumber)
            .floatField('lastReportWatts', inv.lastReportWatts)
            .floatField('maxReportWatts', inv.maxReportWatts);
    });

    points.forEach(p => writeApi.writePoint(p));
    // Flush happens automatically, but can differ based on library config. Default is valid.
}

function logError(context, error) {
    console.error(`Error in ${context}:`, error.message || error);

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
    logError
};
