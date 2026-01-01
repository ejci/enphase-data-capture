FROM node:20-alpine

# Install curl for dotenvx installation
RUN apk add --no-cache curl

# Work Directory
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install --production

# Install dotenvx
RUN curl -sfS https://dotenvx.sh/install.sh | sh

# Copy app source
COPY . .

# Environment variables should be passed to the container
# We use dotenvx to load them if present in .env or checks
# Using dotenvx run to load environment variables into the process
CMD ["dotenvx", "run", "--", "node", "app.js"]
