require('dotenv').config();

const CONFIG = {
    ENPHASE_USER: process.env.ENPHASE_USER,
    ENPHASE_PASSWORD: process.env.ENPHASE_PASSWORD,
    ENVOY_IP: process.env.ENVOY_IP,
    INFLUX_URL: process.env.INFLUX_URL,
    INFLUX_TOKEN: process.env.INFLUX_TOKEN,
    INFLUX_ORG: process.env.INFLUX_ORG,
    INFLUX_BUCKET: process.env.INFLUX_BUCKET,
    // Add separate error bucket support if needed in future, matching reference style roughly
    // For now we map it to the same bucket or just don't use it if not in env, 
    // but the reference repo used a specific CONFIG structure.
    // We will stick to the existing env vars but export them cleanly.
    ENPHASE_POLL_INTERVAL: parseInt(process.env.ENPHASE_POLL_INTERVAL || '60000', 10)
};

// Validate Config
const missingVars = Object.entries(CONFIG).filter(([key, val]) => !val && key !== 'ENPHASE_POLL_INTERVAL').map(([key]) => key);
if (missingVars.length > 0) {
    console.error(`ERROR: Missing environment variables: ${missingVars.join(', ')}`);
    process.exit(1);
}

module.exports = CONFIG;
