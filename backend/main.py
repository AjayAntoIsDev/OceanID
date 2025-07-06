# udp_api_server.py
import asyncio
import redis
import json
import time
from datetime import datetime, timedelta, timezone
from contextlib import asynccontextmanager
from fastapi import FastAPI
from ais_decoder import AISDecoder
from pyais.stream import TagBlockQueue
from pyais.queue import NMEAQueue
from pyais import decode
from pyais.stream import UDPReceiver
import threading
from fastapi.middleware.cors import CORSMiddleware
from scraper import VesselFinderScraper

# Global variables
ais_messages = []
decoder = AISDecoder()
tbq_ais = TagBlockQueue()
queue_ais = NMEAQueue(tbq=tbq_ais)
vessel_scraper = VesselFinderScraper()

valkey_client = None

class ValkeyAISStore:
    def __init__(self, host='localhost', port=6379, db=0):
        self.client = redis.Redis(host=host, port=port, db=db, decode_responses=True)
        self.test_connection()
    
    def test_connection(self):
        try:
            self.client.ping()
            print("✅ Connected to Valkey server")
        except Exception as e:
            print(f"❌ Failed to connect to Valkey: {e}")
    
    def update_ship_position(self, data):
        """Update ship position data (Types 1, 2, 3, 18)"""
        mmsi = data["mmsi"]
        
        position_key = f"ship:position:{mmsi}"
        position_data = {
            'mmsi': mmsi,
            'lat': data["position"]["latitude"],
            'lon': data["position"]["longitude"],
            'sog': data["movement"]["sog"],
            'cog': data["movement"]["cog"],
            'accuracy': data["position"]["accuracy"],
            'timestamp': data.get("timestamp") or datetime.utcnow().isoformat(),
            'last_seen': datetime.utcnow().isoformat(),
            'message_type': data["source"]["message_type"]
        }
        
        if data["movement"].get("heading") is not None:
            position_data['heading'] = data["movement"]["heading"]
        if data["movement"].get("rot") is not None:
            position_data['rot'] = data["movement"]["rot"]
        if data["voyage_info"].get("nav_status") is not None:
            position_data['nav_status'] = data["voyage_info"]["nav_status"]
        
        self.client.hset(position_key, mapping=position_data)
        self.client.expire(position_key, 3600)
        
        if data["position"]["latitude"] and data["position"]["longitude"]:
            self.client.geoadd("ships:locations", 
                             (data["position"]["longitude"], 
                              data["position"]["latitude"], 
                              mmsi))
        
        history_key = f"ship:history:{mmsi}"
        score = int(time.time())
        self.client.zadd(history_key, {json.dumps(position_data): score})
        
        # Remove old entries (older than 24 hours)
        cutoff = int((datetime.utcnow() - timedelta(hours=24)).timestamp())
        self.client.zremrangebyscore(history_key, 0, cutoff)
        
        print(f"📍 Updated position for MMSI {mmsi}: {data['position']['latitude']}, {data['position']['longitude']}")
    
    def update_ship_info(self, data):
        """Update ship static data (Type 5)"""
        mmsi = data["mmsi"]
        info_key = f"ship:info:{mmsi}"
        
        ship_info = {
            'mmsi': mmsi,
            'vessel_name': data["vessel_info"]["name"],
            'callsign': data["vessel_info"]["callsign"],
            'imo': data["vessel_info"]["imo"],
            'ship_type': data["vessel_info"]["ship_type"],
            'to_bow': data["vessel_info"]["dimensions"]["to_bow"],
            'to_stern': data["vessel_info"]["dimensions"]["to_stern"],
            'to_port': data["vessel_info"]["dimensions"]["to_port"],
            'to_starboard': data["vessel_info"]["dimensions"]["to_starboard"],
            'destination': data["voyage_info"]["destination"],
            'eta_month': data["voyage_info"]["eta"]["month"],
            'eta_day': data["voyage_info"]["eta"]["day"],
            'eta_hour': data["voyage_info"]["eta"]["hour"],
            'eta_minute': data["voyage_info"]["eta"]["minute"],
            'draught': data["voyage_info"]["draught"],
            'updated_at': datetime.utcnow().isoformat()
        }
        
        self.client.hset(info_key, mapping=ship_info)
        
        # Create IMO index for fast lookups
        imo = data["vessel_info"]["imo"]
        if imo and imo != 0:
            self.client.set(f"imo:index:{imo}", mmsi)
            print(f"🔍 Created IMO index: {imo} -> {mmsi}")
        
        print(f"🚢 Updated vessel info for MMSI {mmsi}: {data['vessel_info']['name']}")
    
    def update_base_station(self, data):
        """Update base station data (Type 4)"""
        mmsi = data["mmsi"]
        base_key = f"base:station:{mmsi}"
        
        base_data = {
            'mmsi': mmsi,
            'lat': data["position"]["latitude"],
            'lon': data["position"]["longitude"],
            'accuracy': data["position"]["accuracy"],
            'year': data["timestamp"]["year"],
            'month': data["timestamp"]["month"],
            'day': data["timestamp"]["day"],
            'hour': data["timestamp"]["hour"],
            'minute': data["timestamp"]["minute"],
            'second': data["timestamp"]["second"],
            'updated_at': datetime.utcnow().isoformat()
        }
        
        self.client.hset(base_key, mapping=base_data)
        self.client.expire(base_key, 86400)
        
        print(f"📡 Updated base station MMSI {mmsi}")
    
    def get_ships_in_area(self, center_lat, center_lon, radius_km=50):
        """Get all ships within a radius"""
        try:
            nearby = self.client.georadius(
                "ships:locations", 
                center_lon, center_lat, 
                radius_km, unit='km', 
                withcoord=True
            )
            
            ships = []
            for mmsi, (lon, lat) in nearby:
                position = self.client.hgetall(f"ship:position:{mmsi}")
                info = self.client.hgetall(f"ship:info:{mmsi}")
                
                if position:
                    ships.append({
                        'mmsi': mmsi,
                        'position': position,
                        'info': info
                    })
            
            return ships
        except Exception as e:
            print(f"Error getting ships in area: {e}")
            return []
    
    def get_ship_details(self, mmsi):
        """Get complete ship details"""
        position = self.client.hgetall(f"ship:position:{mmsi}")
        info = self.client.hgetall(f"ship:info:{mmsi}")
        
        return {
            'mmsi': mmsi,
            'position': position,
            'info': info,
            'found': bool(position or info)
        }

    def get_ship_by_imo(self, imo):
        """Get ship data by IMO number using index"""
        try:
            # Look up MMSI using IMO index
            mmsi = self.client.get(f"imo:index:{imo}")
            
            if not mmsi:
                return {
                    'imo': imo,
                    'found': False,
                    'message': f'No ship data found for IMO {imo}',
                    'ship': None
                }
            
            # Get ship data using MMSI
            ship_info = self.client.hgetall(f"ship:info:{mmsi}")
            position_data = self.client.hgetall(f"ship:position:{mmsi}")
            
            return {
                'imo': imo,
                'found': True,
                'ship': {
                    'mmsi': mmsi,
                    'imo': imo,
                    'vessel_info': ship_info,
                    'position': position_data,
                    'scraped_data': {
                        'source': 'AIS',
                        'last_updated': ship_info.get('updated_at'),
                        'data_completeness': 'complete' if ship_info.get('vessel_name') else 'partial'
                    }
                }
            }
            
        except Exception as e:
            return {
                'imo': imo,
                'found': False,
                'error': str(e),
                'ship': None
            }
    
