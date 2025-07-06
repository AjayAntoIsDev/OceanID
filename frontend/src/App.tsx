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

interface ShipsCountResponse {
    unique_ships: number;
    ships_with_info: number;
    message?: string;
    error?: string;
}

const KnotsIndicator = ({ speed = 0, className = "" }) => {
    const [animatedSpeed, setAnimatedSpeed] = useState(0);

    useEffect(() => {
        const timer = setTimeout(() => {
            setAnimatedSpeed(parseFloat(speed) || 0);
        }, 100);
        return () => clearTimeout(timer);
    }, [speed]);

    const maxSpeed = 30;
    const percentage = Math.min((animatedSpeed / maxSpeed) * 100, 100);
    const rotation = (percentage / 100) * 180 - 90; // -90 to 90 degrees

    const getSpeedColor = (knots) => {
        if (knots < 5) return 'text-blue-400';
        if (knots < 10) return 'text-green-400';
        if (knots < 15) return 'text-yellow-400';
        if (knots < 20) return 'text-orange-400';
        return 'text-red-400';
    };

    const getGlowColor = (knots) => {
        if (knots < 5) return 'shadow-blue-500/20';
        if (knots < 10) return 'shadow-green-500/20';
        if (knots < 15) return 'shadow-yellow-500/20';
        if (knots < 20) return 'shadow-orange-500/20';
        return 'shadow-red-500/20';
    };

    return (
        <div className={`stat bg-base-200 rounded-lg p-2 relative overflow-hidden ${className}`}>
            <div className="absolute inset-0 bg-gradient-to-br from-transparent via-primary/5 to-primary/10 rounded-lg"></div>

            <div className="relative z-10">
                <div className="stat-title text-xs flex items-center gap-1">
                    Speed
                    <div className="w-1 h-1 bg-primary rounded-full animate-pulse"></div>
                </div>
                
                <div className="flex items-center gap-2 my-1">
                    <div className="relative w-8 h-4 overflow-hidden">
                        <div className="absolute inset-0 border-2 border-base-300 rounded-t-full"></div>
                        <div
                            className="absolute bottom-0 left-1/2 w-0.5 h-3 bg-primary origin-bottom transition-transform duration-500 ease-out"
                            style={{
                                transform: `translateX(-50%) rotate(${rotation}deg)`,
                            }}
                        />
                    </div>
                    
                    {/* Speed value with glow effect */}
                    <div className={`stat-value text-lg font-bold ${getSpeedColor(animatedSpeed)} transition-colors duration-300`}>
                        <span className={`drop-shadow-lg ${getGlowColor(animatedSpeed)}`}>
                            {animatedSpeed.toFixed(1)}
                        </span>
                    </div>
                </div>
                
                <div className="stat-desc text-xs flex items-center justify-between">
                    <span className="pl-0">knots</span>
                    <div className="flex items-center gap-1">
                        <div className={`w-1 h-1 rounded-full ${animatedSpeed > 0 ? 'bg-green-400' : 'bg-gray-400'}`}></div>
                        <span className="text-xs">{animatedSpeed > 0 ? 'Moving' : 'Stationary'}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const HeadingIndicator = ({ heading = 0, className = "" }) => {
    const [animatedHeading, setAnimatedHeading] = useState(0);

    useEffect(() => {
        const timer = setTimeout(() => {
            setAnimatedHeading(parseFloat(heading) || 0);
        }, 100);
        return () => clearTimeout(timer);
    }, [heading]);

    const getDirectionLabel = (degrees) => {
        if (degrees >= 337.5 || degrees < 22.5) return 'N';
        if (degrees >= 22.5 && degrees < 67.5) return 'NE';
        if (degrees >= 67.5 && degrees < 112.5) return 'E';
        if (degrees >= 112.5 && degrees < 157.5) return 'SE';
        if (degrees >= 157.5 && degrees < 202.5) return 'S';
        if (degrees >= 202.5 && degrees < 247.5) return 'SW';
        if (degrees >= 247.5 && degrees < 292.5) return 'W';
        if (degrees >= 292.5 && degrees < 337.5) return 'NW';
        return 'N';
    };

    return (
        <div className={`stat bg-base-200 rounded-lg p-2 relative overflow-hidden ${className}`}>
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-transparent via-accent/5 to-accent/10 rounded-lg"></div>
            
            {/* Direction indicator */}
            <div className="absolute top-1 right-1 text-xs text-accent font-bold">
                {getDirectionLabel(animatedHeading)}
            </div>

            <div className="relative z-10">
                <div className="stat-title text-xs flex items-center gap-1">
                    Heading
                    <div className="w-1 h-1 bg-accent rounded-full animate-pulse"></div>
                </div>
                
                <div className="flex items-center gap-2 my-1">
                    {/* Ship heading indicator */}
                    <div className="relative w-8 h-8 border-2 border-base-300 rounded-full">
                        <div className="absolute inset-1 border border-base-300 rounded-full"></div>
                        {/* Ship bow direction */}
                        <div
                            className="absolute top-1/2 left-1/2 transition-transform duration-500 ease-out"
                            style={{
                                transform: `translateX(-50%) translateY(-50%) rotate(${animatedHeading}deg)`,
                            }}
                        >
                            <div className="w-0 h-0 border-l-[3px] border-r-[3px] border-b-[6px] border-l-transparent border-r-transparent border-b-accent -translate-y-2"></div>
                        </div>
                        <div className="absolute top-1/2 left-1/2 w-1 h-1 bg-accent rounded-full transform -translate-x-1/2 -translate-y-1/2"></div>
                    </div>
                    
                    {/* Heading value */}
                    <div className="stat-value text-lg font-bold text-accent transition-colors duration-300">
                        <span className="drop-shadow-lg">
                            {Math.round(animatedHeading)}°
                        </span>
                    </div>
                </div>
                
                <div className="stat-desc text-xs">
                    ship's bow
                </div>
            </div>
        </div>
    );
};

const getNavigationStatus = (navStatus: string) => {
    const statusCode = (() => {
        if (typeof navStatus === 'string') {
            const match = navStatus.match(/:?\s*(\d+)\s*>?$/);
            if (match) {
                return parseInt(match[1]);
            }
            // Handle plain string numbers
            const parsed = parseInt(navStatus);
            if (!isNaN(parsed)) {
                return parsed;
            }
        }
        if (typeof navStatus === 'number') {
            return navStatus;
        }
        return 15;
    })();

    
    const statusMap = {
        0: { text: "Under way using engine", color: "text-green-500", icon: "⚡" },
        1: { text: "At anchor", color: "text-blue-500", icon: "⚓" },
        2: { text: "Not under command", color: "text-red-500", icon: "⚠️" },
        3: { text: "Restricted maneuverability", color: "text-orange-500", icon: "⚠️" },
        4: { text: "Constrained by draught", color: "text-yellow-500", icon: "⚠️" },
        5: { text: "Moored", color: "text-purple-500", icon: "🔗" },
        6: { text: "Aground", color: "text-red-600", icon: "⚠️" },
        7: { text: "Engaged in fishing", color: "text-cyan-500", icon: "🎣" },
        8: { text: "Under way sailing", color: "text-emerald-500", icon: "⛵" },
        9: { text: "Reserved (Hazardous cargo HSC)", color: "text-amber-600", icon: "⚠️" },
        10: { text: "Reserved (Dangerous goods WIG)", color: "text-amber-700", icon: "⚠️" },
        11: { text: "Towing astern", color: "text-indigo-500", icon: "🚢" },
        12: { text: "Pushing/towing alongside", color: "text-indigo-600", icon: "🚢" },
        13: { text: "Reserved for future use", color: "text-gray-500", icon: "❓" },
        14: { text: "AIS-SART/MOB/EPIRB active", color: "text-red-500", icon: "🆘" },
        15: { text: "Undefined/Default", color: "text-gray-400", icon: "❓" }
    };
    
    return statusMap[statusCode] || statusMap[15];
};

const NavigationStatusIndicator = ({ navStatus, className = "" }) => {
    const status = getNavigationStatus(navStatus);
    
    return (
        <div
            className={`stat bg-base-200 rounded-lg p-2 relative overflow-hidden col-span-2 ${className}`}>
            <div className="absolute inset-0 bg-gradient-to-br from-transparent via-info/5 to-info/10 rounded-lg"></div>
            <div className="relative z-10">
                <div className="stat-title text-xs flex items-center gap-1">
                    Navigation Status
                    <div className="w-1 h-1 bg-info rounded-full animate-pulse"></div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                    <div
                        className={`w-6 h-6 rounded-full ${status.color} flex items-center justify-center text-xs`}>
                        <span className="text-xs">{status.icon}</span>
                    </div>
                    <div className={`stat-desc text-md font-medium ${status.color}`}>
                        {status.text}
                    </div>
                </div>
            </div>
        </div>
    );
};

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
    const [shipsCount, setShipsCount] = useState<ShipsCountResponse | null>(null);
    const [showInfoModal, setShowInfoModal] = useState(true);
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

    const fetchShipsCount = async () => {
        try {
            const response = await fetch("http://127.0.0.1:8000/ships/count");
            const data: ShipsCountResponse = await response.json();
            setShipsCount(data);
            return data;
        } catch (error) {
            console.error("Error fetching ships count:", error);
            return null;
        }
    };

    const updateShips = async () => {
        setIsLoading(true);
        await fetchShipsCount();


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

            return (
                <div className="card bg-base-100 shadow-xl max-w-5xl">
                    <div
                        className={`card-body px-0 ${
                            scrapedData?.Image ? "pt-0" : "pt-4"
                        }`}>
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
                                        className="absolute top-2 left-2 w-14 h-8 object-cover rounded shadow-lg border border-white"
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
                                        {aisData?.callsign ||
                                            ship.info.callsign}
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
                                <div className="flex justify-between">
                                    <span className="font-semibold">
                                        Year Built:
                                    </span>
                                    <span className="badge badge-ghost">
                                        {scrapedData?.["Year of Build"] ||
                                            "N/A"}
                                    </span>
                                </div>
                            </div>

                            {/* Navigation Data*/}
                            <div className="grid grid-cols-2 gap-2 text-sm mt-4">
                                <KnotsIndicator speed={ship.position.sog} />
                                <HeadingIndicator
                                    heading={ship.position.heading}
                                />
                                <NavigationStatusIndicator
                                    navStatus={ship.position.nav_status}
                                />
                            </div>


                            {/* Timestamps */}
                            <div className="text-xs text-base-content/70 space-y-1 mt-4">
                                {/* Timestamps */}
                                    <div className="flex justify-between">
                                        <span>Last AIS:</span>
                                        <span>
                                            {(() => {
                                                const now = new Date();
                                                const lastSeen = new Date(
                                                    ship.position.last_seen +
                                                        "Z"
                                                ); // Add Z to ensure UTC parsing
                                                const diffMs =
                                                    now.getTime() -
                                                    lastSeen.getTime();
                                                const diffMinutes = Math.floor(
                                                    diffMs / (1000 * 60)
                                                );
                                                const diffHours = Math.floor(
                                                    diffMinutes / 60
                                                );
                                                const diffDays = Math.floor(
                                                    diffHours / 24
                                                );

                                                if (diffDays > 0) {
                                                    return `${diffDays}d ${
                                                        diffHours % 24
                                                    }h ago`;
                                                } else if (diffHours > 0) {
                                                    return `${diffHours}h ${
                                                        diffMinutes % 60
                                                    }m ago`;
                                                } else if (diffMinutes > 0) {
                                                    return `${diffMinutes}m ago`;
                                                } else {
                                                    return "Just now";
                                                }
                                            })()}
                                        </span>
                                    </div>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        // Fallback to basic AIS data with 
        if (shipNotFound || !hasDetailedData) {
            return (
                <div className="card bg-base-100 shadow-xl max-w-md">
                    <div className="card-body">

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
                        <div className="px-6">
                            <h2 className="card-title text-primary mb-4">
                                {
                                    ship.info.vessel_name ||
                                    "Unknown Vessel"}
                                {( ship.info.callsign) && (
                                    <span className="badge badge-outline ml-2">
                                        {
                                            ship.info.callsign}
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
                                        {ship.mmsi} /{" "}
                                        {ship?.info.imo ||
                                            "N/A"}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-semibold">
                                        Ship Type:
                                    </span>
                                    <span className="badge badge-secondary">
                                        {ship?.info.ship_type ? 
                                            ship.info.ship_type.split('.').pop()?.replace(/[:\d>]/g, '').trim() || "N/A" 
                                            : "N/A"}
                                    </span>
                                </div>
                            </div>

                            {/* Navigation Data*/}
                            <div className="grid grid-cols-2 gap-2 text-sm mt-4">
                                <KnotsIndicator speed={ship.position.sog} />
                                <HeadingIndicator
                                    heading={ship.position.heading}
                                />
                                <NavigationStatusIndicator
                                    navStatus={ship.position.nav_status}
                                />
                            </div>

                            {/* Timestamps */}
                            <div className="text-xs text-base-content/70 space-y-1 mt-4">
                                <div className="flex justify-between">
                                    <span>Last AIS:</span>
                                    <span>
                                        {(() => {
                                            const now = new Date();
                                            const lastSeen = new Date(ship.position.last_seen + 'Z'); // Add Z to ensure UTC parsing
                                            const diffMs = now.getTime() - lastSeen.getTime();
                                            const diffMinutes = Math.floor(diffMs / (1000 * 60));
                                            const diffHours = Math.floor(diffMinutes / 60);
                                            const diffDays = Math.floor(diffHours / 24);
                                            
                                            if (diffDays > 0) {
                                                return `${diffDays}d ${diffHours % 24}h ago`;
                                            } else if (diffHours > 0) {
                                                return `${diffHours}h ${diffMinutes % 60}m ago`;
                                            } else if (diffMinutes > 0) {
                                                return `${diffMinutes}m ago`;
                                            } else {
                                                return "Just now";
                                            }
                                        })()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return null;
    };

    return (
        <div data-theme="lemonade" className="min-h-screen">
            {/* Info Modal */}
            {showInfoModal && (
                <div className="modal modal-open z-50">
                    <div className="modal-box max-w-4xl">
                        <div className="flex items-center gap-3 mb-6">
                            <div>
                                <h2 className="text-2xl font-bold text-primary">
                                    🌊 OceanID
                                </h2>
                                <p className="text-sm text-base-content/70">
                                    Track ships and other stuff with your own
                                    RTL-SDR
                                </p>
                            </div>
                        </div>

                        <div className="mt-4 rounded-lg">
                            <h4 className="font-semibold mb-2 text-xl">
                                📡 How RTL-SDR Works for AIS
                            </h4>
                            <p className="text-sm text-base-content/80 mb-2">
                                RTL-SDR dongles can receive AIS (Automatic
                                Identification System) signals directly from
                                ships at 161.975 MHz and 162.025 MHz. No
                                internet required - you're capturing live radio
                                transmissions within ~20-50km range depending on
                                antenna setup.
                            </p>
                            <p className="text-sm text-base-content/60">
                                <strong>Current Demo:</strong> This version uses
                                real AIS data from the Norwegian Coastal
                                Administration since I don't currently own an
                                RTL-SDR device. It works the exact same with a
                                real RTL-SDR setup.
                            </p>
                        </div>

                        <div className="space-y-6 mt-4">
                            {/* Tech Stack */}
                            <div className="card bg-base-200">
                                <div className="card-body">
                                    <h3 className="card-title text-lg">
                                        ⚡ Technology Stack
                                    </h3>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        <span className="badge badge-outline">
                                            React
                                        </span>
                                        <span className="badge badge-outline">
                                            TypeScript
                                        </span>
                                        <span className="badge badge-outline">
                                            Leaflet
                                        </span>
                                        <span className="badge badge-outline">
                                            FastAPI
                                        </span>
                                        <span className="badge badge-outline">
                                            Python
                                        </span>
                                        <span className="badge badge-outline">
                                            AIS Data
                                        </span>
                                        <span className="badge badge-outline">
                                            DaisyUI
                                        </span>
                                        <span className="badge badge-outline">
                                            TailwindCSS
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Current Stats */}
                            <div className="stats shadow w-full">
                                <div className="stat">
                                    <div className="stat-title">
                                        Ships Tracked
                                    </div>
                                    <div className="stat-value text-primary">
                                        {shipsCount?.unique_ships || "---"}
                                    </div>
                                    <div className="stat-desc">
                                        Active vessels in database
                                    </div>
                                </div>
                                <div className="stat">
                                    <div className="stat-title">
                                        Update Frequency
                                    </div>
                                    <div className="stat-value text-accent text-lg">
                                        5s
                                    </div>
                                    <div className="stat-desc">
                                        Real-time updates
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="modal-action mt-8">
                            <button
                                onClick={() => setShowInfoModal(false)}
                                className="btn btn-primary">
                                Alright!
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-4 w-4 ml-1"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9 5l7 7-7 7"
                                    />
                                </svg>
                            </button>
                            <button
                                onClick={() =>
                                    window.open(
                                        "https://github.com/AjayAntoIsDev/OceanID",
                                        "_blank"
                                    )
                                }
                                className="btn btn-ghost">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-4 w-4 mr-1"
                                    fill="currentColor"
                                    viewBox="0 0 24 24">
                                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                                </svg>
                                View on GitHub
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <MapContainer
                center={[59.5, 10.6]}
                zoom={10}
                scrollWheelZoom={true}
                className="h-screen w-full z-10"
                ref={mapRef}
                zoomControl={false}>
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
                        <Popup maxWidth={400} autoPan={false}>
                            {renderShipPopup(ship)}
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>

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
                                        width: "29.9px",
                                    } as React.CSSProperties
                                }>
                                <div
                                    className={`w-2 h-2 rounded-full ${
                                        isLoading ? "bg-warning" : "bg-success"
                                    }`}></div>
                            </div>
                            <div className="stat pl-0">
                                <div className="stat-title text-sm">
                                    Ships being tracked
                                </div>
                                <div className="stat-value text-2xl">
                                    {shipsCount?.unique_ships || 0}
                                </div>
                            </div>
                        </div>
                        <div className="text-xs space-y-1">
                            {shipsCount && (
                                <div className="badge badge-ghost badge-sm">
                                    {ships.length} ships in view
                                </div>
                            )}
                            {lastUpdate && (
                                <div className="badge badge-ghost badge-sm">
                                    Updated:{" "}
                                    {(() => {
                                        const now = new Date();
                                        const diffMs =
                                            now.getTime() -
                                            lastUpdate.getTime();
                                        const diffSeconds = Math.floor(
                                            diffMs / 1000
                                        );
                                        const diffMinutes = Math.floor(
                                            diffSeconds / 60
                                        );

                                        if (diffMinutes > 0) {
                                            return `${diffMinutes}m ago`;
                                        } else {
                                            return `${diffSeconds}s ago`;
                                        }
                                    })()}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="absolute bottom-4 right-4 z-20">
                <button
                    onClick={() =>
                        window.open(
                            "https://github.com/AjayAntoIsDev/OceanID",
                            "_blank"
                        )
                    }
                    className="btn btn-neutral btn-md shadow-xl">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        fill="currentColor"
                        viewBox="0 0 24 24">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                    </svg>
                    GitHub
                </button>
            </div>
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

