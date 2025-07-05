import "./App.css";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { useEffect, useState, useRef } from "react";
import L from "leaflet";

const createSquareIcon = () => {
    return L.divIcon({
        className: 'custom-ship-marker',
        html: '<img src="https://cdn-icons-png.freepik.com/512/8059/8059201.png?fd=1&filename=port_8059201.png" style="width: 32px; height: 32px;" />',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
        popupAnchor: [0, -10]
    });
};

interface Position {
  mmsi: string;
  lat: string;
  lon: string;
  sog: string;
  cog: string;
  accuracy: string;
  timestamp: string;
  last_seen: string;
  message_type: string;
  heading: string;
  rot: string;
  nav_status: string;
}

interface ShipInfo {
  mmsi: string;
  vessel_name?: string;
  callsign?: string;
  imo?: string;
  ship_type?: string;
  destination?: string;
  draught?: string;
  updated_at?: string;
}

interface Ship {
  mmsi: string;
  position: Position;
  info: ShipInfo;
}

interface ShipsResponse {
  ships: Ship[];
  count: number;
  center?: { lat: number; lon: number };
  radius_km?: number;
}

function App() {
    const [ships, setShips] = useState<Ship[]>([]);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [currentRadius, setCurrentRadius] = useState<number>(50);
    const mapRef = useRef<L.Map | null>(null);
    
    const REFRESH_INTERVAL = 5000;
    
    const DEFAULT_CENTER = { lat: 59.9139, lon: 10.7522 };

    const calculateRadiusFromZoom = (zoom: number): number => {
        const zoomToRadius: { [key: number]: number } = {
            1: 2000,   // World view
            2: 1500,
            3: 1000,
            4: 750,
            5: 500,
            6: 350,
            7: 250,
            8: 150,
            9: 100,
            10: 75,    // City view
            11: 50,
            12: 35,
            13: 25,
            14: 15,    // Street view
            15: 10,
            16: 7,
            17: 5,
            18: 3,     // Building view
            19: 2,
            20: 1
        };

        const roundedZoom = Math.round(zoom);
        return zoomToRadius[roundedZoom] || 50;
    };

    const getCurrentMapInfo = (): { center: { lat: number; lon: number }, radius: number } => {
        if (mapRef.current) {
            const center = mapRef.current.getCenter();
            const zoom = mapRef.current.getZoom();
            const radius = calculateRadiusFromZoom(zoom);
            return { 
                center: { lat: center.lat, lon: center.lng },
                radius 
            };
        }
        return { center: DEFAULT_CENTER, radius: 50 };
    };

    const fetchAllShips = async () => {
        try {
            const response = await fetch("http://127.0.0.1:8000/ships/");
            const data: ShipsResponse = await response.json();
            setShips(data.ships);
            setLastUpdate(new Date());
            setIsLoading(false);
            setIsInitialLoad(false);
            return data.ships;
        } catch (error) {
            console.error('Error fetching all ships:', error);
            setIsLoading(false);
            return [];
        }
    };

    const fetchShipsInArea = async (lat: number, lon: number, radius: number) => {
        try {
            const response = await fetch(
                `http://127.0.0.1:8000/ships/in-area?lat=${lat}&lon=${lon}&radius=${radius}`
            );
            const data: ShipsResponse = await response.json();
            setShips(data.ships);
            setLastUpdate(new Date());
            setCurrentRadius(radius);
            setIsLoading(false);
            return data.ships;
        } catch (error) {
            console.error('Error fetching ships in area:', error);
            setIsLoading(false);
            return [];
        }
    };

    const updateShips = async () => {
        setIsLoading(true);
        
        if (isInitialLoad) {
            await fetchAllShips();
        } else {
            const mapInfo = getCurrentMapInfo();
            await fetchShipsInArea(mapInfo.center.lat, mapInfo.center.lon, mapInfo.radius);
        }
    };

    const handleMapEvents = () => {
        if (mapRef.current && !isInitialLoad) {
            const map = mapRef.current;
            
            const handleMapChange = () => {
                clearTimeout((handleMapChange as any).timeout);
                (handleMapChange as any).timeout = setTimeout(() => {
                    updateShips();
                }, 1000);
            };

            map.on('moveend zoomend', handleMapChange);
            
            return () => {
                map.off('moveend zoomend', handleMapChange);
            };
        }
    };

    useEffect(() => {
        updateShips();

        const interval = setInterval(() => {
            if (!isInitialLoad) {
                updateShips();
            }
        }, REFRESH_INTERVAL);

        const cleanup = handleMapEvents();

        return () => {
            clearInterval(interval);
            if (cleanup) cleanup();
        };
    }, [isInitialLoad]);

    return (
        <>
        <div className="">
            <MapContainer
                center={[59.5, 10.6]}
                zoom={10}
                scrollWheelZoom={true}
                className="h-screen w-full z-10"
                ref={mapRef}>
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {ships.map((ship) => (
                    <Marker
                        key={ship.mmsi}
                        position={[parseFloat(ship.position.lat), parseFloat(ship.position.lon)]}
                        icon={createSquareIcon()}
                    >
                        <Popup>
                            <div className="p-2">
                                <h3 className="font-bold text-lg">
                                    {ship.info.vessel_name || 'Unknown Vessel'}
                                </h3>
                                <p><strong>MMSI:</strong> {ship.mmsi}</p>
                                <p><strong>Callsign:</strong> {ship.info.callsign || 'N/A'}</p>
                                <p><strong>Ship Type:</strong> {ship.info.ship_type || 'N/A'}</p>
                                <p><strong>Speed:</strong> {ship.position.sog} knots</p>
                                <p><strong>Course:</strong> {ship.position.cog}°</p>
                                <p><strong>Heading:</strong> {ship.position.heading}°</p>
                                <p><strong>Destination:</strong> {ship.info.destination || 'N/A'}</p>
                                <p><strong>Navigation Status:</strong> {ship.position.nav_status}</p>
                                <p><strong>Last Seen:</strong> {new Date(ship.position.last_seen).toLocaleString()}</p>
                            </div>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>
            
            {/* Status indicator */}
            <div className="absolute top-4 left-4 bg-white p-3 rounded shadow-lg z-20">
                <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${isLoading ? 'bg-yellow-500' : 'bg-green-500'}`}></div>
                    <span className="font-semibold">Ships: {ships.length}</span>
                </div>
                <div className="text-xs text-gray-500">
                    {isInitialLoad ? 'Initial load (all ships)' : `Auto radius: ${currentRadius}km`}
                </div>
                <div className="text-xs text-gray-400">
                    Zoom: {mapRef.current ? mapRef.current.getZoom().toFixed(1) : '10.0'}
                </div>
                {lastUpdate && (
                    <div className="text-sm text-gray-600 mt-1">
                        Last updated: {lastUpdate.toLocaleTimeString()}
                    </div>
                )}
            </div>

            {/* Manual refresh button */}
            <div className="absolute top-4 right-4 z-20">
                <button
                    onClick={updateShips}
                    disabled={isLoading}
                    className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-4 py-2 rounded shadow-lg"
                >
                    {isLoading ? 'Updating...' : 'Refresh'}
                </button>
            </div>
        </div>
        </>
    );
}

export default App;