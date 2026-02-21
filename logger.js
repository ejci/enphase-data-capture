const pino = require('pino');

const logger = pino({
    level: process.env.ENPHASE_LOG_LEVEL || 'info',
    base: {
        service: 'enphase-data-capture'
    },
    timestamp: pino.stdTimeFunctions.isoTime
});

module.exports = logger;
