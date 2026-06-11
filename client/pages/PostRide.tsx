import { z } from "zod";
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  MapPin, Navigation, ShieldCheck, Clock, XCircle,
  Loader2, Locate, Car, Bike, CheckCircle2, Route,
  ChevronRight, Users, Calendar, AlertCircle, Zap
} from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";

// ─── Map Icons ────────────────────────────────────────────────────────────────
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

// ─── Map Helpers ──────────────────────────────────────────────────────────────
function MapController({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length > 0 && coords[0][0] !== 0) {
      map.fitBounds(L.latLngBounds(coords), { padding: [60, 60], maxZoom: 15 });
    }
  }, [coords, map]);
  return null;
}

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onMapClick(e.latlng.lat, e.latlng.lng) });
  return null;
}

// ─── Schema ───────────────────────────────────────────────────────────────────
const schema = z.object({
  from:     z.string().min(2, "Enter pickup location"),
  to:       z.string().min(2, "Enter drop location"),
  rideMode: z.enum(["instant", "scheduled"]),
  time:     z.string().optional(),
  seats:    z.string().min(1),
  vehicle:  z.enum(["car", "bike", "auto"]),
}).superRefine((data, ctx) => {
  if (data.rideMode === "scheduled" && !data.time) {
    ctx.addIssue({
      path: ["time"],
      message: "Select date & time for scheduled ride",
      code: z.ZodIssueCode.custom
    });
  }
});
type FormValues = z.infer<typeof schema>;

// ─── Vehicle config ───────────────────────────────────────────────────────────
const VEHICLES = [
  { value: "car",  label: "Car",      icon: "🚗", osrm: "driving" },
  { value: "bike", label: "Bike",     icon: "🏍️", osrm: "bicycle" },
  { value: "auto", label: "Auto/EV",  icon: "🛺", osrm: "driving" },
] as const;

