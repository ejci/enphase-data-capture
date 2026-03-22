const axios = require('axios');
const { checkConnection, writeMeasurement, logError, initInflux } = require('../influx');
const logger = require('../logger');
const { InfluxDB, Point } = require('@influxdata/influxdb-client');

jest.mock('axios');
jest.mock('../logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
}));

jest.mock('@influxdata/influxdb-client', () => {
    const mockWritePoint = jest.fn();
    return {
        InfluxDB: jest.fn().mockImplementation(() => ({
            getWriteApi: jest.fn().mockReturnValue({
                writePoint: mockWritePoint
            })
        })),
        Point: jest.fn().mockImplementation((measurement) => ({
            measurement,
            tag: jest.fn().mockReturnThis(),
            floatField: jest.fn().mockReturnThis(),
            stringField: jest.fn().mockReturnThis()
        }))
    };
});

describe('influx.js', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        initInflux('http://localhost:8086', 'token', 'org', 'bucket');
    });

    describe('checkConnection', () => {
        test('should return true if InfluxDB is available', async () => {
            axios.get.mockResolvedValueOnce({ status: 200 });
            const result = await checkConnection();
            expect(result).toBe(true);
            expect(logger.info).toHaveBeenCalledWith(expect.anything(), 'InfluxDB is available');
        });

        test('should return false if InfluxDB returns unexpected status', async () => {
            axios.get.mockResolvedValueOnce({ status: 500 });
            const result = await checkConnection();
            expect(result).toBe(false);
            expect(logger.warn).toHaveBeenCalledWith(expect.anything(), 'InfluxDB returned unexpected status');
        });

        test('should return false if InfluxDB connection fails', async () => {
            axios.get.mockRejectedValueOnce(new Error('Network error'));
            const result = await checkConnection();
            expect(result).toBe(false);
            expect(logger.warn).toHaveBeenCalledWith(expect.anything(), 'InfluxDB is not available — data will be buffered');
        });
    });

    describe('writeMeasurement', () => {
        test('should write points for inverter data', () => {
            const data = [{
                serialNumber: '123',
                lastReportWatts: 100,
                maxReportWatts: 200
            }];
            writeMeasurement(data);
            const { Point } = require('@influxdata/influxdb-client');
            expect(Point).toHaveBeenCalledTimes(1);
        });
        
        test('should not throw if writeApi is not initialized', () => {
            initInflux(null);
            const data = [{ serialNumber: '123', lastReportWatts: 100, maxReportWatts: 200 }];
            expect(() => writeMeasurement(data)).not.toThrow();
        });
    });

    describe('logError', () => {
        test('should write error to influx and log to console', () => {
            logError('TestContext', new Error('Test Error'));
            expect(logger.error).toHaveBeenCalled();
            const { Point } = require('@influxdata/influxdb-client');
            expect(Point).toHaveBeenCalled();
        });
    });
});
