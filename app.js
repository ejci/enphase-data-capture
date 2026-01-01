const fs = require('fs');
const https = require('https');
const axios = require('axios');
const xml2js = require('xml2js');
const { InfluxDB, Point } = require('@influxdata/influxdb-client');
require('dotenv').config();

// Configuration from Environment Variables
const CONFIG = {
    ENPHASE_USER: process.env.ENPHASE_USER,
    ENPHASE_PASSWORD: process.env.ENPHASE_PASSWORD,
    ENVOY_IP: process.env.ENVOY_IP,
    INFLUX_URL: process.env.INFLUX_URL,
    INFLUX_TOKEN: process.env.INFLUX_TOKEN,
    INFLUX_ORG: process.env.INFLUX_ORG,
    INFLUX_BUCKET: process.env.INFLUX_BUCKET,
    POLL_INTERVAL: parseInt(process.env.POLL_INTERVAL || '60000', 10)
};

// Validate Config
const missingVars = Object.entries(CONFIG).filter(([key, val]) => !val && key !== 'POLL_INTERVAL').map(([key]) => key);
if (missingVars.length > 0) {
    console.error(`ERROR: Missing environment variables: ${missingVars.join(', ')}`);
    process.exit(1);
}

// Global State
let envoySerial = null;
let sessionToken = null;
const TOKEN_FILE = 'enphase_token.json';

// Axios Instance with ignored SSL for local Envoy
const envoyClient = axios.create({
    httpsAgent: new https.Agent({
        rejectUnauthorized: false
    }),
    timeout: 10000
});

// Setup InfluxDB
const writeApi = new InfluxDB({ url: CONFIG.INFLUX_URL, token: CONFIG.INFLUX_TOKEN }).getWriteApi(CONFIG.INFLUX_ORG, CONFIG.INFLUX_BUCKET);

/**
 * Validates existence of token and checks validity with Envoy
 */
async function getValidToken() {
    // 1. Try to load from file
    if (fs.existsSync(TOKEN_FILE)) {
        try {
            const tokenData = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
            // Check if valid against Envoy
            const isValid = await checkTokenValidity(tokenData);
            if (isValid) {
                console.log('Using existing valid token.');
                return tokenData;
            } else {
                console.log('Existing token invalid or expired.');
            }
        } catch (err) {
            console.error('Error reading/parsing token file:', err.message);
        }
    }

    // 2. Login and get new token
    console.log('Acquiring new token...');
    const newToken = await acquireNewToken();
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(newToken));
    return newToken;
}

async function checkTokenValidity(token) {
    try {
        const response = await envoyClient.get(`https://${CONFIG.ENVOY_IP}/auth/check_jwt`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        // Often returns 200 OK if valid
        return response.status === 200;
    } catch (error) {
        // If 401, definitely invalid
        return false;
    }
}

/**
 * Authentication Flow
 */
async function getEnvoySerial() {
    try {
        const response = await envoyClient.get(`https://${CONFIG.ENVOY_IP}/info`);
        const parser = new xml2js.Parser({ explicitArray: false });
        const result = await parser.parseStringPromise(response.data);
        const sn = result.envoy_info?.device?.sn;
        if (!sn) throw new Error('Could not find serial number in /info XML');
        return sn;
    } catch (error) {
        console.error('Error getting Envoy Serial:', error.message);
        throw error;
    }
}

async function acquireNewToken() {
    if (!envoySerial) {
        envoySerial = await getEnvoySerial();
        console.log(`Discovered Envoy Serial: ${envoySerial}`);
    }

    // 1. Login to Enlighten
    const loginData = new URLSearchParams();
    loginData.append('user[email]', CONFIG.ENPHASE_USER);
    loginData.append('user[password]', CONFIG.ENPHASE_PASSWORD);

    console.log('Logging in to Enphase Enlighten...');
    const loginResponse = await axios.post('https://enlighten.enphaseenergy.com/login/login.json?', loginData);
    const responseData = loginResponse.data;

    if (!responseData.session_id) {
        throw new Error('Login failed: No session_id returned. Check credentials.');
    }

    // 2. Get Token from Entrez
    const tokenPayload = {
        session_id: responseData.session_id,
        serial_num: envoySerial,
        username: CONFIG.ENPHASE_USER
    };

    console.log('Requesting token from Entrez...');
    const tokenResponse = await axios.post('https://entrez.enphaseenergy.com/tokens', tokenPayload);
    const token = tokenResponse.data;

    if (!token) throw new Error('Failed to retrieve token from Entrez');

    return token;
}

/**
 * Data Gathering and Storage
 */
async function pollData() {
    try {
        console.log('Polling data...');
        if (!sessionToken) {
            sessionToken = await getValidToken();
        }

        // Fetch Inverter Data
        // Note: Some firmwares use /api/v1/production/inverters
        const response = await envoyClient.get(`https://${CONFIG.ENVOY_IP}/api/v1/production/inverters`, {
            headers: { Authorization: `Bearer ${sessionToken}` }
        });

        const inverters = response.data;
        if (!Array.isArray(inverters)) {
            console.error('Unexpected data format from inverters endpoint');
            return;
        }

        console.log(`Received data for ${inverters.length} inverters.`);

        // Write to InfluxDB
        const points = inverters.map(inv => {
            return new Point('inverter_production')
                .tag('serialNumber', inv.serialNumber)
                .floatField('lastReportWatts', inv.lastReportWatts)
                .floatField('maxReportWatts', inv.maxReportWatts);
        });

        points.forEach(p => writeApi.writePoint(p));
        // Flush handled by library buffering usually, but to ensure immediate see for testing/logs:
        // await writeApi.flush(); 

        console.log('Data pushed to InfluxDB.');

    } catch (error) {
        console.error('Error during polling:', error.message);

        // Log error to InfluxDB as per requirement
        const errorPoint = new Point('application_errors')
            .tag('service', 'enphase-data-capture')
            .stringField('message', error.message);
        writeApi.writePoint(errorPoint);

        // If 401, force token refresh next time
        if (error.response && error.response.status === 401) {
            console.log('401 received, clearing token for next retry.');
            sessionToken = null;
        }
    }
}

// Main Execution
async function main() {
    console.log('Starting Enphase Data Capture...');

    // Initial Run
    await pollData();

    // Schedule
    setInterval(pollData, CONFIG.POLL_INTERVAL);
}

main();
