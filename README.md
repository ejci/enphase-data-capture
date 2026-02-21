# Enphase Data Capture

A Node.js application to capture solar production data from local Enphase Envoy gateways and push it to InfluxDB 2.x.

## Features
-   Auto-discovery of Envoy Serial via local API.
-   Authentication handling (Enlighten login → Local Token).
-   InfluxDB 2.x support with startup health check.
-   Structured JSON logging (via [Pino](https://github.com/pinojs/pino)) — compatible with Grafana Loki.
-   Dockerized with `dotenvx` for secure environment variable management.

## Prerequisites
-   Docker
-   Enphase Envoy on local network
-   Enphase Enlighten Account Credentials

## Configuration
Copy the example environment file:
```bash
cp .env.example .env
```
Edit `.env` and fill in your details:

| Variable | Description |
|---|---|
| `ENPHASE_USER` | Enlighten account email |
| `ENPHASE_PASSWORD` | Enlighten account password |
| `ENVOY_IP` | Local IP / mDNS hostname of your Envoy |
| `INFLUX_URL` | InfluxDB base URL (e.g. `http://influxdb:8086`) |
| `INFLUX_TOKEN` | InfluxDB API token |
| `INFLUX_ORG` | InfluxDB organisation |
| `INFLUX_BUCKET` | InfluxDB bucket for solar data |
| `ENPHASE_POLL_INTERVAL` | Polling interval in ms (default: `60000`) |
| `ENPHASE_LOG_LEVEL` | Log verbosity: `trace`/`debug`/`info`/`warn`/`error` (default: `info`) |

## Running with Docker

### Build
```bash
docker build -t enphase-data-capture .
```

### Run
```bash
docker run -d \
  --name enphase-capture \
  --env-file .env \
  --restart unless-stopped \
  enphase-data-capture
```
*Note: add `--net host` if your Envoy requires mDNS discovery that Docker bridge mode obscures.*

## Development
```bash
npm install
# configure .env
npm start

# human-readable log output during development
node app.js | npx pino-pretty
```

## Logging & Loki
All logs are emitted as newline-delimited JSON to stdout:
```json
{"level":30,"time":"2026-02-21T14:51:18.985Z","service":"enphase-data-capture","msg":"Polling data..."}
{"level":50,"time":"2026-02-21T14:51:18.987Z","service":"enphase-data-capture","context":"Polling Data","err":"...","msg":"Application error"}
```
Each line carries `"service": "enphase-data-capture"`, making it straightforward to create Loki label filters in Promtail/Alloy.

## Project Structure
- `app.js` — Main entry point and orchestration.
- `config.js` — Configuration management and validation.
- `logger.js` — Shared Pino logger instance.
- `enphase.js` — Enphase Envoy authentication and data polling.
- `influx.js` — InfluxDB connection handling and data writing.
