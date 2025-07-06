import "./App.css";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { useEffect, useState, useRef } from "react";
import L from "leaflet";

const createSquareIcon = (heading: string) => {
    const headingDegrees = parseFloat(heading) || 0;
    return L.divIcon({
        className: "custom-ship-marker",
        html: `
          <svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <g transform="rotate(${headingDegrees} 10 10)">
                    <path d="M10 2 L16 14 L10 12 L4 14 Z" 
                          fill="rgba(59, 130, 246, 0.4)" 
                          stroke="#1e40af" 
                          stroke-width="1.5"/>
                </g>
            </svg>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
        popupAnchor: [0, -10],
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

interface DetailedShipData {
    mmsi: number;
    found: boolean;
    imo?: string;
    ais_data?: {
        mmsi: string;
        vessel_name?: string;
        callsign?: string;
        imo?: string;
        ship_type?: string;
        to_bow?: string;
        to_stern?: string;
        to_port?: string;
        to_starboard?: string;
        destination?: string;
        eta_month?: string;
        eta_day?: string;
        eta_hour?: string;
        eta_minute?: string;
        draught?: string;
        updated_at?: string;
    };
    scraped_data?: {
        "Vessel Name"?: string;
        "IMO / MMSI"?: string;
        Image?: string;
        "IMO number"?: string;
        "Ship Type"?: string;
        Flag?: string;
        "Year of Build"?: string;
        "Length Overall(m)"?: string;
        "Beam(m)"?: string;
        "Gross Tonnage"?: string;
        "Deadweight(t)"?: string;
        "Registered Owner"?: string;
        [key: string]: any;
    };
}

const FlagImage: React.FC<{ country: string; className?: string }> = ({ country, className }) => {
    const [flagUrl, setFlagUrl] = useState<string | null>(null);

    useEffect(() => {
        const fetchFlagUrl = async () => {
            try {
                const response = await fetch(`https://restcountries.com/v3.1/name/${country.toLowerCase()}?fields=flags`);
                const data = await response.json();
                if (data[0]?.flags?.png) {
                    setFlagUrl(data[0].flags.png);
                }
            } catch (error) {
                console.error('Error fetching flag:', error);
            }
        };

        if (country) {
            fetchFlagUrl();
        }
    }, [country]);

    if (!flagUrl) return null;

    return (
        <img
            src={flagUrl}
            alt={`${country} flag`}
            className={className}
            onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
            }}
        />
    );
};