def sort_ais(messages, valkey_store):
    """
    Filter and extract relevant data from AIS messages and store in Valkey
    """
    
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
                        "accuracy": "HIGH" if getattr(msg, 'accuracy', None) else "LOW"
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
                
                if data["mmsi"] and data["position"]["latitude"] and data["position"]["longitude"]:
                    valkey_store.update_ship_position(data)
            
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
                
                if data["mmsi"] and data["vessel_info"]["name"]:
                    valkey_store.update_ship_info(data)
            
            # Class B Position Report (Type 18)
            elif msg_type == 18:
                data = {
                    "mmsi": getattr(msg, 'mmsi', None),
                    "timestamp": getattr(msg, 'timestamp', datetime.now(timezone.utc).isoformat()),
                    "position": {
                        "latitude": getattr(msg, 'lat', None),
                        "longitude": getattr(msg, 'lon', None),
                        "accuracy": "HIGH" if getattr(msg, 'accuracy', None) else "LOW"
                    },
                    "movement": {
                        "sog": getattr(msg, 'speed', None),
                        "cog": getattr(msg, 'course', None),
                        "heading": getattr(msg, 'heading', None)
                    },
                    "voyage_info": {},
                    "source": {
                        "message_type": msg_type,
                        "class": "B"
                    }
                }
                
                if data["mmsi"] and data["position"]["latitude"] and data["position"]["longitude"]:
                    valkey_store.update_ship_position(data)
            
            # Base Station Report (Type 4)
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
                        "accuracy": "HIGH" if getattr(msg, 'accuracy', None) else "LOW"
                    },
                    "source": {
                        "message_type": msg_type,
                        "type": "base_station"
                    }
                }
                
                if data["mmsi"]:
                    valkey_store.update_base_station(data)
                    
        except Exception as e:
            print(f"Error processing message: {e}")
            continue
    
