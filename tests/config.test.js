const { validateConfig } = require('../config');
const logger = require('../logger');

jest.mock('../logger', () => ({
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
}));

describe('config.js', () => {
    let originalExit;

    beforeAll(() => {
        originalExit = process.exit;
        process.exit = jest.fn();
    });

    afterAll(() => {
        process.exit = originalExit;
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should exit if required variables are missing', () => {
        validateConfig({
            ENPHASE_USER: '',
            ENPHASE_PASSWORD: 'abc'
        });
        expect(logger.error).toHaveBeenCalled();
        expect(process.exit).toHaveBeenCalledWith(1);
    });

    test('should not exit if all required variables are present', () => {
        validateConfig({
            ENPHASE_USER: 'user',
            ENPHASE_PASSWORD: 'password',
            ENVOY_IP: '192.168.1.1',
            INFLUX_URL: 'http://localhost:8086',
            INFLUX_TOKEN: 'token',
            INFLUX_ORG: 'org',
            INFLUX_BUCKET: 'bucket'
        });
        expect(logger.error).not.toHaveBeenCalled();
        expect(process.exit).not.toHaveBeenCalled();
    });
});
