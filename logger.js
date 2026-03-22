const pino = require('pino');

/**
 * Shared Pino logger instance configured for JSON structured logging.
 * Logs include ISO timestamps and a service label for Loki compatibility.
 * 
 * @type {import('pino').Logger}
 */
const logger = pino({
    level: process.env.ENPHASE_LOG_LEVEL || 'info',
    base: {
        service: 'enphase-data-capture'
    },
    timestamp: pino.stdTimeFunctions.isoTime
});

module.exports = logger;
