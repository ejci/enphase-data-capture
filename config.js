const logger = require('./logger');

require('dotenv').config();

const CONFIG = {
    ENPHASE_USER: process.env.ENPHASE_USER,
    ENPHASE_PASSWORD: process.env.ENPHASE_PASSWORD,
    ENVOY_IP: process.env.ENVOY_IP,
    INFLUX_URL: process.env.INFLUX_URL,
    INFLUX_TOKEN: process.env.INFLUX_TOKEN,
    INFLUX_ORG: process.env.INFLUX_ORG,
    INFLUX_BUCKET: process.env.INFLUX_BUCKET,
    ENPHASE_POLL_INTERVAL: parseInt(process.env.ENPHASE_POLL_INTERVAL || '60000', 10),
    ENPHASE_LOG_LEVEL: process.env.ENPHASE_LOG_LEVEL || 'info'
};

/**
 * Validates the loaded configuration object to ensure all required environment
 * variables are present. If any are missing, it logs an error and exits the process.
 * 
 * @param {Object} configToValidate - The configuration object to validate.
 * @returns {void}
 */
function validateConfig(configToValidate) {
    const missingVars = Object.entries(configToValidate)
        .filter(([key, val]) => !val && key !== 'ENPHASE_POLL_INTERVAL' && key !== 'ENPHASE_LOG_LEVEL')
        .map(([key]) => key);

    if (missingVars.length > 0) {
        logger.error({ missingVars }, 'Missing required environment variables');
        process.exit(1);
    }
}

// Perform initial validation
validateConfig(CONFIG);

module.exports = { ...CONFIG, validateConfig };
