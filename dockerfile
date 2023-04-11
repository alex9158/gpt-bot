# Use Node.js v14 as the base image
FROM node:latest

# Set the working directory to /app
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the project files to the working directory
COPY index.js ./
copy config.json ./

# Expose port 3000 for the Node.js application
EXPOSE 3000

# Start the Node.js application
CMD ["node", "index.js"]
