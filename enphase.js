const fs = require('fs');
const https = require('https');
const axios = require('axios');
const xml2js = require('xml2js');
const CONFIG = require('./config');

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
        return response.status === 200;
    } catch (error) {
        return false;
    }
}

async function getEnvoySerial() {
    try {
        const response = await envoyClient.get(`https://${CONFIG.ENVOY_IP}/info`);
        const parser = new xml2js.Parser({ explicitArray: false });
        const result = await parser.parseStringPromise(response.data);
        const sn = result.envoy_info?.device?.sn;
        if (!sn) throw new Error('Could not find serial number in /info XML');
        return sn;
    } catch (error) {
        throw new Error(`Error getting Envoy Serial: ${error.message}`);
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
 * Main exposed function to get production data
 */
async function getInverterData() {
    if (!sessionToken) {
        sessionToken = await getValidToken();
    }

    try {
        const response = await envoyClient.get(`https://${CONFIG.ENVOY_IP}/api/v1/production/inverters`, {
            headers: { Authorization: `Bearer ${sessionToken}` }
        });

        const inverters = response.data;
        if (!Array.isArray(inverters)) {
            throw new Error('Unexpected data format from inverters endpoint');
        }
        return inverters;

    } catch (error) {
        // If 401, force token refresh next time
        if (error.response && error.response.status === 401) {
            console.log('401 received, clearing token for next retry.');
            sessionToken = null;
        }
        throw error;
    }
}

module.exports = {
    getInverterData
};
