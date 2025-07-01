# udp_api_server.py
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI

ais_messages = []

class UDPServerProtocol(asyncio.DatagramProtocol):
    def connection_made(self, transport):
        self.transport = transport
        
    def datagram_received(self, data, addr):
        message = data.decode()
        print(f"UDP received: {message} from {addr}")
        ais_messages.append({"from": addr, "message": message})


async def start_udp_server():
    loop = asyncio.get_running_loop()
    transport, _ = await loop.create_datagram_endpoint(
        lambda: UDPServerProtocol(),
        local_addr=("0.0.0.0", 9999)
    )
    print("UDP server listening on port 9999")
    return transport


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    transport = await start_udp_server()
    yield
    # Shutdown
    transport.close()


app = FastAPI(lifespan=lifespan)


@app.get("/messages")
async def get_messages():
    return ais_messages
