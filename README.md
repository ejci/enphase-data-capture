# Enphase Data Capture

A Node.js application to capture solar production data from local Enphase Envoy gateways and push it to InfluxDB 2.x.

## Features
-   Auto-discovery of Envoy Serial via local API.
-   Authentication handling (Enlighten login -> Local Token).
-   InfluxDB 2.x support with startup health check.
-   Timestamped logging for easier debugging.
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
-   `ENPHASE_USER` / `ENPHASE_PASSWORD`: Your Enlighten account login.
-   `ENVOY_IP`: Local IP address of your Envoy.
-   `INFLUX_*`: Your InfluxDB 2 details.

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
*Note: Depending on how you run strictly, you might need `--net host` if your Envoy is on a restricted VLAN or requires mdns discovery that docker bridge obscures, though direct IP works fine in bridge mode.*

## Development
To run locally without Docker:
```bash
npm install
# Set env vars in .env
npm start
```

### Project Structure
- `app.js`: Main entry point and orchestration.
- `config.js`: Configuration management and validation.
- `enphase.js`: Enphase Envoy authentication and data polling.
- `influx.js`: InfluxDB connection handling and data writing.

