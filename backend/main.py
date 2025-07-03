# udp_api_server.py
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
import json
from ais_decoder import AISDecoder
from pyais.stream import TagBlockQueue
from pyais.queue import NMEAQueue
from pyais import decode
from pyais.stream import UDPReceiver
import threading

# Global variables
ais_messages = []
decoder = AISDecoder()
tbq_ais = TagBlockQueue()
queue_ais   = NMEAQueue(tbq=tbq_ais)


def sort_ais(messages):
    """
    Filter and extract relevant data from AIS messages
    Only processes message types 1, 2, 3, 5, and 18
    """
    relevant_data = []

    for msg in messages:
        try:
            if not hasattr(msg, 'msg_type'):
                continue

            msg_type = msg.msg_type

            # Position Reports (Types 1, 2, 3)
            if msg_type in [1, 2, 3]:
                data = {
                    "mmsi": getattr(msg, 'mmsi', None),
                    "timestamp": getattr(msg, 'timestamp', None),
                    "position": {
                        "latitude": getattr(msg, 'lat', None),
                        "longitude": getattr(msg, 'lon', None),
                        "accuracy": getattr(msg, 'accuracy', None)
                    },
                    "movement": {
                        "sog": getattr(msg, 'speed', None),
                        "cog": getattr(msg, 'course', None),
                        "heading": getattr(msg, 'heading', None),
                        "rot": getattr(msg, 'turn', None)
                    },
                    "voyage_info": {
                        "nav_status": getattr(msg, 'status', None)
                    },
                    "source": {
                        "message_type": msg_type
                    }
                }
                # Only add if we have essential position data
                if data["mmsi"] and data["position"]["latitude"] and data["position"]["longitude"]:
                    relevant_data.append(data)
                    print(
                        f"Position Report - MMSI: {data['mmsi']}, Lat: {data['position']['latitude']}, Lon: {data['position']['longitude']}")

            # Static and Voyage Data (Type 5)
            elif msg_type == 5:
                data = {
                    "mmsi": getattr(msg, 'mmsi', None),
                    "vessel_info": {
                        "name": getattr(msg, 'shipname', '').strip(),
                        "callsign": getattr(msg, 'callsign', '').strip(),
                        "imo": getattr(msg, 'imo', None),
                        "ship_type": getattr(msg, 'ship_type', None),
                        "dimensions": {
                            "to_bow": getattr(msg, 'to_bow', None),
                            "to_stern": getattr(msg, 'to_stern', None),
                            "to_port": getattr(msg, 'to_port', None),
                            "to_starboard": getattr(msg, 'to_starboard', None)
                        }
                    },
                    "voyage_info": {
                        "destination": getattr(msg, 'destination', '').strip(),
                        "eta": {
                            "month": getattr(msg, 'month', None),
                            "day": getattr(msg, 'day', None),
                            "hour": getattr(msg, 'hour', None),
                            "minute": getattr(msg, 'minute', None)
                        },
                        "draught": getattr(msg, 'draught', None)
                    },
                    "source": {
                        "message_type": msg_type
                    }
                }

                # Only add if we have essential vessel data
                if data["mmsi"] and data["vessel_info"]["name"]:
                    relevant_data.append(data)
                    print(
                        f"Vessel Info - MMSI: {data['mmsi']}, Name: {data['vessel_info']['name']}, Type: {data['vessel_info']['ship_type']}")

            # Class B Position Report (Type 18)
            elif msg_type == 18:
                data = {
                    "mmsi": getattr(msg, 'mmsi', None),
                    "timestamp": getattr(msg, 'timestamp', None),
                    "position": {
                        "latitude": getattr(msg, 'lat', None),
                        "longitude": getattr(msg, 'lon', None),
                        "accuracy": getattr(msg, 'accuracy', None)
                    },
                    "movement": {
                        "sog": getattr(msg, 'speed', None),
                        "cog": getattr(msg, 'course', None),
                        "heading": getattr(msg, 'heading', None)
                        # Note: Class B doesn't have rate of turn
                    },
                    "source": {
                        "message_type": msg_type,
                        "class": "B"
                    }
                }

                # Only add if we have essential position data
                if data["mmsi"] and data["position"]["latitude"] and data["position"]["longitude"]:
                    relevant_data.append(data)
                    print(
                        f"Class B Position - MMSI: {data['mmsi']}, Lat: {data['position']['latitude']}, Lon: {data['position']['longitude']}")

            # Base Station Report (Type 4) - Optional
            elif msg_type == 4:
                data = {
                    "mmsi": getattr(msg, 'mmsi', None),
                    "timestamp": {
                        "year": getattr(msg, 'year', None),
                        "month": getattr(msg, 'month', None),
                        "day": getattr(msg, 'day', None),
                        "hour": getattr(msg, 'hour', None),
                        "minute": getattr(msg, 'minute', None),
                        "second": getattr(msg, 'second', None)
                    },
                    "position": {
                        "latitude": getattr(msg, 'lat', None),
                        "longitude": getattr(msg, 'lon', None),
                        "accuracy": getattr(msg, 'accuracy', None)
                    },
                    "source": {
                        "message_type": msg_type,
                        "type": "base_station"
                    }
                }

                if data["mmsi"]:
                    relevant_data.append(data)
                    print(
                        f"Base Station - MMSI: {data['mmsi']}, Lat: {data['position']['latitude']}, Lon: {data['position']['longitude']}")

            else:
                # Skip other message types
                print(f"Skipping message type {msg_type} (not relevant)")
                continue

        except Exception as e:
            print(f"Error processing message: {e}")
            continue

    print(
        f"\nProcessed {len(relevant_data)} relevant messages out of {len(messages)} total")
    return relevant_data


class AISMessageHandler:
    def __init__(self):
        self.messages = []
        self.relevant_messages = []

    def handle_message(self, decoded_msg):
        decoded = decoded_msg.decode()
        print(f"Received AIS message type: {decoded.msg_type}")
        self.messages.append(decoded)
        ais_messages.append(str(decoded))

        # Process and filter relevant messages
        relevant = sort_ais([decoded])
        if relevant:
            self.relevant_messages.extend(relevant)

ais_handler = AISMessageHandler() 


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

async def start_ais_udp_receiver():
    def run_receiver():
        try:
            for msg in UDPReceiver(host=config["server"]["host"], port=config["server"]["port"]):
                ais_handler.handle_message(msg)
        except Exception as e:
            print(f"AIS receiver error: {e}")
    
    thread = threading.Thread(target=run_receiver, daemon=True)
    thread.start()
    return thread


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await start_ais_udp_receiver()
    yield
    # Shutdown
# UDP server end

app = FastAPI(lifespan=lifespan)


@app.get("/messages")
async def get_messages():
    return ais_messages


@app.get("/clear")
async def clear_messages():
    ais_messages.clear()
    return {"message": "All messages cleared"}