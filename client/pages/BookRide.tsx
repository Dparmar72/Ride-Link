import { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MapPin, Navigation, Car, Loader2, ArrowLeft,
  Star, Search, AlertTriangle, CheckCircle2,
  Route, Clock, ChevronRight, Zap, Home, User, Menu, X
} from "lucide-react";
import {
  MapContainer, TileLayer, Marker, Popup,
  Polyline, useMap, useMapEvents
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { toast } from "sonner";

/* ─── map marker icons ───────────────────────────────────────────── */
const pickupIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});
const dropIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});

/* ─── map helpers ────────────────────────────────────────────────── */
function MapController({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length > 0) map.fitBounds(L.latLngBounds(coords), { padding: [50, 50] });
  }, [coords, map]);
  return null;
}

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { onMapClick(e.latlng.lat, e.latlng.lng); } });
  return null;
}

/* ─── nav ────────────────────────────────────────────────────────── */
function Navbar() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const authData = JSON.parse(localStorage.getItem("ridelink:auth") || "{}");
  const initials = (authData.name || authData.fullName || "")
    .split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase() || null;
}

/* ─── stat pill ──────────────────────────────────────────────────── */
function StatPill({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm">
      <span className="text-primary">{icon}</span>
      <span className="text-slate-500 font-medium">{label}</span>
      <span className="font-extrabold text-slate-800">{value}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
export default function BookRide() {
  const navigate = useNavigate();

  const [hasActiveRide,   setHasActiveRide]   = useState(false);
  const [checkingActive,  setCheckingActive]  = useState(true);

  const [pickupCoords, setPickupCoords] = useState<[number, number]>([22.7243, 75.8839]);
  const [dropCoords,   setDropCoords]   = useState<[number, number]>([22.7533, 75.8937]);
  const [pickupInput,  setPickupInput]  = useState("Palasia, Indore");
  const [dropInput,    setDropInput]    = useState("Vijay Nagar, Indore");

  const [activeClickTarget, setActiveClickTarget] = useState<"pickup" | "drop">("pickup");
  const [pickupSuggestions, setPickupSuggestions] = useState<any[]>([]);
  const [dropSuggestions,   setDropSuggestions]   = useState<any[]>([]);

  const [loadingRoute,    setLoadingRoute]    = useState(false);
  const [routePaths,      setRoutePaths]      = useState<[number, number][]>([]);
  const [distance,        setDistance]        = useState("0");
  const [duration,        setDuration]        = useState("0");

  const [isSearchingRides, setIsSearchingRides] = useState(false);
  const [availableRides,   setAvailableRides]   = useState<any[] | null>(null);
  const [isBooking,        setIsBooking]         = useState(false);

  const searchTimeout = useRef<any>(null);

  /* ── smart fare calculation 🔥 (UPDATED TO CHEAPER FARES) ─────── */
  const fare = useMemo(() => {
    const distKm = parseFloat(distance) || 0;
    let calcFare = 0;

    // 0 - 15 km: City traffic (₹5/km)
    if (distKm <= 15) calcFare = distKm * 5;
    // 16 - 50 km: Outskirts (₹2/km)
    else if (distKm <= 50) calcFare = (15 * 5) + ((distKm - 15) * 2);
    // 50+ km: Long Highway (₹1.2/km) - Sasta fare!
    else calcFare = (15 * 5) + (35 * 2) + ((distKm - 50) * 1.2);

    // Round to nearest 10
    const roundedFare = Math.round(calcFare / 10) * 10;
    return roundedFare < 30 ? 30 : roundedFare; // Minimum fare ₹30
  }, [distance]);

  /* ── check active ride (🔥 FIX: Ignored Scheduled Rides) ─────── */
  useEffect(() => {
    const check = async () => {
      const authData = localStorage.getItem("ridelink:auth");
      if (!authData) { setCheckingActive(false); return; }
      const authObj = JSON.parse(authData);
      const pid = authObj.id || authObj.userId;
      if (!pid) { setCheckingActive(false); return; }
      try {
        const res = await fetch(`http://localhost:9090/api/bookings/passenger/${pid}`, {
          headers: { Authorization: `Bearer ${authObj.token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const arr = Array.isArray(data) ? data : data.content || data.data || [];

          setHasActiveRide(arr.some((b: any) => {
            const isActiveStatus = ["PENDING", "CONFIRMED", "ACCEPTED"].includes(b.status?.toUpperCase());
            // Agar ride backend se aati hai toh check karo ki wo SCHEDULED toh nahi hai
            const isScheduled = b.ride?.rideType === "SCHEDULED" || b.rideType === "SCHEDULED";
            // Sirf wahi block karegi jo Active hai AUR Scheduled NAHI hai
            return isActiveStatus && !isScheduled;
          }));
        }
      } catch { /* silent */ }
      finally { setCheckingActive(false); }
    };
    check();
  }, []);

  /* ── autocomplete ────────────────────────────────────────────── */
  const handleSearch = (query: string, type: "pickup" | "drop") => {
    type === "pickup" ? setPickupInput(query) : setDropInput(query);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (query.length < 3) {
      type === "pickup" ? setPickupSuggestions([]) : setDropSuggestions([]);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      try {
        const res  = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
        const data = await res.json();
        type === "pickup" ? setPickupSuggestions(data) : setDropSuggestions(data);
      } catch { /* silent */ }
    }, 800);
  };

  const handleSelectSuggestion = (place: any, type: "pickup" | "drop") => {
    const coords: [number, number] = [parseFloat(place.lat), parseFloat(place.lon)];
    const nameArr = place.display_name.split(",");
    const name = nameArr.slice(0, Math.min(3, nameArr.length)).join(",").trim();

    if (type === "pickup") { setPickupCoords(coords); setPickupInput(name); setPickupSuggestions([]); }
    else                   { setDropCoords(coords);   setDropInput(name);   setDropSuggestions([]);   }
  };

  const updateAddressFromCoords = async (lat: number, lng: number, type: "pickup" | "drop") => {
    try {
      const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      const data = await res.json();
      const rawName = data.name
        || data.address?.amenity || data.address?.road
        || data.address?.neighbourhood || data.address?.suburb
        || data.display_name?.split(",")[0] || "Selected from Map";

      const cityOrState = data.address?.city || data.address?.town || data.address?.state_district || data.address?.state || "";
      const final = cityOrState && !rawName.includes(cityOrState) ? `${rawName}, ${cityOrState}` : rawName;

      type === "pickup" ? setPickupInput(final) : setDropInput(final);
    } catch { /* silent */ }
  };

  const handleMarkerDrag = async (e: any, type: "pickup" | "drop") => {
    const pos = e.target.getLatLng();
    const coords: [number, number] = [pos.lat, pos.lng];
    type === "pickup" ? setPickupCoords(coords) : setDropCoords(coords);
    await updateAddressFromCoords(pos.lat, pos.lng, type);
  };

  const handleMapClick = async (lat: number, lng: number) => {
    if (activeClickTarget === "pickup") {
      setPickupCoords([lat, lng]);
      await updateAddressFromCoords(lat, lng, "pickup");
      setActiveClickTarget("drop");
    } else {
      setDropCoords([lat, lng]);
      await updateAddressFromCoords(lat, lng, "drop");
    }
  };

  /* ── route fetch ─────────────────────────────────────────────── */
  useEffect(() => {
    const fetchRoute = async () => {
      setLoadingRoute(true);
      try {
        const res  = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${pickupCoords[1]},${pickupCoords[0]};${dropCoords[1]},${dropCoords[0]}?overview=full&geometries=geojson`
        );
        const data = await res.json();
        if (data.routes?.length) {
          const r = data.routes[0];
          setRoutePaths(r.geometry.coordinates.map((c: number[]) => [c[1], c[0]]));
          setDistance((r.distance / 1000).toFixed(1));
          setDuration(Math.round(r.duration / 60).toString());
        }
      } catch { /* silent */ }
      finally { setLoadingRoute(false); }
    };
    fetchRoute();
  }, [pickupCoords, dropCoords]);

  /* ── find carpools ───────────────────────────────────────────── */
  const handleFindCarpools = async () => {
    setIsSearchingRides(true);
    try {
      const authData = localStorage.getItem("ridelink:auth");
      if (!authData || authData === "null") { toast.error("Please sign in first."); return; }
      const authObj = JSON.parse(authData);
      if (!authObj?.token) { toast.error("Session expired. Please log in again."); return; }

      const res = await fetch("http://localhost:9090/api/rides/search-instant", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authObj.token}` },
        body: JSON.stringify({
          pickupLat: pickupCoords[0], pickupLng: pickupCoords[1],
          dropLat: dropCoords[0],    dropLng: dropCoords[1], seats: 1,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const instantRidesOnly = data.filter((ride: any) => ride.rideType === "INSTANT");
        setAvailableRides(instantRidesOnly);
      }
      else if (res.status === 403) toast.error("Authorization failed (403). Check your session.");
      else                         toast.error("Server error. Please try again.");
    } catch { toast.error("Could not connect to server."); }
    finally { setIsSearchingRides(false); }
  };

  /* ── send ride request (🔥 FIX: Added Fare Variables) ────────── */
  const handleSendRideRequest = async (rideId: number) => {
    setIsBooking(true);
    try {
      const authData = localStorage.getItem("ridelink:auth");
      if (!authData || authData === "null") { toast.error("Please sign in first."); return; }
      const authObj   = JSON.parse(authData);

      const res = await fetch("http://localhost:9090/api/bookings/book", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authObj.token}` },
        body: JSON.stringify({
          rideId,
          passengerId: authObj.id || authObj.userId,
          seatsBooked: 1,
          pickupLat: pickupCoords[0],
          pickupLng: pickupCoords[1],
          dropLat:   dropCoords[0],
          dropLng:   dropCoords[1],

          // 🔥 Backend ke variable naam se match karne ke liye humne sab bhej diya hai
          price: fare,
          fare: fare,
          pricePerSeat: fare,
          totalPrice: fare
        }),
      });

      if (res.ok) {
        toast.success("Ride requested! Waiting for driver approval.");
        navigate("/passenger-dashboard");
      } else {
        toast.error("Booking failed. The ride may be full.");
      }
    } catch { toast.error("Server connection failed."); }
    finally { setIsBooking(false); }
  };

  /* ── loading screen ──────────────────────────────────────────── */
  if (checkingActive)
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-3 text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium">Checking your rides…</p>
      </div>
    );

  /* ══════════════════════════════════════════════════════════════ */
  return (
    <div className="flex flex-col min-h-screen bg-slate-50">

      {/* ── page hero strip ──────────────────────────────────────── */}
      <div className="bg-neutral-950 text-white">
        <div className="pointer-events-none absolute h-32 w-full bg-[radial-gradient(800px_200px_at_50%_0px,hsla(46,95%,55%,0.12),transparent)]" />
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-1">
            <Badge className="bg-primary/20 text-primary border-primary/30" variant="outline">
              Instant Matching
            </Badge>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Book Your Ride
          </h1>
          <p className="mt-1.5 text-white/50 text-sm max-w-lg">
            {hasActiveRide
              ? "You already have an active ride in progress."
              : availableRides !== null
                ? `${availableRides.length} driver${availableRides.length !== 1 ? "s" : ""} matched on your route.`
                : "Search a location or click the map to set pickup & drop points."}
          </p>
        </div>
      </div>

      {/* ── main content ─────────────────────────────────────────── */}
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-3">

          {/* ── LEFT PANEL ──────────────────────────────────────── */}
          <div className="lg:col-span-1 space-y-4">

            {/* ── ACTIVE RIDE BLOCK ─ */}
            {hasActiveRide && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-amber-900">Active ride in progress</h3>
                    <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                      You cannot book a new ride until your current trip is completed or cancelled.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => navigate("/passenger-dashboard")}
                  className="w-full rounded-xl font-bold bg-amber-600 hover:bg-amber-700 text-white"
                >
                  <MapPin className="h-4 w-4 mr-2" /> Go to My Rides
                </Button>
              </div>
            )}

            {/* ── SEARCH FORM ─ */}
            {!hasActiveRide && availableRides === null && (
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 text-white">
                      <Navigation className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">Where are you going?</p>
                      <p className="text-[11px] text-slate-500">Set your pickup & drop location</p>
                    </div>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  {/* pickup */}
                  <div className="relative">
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-slate-400">
                      Pickup Location
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
                      <Input
                        value={pickupInput}
                        onChange={(e) => handleSearch(e.target.value, "pickup")}
                        className="pl-9 bg-slate-50 border-slate-200 font-medium focus:bg-white"
                        placeholder="Search pickup location…"
                      />
                    </div>
                    {pickupSuggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
                        {pickupSuggestions.map((p, i) => (
                          <div key={i} onClick={() => handleSelectSuggestion(p, "pickup")}
                               className="flex items-start gap-2.5 px-3 py-2.5 text-sm hover:bg-slate-50 cursor-pointer border-b last:border-0">
                            <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-slate-400" />
                            <span className="truncate text-slate-700 font-medium">{p.display_name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 px-1">
                    <div className="flex flex-col items-center gap-1">
                      <div className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                      <div className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                    </div>
                    <div className="h-px flex-1 bg-slate-200" />
                  </div>

                  {/* drop */}
                  <div className="relative">
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-slate-400">
                      Drop Location
                    </label>
                    <div className="relative">
                      <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500" />
                      <Input
                        value={dropInput}
                        onChange={(e) => handleSearch(e.target.value, "drop")}
                        className="pl-9 bg-slate-50 border-slate-200 font-medium focus:bg-white"
                        placeholder="Search drop location…"
                      />
                    </div>
                    {dropSuggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
                        {dropSuggestions.map((p, i) => (
                          <div key={i} onClick={() => handleSelectSuggestion(p, "drop")}
                               className="flex items-start gap-2.5 px-3 py-2.5 text-sm hover:bg-slate-50 cursor-pointer border-b last:border-0">
                            <Navigation className="h-3.5 w-3.5 mt-0.5 shrink-0 text-slate-400" />
                            <span className="truncate text-slate-700 font-medium">{p.display_name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* route stats */}
                  {routePaths.length > 0 && (
                    <div className="relative rounded-xl border border-primary/20 bg-primary/5 p-4">
                      {loadingRoute && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/70 backdrop-blur-sm">
                          <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="text-center">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Distance</p>
                          <p className="text-xl font-extrabold text-slate-800">{distance} <span className="text-sm font-semibold text-slate-500">km</span></p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Est. Time</p>
                          <p className="text-xl font-extrabold text-slate-800">{duration} <span className="text-sm font-semibold text-slate-500">min</span></p>
                        </div>
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={handleFindCarpools}
                    disabled={loadingRoute || isSearchingRides}
                    className="w-full h-12 text-base font-bold rounded-xl shadow-sm active:scale-[0.98] transition-all"
                  >
                    {isSearchingRides ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Searching Network…</>
                    ) : (
                      <><Zap className="mr-2 h-4 w-4" /> Find Carpools</>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* ── RESULTS PANEL ─ */}
            {!hasActiveRide && availableRides !== null && (
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col" style={{ maxHeight: 620 }}>
                <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4">
                  <button
                    onClick={() => setAvailableRides(null)}
                    className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-slate-200 transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4 text-slate-600" />
                  </button>
                  <div>
                    <p className="text-sm font-bold text-slate-800">Matched Rides</p>
                    <p className="text-[11px] text-slate-500">{availableRides.length} driver{availableRides.length !== 1 ? "s" : ""} on your route</p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {availableRides.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                        <Car className="h-7 w-7 text-slate-400" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-700">No rides found</p>
                        <p className="text-xs text-slate-500 mt-1">No active drivers on this route right now. Try again later.</p>
                      </div>
                      <Button variant="outline" className="rounded-xl" onClick={() => setAvailableRides(null)}>
                        Search Again
                      </Button>
                    </div>
                  ) : (
                    availableRides.map((ride: any, i: number) => {
                      // 🔥 VEHICLE TYPE LOGIC
                      const vType = ride.vehicleType?.toLowerCase() || "car";
                      const vIcon = vType === "bike" ? "🏍️" : vType === "auto" ? "🛺" : "🚗";
                      const vLabel = vType === "bike" ? "Bike" : vType === "auto" ? "Auto" : "Car";

                      return (
                        <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 hover:border-primary/40 hover:shadow-md transition-all">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-900 text-white font-black text-sm">
                                {ride.driver?.fullName?.[0]?.toUpperCase() || "D"}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-bold text-sm text-slate-800">{ride.driver?.fullName || "Verified Driver"}</p>
                                  {/* 🔥 VEHICLE TYPE BADGE */}
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 uppercase bg-slate-100 text-slate-600 border border-slate-200">
                                    {vIcon} {vLabel}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-1 text-xs text-amber-500 font-semibold mt-0.5">
                                  <Star className="h-3 w-3 fill-current" /> 4.8
                                  {ride.driver?.vehicleNumber && (
                                    <span className="ml-1 font-normal text-slate-400">· {ride.driver.vehicleNumber}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xl font-extrabold text-primary">₹{fare}</p>
                              <p className="text-[10px] font-bold text-emerald-600 uppercase">
                                {ride.availableSeats} left
                              </p>
                            </div>
                          </div>

                          <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 mb-3 space-y-1.5">
                            <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                              <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                              Matches your pickup
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                              <div className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
                              Matches your drop-off
                            </div>
                          </div>

                          <Button
                            onClick={() => handleSendRideRequest(ride.id)}
                            disabled={isBooking}
                            className="w-full rounded-xl font-bold h-10 text-sm"
                          >
                            {isBooking
                              ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Requesting…</>
                              : <><CheckCircle2 className="mr-2 h-3.5 w-3.5" /> Send Ride Request</>}
                          </Button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT PANEL: MAP ──────────────────────────────────── */}
          <div className="lg:col-span-2 flex flex-col gap-3">
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Click map to set:
              </span>
              <div className="flex gap-2">
                {(["pickup", "drop"] as const).map((t) => (
                  <button
                    key={t}
                    disabled={hasActiveRide}
                    onClick={() => setActiveClickTarget(t)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                      activeClickTarget === t
                        ? "bg-neutral-900 text-white shadow-sm"
                        : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${t === "pickup" ? "bg-emerald-400" : "bg-red-400"}`} />
                    {t === "pickup" ? "Pickup" : "Drop"}
                  </button>
                ))}
              </div>
            </div>

            {routePaths.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <StatPill icon={<Route className="h-4 w-4" />}  label="Distance" value={`${distance} km`} />
                <StatPill icon={<Clock className="h-4 w-4" />}  label="Est. time" value={`${duration} min`} />
                <StatPill icon={<Car className="h-4 w-4" />}    label="Est. fare" value={`₹${fare}`} />
              </div>
            )}

            <div className="relative overflow-hidden rounded-2xl border border-slate-200 shadow-md" style={{ height: 520 }}>
              {hasActiveRide && (
                <div className="absolute inset-0 z-[999] bg-white/40 backdrop-blur-[2px]" />
              )}
              <MapContainer
                center={pickupCoords} zoom={13} scrollWheelZoom
                style={{ height: "100%", width: "100%", zIndex: 0 }}
              >
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                  attribution="&copy; CartoDB"
                />
                <Marker position={pickupCoords} icon={pickupIcon} draggable={!hasActiveRide}
                        eventHandlers={{ dragend: (e) => handleMarkerDrag(e, "pickup") }}>
                  <Popup className="font-semibold">Pickup location</Popup>
                </Marker>
                <Marker position={dropCoords} icon={dropIcon} draggable={!hasActiveRide}
                        eventHandlers={{ dragend: (e) => handleMarkerDrag(e, "drop") }}>
                  <Popup className="font-semibold">Drop location</Popup>
                </Marker>
                {routePaths.length > 0 && (
                  <Polyline positions={routePaths} color="#2563eb" weight={5} opacity={0.85} lineCap="round" lineJoin="round" />
                )}
                <MapController coords={[pickupCoords, dropCoords]} />
                {!hasActiveRide && <MapClickHandler onMapClick={handleMapClick} />}
              </MapContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}