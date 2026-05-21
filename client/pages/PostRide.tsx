import { z } from "zod";
import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { MapPin, Navigation, ShieldCheck, IndianRupee, Clock, XCircle, Loader2, Locate } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";

// --- MAP ICONS ---
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

// Map Auto-Center Controller
function MapController({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length > 0 && coords[0][0] !== 0) {
      const bounds = L.latLngBounds(coords);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [coords, map]);
  return null;
}

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

const schema = z.object({
  from: z.string().min(2, "Enter pickup location"),
  to: z.string().min(2, "Enter drop location"),
  time: z.string().min(1, "Select date & time"),
  seats: z.string().min(1),
  vehicle: z.enum(["car", "bike", "auto"]),
});

type FormValues = z.infer<typeof schema>;

export default function PostRide() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [auth, setAuth] = useState<any>(null);

  const [pickupCoords, setPickupCoords] = useState<[number, number]>([22.7243, 75.8839]);
  const [dropCoords, setDropCoords] = useState<[number, number]>([22.7533, 75.8937]);

  const [activeClickTarget, setActiveClickTarget] = useState<"pickup" | "drop" | null>(null);

  const [pickupSuggestions, setPickupSuggestions] = useState<any[]>([]);
  const [dropSuggestions, setDropSuggestions] = useState<any[]>([]);

  const [loadingRoute, setLoadingRoute] = useState(false);
  const [routePaths, setRoutePaths] = useState<[number, number][]>([]);
  const [distance, setDistance] = useState<string>("0");
  const [isLocating, setIsLocating] = useState(false);

  const [allRoutes, setAllRoutes] = useState<any[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState<number>(0);

  const searchTimeout = useRef<any>(null);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      from: "Locating...",
      to: "Vijay Nagar, Indore",
      time: "",
      seats: "4",
      vehicle: "car",
    },
  });

  const pickupInput = watch("from");
  const dropInput = watch("to");
  const seatsValue = watch("seats");
  const vehicleValue = watch("vehicle");

  useEffect(() => {
    const authData = JSON.parse(localStorage.getItem("ridelink:auth") || "null");
    setAuth(authData);
  }, []);

  const updateAddressFromCoords = async (lat: number, lng: number, type: "pickup" | "drop") => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      const data = await response.json();
      let addressName = data.name || (data.address && (data.address.amenity || data.address.road || data.address.suburb)) || data.display_name.split(",")[0];
      const cleanAddress = addressName.replace(/,?\s*Indore/i, "").trim();
      const finalAddress = cleanAddress ? `${cleanAddress}, Indore` : "Selected from Map";

      if (type === "pickup") {
        setValue("from", finalAddress);
      } else {
        setValue("to", finalAddress);
      }
    } catch (error) {
      console.log("Reverse geocode issue:", error);
    }
  };

  useEffect(() => {
    if (navigator.geolocation) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setPickupCoords([lat, lng]);
          await updateAddressFromCoords(lat, lng, "pickup");
          setIsLocating(false);
          toast.success("Live location detected! 📍");
        },
        (error) => {
          console.error("Auto GPS fetch failed", error);
          setValue("from", "Palasia, Indore");
          setIsLocating(false);
        },
        { enableHighAccuracy: true }
      );
    } else {
      setValue("from", "Palasia, Indore");
    }
  }, []);

  const handleUseCurrentLocation = (type: "pickup" | "drop") => {
    if (!navigator.geolocation) {
      toast.error("Bhai, aapka browser Geolocation support nahi karta.");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const coords: [number, number] = [lat, lng];

        if (type === "pickup") {
          setPickupCoords(coords);
        } else {
          setDropCoords(coords);
        }

        await updateAddressFromCoords(lat, lng, type);
        toast.success(`Live location set for ${type}! 📍`);
        setIsLocating(false);
      },
      (error) => {
        console.error(error);
        toast.error("Location access nahi mila. Location permission check karein.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleMapClickSelection = async (lat: number, lng: number) => {
    if (!activeClickTarget) return;

    const coords: [number, number] = [lat, lng];
    if (activeClickTarget === "pickup") {
      setPickupCoords(coords);
      await updateAddressFromCoords(lat, lng, "pickup");
      setActiveClickTarget("drop");
    } else if (activeClickTarget === "drop") {
      setDropCoords(coords);
      await updateAddressFromCoords(lat, lng, "drop");
      setActiveClickTarget(null);
    }
  };

  const handleSearch = (query: string, type: "pickup" | "drop") => {
    if (type === "pickup") setValue("from", query);
    else setValue("to", query);

    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (query.length < 3) {
      if (type === "pickup") setPickupSuggestions([]);
      else setDropSuggestions([]);
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      try {
        const searchQuery = query.toLowerCase().includes("indore") ? query : `${query}, Indore`;
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5`);
        const data = await response.json();
        if (type === "pickup") setPickupSuggestions(data);
        else setDropSuggestions(data);
      } catch (error) {
        console.log("Search fail:", error);
      }
    }, 800);
  };

  const handleSelectSuggestion = (place: any, type: "pickup" | "drop") => {
    const coords: [number, number] = [parseFloat(place.lat), parseFloat(place.lon)];
    const shortName = place.display_name.split(",")[0] + ", Indore";
    if (type === "pickup") {
      setPickupCoords(coords);
      setValue("from", shortName);
      setPickupSuggestions([]);
    } else {
      setDropCoords(coords);
      setValue("to", shortName);
      setDropSuggestions([]);
    }
  };

  const handleMarkerDrag = async (e: any, type: "pickup" | "drop") => {
    const marker = e.target;
    const position = marker.getLatLng();
    await updateAddressFromCoords(position.lat, position.lng, type);
    if (type === "pickup") setPickupCoords([position.lat, position.lng]);
    else setDropCoords([position.lat, position.lng]);
  };

  useEffect(() => {
    const fetchRoute = async () => {
      setLoadingRoute(true);
      try {
        const osrmProfile = vehicleValue === "bike" ? "bicycle" : "driving";
        const response = await fetch(`https://router.project-osrm.org/route/v1/${osrmProfile}/${pickupCoords[1]},${pickupCoords[0]};${dropCoords[1]},${dropCoords[0]}?overview=full&geometries=geojson&alternatives=true`);
        const data = await response.json();

        if (data.routes && data.routes.length > 0) {
          setAllRoutes(data.routes);
          setSelectedRouteIndex(0);

          const primaryRoute = data.routes[0];
          const coordinates = primaryRoute.geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]]);
          setRoutePaths(coordinates);
          setDistance((primaryRoute.distance / 1000).toFixed(1));
        }
      } catch (error) {
        console.log("Routing error:", error);
      } finally {
        setLoadingRoute(false);
      }
    };
    fetchRoute();
  }, [pickupCoords, dropCoords, vehicleValue]);

  if (auth) {
    const currentRole = String(auth.role || "").toUpperCase();
    const isRider = currentRole.includes("RIDER") || currentRole.includes("DRIVER");

    if (isRider && auth.kycStatus !== "APPROVED") {
      return (
        <section className="mx-auto max-w-3xl px-4 py-20 text-center">
          <Card className="border-dashed border-2">
            <CardContent className="pt-10 pb-10 flex flex-col items-center">
              {auth.kycStatus === "REJECTED" ? (
                <>
                  <XCircle className="h-16 w-16 text-destructive mb-4" />
                  <h2 className="text-2xl font-bold">KYC Rejected</h2>
                  <p className="text-muted-foreground mt-2 max-w-md">Your documents were rejected. Please update your profile.</p>
                </>
              ) : (
                <>
                  <Clock className="h-16 w-16 text-yellow-500 mb-4 animate-pulse" />
                  <h2 className="text-2xl font-bold">Verification Pending</h2>
                  <p className="text-muted-foreground mt-2 max-w-md">Aapka KYC verification abhi process mein hai. Admin ki approval ke baad hi aap ride post kar payenge.</p>
                </>
              )}
              <div className="mt-6 flex gap-3">
                <Button variant="outline" asChild><Link to="/">Home</Link></Button>
                <Button asChild><Link to="/account">Check Profile</Link></Button>
              </div>
            </CardContent>
          </Card>
        </section>
      );
    }
  }

  const onSubmit = async (data: FormValues) => {
    if (!auth?.token) {
      toast.error("You must be logged in!");
      navigate("/login");
      return;
    }

    try {
      setIsSubmitting(true);

      const payload = {
        sourceName: data.from,
        sourceLatitude: pickupCoords[0],
        sourceLongitude: pickupCoords[1],
        destinationName: data.to,
        destinationLatitude: dropCoords[0],
        destinationLongitude: dropCoords[1],
        departureTime: data.time + ":00",
        pricePerSeat: 0,
        totalSeats: parseInt(data.seats),
        vehicleType: data.vehicle
      };

      const response = await fetch(`http://localhost:9090/api/rides/create?driverId=${auth.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${auth.token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error("Server error while creating ride");

      toast.success("Ride posted successfully! 🎉");
      navigate("/driver-dashboard");

    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight">Post a Ride</h1>
        <p className="text-muted-foreground mt-1">Set your route and let passengers join your journey.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">

        {/* LEFT COMPONENT: FORM */}
        <div className="lg:col-span-1">
          <Card className="shadow-lg border-primary/10 relative z-50">
            <CardHeader className="bg-slate-50/50 border-b pb-4">
              <CardTitle className="text-lg">Ride Details</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

                {/* Pickup node */}
                <div className="relative">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-sm font-bold text-slate-700">From</label>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      onClick={() => handleUseCurrentLocation("pickup")}
                      className="text-xs font-semibold h-auto p-0 flex items-center gap-1 text-emerald-600"
                    >
                      <Locate className="h-3 w-3" /> Use Live
                    </Button>
                  </div>
                  <div className="relative">
                    <Input
                      value={pickupInput}
                      {...register("from", {
                        onChange: (e) => handleSearch(e.target.value, "pickup")
                      })}
                      onClick={() => setActiveClickTarget("pickup")}
                      placeholder="Pickup location"
                      className={`pl-9 font-medium cursor-pointer transition-all ${activeClickTarget === "pickup" ? "ring-2 ring-emerald-500 border-emerald-500" : ""}`}
                      readOnly={isLocating}
                    />
                    {isLocating ? (
                      <Loader2 className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 animate-spin" />
                    ) : (
                      <MapPin className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                    )}
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
                  {errors.from && <p className="mt-1 text-xs text-red-600">{errors.from.message}</p>}
                </div>

                {/* Drop node */}
                <div className="relative">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-sm font-bold text-slate-700">To</label>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      onClick={() => handleUseCurrentLocation("drop")}
                      className="text-xs font-semibold h-auto p-0 flex items-center gap-1 text-red-500"
                    >
                      <Locate className="h-3 w-3" /> Use Live
                    </Button>
                  </div>
                  <div className="relative">
                    <Input
                      value={dropInput}
                      {...register("to", {
                        onChange: (e) => handleSearch(e.target.value, "drop")
                      })}
                      onClick={() => setActiveClickTarget("drop")}
                      placeholder="Drop location"
                      className={`pl-9 font-medium cursor-pointer transition-all ${activeClickTarget === "drop" ? "ring-2 ring-red-500 border-red-500" : ""}`}
                    />
                    <Navigation className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500" />
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
                  {errors.to && <p className="mt-1 text-xs text-red-600">{errors.to.message}</p>}
                </div>

                <div className="border-t pt-4">
                  <label className="mb-1 block text-sm font-bold text-slate-700">Date & time</label>
                  <Input type="datetime-local" {...register("time")} className="font-medium" />
                  {errors.time && <p className="mt-1 text-xs text-red-600">{errors.time.message}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-bold text-slate-700">Seats</label>
                    <Select value={seatsValue} onValueChange={(v) => setValue("seats", v)}>
                      <SelectTrigger><SelectValue placeholder="4" /></SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6].map(num => (
                          <SelectItem key={num} value={num.toString()}>{num}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-bold text-slate-700">Vehicle type</label>
                    <Select value={vehicleValue} onValueChange={(v: any) => setValue("vehicle", v)}>
                      <SelectTrigger><SelectValue placeholder="car" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="car">Car</SelectItem>
                        <SelectItem value="bike">Bike</SelectItem>
                        <SelectItem value="auto">Auto / EV</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {allRoutes.length > 0 && (
                  <div className="p-3 bg-primary/5 rounded-lg border border-primary/20 flex flex-col gap-1 text-sm mt-4">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-slate-600">Selected Route Distance</span>
                      <span className="font-bold text-primary">{distance} km</span>
                    </div>
                    {allRoutes.length > 1 && (
                      <p className="text-[10px] text-slate-500 font-medium mt-1">
                        *Multiple routes found. Click on the grey lines on the map to switch routes.
                      </p>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 text-xs text-slate-500 mt-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" /> Dynamic Pricing applies. Fares are calculated automatically.
                </div>

                <Button type="submit" className="w-full h-11 font-bold text-base text-white mt-2" disabled={isSubmitting || loadingRoute || isLocating}>
                  {isSubmitting ? <><Loader2 className="mr-2 h-5 w-5 animate-spin text-white" /> Publishing...</> : "Publish Ride"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COMPONENT: MAP */}
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
              >
                🟢 Update From (Start)
              </Button>
              <Button
                type="button"
                size="sm"
                variant={activeClickTarget === "drop" ? "default" : "outline"}
                onClick={() => setActiveClickTarget("drop")}
                className="h-7 text-[11px]"
              >
                🔴 Update To (Destination)
              </Button>
            </div>
          </div>

          <Card className="overflow-hidden shadow-xl border-primary/20 h-[550px] relative">
            {(loadingRoute || isLocating) && (
              <div className="absolute top-4 right-4 bg-white px-3 py-1.5 rounded-full shadow-md z-[1000] flex items-center gap-2 text-sm font-bold text-slate-700 animate-fade-in">
                <Loader2 className="h-4 w-4 text-primary animate-spin" />
                {isLocating ? "Fetching Live GPS..." : "Calculating Routes..."}
              </div>
            )}
            <MapContainer center={pickupCoords} zoom={13} scrollWheelZoom={true} style={{ height: "100%", width: "100%", zIndex: 0 }}>
              <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" attribution='&copy; CartoDB'/>

              <Marker position={pickupCoords} icon={pickupIcon} draggable={true} eventHandlers={{ dragend: (e) => handleMarkerDrag(e, "pickup") }}>
                <Popup className="font-bold">Start Location</Popup>
              </Marker>

              <Marker position={dropCoords} icon={dropIcon} draggable={true} eventHandlers={{ dragend: (e) => handleMarkerDrag(e, "drop") }}>
                <Popup className="font-bold">Destination</Popup>
              </Marker>

              {/* 🔥 FIX: key ko update kiya selectedRouteIndex ke sath taaki color Blue ho jaye 🔥 */}
              {allRoutes.map((route, idx) => {
                const coords = route.geometry.coordinates.map((c: number[]) => [c[1], c[0]]);
                const isSelected = idx === selectedRouteIndex;

                return (
                  <Polyline
                    key={`route-${idx}-${selectedRouteIndex === idx ? 'active' : 'inactive'}`}
                    positions={coords}
                    color={isSelected ? "#2563eb" : "#94a3b8"}
                    weight={isSelected ? 6 : 4}
                    opacity={isSelected ? 0.9 : 0.6}
                    eventHandlers={{
                      click: (e) => {
                        L.DomEvent.stopPropagation(e.originalEvent);

                        setSelectedRouteIndex(idx);
                        setRoutePaths(coords);
                        setDistance((route.distance / 1000).toFixed(1));
                        toast.info(`Alternative Route Selected! Distance: ${(route.distance / 1000).toFixed(1)} km`);
                      }
                    }}
                  />
                );
              })}

              <MapController coords={[pickupCoords, dropCoords]} />
              <MapClickHandler onMapClick={handleMapClickSelection} />
            </MapContainer>
          </Card>
        </div>

      </div>
    </section>
  );
}