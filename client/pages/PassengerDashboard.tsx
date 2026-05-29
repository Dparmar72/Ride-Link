import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  MapPin, Users, X, Loader2, Clock, Map as MapIcon, Calendar,
  Car, Navigation, ShieldCheck, Phone, AlertTriangle,
  SmartphoneNfc, History, ChevronRight, Zap, Wifi, Filter, ArrowUpDown, CreditCard
} from "lucide-react";
import { toast } from "sonner";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// ─── Map Icons ────────────────────────────────────────────────────────────────
const carIcon = L.divIcon({
  className: "",
  html: `<div style="font-size:32px;line-height:1;filter:drop-shadow(2px 4px 6px rgba(0,0,0,0.45));transform:scaleX(-1);">🚗</div>`,
  iconSize: [35, 35],
  iconAnchor: [17, 17],
  popupAnchor: [0, -15],
});

const passengerIcon = L.divIcon({
  className: "custom-marker",
  html: `<div style="width:20px;height:20px;background:#10b981;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(16,185,129,0.5);display:flex;align-items:center;justify-content:center;"><div style="width:6px;height:6px;background:#fff;border-radius:50%;"></div></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const pinIcon = (color: string) =>
  L.divIcon({
    className: "",
    html: `<div style="width:16px;height:16px;background:${color};border:2.5px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.25);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

// ─── Status helpers ───────────────────────────────────────────────────────────
const ACTIVE_STATUSES  = ["PENDING", "CONFIRMED", "ACCEPTED", "BOARDED", "STARTED", "IN_PROGRESS"];
const HISTORY_STATUSES = ["COMPLETED", "ENDED", "CANCELLED", "REJECTED", "DROPPED"];
const ONTRIP_STATUSES  = ["BOARDED", "STARTED", "IN_PROGRESS"];

function statusMeta(status: string, paymentStatus?: string) {
  const s = status?.toUpperCase();
  const p = paymentStatus?.toUpperCase();

  if (s === "PENDING")                    return { label: "Finding Driver…",  color: "amber",   pulse: true };
  if (s === "ACCEPTED" && p === "PENDING") return { label: "Payment Required", color: "red", pulse: true };
  if (s === "CONFIRMED" || s === "ACCEPTED") return { label: "Driver Confirmed", color: "emerald", pulse: false };
  if (ONTRIP_STATUSES.includes(s))        return { label: "On Trip",          color: "blue",    pulse: true };
  if (s === "COMPLETED" || s === "ENDED") return { label: "Completed",        color: "emerald", pulse: false };
  if (s === "CANCELLED")                  return { label: "Cancelled",        color: "red",     pulse: false };
  if (s === "REJECTED")                   return { label: "Rejected",         color: "red",     pulse: false };
  return { label: s, color: "slate", pulse: false };
}

function StatusBadge({ status, paymentStatus }: { status: string, paymentStatus?: string }) {
  const { label, color, pulse } = statusMeta(status, paymentStatus);
  const styles: Record<string, string> = {
    amber:   "bg-amber-50   text-amber-700  border-amber-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    blue:    "bg-blue-50    text-blue-700   border-blue-200",
    red:     "bg-red-50     text-red-600    border-red-200",
    slate:   "bg-slate-50   text-slate-600  border-slate-200",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${styles[color]}`}>
      {pulse && <span className="relative flex h-2 w-2"><span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-${color}-400 opacity-75`}></span><span className={`relative inline-flex rounded-full h-2 w-2 bg-${color}-500`}></span></span>}
      {label}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PassengerDashboard() {
  const navigate = useNavigate();
  const [activeTab,        setActiveTab]        = useState<"active" | "history">("active");
  const [myBookings,       setMyBookings]        = useState<any[]>([]);
  const [isLoading,        setIsLoading]         = useState(true);
  const [cancellingId,     setCancellingId]      = useState<number | null>(null);
  const [trackingId,       setTrackingId]        = useState<number | null>(null);
  const [processingPay,    setProcessingPay]     = useState<number | null>(null);
  const [passengerCoords,  setPassengerCoords]   = useState<[number, number] | null>(null);
  const [driverCoords,     setDriverCoords]      = useState<[number, number] | null>(null);
  const [routePolyline,    setRoutePolyline]     = useState<[number, number][]>([]);

  // 🔥 Refund Alert State
  const [refundAlertBooking, setRefundAlertBooking] = useState<any>(null);

  const [historyFilter,    setHistoryFilter]     = useState<string>("ALL");
  const [historySort,      setHistorySort]       = useState<"NEWEST" | "OLDEST">("NEWEST");

  const watchIdRef    = useRef<number | null>(null);
  const stompRef      = useRef<Client | null>(null);
  const selfCancelRef = useRef<Set<number>>(new Set());

  // 🔥 Track dismissed refund alerts to prevent re-triggering during poll
  const dismissedRefunds = useRef<Set<number>>(new Set());

  const getAuth = useCallback(() => {
    try {
      const raw = localStorage.getItem("ridelink:auth");
      if (!raw || raw === "null") return null;
      return JSON.parse(raw);
    } catch { return null; }
  }, []);
  function getToken() { return getAuth()?.token ?? null; }

  const fetchBookings = useCallback(async () => {
    const auth = getAuth();
    if (!auth) { navigate("/login"); return; }
    const passengerId = auth.id || auth.userId;
    if (!passengerId) return;

    try {
      const res = await fetch(`https://ride-link-backend.onrender.com/api/bookings/passenger/${passengerId}`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      if (res.status === 401) { navigate("/login"); return; }
      if (res.ok) {
        const data = await res.json();
        const arr = Array.isArray(data) ? data : data.content || data.data || [];
        setMyBookings(arr);

        // 🔥 CHECK FOR REFUNDED RIDES TO SHOW MODAL
        const refundedRide = arr.find((b: any) =>
          (b.status?.toUpperCase() === "CANCELLED" || b.status?.toUpperCase() === "REJECTED") &&
          b.paymentStatus?.toUpperCase() === "REFUNDED" &&
          !dismissedRefunds.current.has(b.id)
        );

        if (refundedRide) {
          setRefundAlertBooking(refundedRide);
        }
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [getAuth, navigate]);

  useEffect(() => {
    fetchBookings();
    const interval = setInterval(fetchBookings, 10_000);
    return () => clearInterval(interval);
  }, [fetchBookings]);

  // ── Advance Payment Handler (Razorpay Escrow) ──────────────────────────
  const handleAdvancePayment = async (booking: any) => {
    try {
      setProcessingPay(booking.id);
      const authData = getAuth();

      const res = await fetch(`https://ride-link-backend.onrender.com/api/payments/create-order/${booking.id}`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${authData.token}` }
      });

      if (!res.ok) throw new Error("Failed to create order");

      let orderData = await res.json();

      if (typeof orderData === 'string') {
        orderData = JSON.parse(orderData);
      }

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: "INR",
        name: "RideLink Escrow",
        description: "50% Advance Payment for Scheduled Ride",
        order_id: orderData.id,
        handler: async function (response: any) {
          toast.success(`Payment Successful!`);

          await fetch(`https://ride-link-backend.onrender.com/api/payments/verify`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${authData.token}`
            },
            body: JSON.stringify({
              bookingId: booking.id,
              paymentId: response.razorpay_payment_id
            })
          });

          fetchBookings();
        },
        prefill: {
          name: authData.name || authData.fullName,
          email: authData.email || "passenger@ridelink.com",
        },
        theme: { color: "#10b981" },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();

    } catch (error) {
      toast.error("Payment initialization failed!");
    } finally {
      setProcessingPay(null);
    }
  };

  const handleCancelRide = async (bookingId: number) => {
    if (!window.confirm("Cancel this ride?")) return;
    setCancellingId(bookingId);
    selfCancelRef.current.add(bookingId);
    try {
      const token = getAuth()?.token;
      const res = await fetch(`https://ride-link-backend.onrender.com/api/bookings/${bookingId}/cancel`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) { toast.success("Ride cancelled."); fetchBookings(); }
      else toast.error("Failed to cancel.");
    } catch { toast.error("Network error."); }
    finally { setCancellingId(null); }
  };

  const handleSOS = () =>
    toast.error("🚨 SOS ACTIVATED — Alerts Sent!", {
      duration: 8000,
      style: { background: "#ef4444", color: "#fff", border: "none" },
    });

  const activeRides  = useMemo(() => myBookings.filter((b) => ACTIVE_STATUSES.includes(b.status?.toUpperCase())),  [myBookings]);
  const historyRidesRaw = useMemo(() => myBookings.filter((b) => HISTORY_STATUSES.includes(b.status?.toUpperCase())), [myBookings]);

  const processedHistoryRides = useMemo(() => {
    let filtered = historyRidesRaw;
    if (historyFilter !== "ALL") {
      if (historyFilter === "COMPLETED") {
        filtered = filtered.filter(b => ["COMPLETED", "ENDED"].includes(b.status?.toUpperCase()));
      } else {
        filtered = filtered.filter(b => b.status?.toUpperCase() === historyFilter);
      }
    }
    return filtered.sort((a, b) => {
      const timeA = a.ride?.departureTime ? new Date(a.ride.departureTime).getTime() : a.id;
      const timeB = b.ride?.departureTime ? new Date(b.ride.departureTime).getTime() : b.id;
      return historySort === "NEWEST" ? timeB - timeA : timeA - timeB;
    });
  }, [historyRidesRaw, historyFilter, historySort]);

  const trackingData = useMemo(() => {
    if (!trackingId) return null;
    const booking = myBookings.find((b) => b.id === trackingId);
    if (!booking?.ride) return null;

    const src: [number, number] = [
      booking.pickupLatitude  ?? booking.ride.sourceLatitude      ?? 22.7196,
      booking.pickupLongitude ?? booking.ride.sourceLongitude     ?? 75.8577,
    ];
    const dst: [number, number] = [
      booking.dropLatitude  ?? booking.ride.destinationLatitude   ?? 22.7244,
      booking.dropLongitude ?? booking.ride.destinationLongitude  ?? 75.8839,
    ];
    return { booking, ride: booking.ride, source: src, destination: dst };
  }, [trackingId, myBookings]);

  useEffect(() => {
    if (!trackingData) { setRoutePolyline([]); return; }
    const { source: s, destination: d } = trackingData;
    fetch(`https://router.project-osrm.org/route/v1/driving/${s[1]},${s[0]};${d[1]},${d[0]}?overview=full&geometries=geojson`)
      .then((r) => r.json())
      .then((data) => {
        if (data.routes?.[0]) {
          setRoutePolyline(data.routes[0].geometry.coordinates.map((c: number[]) => [c[1], c[0]]));
        }
      })
      .catch(() => setRoutePolyline([]));
  }, [trackingData?.booking.id]);

  useEffect(() => {
    if (!trackingData) return;
    const auth = getAuth();
    const myId = auth?.id || auth?.userId || 2;
    const rideId = trackingData.ride.id;

    const socket = new SockJS("https://ride-link-backend.onrender.com/ws-provider");
    const client = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 5000,
      connectHeaders: { Authorization: `Bearer ${getToken()}` },
      onConnect: () => {
        client.subscribe(`/topic/ride/${rideId}`, (msg) => {
          const d = JSON.parse(msg.body);
          if (d.senderRole === "DRIVER") setDriverCoords([d.latitude, d.longitude]);
        });
      },
    });
    client.activate();
    stompRef.current = client;

    if (navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        ({ coords }) => {
          setPassengerCoords([coords.latitude, coords.longitude]);
          if (client.connected) {
            client.publish({
              destination: "/app/update-location",
              body: JSON.stringify({ rideId, senderRole: "PASSENGER", passengerId: myId, latitude: coords.latitude, longitude: coords.longitude }),
            });
          }
        },
        (err) => console.error("GPS error:", err),
        { enableHighAccuracy: true, maximumAge: 10_000 }
      );
    }

    return () => {
      client.deactivate();
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      setDriverCoords(null);
    };
  }, [trackingData?.booking.id, getAuth]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <Car className="absolute inset-0 m-auto h-7 w-7 text-primary" />
        </div>
        <p className="text-sm font-medium text-slate-500">Loading your rides…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8 max-w-5xl">

        <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">My Rides</h1>
            <p className="text-muted-foreground mt-1 text-sm">Track journeys and view your booking history.</p>
          </div>
          <Button asChild className="gap-2 shadow-sm font-semibold">
            <Link to="/book"><MapPin className="h-4 w-4" /> Book a Ride</Link>
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { label: "Active",    value: activeRides.length,  color: "text-emerald-600", bg: "bg-emerald-50",  icon: <Zap className="h-5 w-5 text-emerald-500" /> },
            { label: "Completed", value: historyRidesRaw.filter(b => ["COMPLETED","ENDED"].includes(b.status?.toUpperCase())).length, color: "text-blue-600", bg: "bg-blue-50", icon: <ShieldCheck className="h-5 w-5 text-blue-500" /> },
            { label: "Total",     value: myBookings.length,   color: "text-slate-800",   bg: "bg-slate-100",   icon: <History className="h-5 w-5 text-slate-500" /> },
          ].map(({ label, value, color, bg, icon }) => (
            <Card key={label} className="shadow-sm border-0">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`h-10 w-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}>{icon}</div>
                <div>
                  <p className={`text-2xl font-black ${color}`}>{value}</p>
                  <p className="text-xs text-slate-500 font-medium">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex gap-1 bg-slate-200/70 p-1 rounded-xl mb-6 max-w-sm shadow-inner">
          {(["active", "history"] as const).map((tab) => (
            <button key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all capitalize flex items-center justify-center gap-2 ${activeTab === tab ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
              {tab === "active" ? <Zap className="h-3.5 w-3.5" /> : <History className="h-3.5 w-3.5" />}
              {tab === "active" ? "Active" : "History"}
              {tab === "active" && activeRides.length > 0 && (
                <span className="bg-primary text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                  {activeRides.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {activeTab === "active" && (
          activeRides.length === 0 ? (
            <Card className="border-dashed shadow-sm bg-white">
              <CardContent className="flex flex-col items-center justify-center py-20 space-y-4">
                <div className="h-16 w-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <MapIcon className="h-8 w-8 text-slate-300" />
                </div>
                <div className="text-center">
                  <h3 className="font-bold text-lg text-slate-700">No Active Bookings</h3>
                  <p className="text-slate-500 text-sm mt-1">Ready for your next journey?</p>
                </div>
                <Button asChild className="mt-2 gap-2 font-semibold">
                  <Link to="/book"><MapPin className="h-4 w-4" /> Book a Ride</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-5 lg:grid-cols-2">
              {activeRides.map((booking) => {
                const ride   = booking.ride;
                const status = booking.status?.toUpperCase();

                const isInstantRide = ride?.rideType === "INSTANT" || booking.rideType === "INSTANT";

                const paymentStatus = booking.paymentStatus?.toUpperCase() || "PENDING";
                const totalFare = booking.price || 0;
                const isAdvancePaid = paymentStatus === "ADVANCE_PAID" || paymentStatus === "FULL_PAID";
                const advanceAmount = isAdvancePaid ? (totalFare * 0.5) : 0;
                const remainingAmount = totalFare - advanceAmount;

                const isConfirmed = status === "CONFIRMED" || status === "ACCEPTED";
                const isOnTrip    = ONTRIP_STATUSES.includes(status);
                const isPending   = status === "PENDING";

                const needsPayment = !isInstantRide && (status === "ACCEPTED" || status === "CONFIRMED") && paymentStatus === "PENDING";

                const departureTimeMs = ride?.departureTime ? new Date(ride.departureTime).getTime() : 0;
                const timeToRideMs = departureTimeMs - Date.now();
                const isWithin30Mins = timeToRideMs <= 30 * 60 * 1000;

                const isTrackingEnabled = (isInstantRide || isWithin30Mins || isOnTrip) && !needsPayment;

                const borderColor = isOnTrip ? "border-t-blue-500" : needsPayment ? "border-t-red-500" : isConfirmed ? "border-t-emerald-500" : "border-t-amber-400";
                const pickupLabel = booking.pickupAddress || booking.ride?.sourceAddress  || `${booking.pickupLatitude?.toFixed(4)}, ${booking.pickupLongitude?.toFixed(4)}`  || "Pickup Point";
                const dropLabel   = booking.dropAddress   || booking.ride?.destinationAddress || `${booking.dropLatitude?.toFixed(4)}, ${booking.dropLongitude?.toFixed(4)}` || "Drop-off Point";

                return (
                  <Card key={booking.id} className={`shadow-md border-t-4 ${borderColor} overflow-hidden flex flex-col`}>
                    <CardHeader className="bg-white border-b pb-4 pt-5 px-5">
                      <div className="flex justify-between items-start gap-3">
                        <div className="space-y-2 min-w-0">
                          <div className="flex items-start gap-2">
                            <div className="mt-0.5 h-5 w-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                              <MapPin className="h-3 w-3 text-emerald-600" />
                            </div>
                            <p className="text-sm font-semibold text-slate-800 truncate">{pickupLabel}</p>
                          </div>
                          <div className="flex items-start gap-2">
                            <div className="mt-0.5 h-5 w-5 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                              <Navigation className="h-3 w-3 text-red-600" />
                            </div>
                            <p className="text-sm font-semibold text-slate-800 truncate">{dropLabel}</p>
                          </div>
                        </div>
                        <StatusBadge status={status} paymentStatus={paymentStatus} />
                      </div>

                      <div className="flex items-center gap-4 mt-3 text-xs text-slate-500 font-medium">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          {ride?.departureTime ? new Date(ride.departureTime).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "TBA"}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-slate-400" />
                          {booking.seatsBooked} Seat{booking.seatsBooked > 1 ? "s" : ""}
                        </span>
                        {isInstantRide && (
                          <span className="flex items-center gap-1.5 ml-auto text-primary font-bold">
                             <Zap className="h-3.5 w-3.5" /> Instant
                           </span>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent className="pt-4 pb-5 px-5 bg-slate-50/60 flex-1">
                      {isPending ? (
                        <div className="flex flex-col items-center py-5 gap-3">
                          <div className="relative">
                            <div className="h-12 w-12 rounded-full border-4 border-amber-200 border-t-amber-500 animate-spin" />
                            <Car className="absolute inset-0 m-auto h-5 w-5 text-amber-500" />
                          </div>
                          <p className="text-sm font-semibold text-slate-700">Finding you the best driver…</p>
                          <Button variant="ghost" size="sm"
                                  className="text-red-500 hover:text-red-600 hover:bg-red-50 font-bold text-xs mt-1"
                                  onClick={() => handleCancelRide(booking.id)}
                                  disabled={cancellingId === booking.id}>
                            {cancellingId === booking.id ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Cancelling…</> : "Cancel Request"}
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="flex flex-col bg-white p-3.5 rounded-xl border shadow-sm">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-lg">
                                  {ride?.driver?.fullName?.[0]?.toUpperCase() || "D"}
                                </div>
                                <div>
                                  <p className="font-bold text-sm text-slate-800">{ride?.driver?.fullName || "Your Driver"}</p>
                                  <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                    <Car className="h-3 w-3" /> {ride?.vehicleType || "Vehicle assigned"}
                                  </p>
                                </div>
                              </div>

                              <div className="text-right">
                                {needsPayment ? (
                                  <>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Advance Due</p>
                                    <p className="text-xl font-black text-red-500">₹{(totalFare * 0.5).toFixed(0)}</p>
                                  </>
                                ) : isTrackingEnabled ? (
                                  <>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Boarding OTP</p>
                                    <p className="text-2xl font-black text-emerald-600 tracking-[0.2em]">
                                      {booking.rideOtp || booking.otp || "••••"}
                                    </p>
                                  </>
                                ) : (
                                  <>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Boarding OTP</p>
                                    <p className="text-[11px] font-bold text-slate-500 mt-1 bg-slate-100 px-2 py-1 rounded-md">
                                      Unlocks 30 mins<br/>before ride
                                    </p>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                              <p className="text-xs font-bold text-slate-600">Total Fare: ₹{totalFare}</p>
                              {isAdvancePaid ? (
                                <div className="flex items-center gap-1.5">
                                  <Badge className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] py-0 px-1.5">Paid: ₹{advanceAmount.toFixed(0)}</Badge>
                                  <Badge className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] py-0 px-1.5">Due: ₹{remainingAmount.toFixed(0)}</Badge>
                                </div>
                              ) : (
                                <Badge className="bg-slate-100 text-slate-500 border border-slate-200 text-[10px] py-0 px-1.5">
                                  {isInstantRide ? "Pay Full at End" : "Unpaid"}
                                </Badge>
                              )}
                            </div>
                          </div>

                          {needsPayment ? (
                            <div className="flex flex-col gap-2">
                              <Button className="w-full font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-md animate-pulse"
                                      onClick={() => handleAdvancePayment(booking)}
                                      disabled={processingPay === booking.id}>
                                {processingPay === booking.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                                {processingPay === booking.id ? "Processing..." : `Pay ₹${(totalFare * 0.5).toFixed(0)} Advance to Confirm`}
                              </Button>
                              <p className="text-[10px] text-center text-slate-500 font-semibold italic">Pay within 2 hours or ride will be auto-cancelled.</p>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              {isTrackingEnabled ? (
                                <Button className="flex-1 font-bold bg-slate-900 hover:bg-slate-800 text-white gap-2"
                                        onClick={() => setTrackingId(booking.id)}>
                                  <MapIcon className="h-4 w-4" /> Live Track
                                </Button>
                              ) : (
                                <Button disabled className="flex-1 font-bold bg-slate-200 text-slate-400 gap-2 cursor-not-allowed">
                                  <Clock className="h-4 w-4" /> Track Later
                                </Button>
                              )}

                              {isOnTrip ? (
                                <Button variant="destructive" onClick={handleSOS} className="font-bold gap-1.5 px-4">
                                  <AlertTriangle className="h-4 w-4" /> SOS
                                </Button>
                              ) : (
                                <Button variant="outline"
                                        className="border-red-200 text-red-600 hover:bg-red-50 font-bold px-4"
                                        onClick={() => handleCancelRide(booking.id)}
                                        disabled={cancellingId === booking.id}>
                                  {cancellingId === booking.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancel"}
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )
        )}

        {activeTab === "history" && (
          <div className="space-y-4">
            {historyRidesRaw.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-3 bg-white p-3 rounded-xl border shadow-sm">
                <div className="flex-1 flex items-center gap-2">
                  <Filter className="h-4 w-4 text-slate-400" />
                  <Select value={historyFilter} onValueChange={setHistoryFilter}>
                    <SelectTrigger className="h-9 text-sm border-slate-200 font-medium">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Rides</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                      <SelectItem value="CANCELLED">Cancelled</SelectItem>
                      <SelectItem value="REJECTED">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 flex items-center gap-2">
                  <ArrowUpDown className="h-4 w-4 text-slate-400" />
                  <Select value={historySort} onValueChange={(v: any) => setHistorySort(v)}>
                    <SelectTrigger className="h-9 text-sm border-slate-200 font-medium">
                      <SelectValue placeholder="Sort by date" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NEWEST">Newest First</SelectItem>
                      <SelectItem value="OLDEST">Oldest First</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {processedHistoryRides.length === 0 ? (
              <Card className="border-dashed shadow-sm bg-white">
                <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
                  <History className="h-10 w-10 text-slate-300" />
                  <p className="text-slate-500 font-medium">No rides match your filter.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {processedHistoryRides.map((booking) => {
                  const status   = booking.status?.toUpperCase();
                  const paymentStatus = booking.paymentStatus?.toUpperCase() || "PENDING";
                  const isDone   = status === "COMPLETED" || status === "ENDED";
                  const byDriver = status === "REJECTED" || (status === "CANCELLED" && !selfCancelRef.current.has(booking.id));

                  // 🔥 Check if the ride was refunded
                  const isRefunded = paymentStatus === "REFUNDED";

                  const from = booking.pickupAddress || booking.ride?.sourceAddress || "Pickup";
                  const to   = booking.dropAddress   || booking.ride?.destinationAddress || "Drop-off";

                  return (
                    <Card key={booking.id} className="bg-white shadow-sm hover:shadow-md transition-shadow">
                      <div className="p-4 flex items-center gap-4">
                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${isDone ? "bg-emerald-50" : "bg-red-50"}`}>
                          {isDone ? <ShieldCheck className="h-5 w-5 text-emerald-500" /> : <X className="h-5 w-5 text-red-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 truncate">
                            <span className="truncate">{from}</span>
                            <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{to}</span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {booking.ride?.departureTime
                              ? new Date(booking.ride.departureTime).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
                              : "Date N/A"}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <Badge variant="outline"
                                 className={isDone
                                   ? "border-emerald-400 text-emerald-700 bg-emerald-50 text-[10px] font-bold"
                                   : "border-red-300   text-red-600   bg-red-50   text-[10px] font-bold"}>
                            {byDriver ? "DRIVER CANCELLED" : isDone ? "COMPLETED" : status}
                          </Badge>
                          {/* 🔥 Show Refunded Badge in History */}
                          {isRefunded && (
                            <Badge className="bg-blue-50 text-blue-600 border border-blue-200 text-[10px] font-bold">
                              PAYMENT REFUNDED
                            </Badge>
                          )}
                          {isDone && booking.price != null && !isRefunded && (
                            <span className="text-sm font-black text-slate-700">₹{booking.price}</span>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {trackingId && trackingData && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col" style={{ maxHeight: "92vh" }}>
            <div className="bg-slate-900 px-5 py-4 flex justify-between items-center text-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight">Live Ride Tracking</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {ONTRIP_STATUSES.includes(trackingData.booking.status?.toUpperCase())
                      ? "You're on the trip — tracking live."
                      : "Driver is heading to your pickup point."}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="destructive" size="sm" onClick={handleSOS} className="font-bold h-8 px-3 text-xs gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" /> SOS
                </Button>
                <Button variant="ghost" size="icon" className="hover:bg-slate-800 text-white h-8 w-8"
                        onClick={() => { setTrackingId(null); setDriverCoords(null); setRoutePolyline([]); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="relative flex-1 min-h-[280px] sm:min-h-[360px] bg-slate-100">
              <MapContainer
                key={trackingId}
                center={passengerCoords || trackingData.source}
                zoom={13}
                style={{ height: "100%", width: "100%", minHeight: "280px" }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Marker position={trackingData.source}      icon={pinIcon("#f59e0b")}><Popup><b>Boarding Point</b></Popup></Marker>
                <Marker position={trackingData.destination} icon={pinIcon("#ef4444")}><Popup><b>Drop-off Point</b></Popup></Marker>
                {routePolyline.length > 0
                  ? <Polyline positions={routePolyline} color="#2563eb" weight={5} opacity={0.75} />
                  : <Polyline positions={[trackingData.source, trackingData.destination]} color="#f59e0b" weight={4} opacity={0.6} dashArray="8,12" />}
                {driverCoords   && <Marker position={driverCoords}   icon={carIcon}><Popup><b>Your Driver</b></Popup></Marker>}
                {passengerCoords && <Marker position={passengerCoords} icon={passengerIcon}><Popup><b>You</b></Popup></Marker>}
              </MapContainer>

              {!ONTRIP_STATUSES.includes(trackingData.booking.status?.toUpperCase()) && (
                <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur px-4 py-2.5 rounded-xl shadow-xl border border-primary/20 z-[1001] text-center">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Boarding OTP</p>
                  <p className="text-3xl font-black text-primary tracking-[0.25em] leading-tight">
                    {trackingData.booking.rideOtp || trackingData.booking.otp || "0000"}
                  </p>
                </div>
              )}

              <div className="absolute top-3 left-3 z-[1001] flex items-center gap-1.5 bg-white/90 backdrop-blur px-2.5 py-1 rounded-full shadow-sm border text-xs font-semibold text-emerald-700">
                <Wifi className="h-3 w-3" /> Live
              </div>
            </div>

            <div className="p-5 bg-white border-t space-y-4 shrink-0 overflow-y-auto">
              <div className="flex justify-between items-center gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 text-xl font-black">
                    {trackingData.ride?.driver?.fullName?.[0]?.toUpperCase() || "D"}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800">{trackingData.ride?.driver?.fullName || "Driver"}</h4>
                    <p className="text-xs text-emerald-600 flex items-center gap-1 mt-0.5 font-medium">
                      <ShieldCheck className="h-3 w-3" /> Verified Partner
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <p className="text-xs text-slate-400 flex items-center gap-1 font-medium">
                    <Car className="h-3.5 w-3.5" /> {trackingData.ride?.vehicleType || "Car"}
                  </p>
                  {trackingData.ride?.driver?.phone && (
                    <a href={`tel:${trackingData.ride.driver.phone}`}>
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-7 text-xs gap-1.5">
                        <Phone className="h-3 w-3" /> Call Driver
                      </Button>
                    </a>
                  )}
                </div>
              </div>

              {ONTRIP_STATUSES.includes(trackingData.booking.status?.toUpperCase()) ? (
                <div className="space-y-3">
                  {(() => {
                    const pStatus = trackingData.booking.paymentStatus?.toUpperCase() || "PENDING";
                    const tFare = trackingData.booking.price || 0;
                    const isAdvPaid = pStatus === "ADVANCE_PAID" || pStatus === "FULL_PAID";
                    const remAmt = isAdvPaid ? (tFare * 0.5) : tFare;

                    return (
                      <>
                        <div className="bg-blue-50 p-3.5 rounded-xl border border-blue-100 text-sm text-blue-800 flex items-start gap-3">
                          <ShieldCheck className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                          {isAdvPaid ? (
                            <p><b>Enjoy your ride!</b> Advance is paid. Settle remaining amount via UPI.</p>
                          ) : (
                            <p><b>Enjoy your ride!</b> Please settle the total fare via UPI after reaching.</p>
                          )}
                        </div>

                        <a
                          href={`upi://pay?pa=${trackingData.ride?.driver?.upiId || "not-set@upi"}&pn=${encodeURIComponent(trackingData.ride?.driver?.fullName || "Driver")}&am=${remAmt.toFixed(0)}&cu=INR`}
                          target="_blank" rel="noreferrer" className="block">
                          <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 shadow-md gap-2 text-base">
                            <SmartphoneNfc className="h-5 w-5" />
                            Pay {isAdvPaid ? "Remaining" : "Total"} ₹{remAmt.toFixed(0)} via UPI
                          </Button>
                        </a>
                      </>
                    );
                  })()}

                  {!trackingData.ride?.driver?.upiId && (
                    <p className="text-[11px] text-center text-red-500 font-semibold">
                      ⚠ Driver has not linked their UPI ID.
                    </p>
                  )}
                </div>
              ) : (
                <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-100 text-sm text-amber-800 flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                  <p><b>Pickup Instruction:</b> Stand near the orange marker. Share your OTP with the driver once seated.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 🔥 CANCELLED WITH REFUND ALERT MODAL */}
      {refundAlertBooking && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in zoom-in-95 duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden p-6 text-center space-y-4 border-t-4 border-t-blue-500">
            <div className="mx-auto h-16 w-16 rounded-full bg-blue-50 flex items-center justify-center">
              <ShieldCheck className="h-8 w-8 text-blue-500" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 leading-tight">Ride Cancelled</h3>
              <p className="text-sm text-slate-500 mt-2">
                We're sorry, your driver had to cancel this scheduled ride.
              </p>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 mt-3">
                <p className="text-xs font-bold text-slate-700">Your advance payment has been</p>
                <p className="text-lg font-black text-blue-600 mt-0.5">100% Refunded</p>
              </div>
              <p className="text-[10px] text-slate-400 mt-2">It will reflect in your original payment method shortly.</p>
            </div>
            <Button
              className="w-full h-12 font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md text-base"
              onClick={() => {
                dismissedRefunds.current.add(refundAlertBooking.id);
                setRefundAlertBooking(null);
              }}
            >
              OK, I Understand
            </Button>
          </div>
        </div>
      )}

    </div>
  );
}