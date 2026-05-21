import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation, Car, Clock, CreditCard, Loader2, ArrowLeft, User, Star, Map as MapIcon } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { toast } from "sonner";

// map ke marker fix kar rahe hai taki badhiya se render ho ske
const pickupIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const dropIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

// location badalne par map automatically auto-center ya fit ho jaye uske liye controller
function MapController({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length > 0) {
      const bounds = L.latLngBounds(coords);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [coords, map]);
  return null;
}

// Map Click Handler
function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function BookRide() {
  const navigate = useNavigate();

  const [hasActiveRide, setHasActiveRide] = useState(false);
  const [checkingActive, setCheckingActive] = useState(true);

  // initial setup indore ke coordinates se shuru kiya hai
  const [pickupCoords, setPickupCoords] = useState<[number, number]>([22.7243, 75.8839]);
  const [dropCoords, setDropCoords] = useState<[number, number]>([22.7533, 75.8937]);
  const [pickupInput, setPickupInput] = useState("Palasia, Indore");
  const [dropInput, setDropInput] = useState("Vijay Nagar, Indore");

  const [activeClickTarget, setActiveClickTarget] = useState<"pickup" | "drop">("pickup");

  const [pickupSuggestions, setPickupSuggestions] = useState<any[]>([]);
  const [dropSuggestions, setDropSuggestions] = useState<any[]>([]);

  const [loadingRoute, setLoadingRoute] = useState(false);
  const [routePaths, setRoutePaths] = useState<[number, number][]>([]);
  const [distance, setDistance] = useState<string>("0");
  const [duration, setDuration] = useState<string>("0");

  const [isSearchingRides, setIsSearchingRides] = useState(false);
  const [availableRides, setAvailableRides] = useState<any[] | null>(null);

  const searchTimeout = useRef<any>(null);

  useEffect(() => {
    const checkActiveRides = async () => {
      const authData = localStorage.getItem("ridelink:auth");
      if (!authData) { setCheckingActive(false); return; }
      const authObj = JSON.parse(authData);
      const passengerId = authObj.id || authObj.userId;
      if (!passengerId) { setCheckingActive(false); return; }

      try {
        const res = await fetch(`http://localhost:9090/api/bookings/passenger/${passengerId}`, {
          headers: { "Authorization": `Bearer ${authObj.token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const arr = data.content || data.data || data;
          const active = arr.some((b: any) => ["PENDING", "CONFIRMED", "ACCEPTED"].includes(b.status?.toUpperCase()));
          setHasActiveRide(active);
        }
      } catch (e) {
        console.error("Check active rides error", e);
      } finally {
        setCheckingActive(false);
      }
    };
    checkActiveRides();
  }, []);

  const handleSearch = (query: string, type: "pickup" | "drop") => {
    if (type === "pickup") setPickupInput(query);
    else setDropInput(query);

    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (query.length < 3) {
      if (type === "pickup") setPickupSuggestions([]);
      else setDropSuggestions([]);
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      try {
        const searchQuery = query.toLowerCase().includes("indore") ? query : `${query}, Indore`;
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5`
        );
        const data = await response.json();
        if (type === "pickup") setPickupSuggestions(data);
        else setDropSuggestions(data);
      } catch (error) {
        console.log("Nominatim fetch loop fail:", error);
      }
    }, 800);
  };

  const handleSelectSuggestion = (place: any, type: "pickup" | "drop") => {
    const coords: [number, number] = [parseFloat(place.lat), parseFloat(place.lon)];
    const shortName = place.display_name.split(",")[0] + ", Indore";
    if (type === "pickup") {
      setPickupCoords(coords);
      setPickupInput(shortName);
      setPickupSuggestions([]);
    } else {
      setDropCoords(coords);
      setDropInput(shortName);
      setDropSuggestions([]);
    }
  };

  const updateAddressFromCoords = async (lat: number, lng: number, type: "pickup" | "drop") => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
      );
      const data = await response.json();

      let addressName = "";
      if (data.name) addressName = data.name;
      else if (data.address) {
        addressName = data.address.amenity || data.address.road || data.address.neighbourhood || data.address.residential || data.address.suburb || data.address.village;
      }
      if (!addressName && data.display_name) addressName = data.display_name.split(",")[0];

      const cleanAddress = addressName.replace(/,?\s*Indore/i, "").trim();
      const finalAddress = cleanAddress ? `${cleanAddress}, Indore` : "Selected from Map";

      if (type === "pickup") setPickupInput(finalAddress);
      else setDropInput(finalAddress);
    } catch (error) {
      console.log("Map pinpoint extraction issue:", error);
    }
  };

  const handleMarkerDrag = async (e: any, type: "pickup" | "drop") => {
    const marker = e.target;
    const position = marker.getLatLng();
    const coords: [number, number] = [position.lat, position.lng];

    if (type === "pickup") setPickupCoords(coords);
    else setDropCoords(coords);

    await updateAddressFromCoords(position.lat, position.lng, type);
  };

  const handleMapClickSelection = async (lat: number, lng: number) => {
    const coords: [number, number] = [lat, lng];
    if (activeClickTarget === "pickup") {
      setPickupCoords(coords);
      await updateAddressFromCoords(lat, lng, "pickup");
      setActiveClickTarget("drop");
    } else {
      setDropCoords(coords);
      await updateAddressFromCoords(lat, lng, "drop");
    }
  };

  useEffect(() => {
    const fetchRoute = async () => {
      setLoadingRoute(true);
      try {
        const response = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${pickupCoords[1]},${pickupCoords[0]};${dropCoords[1]},${dropCoords[0]}?overview=full&geometries=geojson`
        );
        const data = await response.json();
        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const coordinates = route.geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]]);
          setRoutePaths(coordinates);
          setDistance((route.distance / 1000).toFixed(1));
          setDuration(Math.round(route.duration / 60).toString());
        }
      } catch (error) {
        console.log("Routing maps line rendering error:", error);
      } finally {
        setLoadingRoute(false);
      }
    };
    fetchRoute();
  }, [pickupCoords, dropCoords]);


  const handleFindCarpools = async () => {
    setIsSearchingRides(true);
    try {
      const authData = localStorage.getItem("ridelink:auth");

      if (!authData || authData === "null") {
        toast.error("Bhai pehle login toh kar lo!");
        setIsSearchingRides(false);
        return;
      }

      const authObj = JSON.parse(authData);
      const token = authObj?.token;

      if (!token) {
        toast.error("Auth token nahi mila. Kripya wapas login karein.");
        setIsSearchingRides(false);
        return;
      }

      const payload = {
        pickupLat: pickupCoords[0],
        pickupLng: pickupCoords[1],
        dropLat: dropCoords[0],
        dropLng: dropCoords[1],
        seats: 1
      };

      const response = await fetch("http://localhost:9090/api/rides/search-instant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        setAvailableRides(data);
      } else if (response.status === 403) {
        toast.error("Spring Security validation failed (403 Forbidden). Token check karo.");
      } else {
        toast.error("Server connection bad response. Route correct nahi mila.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Spring Boot app connect nahi ho pa rha. Kya server up hai?");
    } finally {
      setIsSearchingRides(false);
    }
  };

  const [isBooking, setIsBooking] = useState(false);

  const handleSendRideRequest = async (rideId: number) => {
    setIsBooking(true);
    try {
      const authData = localStorage.getItem("ridelink:auth");
      if (!authData || authData === "null") {
        toast.error("Bhai pehle login toh kar lo!");
        setIsBooking(false);
        return;
      }

      const authObj = JSON.parse(authData);
      const token = authObj?.token;
      const passengerId = authObj?.id || authObj?.userId;

      const calculatedFare = Math.round(parseFloat(distance) * 8);
      const finalFare = calculatedFare < 30 ? 30 : calculatedFare;

      // 🔥 UPDATE: fare ki jagah "price" kar diya backend ke hisaab se 🔥
      const bookingPayload = {
        rideId: rideId,
        passengerId: passengerId,
        seatsBooked: 1,
        pickupLat: pickupCoords[0],
        pickupLng: pickupCoords[1],
        dropLat: dropCoords[0],
        dropLng: dropCoords[1],
        price: finalFare
      };

      const response = await fetch("http://localhost:9090/api/bookings/book", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(bookingPayload),
      });

      if (response.ok) {
        toast.success("Ride requested! Waiting for driver approval. 🚗");
        navigate("/passenger-dashboard");
      } else {
        toast.error("Booking fail ho gayi. Gaadi me shayad seats full hain!");
      }
    } catch (error) {
      console.error(error);
      toast.error("Server connection fail ho gaya.");
    } finally {
      setIsBooking(false);
    }
  };

  if (checkingActive) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-10 w-10 text-primary animate-spin" /></div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
          <Car className="h-8 w-8 text-primary" /> Book Your Ride
        </h1>
        <p className="text-muted-foreground mt-1">
          {hasActiveRide ? "You already have an active ride." : availableRides !== null
            ? "Select a carpool that matches your route."
            : "Search places or click anywhere on the map to set location!"}
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">

          {hasActiveRide ? (
            <Card className="shadow-lg border-amber-500/30 relative z-50 overflow-hidden bg-amber-50">
              <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
              <CardContent className="flex flex-col items-center justify-center p-8 text-center space-y-4">
                <div className="h-16 w-16 bg-amber-100 rounded-full flex items-center justify-center">
                  <Car className="h-8 w-8 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800">You have an active ride!</h3>
                  <p className="text-sm text-slate-500 mt-2">You cannot book a new ride until your current trip is completed or cancelled.</p>
                </div>
                <Button onClick={() => navigate('/passenger-dashboard')} className="w-full mt-4 font-bold shadow-sm">
                  <MapPin className="h-4 w-4 mr-2"/> Go to My Rides
                </Button>
              </CardContent>
            </Card>
          ) : availableRides === null ? (
            <Card className="shadow-lg border-primary/10 relative z-50">
              <CardHeader className="bg-slate-50/50 border-b pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Navigation className="h-5 w-5 text-primary" /> Where are you going?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">

                <div className="relative">
                  <div className="flex justify-between items-end mb-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Pickup Location</label>
                  </div>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-green-500" />
                    <Input
                      value={pickupInput}
                      onChange={(e) => handleSearch(e.target.value, "pickup")}
                      className="pl-10 font-medium"
                      placeholder="Search pickup..."
                    />
                  </div>
                  {pickupSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 mt-1 bg-white border rounded-md shadow-2xl z-50 max-h-48 overflow-y-auto">
                      {pickupSuggestions.map((place, idx) => (
                        <div key={idx} onClick={() => handleSelectSuggestion(place, "pickup")} className="p-3 text-sm font-medium hover:bg-slate-100 cursor-pointer border-b last:border-0 truncate">
                          {place.display_name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="relative">
                  <div className="flex justify-between items-end mb-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Drop Location</label>
                  </div>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-red-500" />
                    <Input
                      value={dropInput}
                      onChange={(e) => handleSearch(e.target.value, "drop")}
                      className="pl-10 font-medium"
                      placeholder="Search drop..."
                    />
                  </div>
                  {dropSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 mt-1 bg-white border rounded-md shadow-2xl z-50 max-h-48 overflow-y-auto">
                      {dropSuggestions.map((place, idx) => (
                        <div key={idx} onClick={() => handleSelectSuggestion(place, "drop")} className="p-3 text-sm font-medium hover:bg-slate-100 cursor-pointer border-b last:border-0 truncate">
                          {place.display_name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {routePaths.length > 0 && (
                  <div className="mt-6 p-4 bg-primary/5 rounded-xl border border-primary/20 space-y-3 relative overflow-hidden">
                    {loadingRoute && (
                      <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-10">
                        <Loader2 className="h-6 w-6 text-primary animate-spin" />
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium flex items-center gap-2"><Navigation className="h-4 w-4 text-slate-500"/> Route Length</span>
                      <span className="font-bold">{distance} km</span>
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleFindCarpools}
                  disabled={loadingRoute || isSearchingRides}
                  className="w-full mt-4 text-lg py-6 shadow-md transition-all active:scale-95"
                  size="lg"
                >
                  {isSearchingRides ? (
                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Searching Network...</>
                  ) : (
                    "Find Carpools"
                  )}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-lg border-primary/20 flex flex-col h-[600px]">
              <CardHeader className="bg-slate-50 border-b py-4">
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="icon" onClick={() => setAvailableRides(null)} className="h-8 w-8 rounded-full">
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div>
                    <CardTitle className="text-lg">Matched Rides</CardTitle>
                    <p className="text-xs text-muted-foreground font-medium mt-0.5">
                      {availableRides.length} drivers found on your route
                    </p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0 flex-1 overflow-y-auto bg-slate-50/50">
                {availableRides.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-4">
                    <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center">
                      <Car className="h-8 w-8 text-slate-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-slate-700">No Rides Found</h3>
                      <p className="text-sm text-slate-500 mt-1">Right now koi bhi active driver is line radius me nahi mil rha h. Bad me try krein.</p>
                    </div>
                    <Button variant="outline" onClick={() => setAvailableRides(null)}>Search Again</Button>
                  </div>
                ) : (
                  <div className="p-4 space-y-4">
                    {availableRides.map((ride: any, index: number) => {
                      const calculatedFare = Math.round(parseFloat(distance) * 8);
                      const finalFare = calculatedFare < 30 ? 30 : calculatedFare;

                      return (
                        <div key={index} className="bg-white border rounded-xl p-4 shadow-sm hover:border-primary/50 transition-colors">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                                {ride.driver?.fullName?.[0] || 'D'}
                              </div>
                              <div>
                                <p className="font-bold text-sm">{ride.driver?.fullName || "Eco Rider"}</p>
                                <div className="flex items-center gap-1 text-xs text-amber-500 font-semibold">
                                  <Star className="h-3 w-3 fill-current" /> 4.8
                                  <span className="text-slate-400 font-normal ml-1">• {ride.driver?.vehicleNumber || "Verified Driver"}</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-extrabold text-primary">₹{finalFare}</p>
                              <p className="text-[10px] font-bold text-emerald-600 uppercase">
                                {ride.availableSeats} Seats Left
                              </p>
                            </div>
                          </div>

                          <div className="bg-slate-50 p-2 rounded-md border text-xs space-y-2 mb-4">
                            <div className="flex items-start gap-2">
                              <MapPin className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                              <p className="text-slate-600 font-medium">Matches your pickup location</p>
                            </div>
                            <div className="flex items-start gap-2">
                              <Navigation className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                              <p className="text-slate-600 font-medium">Matches your drop-off location</p>
                            </div>
                          </div>

                          <Button
                            onClick={() => handleSendRideRequest(ride.id)}
                            disabled={isBooking}
                            className="w-full font-bold shadow-sm"
                          >
                            {isBooking ? (
                              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Requesting...</>
                            ) : (
                              "Send Ride Request"
                            )}
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

        </div>

        <div className="lg:col-span-2 relative z-0 flex flex-col gap-3">
          <div className="bg-slate-100 p-2 rounded-lg border border-slate-200 flex items-center justify-between text-xs font-bold shadow-sm">
            <span className="text-slate-600 uppercase tracking-wide">Map Click Target:</span>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={activeClickTarget === "pickup" ? "default" : "outline"}
                onClick={() => setActiveClickTarget("pickup")}
                className="h-7 text-[11px]"
                disabled={hasActiveRide}
              >
                🟢 Set Pickup
              </Button>
              <Button
                type="button"
                size="sm"
                variant={activeClickTarget === "drop" ? "default" : "outline"}
                onClick={() => setActiveClickTarget("drop")}
                className="h-7 text-[11px]"
                disabled={hasActiveRide}
              >
                🔴 Set Drop
              </Button>
            </div>
          </div>

          <Card className="overflow-hidden shadow-xl border-primary/20 h-[550px] relative">
            {hasActiveRide && (
              <div className="absolute inset-0 bg-white/40 z-[999] backdrop-blur-[1px] flex items-center justify-center">
              </div>
            )}

            <MapContainer center={pickupCoords} zoom={13} scrollWheelZoom={true} style={{ height: "100%", width: "100%", zIndex: 0 }}>
              <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" attribution='&copy; CartoDB'/>

              <Marker position={pickupCoords} icon={pickupIcon} draggable={!hasActiveRide} eventHandlers={{ dragend: (e) => handleMarkerDrag(e, "pickup") }}>
                <Popup className="font-bold">Green marker pickup location h.</Popup>
              </Marker>

              <Marker position={dropCoords} icon={dropIcon} draggable={!hasActiveRide} eventHandlers={{ dragend: (e) => handleMarkerDrag(e, "drop") }}>
                <Popup className="font-bold">Red marker drop location h.</Popup>
              </Marker>

              {routePaths.length > 0 && (
                <Polyline positions={routePaths} color="#2563eb" weight={6} opacity={0.8} lineCap="round" lineJoin="round" />
              )}

              <MapController coords={[pickupCoords, dropCoords]} />

              {!hasActiveRide && <MapClickHandler onMapClick={handleMapClickSelection} />}
            </MapContainer>
          </Card>
        </div>
      </div>
    </div>
  );
}