function App() {
    const [ships, setShips] = useState<Ship[]>([]);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [currentRadius, setCurrentRadius] = useState<number>(50);
    const [selectedShipData, setSelectedShipData] = useState<{
        [mmsi: string]: DetailedShipData;
    }>({});
    const [loadingShipDetails, setLoadingShipDetails] = useState<Set<string>>(
        new Set()
    );
    const [activePopupMmsi, setActivePopupMmsi] = useState<string | null>(null);
    const mapRef = useRef<L.Map | null>(null);

    const REFRESH_INTERVAL = 5000;

    const DEFAULT_CENTER = { lat: 59.9139, lon: 10.7522 };

    const calculateRadiusFromZoom = (zoom: number): number => {
        const zoomToRadius: { [key: number]: number } = {
            1: 3000,
            2: 2500,
            3: 2000,
            4: 1500,
            5: 1000,
            6: 700,
            7: 500,
            8: 300,
            9: 200,
            10: 150,
            11: 100,
            12: 70,
            13: 50,
            14: 30,
            15: 20,
            16: 15,
            17: 10,
            18: 7,
            19: 5,
            20: 3,
        };

        const roundedZoom = Math.round(zoom);
        return zoomToRadius[roundedZoom] || 100;
    };

    const getCurrentMapInfo = (): {
        center: { lat: number; lon: number };
        radius: number;
    } => {
        if (mapRef.current) {
            const center = mapRef.current.getCenter();
            const zoom = mapRef.current.getZoom();
            const radius = calculateRadiusFromZoom(zoom);
            return {
                center: { lat: center.lat, lon: center.lng },
                radius,
            };
        }
        return { center: DEFAULT_CENTER, radius: 50 };
    };

    const fetchShipDetails = async (mmsi: string) => {
        if (loadingShipDetails.has(mmsi) || selectedShipData[mmsi]) {
            return;
        }

        setLoadingShipDetails((prev) => new Set([...prev, mmsi]));
        try {
            const response = await fetch(
                `http://127.0.0.1:8000/ship/data/${mmsi}`
            );
            const data: DetailedShipData = await response.json();
            setSelectedShipData((prev) => ({
                ...prev,
                [mmsi]: data,
            }));
            return data;
        } catch (error) {
            console.error("Error fetching ship details:", error);
            return null;
        } finally {
            setLoadingShipDetails((prev) => {
                const newSet = new Set(prev);
                newSet.delete(mmsi);
                return newSet;
            });
        }
    };

    useEffect(() => {
        if (
            activePopupMmsi &&
            !selectedShipData[activePopupMmsi] &&
            !loadingShipDetails.has(activePopupMmsi)
        ) {
            fetchShipDetails(activePopupMmsi);
        }
    }, [activePopupMmsi]);

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
            console.error("Error fetching all ships:", error);
            setIsLoading(false);
            return [];
        }
    };

    const fetchShipsInArea = async (
        lat: number,
        lon: number,
        radius: number
    ) => {
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
            console.error("Error fetching ships in area:", error);
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
            await fetchShipsInArea(
                mapInfo.center.lat,
                mapInfo.center.lon,
                mapInfo.radius
            );
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

            map.on("moveend zoomend", handleMapChange);

            return () => {
                map.off("moveend zoomend", handleMapChange);
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

    const renderShipPopup = (ship: Ship) => {
        const isLoadingDetails = loadingShipDetails.has(ship.mmsi);
        const shipData = selectedShipData[ship.mmsi];
        const hasDetailedData = shipData !== undefined;
        const shipNotFound = shipData?.found === false;

        if (isLoadingDetails && !hasDetailedData) {
            return (
                <div className="card bg-base-100 shadow-xl max-w-md">
                    <div className="card-body">
                        <div className="flex flex-col items-center justify-center py-8">
                            <span className="loading loading-spinner loading-lg text-primary"></span>
                            <p className="text-lg font-medium mt-4">
                                Loading ship details...
                            </p>
                        </div>
                    </div>
                </div>
            );
        }

        if (hasDetailedData && shipData && shipData.found) {
            const aisData = shipData.ais_data;
            const scrapedData = shipData.scraped_data;

            console.log("Rendering detailed ship data:", {
                mmsi: ship.mmsi,
                aisData,
                scrapedData,
            });
            return (
                <div className="card bg-base-100 shadow-xl max-w-5xl">
                    <div className="card-body px-0 pt-0">
                        {/* Ship Image */}
                        {scrapedData?.Image && (
                            <figure className="relative">
                                <img
                                    src={scrapedData.Image}
                                    alt="Ship"
                                    className="rounded-lg w-full h-52 object-cover rounded-b-none"
                                    onError={(e) => {
                                        (
                                            e.target as HTMLImageElement
                                        ).style.display = "none";
                                    }}
                                />
                                {scrapedData?.Flag && (
                                    <FlagImage
                                        country={scrapedData.Flag}
                                        className="absolute top-2 left-2 w-8 h-6 object-cover rounded shadow-lg border border-white"
                                    />
                                )}
                            </figure>
                        )}
                        <div className="px-6">
                            <h2 className="card-title text-primary mb-4">
                                {scrapedData?.["Vessel Name"] ||
                                    aisData?.vessel_name ||
                                    ship.info.vessel_name ||
                                    "Unknown Vessel"}
                                {(aisData?.callsign || ship.info.callsign) && (
                                    <span className="badge badge-outline ml-2">
                                        {aisData?.callsign || ship.info.callsign}
                                    </span>
                                )}
                            </h2>
                            {/* Primary Information */}
                            <div className="grid grid-cols-1 gap-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="font-semibold">
                                        MMSI / IMO:
                                    </span>
                                    <span className="badge badge-outline">
                                        {aisData?.mmsi || ship.mmsi} /{" "}
                                        {aisData?.imo ||
                                            scrapedData?.["IMO number"] ||
                                            "N/A"}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-semibold">
                                        Ship Type:
                                    </span>
                                    <span className="badge badge-secondary">
                                        {scrapedData?.["Ship Type"] ||
                                            aisData?.ship_type ||
                                            "N/A"}
                                    </span>
                                </div>
                            </div>

                            {/* Navigation Data */}
                            <div className="divider divider-secondary">
                                Navigation
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div className="stat bg-base-200 rounded-lg p-2">
                                    <div className="stat-title text-xs">
                                        Speed
                                    </div>
                                    <div className="stat-value text-lg">
                                        {ship.position.sog}
                                    </div>
                                    <div className="stat-desc">knots</div>
                                </div>
                                <div className="stat bg-base-200 rounded-lg p-2">
                                    <div className="stat-title text-xs">
                                        Course
                                    </div>
                                    <div className="stat-value text-lg">
                                        {ship.position.cog}°
                                    </div>
                                </div>
                                <div className="stat bg-base-200 rounded-lg p-2">
                                    <div className="stat-title text-xs">
                                        Heading
                                    </div>
                                    <div className="stat-value text-lg">
                                        {ship.position.heading}°
                                    </div>
                                </div>
                                <div className="stat bg-base-200 rounded-lg p-2">
                                    <div className="stat-title text-xs">
                                        Status
                                    </div>
                                    <div className="stat-desc text-xs">
                                        {ship.position.nav_status}
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-between items-center text-sm mt-2">
                                <span className="font-semibold">
                                    Destination:
                                </span>
                                <span className="badge badge-accent">
                                    {aisData?.destination || "N/A"}
                                </span>
                            </div>

                            {aisData?.eta_month && (
                                <div className="flex justify-between items-center text-sm">
                                    <span className="font-semibold">ETA:</span>
                                    <span>
                                        {aisData.eta_month}/{aisData.eta_day}{" "}
                                        {aisData.eta_hour}:{aisData.eta_minute}
                                    </span>
                                </div>
                            )}

                            {/* Vessel Specifications */}
                            <div className="divider divider-accent">
                                Specifications
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div className="flex justify-between col-span-2">
                                    <span className="font-semibold">
                                        Year Built:
                                    </span>
                                    <span className="badge badge-ghost">
                                        {scrapedData?.["Year of Build"] ||
                                            "N/A"}
                                    </span>
                                </div>
                            </div>

                            {/* Owner Information */}
                            {scrapedData?.["Registered Owner"] && (
                                <>
                                    <div className="divider divider-warning">
                                        Owner
                                    </div>
                                    <div className="alert alert-info">
                                        <span className="text-sm">
                                            {scrapedData["Registered Owner"]}
                                        </span>
                                    </div>
                                </>
                            )}

                            {/* Timestamps */}
                            <div className="divider">Updates</div>
                            <div className="text-xs text-base-content/70 space-y-1">
                                <div className="flex justify-between">
                                    <span>Last AIS:</span>
                                    <span>
                                        {new Date(
                                            ship.position.last_seen
                                        ).toLocaleString()}
                                    </span>
                                </div>
                                {aisData?.updated_at && (
                                    <div className="flex justify-between">
                                        <span>Data Updated:</span>
                                        <span>
                                            {new Date(
                                                aisData.updated_at
                                            ).toLocaleString()}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        // Fallback to basic AIS data if ship not found in detailed endpoint
        if (shipNotFound || !hasDetailedData) {
            return (
                <div className="card bg-base-100 shadow-xl max-w-md">
                    <div className="card-body">
                        <h2 className="card-title text-primary mb-4">
                            {ship.info.vessel_name || "Unknown Vessel"}
                        </h2>

                        {shipNotFound && (
                            <div className="alert alert-warning mb-4">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="stroke-current shrink-0 h-6 w-6"
                                    fill="none"
                                    viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                                    />
                                </svg>
                                <span className="text-sm">
                                    Limited data available - showing AIS data
                                    only
                                </span>
                            </div>
                        )}

                        {/* Basic AIS Data */}
                        <div className="space-y-3">
                            <div className="grid grid-cols-1 gap-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="font-semibold">MMSI:</span>
                                    <span className="badge badge-outline">
                                        {ship.mmsi}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-semibold">
                                        Callsign:
                                    </span>
                                    <span>{ship.info.callsign || "N/A"}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-semibold">IMO:</span>
                                    <span>{ship.info.imo || "N/A"}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-semibold">
                                        Ship Type:
                                    </span>
                                    <span className="badge badge-secondary">
                                        {ship.info.ship_type || "N/A"}
                                    </span>
                                </div>
                            </div>

                            <div className="divider divider-primary">
                                Navigation
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="stat bg-base-200 rounded-lg p-2">
                                    <div className="stat-title text-xs">
                                        Speed
                                    </div>
                                    <div className="stat-value text-lg">
                                        {ship.position.sog}
                                    </div>
                                    <div className="stat-desc">knots</div>
                                </div>
                                <div className="stat bg-base-200 rounded-lg p-2">
                                    <div className="stat-title text-xs">
                                        Course
                                    </div>
                                    <div className="stat-value text-lg">
                                        {ship.position.cog}°
                                    </div>
                                </div>
                                <div className="stat bg-base-200 rounded-lg p-2">
                                    <div className="stat-title text-xs">
                                        Heading
                                    </div>
                                    <div className="stat-value text-lg">
                                        {ship.position.heading}°
                                    </div>
                                </div>
                                <div className="stat bg-base-200 rounded-lg p-2">
                                    <div className="stat-title text-xs">
                                        Status
                                    </div>
                                    <div className="stat-desc text-xs">
                                        {ship.position.nav_status}
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-between text-sm">
                                <span className="font-semibold">
                                    Destination:
                                </span>
                                <span className="badge badge-accent">
                                    {ship.info.destination || "N/A"}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="font-semibold">Draught:</span>
                                <span>{ship.info.draught || "N/A"}m</span>
                            </div>
                        </div>

                        <div className="divider">Updates</div>
                        <div className="text-xs text-base-content/70 space-y-1">
                            <div className="flex justify-between">
                                <span>Last Seen:</span>
                                <span>
                                    {new Date(
                                        ship.position.last_seen
                                    ).toLocaleString()}
                                </span>
                            </div>
                            {ship.info.updated_at && (
                                <div className="flex justify-between">
                                    <span>AIS Updated:</span>
                                    <span>
                                        {new Date(
                                            ship.info.updated_at
                                        ).toLocaleString()}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Retry button for failed lookups */}
                        {shipNotFound && (
                            <div className="card-actions justify-end mt-4">
                                <button
                                    onClick={() => fetchShipDetails(ship.mmsi)}
                                    disabled={isLoadingDetails}
                                    className="btn btn-primary btn-sm">
                                    {isLoadingDetails ? (
                                        <>
                                            <span className="loading loading-spinner loading-sm"></span>
                                            Retrying...
                                        </>
                                    ) : (
                                        "Retry Lookup"
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        return null;
    };

    return (
        <div data-theme="lemonade" className="min-h-screen">
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
                        position={[
                            parseFloat(ship.position.lat),
                            parseFloat(ship.position.lon),
                        ]}
                        icon={createSquareIcon(ship.position.heading)}
                        eventHandlers={{
                            popupopen: () => setActivePopupMmsi(ship.mmsi),
                            popupclose: () => setActivePopupMmsi(null),
                        }}>
                        <Popup maxWidth={400}>{renderShipPopup(ship)}</Popup>
                    </Marker>
                ))}
            </MapContainer>

            {/* Status indicator */}
            <div className="absolute top-4 left-4 z-20">
                <div className="card bg-base-100 shadow-xl">
                    <div className="card-body p-4">
                        <div className="flex items-center gap-3 mb-2">
                            <div
                                className={`radial-progress ${
                                    isLoading ? "text-warning" : "text-success"
                                }`}
                                style={
                                    {
                                        "--value": "100",
                                        "--size": "1.5rem",
                                    } as React.CSSProperties
                                }>
                                <div
                                    className={`w-2 h-2 rounded-full ${
                                        isLoading ? "bg-warning" : "bg-success"
                                    }`}></div>
                            </div>
                            <div className="stat">
                                <div className="stat-title text-sm">
                                    Active Ships
                                </div>
                                <div className="stat-value text-2xl">
                                    {ships.length}
                                </div>
                            </div>
                        </div>
                        <div className="text-xs space-y-1">
                            <div className="badge badge-ghost badge-sm">
                                {isInitialLoad
                                    ? "Initial load (all ships)"
                                    : `Auto radius: ${currentRadius}km`}
                            </div>
                            <div className="badge badge-ghost badge-sm">
                                Zoom:{" "}
                                {mapRef.current
                                    ? mapRef.current.getZoom().toFixed(1)
                                    : "10.0"}
                            </div>
                            {lastUpdate && (
                                <div className="text-xs text-base-content/70">
                                    Updated: {lastUpdate.toLocaleTimeString()}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Manual refresh button */}
            <div className="absolute top-4 right-4 z-20">
                <button
                    onClick={updateShips}
                    disabled={isLoading}
                    className="btn btn-primary shadow-xl">
                    {isLoading ? (
                        <>
                            <span className="loading loading-spinner loading-sm"></span>
                            Updating...
                        </>
                    ) : (
                        <>
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                />
                            </svg>
                            Refresh
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}

export default App;
