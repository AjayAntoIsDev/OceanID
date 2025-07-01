

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

-------

# Stuff that needs to be done

## Backend
- [] Build a simple script for the clients(RTL-SDR) to connect to the server
- [X] Find a way to send simulated AIS data to the server
- [] Make a DB for the server
- [] Receive Decode the AIS data 
- [] Find more info on the ship and save it in the server
- [] Make a endpoint to send the data to the frontend
- [] Use websockets

## Frontend
- [] Make the map view
- [] Receive the data from the server (Websockets?)
- [] Plot the ships on the map
- [] Show more info about the ship on hover
- [] Make it pretty