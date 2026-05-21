import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";

// Leaflet markers fix
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// Custom Premium Icons (Green for Pickup, Red for Drop)
const pickupIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const dropIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

export default function RideMap() {
  // Setup coordinates around Indore
  const [pickupCoords] = useState<[number, number]>([22.7196, 75.8577]);
  const [dropCoords] = useState<[number, number]>([22.7533, 75.8937]);
  const [routePaths, setRoutePaths] = useState<[number, number][]>([]);

  // 100% Free OSRM API for routing (No API Key required)
  useEffect(() => {
    const fetchRoute = async () => {
      try {
        const response = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${pickupCoords[1]},${pickupCoords[0]};${dropCoords[1]},${dropCoords[0]}?overview=full&geometries=geojson`
        );
        const data = await response.json();

        if (data.routes && data.routes.length > 0) {
          // OSRM deta hai [long, lat], Leaflet ko chahiye [lat, long]
          const coordinates = data.routes[0].geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]]);
          setRoutePaths(coordinates);
        }
      } catch (error) {
        console.error("Routing error:", error);
      }
    };

    fetchRoute();
  }, [pickupCoords, dropCoords]);

  return (
    <div className="relative w-full h-[600px] rounded-2xl overflow-hidden shadow-2xl border border-slate-800">
      <MapContainer
        center={pickupCoords}
        zoom={13}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%", backgroundColor: "#111" }}
      >
        {/* 🔥 MAGIC HERE: CartoDB Dark Matter BaseMap for Premium Uber Look 🔥 */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
        />

        <Marker position={pickupCoords} icon={pickupIcon}>
          <Popup className="font-bold text-slate-800">Pickup Location</Popup>
        </Marker>

        <Marker position={dropCoords} icon={dropIcon}>
          <Popup className="font-bold text-slate-800">Drop Location</Popup>
        </Marker>

        {/* The Route Line */}
        {routePaths.length > 0 && (
          <Polyline positions={routePaths} color="#3b82f6" weight={5} opacity={0.8} />
        )}
      </MapContainer>

      {/* Floating UI over the Map */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[400] bg-slate-900/90 backdrop-blur-sm text-white px-6 py-3 rounded-full shadow-2xl font-bold flex items-center gap-3 border border-slate-700">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
        </span>
        Live Routing Active
      </div>
    </div>
  );
}