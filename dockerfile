
FROM node:latest

# Set the working directory to /app
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY index.js ./
copy config.json ./

# Start the Node.js application
CMD ["node", "index.js"]