// ─── Suggestion dropdown ──────────────────────────────────────────────────────
function SuggestionList({ items, onSelect }: { items: any[]; onSelect: (p: any) => void }) {
  if (!items.length) return null;
  return (
    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-[9999] max-h-52 overflow-y-auto divide-y divide-slate-50">
      {items.map((place, i) => (
        <button
          key={i} type="button"
          onClick={() => onSelect(place)}
          className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 transition-colors flex items-start gap-2.5"
        >
          <MapPin className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
          <span className="text-slate-700 font-medium leading-snug line-clamp-2">{place.display_name}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function PostRide() {
  const navigate = useNavigate();
  const [isSubmitting,   setIsSubmitting]   = useState(false);
  const [auth,           setAuth]           = useState<any>(null);
  const [pickupCoords,   setPickupCoords]   = useState<[number, number]>([22.7196, 75.8577]);
  const [dropCoords,     setDropCoords]     = useState<[number, number]>([22.7533, 75.8937]);
  const [clickTarget,    setClickTarget]    = useState<"pickup" | "drop" | null>(null);
  const [pickupSugg,     setPickupSugg]     = useState<any[]>([]);
  const [dropSugg,       setDropSugg]       = useState<any[]>([]);
  const [loadingRoute,   setLoadingRoute]   = useState(false);
  const [isLocating,     setIsLocating]     = useState(false);
  const [allRoutes,      setAllRoutes]      = useState<any[]>([]);
  const [selRouteIdx,    setSelRouteIdx]    = useState(0);

  const [distance,       setDistance]       = useState("0");
  const [duration,       setDuration]       = useState("0");
  const [price,          setPrice]          = useState<number>(0);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef     = useRef<HTMLDivElement>(null);

  const {
    register, handleSubmit, setValue, watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { from: "", to: "", time: "", seats: "4", vehicle: "car", rideMode: "instant" },
  });

  const fromVal     = watch("from");
  const toVal       = watch("to");
  const seatsVal    = watch("seats");
  const vehicleVal  = watch("vehicle");
  const rideModeVal = watch("rideMode");

  // ── Auth ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem("ridelink:auth");
      if (raw && raw !== "null") setAuth(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  const calculateFare = useCallback((distKm: number, vehicle: string) => {
    let fare = 0;
    if (vehicle === "car") {
      if (distKm <= 15) fare = distKm * 5;
      else if (distKm <= 50) fare = (15 * 5) + ((distKm - 15) * 2);
      else fare = (15 * 5) + (35 * 2) + ((distKm - 50) * 1.2);
    }
    else if (vehicle === "bike") {
      if (distKm <= 15) fare = distKm * 3;
      else if (distKm <= 50) fare = (15 * 3) + ((distKm - 15) * 1.2);
      else fare = (15 * 3) + (35 * 1.2) + ((distKm - 50) * 0.8);
    }
    else {
      if (distKm <= 15) fare = distKm * 4;
      else if (distKm <= 50) fare = (15 * 4) + ((distKm - 15) * 1.5);
      else fare = (15 * 4) + (35 * 1.5) + ((distKm - 50) * 1);
    }
    const finalFare = Math.round(fare / 10) * 10;
    return finalFare < 30 ? 30 : finalFare;
  }, []);

  const getAvailableSeats = (v: string) => {
    if (v === "bike") return [1];
    if (v === "auto") return [1, 2, 3];
    return [1, 2, 3, 4, 5, 6];
  };
  const availableSeatsArr = getAvailableSeats(vehicleVal);

  useEffect(() => {
    const maxAllowed = Math.max(...availableSeatsArr);
    if (parseInt(seatsVal) > maxAllowed) {
      setValue("seats", String(maxAllowed));
    }
  }, [vehicleVal, seatsVal, availableSeatsArr, setValue]);

  // ── Reverse geocode ──────────────────────────────────────────────────────
  const reverseGeocode = useCallback(async (lat: number, lng: number, type: "pickup" | "drop") => {
    try {
      const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=en`);
      const data = await res.json();
      const rawName = data.name || data.address?.amenity || data.address?.road || data.address?.suburb || data.display_name?.split(",")[0] || "Selected from Map";
      const cityOrState = data.address?.city || data.address?.town || data.address?.state_district || data.address?.state || "";
      const final = cityOrState && !rawName.includes(cityOrState) ? `${rawName}, ${cityOrState}` : rawName;
      setValue(type === "pickup" ? "from" : "to", final, { shouldValidate: true });
    } catch (e) {
      console.error("Reverse geocode failed:", e);
    }
  }, [setValue]);

  useEffect(() => {
    if (!navigator.geolocation) { setValue("from", "Fetching failed..."); return; }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        setPickupCoords([coords.latitude, coords.longitude]);
        await reverseGeocode(coords.latitude, coords.longitude, "pickup");
        setIsLocating(false);
        toast.success("Live location detected!");
      },
      () => { setValue("from", ""); setIsLocating(false); },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [reverseGeocode, setValue]);

  const handleUseCurrentLocation = useCallback((type: "pickup" | "drop") => {
    if (!navigator.geolocation) { toast.error("Geolocation not supported by your browser."); return; }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const c: [number, number] = [coords.latitude, coords.longitude];
        type === "pickup" ? setPickupCoords(c) : setDropCoords(c);
        await reverseGeocode(coords.latitude, coords.longitude, type);
        toast.success(`Live location set for ${type}.`);
        setIsLocating(false);
      },
      () => { toast.error("Location access denied. Please check browser permissions."); setIsLocating(false); },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [reverseGeocode]);

  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    if (!clickTarget) return;
    const coords: [number, number] = [lat, lng];
    if (clickTarget === "pickup") {
      setPickupCoords(coords);
      await reverseGeocode(lat, lng, "pickup");
      setClickTarget("drop");
    } else {
      setDropCoords(coords);
      await reverseGeocode(lat, lng, "drop");
      setClickTarget(null);
    }
  }, [clickTarget, reverseGeocode]);

  const handleSearch = useCallback((query: string, type: "pickup" | "drop") => {
    setValue(type === "pickup" ? "from" : "to", query, { shouldValidate: false });
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (query.length < 3) { type === "pickup" ? setPickupSugg([]) : setDropSugg([]); return; }
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&accept-language=en`);
        const data = await res.json();
        type === "pickup" ? setPickupSugg(data) : setDropSugg(data);
      } catch { /* ignore */ }
    }, 600);
  }, [setValue]);

  const handleSelectSugg = useCallback((place: any, type: "pickup" | "drop") => {
    const coords: [number, number] = [parseFloat(place.lat), parseFloat(place.lon)];
    const nameArr = place.display_name.split(",");
    const name = nameArr.slice(0, Math.min(3, nameArr.length)).join(",").trim();
    if (type === "pickup") { setPickupCoords(coords); setValue("from", name, { shouldValidate: true }); setPickupSugg([]); }
    else                   { setDropCoords(coords);   setValue("to",   name, { shouldValidate: true }); setDropSugg([]); }
  }, [setValue]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (formRef.current && !formRef.current.contains(e.target as Node)) {
        setPickupSugg([]);
        setDropSugg([]);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleMarkerDrag = useCallback(async (e: any, type: "pickup" | "drop") => {
    const { lat, lng } = e.target.getLatLng();
    type === "pickup" ? setPickupCoords([lat, lng]) : setDropCoords([lat, lng]);
    await reverseGeocode(lat, lng, type);
  }, [reverseGeocode]);

  // ── OSRM Route & Price calculation ───────────────────────────────────────
  useEffect(() => {
    const vehicle = VEHICLES.find(v => v.value === vehicleVal);
    const profile = vehicle?.osrm ?? "driving";
    setLoadingRoute(true);
    fetch(`https://router.project-osrm.org/route/v1/${profile}/${pickupCoords[1]},${pickupCoords[0]};${dropCoords[1]},${dropCoords[0]}?overview=full&geometries=geojson&alternatives=true`)
      .then(r => r.json())
      .then(data => {
        if (data.routes?.length) {
          setAllRoutes(data.routes);
          setSelRouteIdx(0);
          const distInKm = data.routes[0].distance / 1000;
          setDistance(distInKm.toFixed(1));
          setDuration(Math.round(data.routes[0].duration / 60).toString());
          setPrice(calculateFare(distInKm, vehicleVal));
        }
      })
      .catch(() => {})
      .finally(() => setLoadingRoute(false));
  }, [pickupCoords, dropCoords, vehicleVal, calculateFare]);

  const minDateTime = new Date();
  minDateTime.setMinutes(minDateTime.getMinutes() - minDateTime.getTimezoneOffset());
  const minDateTimeStr = minDateTime.toISOString().slice(0, 16);

  // ── Submit API Call ─────────────────────────────────────────────────────
  const onSubmit = async (data: FormValues) => {
    if (!auth?.token) { toast.error("Please log in to post a ride."); navigate("/login"); return; }
    if (price === 0) { toast.error("Calculating fare, please wait..."); return; }

    let finalDepartureTimeStr = "";
    let rideTypeFlag = "";

    // 🔥 FIX: Ab hum 'data.rideMode' ki jagah 'rideModeVal' use kar rahe hain jo seedha UI se mapped hai
    if (rideModeVal === "instant") {
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      finalDepartureTimeStr = now.toISOString().slice(0, 19);
      rideTypeFlag = "INSTANT";
    } else {
      const departureDateObj = new Date(data.time!);
      const currentDateObj = new Date();
      if (departureDateObj <= currentDateObj) {
        toast.error("Please select a future departure time.");
        return;
      }
      finalDepartureTimeStr = data.time + ":00";
      rideTypeFlag = "SCHEDULED";
    }

    setIsSubmitting(true);
    try {
      const payload = {
        sourceName:           data.from,
        sourceLatitude:       pickupCoords[0],
        sourceLongitude:      pickupCoords[1],
        destinationName:      data.to,
        destinationLatitude:  dropCoords[0],
        destinationLongitude: dropCoords[1],
        departureTime:        finalDepartureTimeStr,

        // 🔥 FIX: Seats aur Vehicle ki value bhi seedha watch() variables se lenge
        totalSeats:           parseInt(seatsVal),
        vehicleType:          vehicleVal,

        distanceInKm:         parseFloat(distance),
        pricePerSeat:         price,
        rideType:             rideTypeFlag
      };

      const res = await fetch(`https://ride-link-backend.onrender.com/api/rides/create?driverId=${auth.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify(payload),
      });

      if (res.status === 401) { navigate("/login"); return; }
      if (!res.ok) throw new Error("Server error. Please try again.");

      toast.success(`${rideTypeFlag === "INSTANT" ? "Instant" : "Scheduled"} Ride published successfully!`);
      navigate("/driver-dashboard");
    } catch (e: any) {
      toast.error(e.message ?? "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── GATEKEEPING: Role Check & KYC ──────────────────────────────────────────
  if (auth) {
    const role     = String(auth.role || "").toUpperCase();
    const isDriver = role.includes("RIDER") || role.includes("DRIVER");
    const isAdmin  = role.includes("ADMIN");

    // 1. BLOCK PASSENGERS (USER ROLE ONLY)
    if (!isDriver && !isAdmin) {
      return (
        <div className="min-h-[70vh] flex items-center justify-center px-4">
          <Card className="max-w-md w-full shadow-xl border-0 overflow-hidden">
            <div className="h-2 w-full bg-blue-500" />
            <CardContent className="pt-10 pb-10 flex flex-col items-center text-center gap-4">
              <div className="h-20 w-20 rounded-full bg-blue-50 flex items-center justify-center">
                <Car className="h-10 w-10 text-blue-500" />
              </div>
              <div>
                <h2 className="text-2xl font-extrabold text-slate-900">Passenger Account</h2>
                <p className="text-slate-500 mt-2 text-sm leading-relaxed max-w-sm">
                  You are currently registered as a Passenger. To post a ride and share your journey, you need to upgrade your account to a Driver.
                </p>
              </div>
              <div className="flex gap-3 mt-4">
                <Button variant="outline" asChild><Link to="/">Go Home</Link></Button>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all active:scale-95" asChild>
                  <Link to="/profile">Upgrade to Driver</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    // 2. KYC CHECK FOR DRIVERS
    if (isDriver && auth.kycStatus !== "APPROVED") {
      const isRejected = auth.kycStatus === "REJECTED";
      return (
        <div className="min-h-[70vh] flex items-center justify-center px-4">
          <Card className="max-w-md w-full shadow-xl border-0 overflow-hidden">
            <div className={`h-2 w-full ${isRejected ? "bg-red-500" : "bg-amber-400"}`} />
            <CardContent className="pt-10 pb-10 flex flex-col items-center text-center gap-4">
              {isRejected ? (
                <div className="h-20 w-20 rounded-full bg-red-50 flex items-center justify-center">
                  <XCircle className="h-10 w-10 text-red-500" />
                </div>
              ) : (
                <div className="h-20 w-20 rounded-full bg-amber-50 flex items-center justify-center">
                  <Clock className="h-10 w-10 text-amber-500 animate-pulse" />
                </div>
              )}
              <div>
                <h2 className="text-2xl font-extrabold text-slate-900">
                  {isRejected ? "KYC Rejected" : "Verification Pending"}
                </h2>
                <p className="text-slate-500 mt-2 text-sm leading-relaxed max-w-sm">
                  {isRejected
                    ? "Your documents were rejected. Please update your profile with valid documents."
                    : "Your KYC verification is in progress. You can post rides once admin approves your account."}
                </p>
              </div>
              <div className="flex gap-3 mt-2">
                <Button variant="outline" asChild><Link to="/">Go Home</Link></Button>
                <Button asChild><Link to="/account">View Profile</Link></Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }
  }

  // ─── Main Render ────────────────────────────────────────────────────────────
  return (
    <section className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
          <Link to="/" className="hover:text-primary transition-colors font-medium">Home</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-slate-800 font-semibold">Post a Ride</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Post a Ride</h1>
        <p className="text-muted-foreground mt-1 text-sm">Set your route and let passengers join your journey.</p>
      </div>

      <div className="grid lg:grid-cols-5 gap-6 items-start">
        {/* ── FORM ──────────────────────────────────────────────────────── */}
        <div className="lg:col-span-2" ref={formRef}>
          <Card className="shadow-lg border-slate-200/80 overflow-visible">
            <CardHeader className="bg-gradient-to-br from-slate-50 to-white border-b px-5 py-4">
              <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Route className="h-4.5 w-4.5 text-primary" /> Ride Details
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pt-5 pb-6">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                {/* FROM */}
                <div className="relative">
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">From</label>
                    <button type="button" onClick={() => handleUseCurrentLocation("pickup")}
                            className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 transition-colors disabled:opacity-50"
                            disabled={isLocating}>
                      {isLocating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Locate className="h-3 w-3" />}
                      Use live location
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      {...register("from", { onChange: (e) => handleSearch(e.target.value, "pickup") })}
                      placeholder="Search pickup location…"
                      className={`pl-9 h-11 font-medium transition-all bg-slate-50 border-slate-200
                        ${clickTarget === "pickup" ? "ring-2 ring-emerald-500 border-emerald-400" : ""}
                        ${errors.from ? "border-red-400" : ""}`}
                      onFocus={() => setClickTarget("pickup")}
                      autoComplete="off"
                    />
                    <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
                      {isLocating
                        ? <Loader2 className="h-4 w-4 text-emerald-500 animate-spin" />
                        : <MapPin className="h-4 w-4 text-emerald-500" />}
                    </div>
                  </div>
                  {errors.from && (
                    <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />{errors.from.message}
                    </p>
                  )}
                  <SuggestionList items={pickupSugg} onSelect={(p) => handleSelectSugg(p, "pickup")} />
                </div>

                <div className="flex items-center gap-2 -my-1 px-1">
                  <div className="flex flex-col items-center gap-0.5 ml-[10px]">
                    <div className="w-px h-3 bg-slate-200" />
                    <div className="w-px h-3 bg-slate-200" />
                  </div>
                </div>

                {/* TO */}
                <div className="relative">
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">To</label>
                    <button type="button" onClick={() => handleUseCurrentLocation("drop")}
                            className="flex items-center gap-1 text-[11px] font-bold text-red-500 hover:text-red-600 transition-colors disabled:opacity-50"
                            disabled={isLocating}>
                      <Locate className="h-3 w-3" /> Use live location
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      {...register("to", { onChange: (e) => handleSearch(e.target.value, "drop") })}
                      placeholder="Search drop location…"
                      className={`pl-9 h-11 font-medium transition-all bg-slate-50 border-slate-200
                        ${clickTarget === "drop" ? "ring-2 ring-red-500 border-red-400" : ""}
                        ${errors.to ? "border-red-400" : ""}`}
                      onFocus={() => setClickTarget("drop")}
                      autoComplete="off"
                    />
                    <Navigation className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500" />
                  </div>
                  {errors.to && (
                    <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />{errors.to.message}
                    </p>
                  )}
                  <SuggestionList items={dropSugg} onSelect={(p) => handleSelectSugg(p, "drop")} />
                </div>

                <div className="border-t border-dashed border-slate-200 pt-5 space-y-4">

                  {/* 🔥 Ride Mode Selector (Instant vs Scheduled) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Ride Type</label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={rideModeVal === "instant" ? "default" : "outline"}
                        onClick={() => setValue("rideMode", "instant", { shouldValidate: true })}
                        className={`flex-1 font-bold ${rideModeVal === "instant" ? "bg-emerald-600 hover:bg-emerald-700" : "text-slate-500 hover:text-slate-700"}`}
                      >
                        <Zap className={`h-4 w-4 mr-1.5 ${rideModeVal === "instant" ? "text-white" : "text-slate-400"}`} /> Instant
                      </Button>
                      <Button
                        type="button"
                        variant={rideModeVal === "scheduled" ? "default" : "outline"}
                        onClick={() => setValue("rideMode", "scheduled", { shouldValidate: true })}
                        className={`flex-1 font-bold ${rideModeVal === "scheduled" ? "bg-slate-800 hover:bg-slate-900" : "text-slate-500 hover:text-slate-700"}`}
                      >
                        <Calendar className={`h-4 w-4 mr-1.5 ${rideModeVal === "scheduled" ? "text-white" : "text-slate-400"}`} /> Scheduled
                      </Button>
                    </div>
                  </div>

                  {/* Date & Time (Only show if Scheduled) */}
                  {rideModeVal === "scheduled" && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                      <label className="mb-1.5 block text-xs font-bold text-slate-600 uppercase tracking-wider">
                        Departure Date & Time
                      </label>
                      <div className="relative">
                        <Input
                          type="datetime-local"
                          min={minDateTimeStr}
                          {...register("time")}
                          className={`pl-9 h-11 font-medium bg-slate-50 border-slate-200 ${errors.time ? "border-red-400" : ""}`}
                        />
                        <Calendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      </div>
                      {errors.time && (
                        <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />{errors.time.message}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Seats + Vehicle */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-600 uppercase tracking-wider">Vehicle</label>
                      <Select value={vehicleVal} onValueChange={(v: any) => setValue("vehicle", v)}>
                        <SelectTrigger className="h-11 bg-slate-50 border-slate-200">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {VEHICLES.map(v => (
                            <SelectItem key={v.value} value={v.value}>
                              {v.icon} {v.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-600 uppercase tracking-wider">Seats</label>
                      <Select value={seatsVal} onValueChange={(v) => setValue("seats", v)}>
                        <SelectTrigger className="h-11 bg-slate-50 border-slate-200">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {availableSeatsArr.map(n => (
                            <SelectItem key={n} value={String(n)}>
                              <span className="flex items-center gap-2">
                                <Users className="h-3.5 w-3.5 text-slate-400" /> {n} seat{n > 1 ? "s" : ""}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* 🔥 Route Summary Card With Fare 🔥 */}
                {allRoutes.length > 0 && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Route Summary</span>
                      {allRoutes.length > 1 && (
                        <Badge variant="outline" className="text-[10px] border-primary/30 text-primary font-bold">
                          {allRoutes.length} routes found
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-white rounded-lg p-2.5 border border-slate-100 text-center">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Distance</p>
                        <p className="text-lg font-black text-primary">{distance} <span className="text-[10px] font-bold">km</span></p>
                      </div>
                      <div className="bg-white rounded-lg p-2.5 border border-slate-100 text-center">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Time</p>
                        <p className="text-lg font-black text-slate-700">{duration} <span className="text-[10px] font-bold">min</span></p>
                      </div>
                      <div className="bg-white rounded-lg p-2.5 border border-slate-100 text-center">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Fare/Seat</p>
                        <p className="text-lg font-black text-emerald-600">₹{price}</p>
                      </div>
                    </div>

                    {allRoutes.length > 1 && (
                      <p className="text-[10px] text-slate-400 font-medium text-center">
                        Click grey lines on the map to switch routes
                      </p>
                    )}
                  </div>
                )}

                <div className="flex items-start gap-2 text-xs text-slate-500 bg-emerald-50 border border-emerald-100 rounded-lg p-3 mt-1">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Dynamic pricing applies. Fares are computed automatically based on route and vehicle type.</span>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 font-bold text-base shadow-md gap-2"
                  disabled={isSubmitting || loadingRoute || isLocating}
                >
                  {isSubmitting
                    ? <><Loader2 className="h-5 w-5 animate-spin" /> Publishing…</>
                    : <><CheckCircle2 className="h-5 w-5" /> Publish Ride</>}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* ── MAP ───────────────────────────────────────────────────────── */}
        <div className="lg:col-span-3 flex flex-col gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3 shadow-sm">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">Click map to set:</span>
            <div className="flex gap-2 flex-1">
              <button
                type="button"
                onClick={() => setClickTarget("pickup")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all border
                  ${clickTarget === "pickup"
                  ? "bg-emerald-500 text-white border-emerald-500 shadow-sm"
                  : "border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-600"}`}
              >
                <MapPin className="h-3.5 w-3.5" /> Pickup
              </button>
              <button
                type="button"
                onClick={() => setClickTarget("drop")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all border
                  ${clickTarget === "drop"
                  ? "bg-red-500 text-white border-red-500 shadow-sm"
                  : "border-slate-200 text-slate-600 hover:border-red-300 hover:text-red-500"}`}
              >
                <Navigation className="h-3.5 w-3.5" /> Drop-off
              </button>
              {clickTarget && (
                <button type="button" onClick={() => setClickTarget(null)}
                        className="px-3 py-2 rounded-lg text-xs font-bold border border-slate-200 text-slate-500 hover:bg-slate-50 transition-all">
                  ✕ Cancel
                </button>
              )}
            </div>
            {clickTarget && (
              <Badge className={`text-[10px] font-bold animate-pulse shrink-0 ${clickTarget === "pickup" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                Tap map…
              </Badge>
            )}
          </div>

          <Card className={`overflow-hidden shadow-xl border-slate-200 transition-all ${clickTarget ? "ring-2 ring-primary/30" : ""}`}
                style={{ height: 520 }}>
            {(loadingRoute || isLocating) && (
              <div className="absolute top-3 right-3 bg-white/95 backdrop-blur px-3 py-1.5 rounded-full shadow-md z-[1000] flex items-center gap-2 text-xs font-bold text-slate-700">
                <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
                {isLocating ? "Fetching GPS…" : "Calculating route…"}
              </div>
            )}
            <MapContainer
              center={pickupCoords} zoom={13} scrollWheelZoom
              style={{ height: "100%", width: "100%", cursor: clickTarget ? "crosshair" : "grab" }}>
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                attribution="&copy; CartoDB"
              />

              <Marker position={pickupCoords} icon={pickupIcon} draggable
                      eventHandlers={{ dragend: (e) => handleMarkerDrag(e, "pickup") }}>
                <Popup><b>Pickup</b><br />{fromVal || "Start point"}</Popup>
              </Marker>

              <Marker position={dropCoords} icon={dropIcon} draggable
                      eventHandlers={{ dragend: (e) => handleMarkerDrag(e, "drop") }}>
                <Popup><b>Drop-off</b><br />{toVal || "End point"}</Popup>
              </Marker>

              {allRoutes.map((route, idx) => {
                const positions = route.geometry.coordinates.map((c: number[]) => [c[1], c[0]]) as [number,number][];
                const active = idx === selRouteIdx;
                return (
                  <Polyline
                    key={idx}
                    positions={positions}
                    pathOptions={{
                      color:   active ? "#2563eb" : "#94a3b8",
                      weight:  active ? 6 : 4,
                      opacity: active ? 0.9 : 0.55,
                    }}
                    eventHandlers={{
                      click: (e) => {
                        L.DomEvent.stopPropagation(e.originalEvent);
                        setSelRouteIdx(idx);
                        const distInKm = route.distance / 1000;
                        setDistance(distInKm.toFixed(1));
                        setDuration(Math.round(route.duration / 60).toString());
                        setPrice(calculateFare(distInKm, vehicleVal));
                        toast.info(`Route ${idx + 1} selected — ${distInKm.toFixed(1)} km`);
                      },
                    }}
                  />
                );
              })}

              <MapController coords={[pickupCoords, dropCoords]} />
              <MapClickHandler onMapClick={handleMapClick} />
            </MapContainer>
          </Card>

          <p className="text-center text-xs text-slate-400 font-medium">
            Drag markers · Click map to place pins · Click grey lines to switch routes
          </p>
        </div>

      </div>
    </section>
  );
}