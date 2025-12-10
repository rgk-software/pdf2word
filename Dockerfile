FROM node:20

# Install Python, pip, LibreOffice, and Poppler
RUN apt-get update && \
    apt-get install -y python3 python3-pip python3-venv libreoffice poppler-utils && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm install

# Install Python dependencies
# We need to create a virtual environment or install globally with --break-system-packages (for newer python versions in debian bookworm)
COPY requirements.txt ./
RUN pip3 install -r requirements.txt --break-system-packages

# Bundle app source
COPY . .

# Expose port
EXPOSE 3000

# Start command
CMD [ "node", "server.js" ]
