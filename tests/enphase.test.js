const fs = require('fs');
const axios = require('axios');
const xml2js = require('xml2js');
const { 
    getInverterData, 
    clearState, 
    getValidToken, 
    checkTokenValidity, 
    acquireNewToken, 
    getEnvoySerial 
} = require('../enphase');

jest.mock('fs');

const mockEnvoyGet = jest.fn();
jest.mock('axios', () => ({
    create: jest.fn(() => ({
        get: (...args) => mockEnvoyGet(...args)
    })),
    post: jest.fn(),
    get: jest.fn()
}));

jest.mock('../logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
}));

describe('enphase.js', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        clearState();
    });

    describe('checkTokenValidity', () => {
        test('returns true when valid', async () => {
            mockEnvoyGet.mockResolvedValueOnce({ status: 200 });
            const result = await checkTokenValidity('token');
            expect(result).toBe(true);
        });

        test('returns false when invalid', async () => {
            mockEnvoyGet.mockRejectedValueOnce(new Error('Invalid'));
            const result = await checkTokenValidity('token');
            expect(result).toBe(false);
        });
    });

    describe('getEnvoySerial', () => {
        test('parses XML to get serial', async () => {
            mockEnvoyGet.mockResolvedValueOnce({ data: '<xml></xml>' });
            const { Parser } = require('xml2js');
            const mockParse = jest.spyOn(Parser.prototype, 'parseStringPromise').mockResolvedValueOnce({
                envoy_info: { device: { sn: '123456789' } }
            });

            const result = await getEnvoySerial();
            expect(result).toBe('123456789');
            mockParse.mockRestore();
        });

        test('throws if serial not found', async () => {
            mockEnvoyGet.mockResolvedValueOnce({ data: '<xml></xml>' });
            const { Parser } = require('xml2js');
            const mockParse = jest.spyOn(Parser.prototype, 'parseStringPromise').mockResolvedValueOnce({});
            await expect(getEnvoySerial()).rejects.toThrow();
            mockParse.mockRestore();
        });
    });

    describe('acquireNewToken', () => {
        test('successfully logs in and gets token', async () => {
            const { Parser } = require('xml2js');
            const mockParse = jest.spyOn(Parser.prototype, 'parseStringPromise').mockResolvedValueOnce({
                envoy_info: { device: { sn: '123' } }
            });
            mockEnvoyGet.mockResolvedValueOnce({ data: '<xml></xml>' }); // for getEnvoySerial
            axios.post.mockResolvedValueOnce({ data: { session_id: 'session123' } }); // login
            axios.post.mockResolvedValueOnce({ data: 'new_token' }); // token fetch

            const token = await acquireNewToken();
            expect(token).toBe('new_token');
            mockParse.mockRestore();
        });
    });

    describe('getValidToken', () => {
        test('reads from file if valid', async () => {
            fs.existsSync.mockReturnValueOnce(true);
            fs.readFileSync.mockReturnValueOnce(JSON.stringify('cached_token'));
            mockEnvoyGet.mockResolvedValueOnce({ status: 200 }); // Token is valid

            const token = await getValidToken();
            expect(token).toBe('cached_token');
        });

        test('acquires new token if cache invalid', async () => {
            fs.existsSync.mockReturnValueOnce(true);
            fs.readFileSync.mockReturnValueOnce(JSON.stringify('cached_token'));
            mockEnvoyGet.mockRejectedValueOnce(new Error('Invalid')); // Token is invalid

            const { Parser } = require('xml2js');
            const mockParse = jest.spyOn(Parser.prototype, 'parseStringPromise').mockResolvedValueOnce({
                envoy_info: { device: { sn: '123' } }
            });
            mockEnvoyGet.mockResolvedValueOnce({ data: '<xml></xml>' }); // for getEnvoySerial
            axios.post.mockResolvedValueOnce({ data: { session_id: 'session' } });
            axios.post.mockResolvedValueOnce({ data: 'new_token' });

            const token = await getValidToken();
            expect(token).toBe('new_token');
            expect(fs.writeFileSync).toHaveBeenCalled();
            mockParse.mockRestore();
        });
    });

    describe('getInverterData', () => {
        test('successfully retrieves data', async () => {
            fs.existsSync.mockReturnValueOnce(false); // No cache
            
            // Mocking acquireNewToken flow
            const { Parser } = require('xml2js');
            const mockParse = jest.spyOn(Parser.prototype, 'parseStringPromise').mockResolvedValueOnce({
                envoy_info: { device: { sn: '123' } }
            });
            mockEnvoyGet.mockResolvedValueOnce({ data: '<xml></xml>' }); // for getEnvoySerial
            axios.post.mockResolvedValueOnce({ data: { session_id: 'session' } });
            axios.post.mockResolvedValueOnce({ data: 'new_token' });

            mockEnvoyGet.mockResolvedValueOnce({ data: [{ serialNumber: 'inv1' }] });

            const data = await getInverterData();
            expect(data).toHaveLength(1);
            expect(data[0].serialNumber).toBe('inv1');
            mockParse.mockRestore();
        });
    });
});
