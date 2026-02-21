const { InfluxDB, Point } = require('@influxdata/influxdb-client');
const axios = require('axios');
const logger = require('./logger');
const CONFIG = require('./config');

let writeApi;

if (CONFIG.INFLUX_URL) {
    const client = new InfluxDB({ url: CONFIG.INFLUX_URL, token: CONFIG.INFLUX_TOKEN });
    writeApi = client.getWriteApi(CONFIG.INFLUX_ORG, CONFIG.INFLUX_BUCKET);
}

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
    logError
};
