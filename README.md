

# Architecture

## Backend

- Real application
 - RTL-SDR(s)
 - raspberry pi
 - rtl-asi to send the data to server

- Testing 
 - Simulate data from rtl-asi and send it to the server

- Server
 - Recives data from multiple clients
 - Decodes the data
 - Try to find more info through some apis
 - stores it in db
 - updates the db as new data is fed


## Frontend

- get data from server
- show the data to the user
- make it pretty

---

# Stuff that needs to be done
- []  