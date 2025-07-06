# OceanID

Track ships with your own RTL-SDR without any using the internet

# Usage
## Backend

To start the rtl-ais decoder (Run this on the computer that connects to the RTL-SDR)
```bash
git clone https://github.com/dgiardini/rtl-ais
cd rtl-ais
./rtl_ais -n -d 00000002 -h {the ip of the backend server} -P {The port of the backend server}
```

For the backend server (This decodes the raw AIS data,stores it, and servers it via a REST API server)
```bash
yay -S valkey # Yes i use arch and you should too
sudo systemctl start valkey
git clone https://github.com/AjayAntoIsDev/OceanID
cd OceanID/backend
pip install fastapi uvicorn redis pyais requests beautifulsoup4 lxml
fastapi run main.py
```
(Note:if you dont have a real RTL-SDR you can just run the relay.py to use the raw AIS data from Norwegian Coastal Administration instead)

## Frontend
Make sure you change the config.ts to your needs
```bash
git clone https://github.com/AjayAntoIsDev/OceanID
cd OceanID/frontend
npm i
npm run dev
```
# Architecture

## Backend

- Real application
    - RTL-SDR(s)
    - Raspberry pi
    - RTL-ais to send the data to server

- Testing 
    - Simulate data from rtl-ais and send it to the server

- Server
    - Receives data from multiple clients
    - Decodes the data
    - Try to find more info through some apis
    - Stores it in db
    - Updates the db as new data is fed


## Frontend

- get data from server
- show the data to the user
- make it pretty