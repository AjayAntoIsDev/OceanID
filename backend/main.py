# udp_api_server.py
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
import json
from ais_decoder import AISDecoder
from pyais.stream import TagBlockQueue
from pyais.queue import NMEAQueue
from pyais import decode

# Global variables
ais_messages = []
decoder = AISDecoder()
tbq_ais = TagBlockQueue()
queue_ais   = NMEAQueue(tbq=tbq_ais)

def load_config(file_path='config.json'):
    try:
        with open(file_path, 'r') as file:
            return json.load(file)
    except FileNotFoundError:
        print(f"File {file_path} not found")
        return {}
    except json.JSONDecodeError:
        print(f"Invalid JSON in {file_path}")
        return {}

config = load_config()



def parse_ais_message(message):
    print(message)
    queue_ais.put_line(message)
    sentence = queue_ais.get_or_none()
    if sentence:
        decoded_message = decode(sentence.raw)
        print(decoded_message)


# UDP Server
class UDPServerProtocol(asyncio.DatagramProtocol):
    def connection_made(self, transport):
        self.transport = transport
        
    def datagram_received(self, data, addr):
        message = data.decode()
        print(f"UDP received: {message} from {addr}")
        # Decode the AIS message
        
        decoded_message = decoder.parse(message)
        parse_ais_message(data)
        ais_messages.append({"from": addr, "message": decoded_message})


async def start_udp_server():
    loop = asyncio.get_running_loop()
    transport, _ = await loop.create_datagram_endpoint(
        lambda: UDPServerProtocol(),
        local_addr=(config["server"]["host"], config["server"]["port"])
    )
    print(f"UDP server listening on port {config['server']['port']}")
    return transport


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    transport = await start_udp_server()
    yield
    # Shutdown
    transport.close()
# UDP server end

app = FastAPI(lifespan=lifespan)


@app.get("/messages")
async def get_messages():
    return ais_messages


@app.get("/clear")
async def clear_messages():
    ais_messages.clear()
    return {"message": "All messages cleared"}