class AISMessageHandler:
    def __init__(self, valkey_store):
        self.messages = []
        self.relevant_messages = []
        self.valkey_store = valkey_store

    def handle_message(self, decoded_msg):
        decoded = decoded_msg.decode()
        # print(f"📡 Received AIS message type: {decoded.msg_type}")
        self.messages.append(decoded)
        ais_messages.append(str(decoded))
    
        sort_ais([decoded], self.valkey_store)

def load_config(file_path='config.json'):
    try:
        with open(file_path, 'r') as file:
            return json.load(file)
    except FileNotFoundError:
        print(f"File {file_path} not found")
        return {"server": {"host": "127.0.0.1", "port": 12345}, "valkey": {"host": "localhost", "port": 6379}}
    except json.JSONDecodeError:
        print(f"Invalid JSON in {file_path}")
        return {"server": {"host": "127.0.0.1", "port": 12345}, "valkey": {"host": "localhost", "port": 6379}}

config = load_config()

valkey_store = ValkeyAISStore(
    host=config.get("valkey", {}).get("host", "localhost"),
    port=config.get("valkey", {}).get("port", 6379)
)

ais_handler = AISMessageHandler(valkey_store)

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
    # Shutdown - could add cleanup here

app = FastAPI(lifespan=lifespan)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173",
                   "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/messages")
async def get_messages():
    return ais_messages

@app.get("/ships")
async def get_ships():
    """Get all ships with recent positions"""
    try:
        ships = valkey_store.get_ships_in_area(59.9139, 10.7522, 100)
        return {"ships": ships, "count": len(ships)}
    except Exception as e:
        return {"error": str(e)}
    
@app.get("/ships/in-area")
async def get_ships_in_area(lat: float, lon: float, radius: float = 50.0):
    """Get all ships within a specified area"""
    try:
        ships = valkey_store.get_ships_in_area(lat, lon, radius)
        return {
            "ships": ships, 
            "count": len(ships),
            "center": {"lat": lat, "lon": lon},
            "radius_km": radius
        }
    except Exception as e:
        return {"error": str(e)}


@app.get("/ship/{mmsi}")
async def get_ship_details(mmsi: int):
    """Get detailed info for specific ship"""
    ship_data = valkey_store.get_ship_details(mmsi)
    return ship_data


@app.get("/ship/data/{mmsi}")
async def get_ship_data(mmsi: int):
    """Get scraped data for specific ship by MMSI number"""
    try:
        ship_info = valkey_store.client.hgetall(f"ship:info:{mmsi}")
        
        if not ship_info:
            return {
                "mmsi": mmsi,
                "found": False,
                "message": f"No ship data found for MMSI {mmsi}",
                "imo": None
            }
        
        imo = ship_info.get('imo')
        if not imo or imo == '0':
            return {
                "mmsi": mmsi,
                "found": False,
                "message": f"Ship found but no IMO available for MMSI {mmsi}",
                "imo": None,
                "ship_info": ship_info
            }
        
        scraped_data = vessel_scraper.scrape_vessel_data(imo)
        
        return {
            "mmsi": mmsi,
            "found": True,
            "imo": imo,
            "ais_data": ship_info,
            "scraped_data": scraped_data
        }
        
    except Exception as e:
        return {
            "mmsi": mmsi,
            "found": False,
            "error": str(e),
            "imo": None
        }

@app.get("/clear")
async def clear_messages():
    ais_messages.clear()
    return {"message": "All messages cleared"}

@app.get("/ships/count")
async def get_ships_count():
    """Get count of unique ships in the database"""
    try:
        position_keys = valkey_store.client.keys("ship:position:*")
        unique_ships_count = len(position_keys)
        
        info_keys = valkey_store.client.keys("ship:info:*")
        ships_with_info_count = len(info_keys)
        
        return {
            "unique_ships": unique_ships_count,
            "ships_with_info": ships_with_info_count,
        }
    except Exception as e:
        return {"error": str(e), "unique_ships": 0}

