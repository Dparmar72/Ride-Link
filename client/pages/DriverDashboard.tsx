import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  MapPin, User, Check, X, Loader2, Clock, Map as MapIcon, Calendar,
  Car, Users, Phone, LogOut, Home, PlusCircle, Navigation, Flag,
  AlertCircle, QrCode, Wifi, ChevronRight, Zap, Route,
  CheckCircle2, XCircle, ShieldCheck, TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// ─── Map Icons ────────────────────────────────────────────────────────────────
const driverIcon = L.divIcon({
  className: "",
  html: `<div style="width:22px;height:22px;background:#2563eb;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 4px rgba(37,99,235,0.25);display:flex;align-items:center;justify-content:center;"><div style="width:7px;height:7px;background:#fff;border-radius:50%;"></div></div>`,
  iconSize: [22, 22], iconAnchor: [11, 11],
});
const passengerIcon = L.divIcon({
  className: "",
  html: `<div style="width:20px;height:20px;background:#10b981;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(16,185,129,0.4);display:flex;align-items:center;justify-content:center;"><div style="width:6px;height:6px;background:#fff;border-radius:50%;"></div></div>`,
  iconSize: [20, 20], iconAnchor: [10, 10],
});
const pinIcon = (color: string) => L.divIcon({
  className: "",
  html: `<div style="width:14px;height:14px;background:${color};border:2.5px solid #fff;border-radius:50%;box-shadow:0 2px 5px rgba(0,0,0,0.25);"></div>`,
  iconSize: [14, 14], iconAnchor: [7, 7],
});

// ─── Auth helper ──────────────────────────────────────────────────────────────
function getAuth() {
  try {
    const raw = localStorage.getItem("ridelink:auth");
    if (!raw || raw === "null") return null;
    return JSON.parse(raw);
  } catch { return null; }
}
function getToken() { return getAuth()?.token ?? null; }

// ─── Ride status badge ────────────────────────────────────────────────────────
function RideStatusBadge({ status }: { status: string }) {
  const s = status?.toUpperCase();
  const map: Record<string, string> = {
    PENDING:     "bg-amber-50   text-amber-700  border-amber-200",
    CONFIRMED:   "bg-emerald-50 text-emerald-700 border-emerald-200",
    BOARDED:     "bg-blue-50    text-blue-700   border-blue-200",
    STARTED:     "bg-blue-50    text-blue-700   border-blue-200",
    IN_PROGRESS: "bg-blue-50    text-blue-700   border-blue-200",
    COMPLETED:   "bg-slate-100  text-slate-600  border-slate-200",
    CANCELLED:   "bg-red-50     text-red-600    border-red-200",
  };
  const cls = map[s] ?? "bg-slate-50 text-slate-500 border-slate-200";
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${cls}`}>{s}</span>;
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <Card className="shadow-sm border-0">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-10 w-10 rounded-xl ${color} flex items-center justify-center shrink-0`}>{icon}</div>
        <div>
          <p className="text-2xl font-black text-slate-800 leading-none">{value}</p>
          <p className="text-xs text-slate-500 font-medium mt-0.5">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DriverDashboard() {
  const navigate = useNavigate();
  const [activeTab,           setActiveTab]           = useState<"requests" | "active-rides">("requests");
  const [pendingRequests,     setPendingRequests]      = useState<any[]>([]);
  const [myRides,             setMyRides]              = useState<any[]>([]);
  const [isLoading,           setIsLoading]            = useState(true);
  const [processingId,        setProcessingId]         = useState<number | null>(null);
  const [selectedRideId,      setSelectedRideId]       = useState<number | null>(null);
  const [manageRideId,        setManageRideId]         = useState<number | null>(null);
  const [rideBookings,        setRideBookings]         = useState<any[]>([]);
  const [isLoadingBookings,   setIsLoadingBookings]    = useState(false);
  const [otpInputs,           setOtpInputs]            = useState<Record<number, string>>({});
  const [verifyingId,         setVerifyingId]          = useState<number | null>(null);
  const [endingBookingId,     setEndingBookingId]      = useState<number | null>(null);
  const [paymentBooking,      setPaymentBooking]       = useState<any>(null);
  const [rideOperationId,     setRideOperationId]      = useState<number | null>(null);
  const [driverCoords,        setDriverCoords]         = useState<[number, number] | null>(null);
  const [passengersCoords,    setPassengersCoords]     = useState<Record<string, [number, number]>>({});
  const [routePolyline,       setRoutePolyline]        = useState<[number, number][]>([]);
  // stable snapshot so modal survives poll-driven upcomingRides changes
  const [managedRideSnapshot, setManagedRideSnapshot] = useState<any>(null);

  const watchIdRef = useRef<number | null>(null);
  const stompRef   = useRef<Client | null>(null);

  // ── Auth + fetch ─────────────────────────────────────────────────────────
  const fetchDashboardData = useCallback(async () => {
    const auth = getAuth();
    if (!auth) { navigate("/login"); return; }
    const { token, id, userId } = auth;
    const driverId = id || userId;
    if (!driverId) return;

    try {
      const [pendingRes, ridesRes] = await Promise.all([
        fetch(`http://localhost:9090/api/bookings/driver/${driverId}/pending`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`http://localhost:9090/api/rides/driver/${driverId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => null),
      ]);

      if (pendingRes.status === 401) { navigate("/login"); return; }
      if (pendingRes.ok)              setPendingRequests(await pendingRes.json());
      if (ridesRes?.ok)               setMyRides(await ridesRes.json());
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 10_000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  // ── Derived ──────────────────────────────────────────────────────────────
  const groupedRequests = useMemo(() => {
    const groups: Record<number, { ride: any; requests: any[] }> = {};
    pendingRequests.forEach((req) => {
      const rId = req.ride?.id;
      if (!rId) return;
      if (!groups[rId]) groups[rId] = { ride: req.ride, requests: [] };
      groups[rId].requests.push(req);
    });
    return groups;
  }, [pendingRequests]);

  const upcomingRides = useMemo(() => {
    const buffer = 3 * 60 * 60 * 1000;
    return myRides.filter((r) => {
      const onTrip = ["BOARDED", "STARTED", "IN_PROGRESS"].includes(r.status?.toUpperCase());
      const future = new Date(r.departureTime).getTime() + buffer > Date.now();
      return r.status !== "COMPLETED" && r.status !== "CANCELLED" && (future || onTrip);
    });
  }, [myRides]);

  const activeBookings = useMemo(
    () => rideBookings.filter((b) => ["CONFIRMED", "COMPLETED", "BOARDED", "STARTED"].includes(b.status?.toUpperCase())),
    [rideBookings]
  );

  useEffect(() => {
    if (selectedRideId && !groupedRequests[selectedRideId]) setSelectedRideId(null);
  }, [groupedRequests, selectedRideId]);

  // ── OSRM ────────────────
  const srcStr = managedRideSnapshot
    ? `${managedRideSnapshot.sourceLatitude},${managedRideSnapshot.sourceLongitude}` : "";
  const dstStr = managedRideSnapshot
    ? `${managedRideSnapshot.destinationLatitude},${managedRideSnapshot.destinationLongitude}` : "";

  useEffect(() => {
    if (!managedRideSnapshot) { setRoutePolyline([]); return; }
    const sLat = managedRideSnapshot.sourceLatitude      ?? 22.7196;
    const sLng = managedRideSnapshot.sourceLongitude     ?? 75.8577;
    const dLat = managedRideSnapshot.destinationLatitude ?? 22.7244;
    const dLng = managedRideSnapshot.destinationLongitude ?? 75.8839;
    fetch(`https://router.project-osrm.org/route/v1/driving/${sLng},${sLat};${dLng},${dLat}?overview=full&geometries=geojson`)
      .then(r => r.json())
      .then(data => {
        if (data.routes?.[0])
          setRoutePolyline(data.routes[0].geometry.coordinates.map((c: number[]) => [c[1], c[0]]));
      })
      .catch(() => setRoutePolyline([[sLat, sLng], [dLat, dLng]]));
  }, [srcStr, dstStr]);

  // ── WebSocket + GPS ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!manageRideId) return;

    const socket = new SockJS("http://localhost:9090/ws-provider");
    const client = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 5000,
      connectHeaders: {
        Authorization: `Bearer ${getToken()}`
      },
      onConnect: () => {
        client.subscribe(`/topic/ride/${manageRideId}`, (msg) => {
          const d = JSON.parse(msg.body);
          if (d.senderRole === "PASSENGER" && d.passengerId)
            setPassengersCoords(prev => ({ ...prev, [d.passengerId]: [d.latitude, d.longitude] }));
        });
      },
    });
    client.activate();
    stompRef.current = client;

    if (navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        ({ coords }) => {
          setDriverCoords([coords.latitude, coords.longitude]);
          if (client.connected)
            client.publish({
              destination: "/app/update-location",
              body: JSON.stringify({ rideId: manageRideId, senderRole: "DRIVER", latitude: coords.latitude, longitude: coords.longitude }),
            });
        },
        (err) => console.error("GPS error:", err),
        { enableHighAccuracy: true, maximumAge: 10_000 }
      );
    }

    return () => {
      client.deactivate();
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      setPassengersCoords({});
      setDriverCoords(null);
      setRoutePolyline([]);
    };
  }, [manageRideId]);

  // ── Open/close manage modal ──────────────────────────────────────────────
  const openManageModal = useCallback(async (rideId: number) => {
    const snap = upcomingRides.find(r => r.id === rideId) ?? null;
    setManagedRideSnapshot(snap);
    setManageRideId(rideId);
    setIsLoadingBookings(true);
    try {
      const res = await fetch(`http://localhost:9090/api/bookings/ride/${rideId}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) setRideBookings(await res.json());
      else toast.error("Failed to load passengers.");
    } catch { toast.error("Network error loading passengers."); }
    finally { setIsLoadingBookings(false); }
  }, [upcomingRides]);

  const closeManageModal = () => {
    setManageRideId(null);
    setRideBookings([]);
    setManagedRideSnapshot(null);
  };

  // ── Actions ──────────────────────────────────────────────────────────────
  const handleAccept = async (bookingId: number) => {
    setProcessingId(bookingId);
    try {
      const res = await fetch(`http://localhost:9090/api/bookings/${bookingId}/accept`, {
        method: "PUT", headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) { toast.success("Request accepted!"); setPendingRequests(p => p.filter(r => r.id !== bookingId)); fetchDashboardData(); }
      else toast.error("Failed to accept.");
    } catch { toast.error("Network error."); }
    finally { setProcessingId(null); }
  };

  const handleReject = async (bookingId: number) => {
    setProcessingId(bookingId);
    try {
      const res = await fetch(`http://localhost:9090/api/bookings/${bookingId}/reject`, {
        method: "PUT", headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) { toast.success("Request rejected."); setPendingRequests(p => p.filter(r => r.id !== bookingId)); }
      else toast.error("Failed to reject.");
    } catch { toast.error("Network error."); }
    finally { setProcessingId(null); }
  };

  const handleCancelPassenger = async (bookingId: number) => {
    if (!window.confirm("Cancel this passenger's booking? This frees their seat(s).")) return;
    setProcessingId(bookingId);
    try {
      const res = await fetch(`http://localhost:9090/api/bookings/${bookingId}/driver-cancel`, {
        method: "PUT", headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) { toast.success("Passenger removed."); setRideBookings(p => p.filter(b => b.id !== bookingId)); fetchDashboardData(); }
      else toast.error("Failed to remove passenger.");
    } catch { toast.error("Network error."); }
    finally { setProcessingId(null); }
  };

  const handleVerifyOtp = async (bookingId: number) => {
    const otp = (otpInputs[bookingId] ?? "").trim();
    if (!/^\d{4}$/.test(otp)) { toast.error("Enter a valid 4-digit OTP."); return; }
    setVerifyingId(bookingId);
    try {
      const res = await fetch(`http://localhost:9090/api/bookings/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ rideId: manageRideId, otp }),
      });
      if (res.ok) {
        toast.success("OTP verified! Passenger boarded.");
        setOtpInputs(p => ({ ...p, [bookingId]: "" }));
        openManageModal(manageRideId!);
      } else toast.error("Invalid OTP. Please check and retry.");
    } catch { toast.error("Error verifying OTP."); }
    finally { setVerifyingId(null); }
  };

  const handleFinalEndPassengerRide = async (bookingId: number) => {
    setEndingBookingId(bookingId);
    try {
      const res = await fetch(`http://localhost:9090/api/bookings/${bookingId}/end-ride`, {
        method: "PUT", headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) { toast.success("Payment confirmed & passenger dropped!"); setPaymentBooking(null); setRideBookings(p => p.filter(b => b.id !== bookingId)); }
      else toast.error("Failed to end passenger ride.");
    } catch { toast.error("Network error."); }
    finally { setEndingBookingId(null); }
  };

  const handleCompleteEntireRide = async (rideId: number) => {
    if (!window.confirm("End the entire journey? Ensure all passengers are dropped.")) return;
    setRideOperationId(rideId);
    try {
      const res = await fetch(`http://localhost:9090/api/rides/${rideId}/complete`, {
        method: "PUT", headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) toast.success("Journey completed successfully!");
      else        toast.warning("UI updated — please verify server status.");
      closeManageModal();
      fetchDashboardData();
    } catch { toast.error("Network error while completing ride."); }
    finally { setRideOperationId(null); }
  };

  const handleCancelEntireRide = async (rideId: number) => {
    if (!window.confirm("WARNING: This cancels all active passenger bookings. Proceed?")) return;
    setRideOperationId(rideId);
    try {
      const res = await fetch(`http://localhost:9090/api/rides/${rideId}/cancel`, {
        method: "PUT", headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) toast.success("Ride cancelled.");
      else        toast.warning("UI updated — please verify server status.");
      closeManageModal();
      fetchDashboardData();
    } catch { toast.error("Network error while cancelling ride."); }
    finally { setRideOperationId(null); }
  };

  // Map coords
  const mapSrc: [number, number] = [managedRideSnapshot?.sourceLatitude ?? 22.7196, managedRideSnapshot?.sourceLongitude ?? 75.8577];
  const mapDst: [number, number] = [managedRideSnapshot?.destinationLatitude ?? 22.7244, managedRideSnapshot?.destinationLongitude ?? 75.8839];

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <Car className="absolute inset-0 m-auto h-7 w-7 text-primary" />
        </div>
        <p className="text-sm font-medium text-slate-500">Loading driver dashboard…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">

      <div className="container mx-auto px-4 py-8 max-w-5xl">

        {/* ── HEADER ── */}
        <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Driver Operations</h1>
            <p className="text-muted-foreground mt-1 text-sm">Manage requests and active journeys from one place.</p>
          </div>
          <Button asChild className="gap-2 font-semibold shadow-sm">
            <Link to="/post-ride"><PlusCircle className="h-4 w-4" /> Post a Ride</Link>
          </Button>
        </div>

        {/* ── STATS ── */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <StatCard label="Pending Requests" value={pendingRequests.length}
                    icon={<Zap className="h-5 w-5 text-amber-500" />} color="bg-amber-50" />
          <StatCard label="Active Rides" value={upcomingRides.length}
                    icon={<Route className="h-5 w-5 text-blue-500" />} color="bg-blue-50" />
          <StatCard label="Total Rides" value={myRides.length}
                    icon={<TrendingUp className="h-5 w-5 text-emerald-500" />} color="bg-emerald-50" />
        </div>

        {/* ── TABS ── */}
        <div className="flex gap-1 bg-slate-200/70 p-1 rounded-xl mb-6 max-w-sm shadow-inner">
          {(["requests", "active-rides"] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${activeTab === tab ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
              {tab === "requests" ? <Zap className="h-3.5 w-3.5" /> : <Car className="h-3.5 w-3.5" />}
              {tab === "requests" ? "Requests" : "Active Rides"}
              {tab === "requests" && pendingRequests.length > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                  {pendingRequests.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── REQUESTS TAB ── */}
        {activeTab === "requests" && (
          Object.keys(groupedRequests).length === 0 ? (
            <Card className="border-dashed shadow-sm bg-white">
              <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="h-16 w-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <Clock className="h-8 w-8 text-slate-300" />
                </div>
                <div className="text-center">
                  <h3 className="font-bold text-lg text-slate-700">No Pending Requests</h3>
                  <p className="text-slate-500 text-sm mt-1">New passenger requests will appear here.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-5 lg:grid-cols-2">
              {Object.values(groupedRequests).map((group: any) => (
                <Card key={group.ride.id} className="shadow-md border-0 overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="h-1 w-full bg-gradient-to-r from-amber-400 to-orange-400" />
                  <CardHeader className="bg-white border-b py-4 px-5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Car className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-slate-800 truncate">
                            {group.ride.sourceName.split(",")[0]}
                            <ChevronRight className="inline h-3.5 w-3.5 text-slate-400 mx-0.5" />
                            {group.ride.destinationName.split(",")[0]}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(group.ride.departureTime).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                          </p>
                        </div>
                      </div>
                      <Badge className="bg-amber-50 text-amber-700 border border-amber-200 shrink-0 text-[11px] font-bold">Action Needed</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4 pb-5 px-5 bg-slate-50/50">
                    <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-100 shadow-sm mb-4">
                      <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 rounded-full bg-amber-100 flex items-center justify-center">
                          <Users className="h-4 w-4 text-amber-600" />
                        </div>
                        <div>
                          <p className="font-bold text-sm text-slate-800">{group.requests.length} passenger{group.requests.length > 1 ? "s" : ""}</p>
                          <p className="text-xs text-slate-400">awaiting your response</p>
                        </div>
                      </div>
                      <p className="text-xl font-black text-primary">₹{group.requests.reduce((s: number, r: any) => s + (r.price || 0), 0)}</p>
                    </div>
                    <Button className="w-full font-bold shadow-sm gap-2" onClick={() => setSelectedRideId(group.ride.id)}>
                      Review Requests <ChevronRight className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        )}

        {/* ── ACTIVE RIDES TAB ── */}
        {activeTab === "active-rides" && (
          upcomingRides.length === 0 ? (
            <Card className="border-dashed shadow-sm bg-white">
              <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="h-16 w-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <Calendar className="h-8 w-8 text-slate-300" />
                </div>
                <div className="text-center">
                  <h3 className="font-bold text-lg text-slate-700">No Active Rides</h3>
                  <p className="text-slate-500 text-sm mt-1">Post a ride or accept requests to get started.</p>
                </div>
                <Button asChild className="gap-2 font-semibold">
                  <Link to="/post-ride"><PlusCircle className="h-4 w-4" /> Post a Ride</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-5 lg:grid-cols-2">
              {upcomingRides.map((ride) => (
                <Card key={ride.id} className="shadow-md border-0 overflow-hidden hover:shadow-lg transition-shadow">
                  <div className={`h-1 w-full ${["BOARDED","STARTED","IN_PROGRESS"].includes(ride.status?.toUpperCase()) ? "bg-blue-500" : "bg-primary"}`} />
                  <CardHeader className="bg-white border-b py-4 px-5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Car className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-slate-800 truncate">
                            {ride.sourceName.split(",")[0]}
                            <ChevronRight className="inline h-3.5 w-3.5 text-slate-400 mx-0.5" />
                            {ride.destinationName.split(",")[0]}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(ride.departureTime).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                          </p>
                        </div>
                      </div>
                      <RideStatusBadge status={ride.status} />
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4 pb-5 px-5 bg-white">
                    <div className="flex items-center justify-between mb-4 text-xs text-slate-500 font-medium">
                      <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-slate-400" />{ride.availableSeats}/{ride.totalSeats} seats available</span>
                      <span className="flex items-center gap-1 font-bold text-slate-600"><Car className="h-3.5 w-3.5 text-slate-400" />{ride.vehicleType || "Car"}</span>
                    </div>
                    <Button className="w-full h-11 font-bold bg-slate-900 hover:bg-slate-800 text-white gap-2 shadow-sm"
                            onClick={() => openManageModal(ride.id)}>
                      <MapIcon className="h-4 w-4" /> Manage Journey
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        )}

        {/* ── REQUEST REVIEW MODAL ── */}
        {selectedRideId && groupedRequests[selectedRideId] && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[88vh]">
              <div className="bg-white border-b px-5 py-4 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-lg text-slate-900">Passenger Requests</h3>
                  <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-emerald-500" />
                    {groupedRequests[selectedRideId].ride.sourceName.split(",")[0]}
                    <ChevronRight className="h-3 w-3" />
                    {groupedRequests[selectedRideId].ride.destinationName.split(",")[0]}
                  </p>
                </div>
                <button onClick={() => setSelectedRideId(null)}
                        className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
                  <X className="h-4 w-4 text-slate-600" />
                </button>
              </div>
              <div className="p-4 overflow-y-auto flex-1 space-y-3 bg-slate-50/50">
                {groupedRequests[selectedRideId].requests.map((req: any) => (
                  <div key={req.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-black text-base">
                          {req.passenger?.fullName?.[0]?.toUpperCase() ?? "P"}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-slate-800">{req.passenger?.fullName ?? "Passenger"}</p>
                          <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3" />
                            {req.createdAt ? new Date(req.createdAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }) : "Just now"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xl font-black text-primary">₹{req.price ?? "—"}</p>
                        <Badge variant="outline" className="text-[10px] mt-0.5">{req.seatsBooked} seat{req.seatsBooked > 1 ? "s" : ""}</Badge>
                      </div>
                    </div>
                    {req.pickupLatitude && req.dropLatitude && (
                      <div className="bg-slate-50 rounded-lg border border-slate-100 p-3 space-y-1.5">
                        <div className="flex items-center gap-2 text-[11px] text-slate-600">
                          <MapPin className="h-3 w-3 text-emerald-500 shrink-0" />
                          <span className="font-semibold text-slate-700">Pickup:</span>
                          <span>{req.pickupLatitude.toFixed(4)}, {req.pickupLongitude.toFixed(4)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-600">
                          <Navigation className="h-3 w-3 text-red-500 shrink-0" />
                          <span className="font-semibold text-slate-700">Drop:</span>
                          <span>{req.dropLatitude.toFixed(4)}, {req.dropLongitude.toFixed(4)}</span>
                        </div>
                        <a href={`https://www.google.com/maps/dir/${req.pickupLatitude},${req.pickupLongitude}/${req.dropLatitude},${req.dropLongitude}`}
                           target="_blank" rel="noreferrer"
                           className="text-[11px] text-blue-600 font-bold hover:underline flex items-center gap-1 pt-0.5 w-fit">
                          <MapIcon className="h-3 w-3" /> View on Google Maps
                        </a>
                      </div>
                    )}
                    <div className="flex gap-2 pt-1">
                      <Button variant="outline" size="sm" className="flex-1 border-red-200 text-red-600 hover:bg-red-50 font-bold h-9"
                              onClick={() => handleReject(req.id)} disabled={processingId === req.id}>
                        {processingId === req.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><XCircle className="h-3.5 w-3.5 mr-1.5" />Reject</>}
                      </Button>
                      <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-9"
                              onClick={() => handleAccept(req.id)} disabled={processingId === req.id}>
                        {processingId === req.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />Accept</>}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── MANAGE RIDE MODAL ── */}
        {manageRideId && managedRideSnapshot && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col" style={{ maxHeight: "92vh" }}>
              {/* Header */}
              <div className="bg-slate-900 px-5 py-4 flex justify-between items-center text-white shrink-0">
                <div className="flex items-center gap-3">
                  <div className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base">Live Tracking & Management</h3>
                    <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">
                      {managedRideSnapshot.sourceName?.split(",")[0]}
                      <ChevronRight className="inline h-3 w-3 mx-0.5" />
                      {managedRideSnapshot.destinationName?.split(",")[0]}
                    </p>
                  </div>
                </div>
                <button onClick={closeManageModal}
                        className="h-8 w-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-colors">
                  <X className="h-4 w-4 text-white" />
                </button>
              </div>

              {/* Map */}
              <div className="relative shrink-0" style={{ height: 280 }}>
                <MapContainer key={manageRideId} center={driverCoords ?? mapSrc} zoom={13}
                              style={{ height: "100%", width: "100%" }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={mapSrc} icon={pinIcon("#f59e0b")}><Popup><b>Start:</b> {managedRideSnapshot.sourceName}</Popup></Marker>
                  <Marker position={mapDst} icon={pinIcon("#ef4444")}><Popup><b>End:</b> {managedRideSnapshot.destinationName}</Popup></Marker>
                  {routePolyline.length > 0 && <Polyline positions={routePolyline} color="#2563eb" weight={5} opacity={0.8} />}

                  {activeBookings.map((booking) => (
                    <React.Fragment key={booking.id}>
                      {booking.pickupLatitude && booking.pickupLongitude && (
                        <Marker position={[booking.pickupLatitude, booking.pickupLongitude]} icon={pinIcon("#10b981")}>
                          <Popup>
                            <b>Pickup — {booking.passenger?.fullName}</b>
                            {booking.passenger?.phone && <a href={`tel:${booking.passenger.phone}`} className="block text-xs text-blue-600 font-bold mt-1">📞 Call</a>}
                          </Popup>
                        </Marker>
                      )}
                      {booking.dropLatitude && booking.dropLongitude && (
                        <Marker position={[booking.dropLatitude, booking.dropLongitude]} icon={pinIcon("#f43f5e")}>
                          <Popup><b>Drop — {booking.passenger?.fullName}</b></Popup>
                        </Marker>
                      )}
                    </React.Fragment>
                  ))}
                  {driverCoords && <Marker position={driverCoords} icon={driverIcon}><Popup><b>You (Driver)</b></Popup></Marker>}
                  {Object.entries(passengersCoords).map(([pid, coords]) => {
                    const b = activeBookings.find(b => b.passenger?.id?.toString() === pid);
                    return (
                      <Marker key={pid} position={coords} icon={passengerIcon}>
                        <Popup><b>{b?.passenger?.fullName ?? "Passenger"}</b><br />{coords[0].toFixed(4)}, {coords[1].toFixed(4)}</Popup>
                      </Marker>
                    );
                  })}
                </MapContainer>
                <div className="absolute top-3 left-3 z-[1001] bg-white/90 backdrop-blur px-2.5 py-1 rounded-full shadow border text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                  <Wifi className="h-3 w-3" /> Live
                </div>
              </div>

              {/* Passenger list */}
              <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-3">
                {isLoadingBookings ? (
                  <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 text-primary animate-spin" /></div>
                ) : activeBookings.length === 0 ? (
                  <div className="text-center py-10">
                    <Users className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-600">No passengers yet</p>
                    <p className="text-xs text-slate-400 mt-1">Accept requests from the Requests tab.</p>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {activeBookings.map((booking: any) => {
                      const isBoarded  = ["BOARDED", "STARTED", "COMPLETED"].includes(booking.status?.toUpperCase());
                      const hasLiveGps = !!passengersCoords[booking.passenger?.id?.toString()];
                      const navLat     = passengersCoords[booking.passenger?.id?.toString()]?.[0] ?? booking.pickupLatitude;
                      const navLng     = passengersCoords[booking.passenger?.id?.toString()]?.[1] ?? booking.pickupLongitude;

                      // 🔥 ADVANCE PAYMENT LOGIC CALCULATION
                      const paymentStatus = booking.paymentStatus?.toUpperCase() || "PENDING";
                      const totalFare = booking.price || 0;
                      const isAdvancePaid = paymentStatus === "ADVANCE_PAID" || paymentStatus === "FULL_PAID";
                      const advanceAmount = isAdvancePaid ? (totalFare * 0.5) : 0;
                      const remainingAmount = totalFare - advanceAmount;

                      return (
                        <div key={booking.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                          <div className="p-3.5 flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-700 text-sm shrink-0">
                                {booking.passenger?.fullName?.[0]?.toUpperCase() ?? "P"}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <p className="font-bold text-sm text-slate-800 leading-none">{booking.passenger?.fullName ?? "Passenger"}</p>
                                  {hasLiveGps && <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" title="Live GPS" />}
                                </div>
                                {/* 🔥 PAYMENT BADGES UPDATED */}
                                <div className="flex flex-col gap-1 mt-1">
                                  <div className="flex items-center gap-1.5">
                                    <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-bold">{booking.seatsBooked} seat{booking.seatsBooked > 1 ? "s" : ""}</Badge>
                                    <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] py-0 px-1.5 font-bold">Total: ₹{totalFare}</Badge>
                                  </div>

                                  {isAdvancePaid ? (
                                    <div className="flex items-center gap-1">
                                      <Badge className="bg-blue-50 text-blue-700 border border-blue-200 text-[9px] py-0 px-1">Adv: ₹{advanceAmount.toFixed(0)} Paid</Badge>
                                      <Badge className="bg-amber-50 text-amber-700 border border-amber-200 text-[9px] py-0 px-1">Due: ₹{remainingAmount.toFixed(0)}</Badge>
                                    </div>
                                  ) : (
                                    <Badge className="bg-red-50 text-red-600 border border-red-200 text-[9px] py-0 px-1 w-fit">Due: ₹{totalFare} (No Advance)</Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-1.5 shrink-0">
                              {navLat && navLng && (
                                <a href={`https://www.google.com/maps/dir/?api=1&destination=${navLat},${navLng}`} target="_blank" rel="noreferrer">
                                  <Button variant="outline" size="icon" className="h-7 w-7 rounded-full border-emerald-200 text-emerald-600 hover:bg-emerald-50"><Navigation className="h-3 w-3" /></Button>
                                </a>
                              )}
                              {booking.passenger?.phone && (
                                <a href={`tel:${booking.passenger.phone}`}>
                                  <Button variant="outline" size="icon" className="h-7 w-7 rounded-full border-blue-200 text-blue-600 hover:bg-blue-50"><Phone className="h-3 w-3" /></Button>
                                </a>
                              )}
                            </div>
                          </div>

                          {isBoarded ? (
                            <div className="border-t border-slate-100 p-3 space-y-2 bg-slate-50/50">
                              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                                <span className="text-xs font-bold text-emerald-700">Verified & Boarded</span>
                              </div>
                              {/* 🔥 COLLECT BUTTON TEXT UPDATED */}
                              <Button className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold h-8 text-xs gap-1.5"
                                      onClick={() => setPaymentBooking(booking)}>
                                <QrCode className="h-3.5 w-3.5" /> Collect ₹{remainingAmount.toFixed(0)} & Drop
                              </Button>
                            </div>
                          ) : (
                            <div className="border-t border-slate-100 p-3 bg-slate-50/50">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Verify Boarding OTP</p>
                              <div className="flex gap-2">
                                <Input
                                  placeholder="0000" maxLength={4}
                                  inputMode="numeric" pattern="\d{4}"
                                  className="h-8 text-xs font-bold tracking-[0.2em] text-center bg-white border-slate-200 w-20 shrink-0"
                                  value={otpInputs[booking.id] ?? ""}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                                    setOtpInputs(p => ({ ...p, [booking.id]: val }));
                                  }}
                                />
                                <Button className="flex-1 bg-primary hover:bg-primary/90 text-white font-bold h-8 text-xs"
                                        onClick={() => handleVerifyOtp(booking.id)} disabled={verifyingId === booking.id}>
                                  {verifyingId === booking.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Check className="h-3 w-3 mr-1" />Verify</>}
                                </Button>
                                <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 font-bold h-8 text-xs px-3"
                                        onClick={() => handleCancelPassenger(booking.id)} disabled={processingId === booking.id}>
                                  {processingId === booking.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Cancel"}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Journey controls */}
              <div className="bg-white border-t px-5 py-4 flex items-center justify-between gap-3 shrink-0">
                <div>
                  <p className="font-bold text-sm text-slate-800">Journey Controls</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">End or cancel the trip for all passengers.</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline"
                          className="border-red-200 text-red-600 hover:bg-red-50 font-bold h-9 text-xs gap-1.5"
                          onClick={() => handleCancelEntireRide(manageRideId!)} disabled={rideOperationId === manageRideId}>
                    {rideOperationId === manageRideId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><AlertCircle className="h-3.5 w-3.5" />Cancel Ride</>}
                  </Button>
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-9 text-xs gap-1.5 shadow-sm"
                          onClick={() => handleCompleteEntireRide(manageRideId!)} disabled={rideOperationId === manageRideId}>
                    {rideOperationId === manageRideId ? <Loader2 className="h-3.5 w-3.5 animate-spin text-white" /> : <><Flag className="h-3.5 w-3.5" />End Journey</>}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── PAYMENT / QR MODAL ── */}
        {paymentBooking && (
          <div className="fixed inset-0 z-[1001] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in zoom-in-95 duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
              <div className="bg-slate-900 text-white px-5 py-4 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-base">Collect Payment</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{paymentBooking.passenger?.fullName}</p>
                </div>
                <button onClick={() => setPaymentBooking(null)}
                        className="h-8 w-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center">
                  <X className="h-4 w-4 text-white" />
                </button>
              </div>

              {/* 🔥 QR MODAL UPDATED LOGIC */}
              <div className="p-6 flex flex-col items-center gap-5 bg-slate-50">
                {(() => {
                  const pStatus = paymentBooking.paymentStatus?.toUpperCase() || "PENDING";
                  const fare = paymentBooking.price || 0;
                  const isAdv = pStatus === "ADVANCE_PAID" || pStatus === "FULL_PAID";
                  const dueAmount = isAdv ? (fare * 0.5) : fare;

                  return (
                    <>
                      {isAdv && (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 w-full text-center">
                          <p className="text-xs font-bold text-blue-700">✅ 50% Advance (₹{(fare * 0.5).toFixed(0)}) is in Escrow.</p>
                          <p className="text-[10px] text-blue-600 mt-0.5">It will be transferred to your account after dropping the passenger.</p>
                        </div>
                      )}

                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-2.5 text-center w-full mt-2">
                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
                          {isAdv ? "Remaining Cash/UPI to Collect" : "Total Amount to Collect"}
                        </p>
                        <p className="text-3xl font-black text-emerald-700">₹{dueAmount.toFixed(0)}</p>
                      </div>

                      {dueAmount > 0 ? (
                        <div className="bg-white p-3 rounded-2xl shadow-md border border-slate-200">
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                              `upi://pay?pa=${managedRideSnapshot?.driver?.upiId ?? "not-set@upi"}&pn=${encodeURIComponent(managedRideSnapshot?.driver?.fullName ?? "Driver")}&am=${dueAmount.toFixed(0)}&cu=INR`
                            )}`}
                            alt="UPI QR Code"
                            className="w-48 h-48 rounded-xl"
                          />
                        </div>
                      ) : (
                        <p className="text-sm font-bold text-emerald-600">Payment Fully Settled!</p>
                      )}
                    </>
                  );
                })()}

                {!managedRideSnapshot?.driver?.upiId && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 w-full">
                    <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                    <p className="text-xs text-red-600 font-bold">UPI ID not linked. QR payment may fail.</p>
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                  PhonePe · GPay · Paytm and all UPI apps supported
                </div>
              </div>
              <div className="px-5 pb-5 bg-white space-y-2 pt-4">
                <Button className="w-full h-12 text-base font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md gap-2"
                        onClick={() => handleFinalEndPassengerRide(paymentBooking.id)} disabled={endingBookingId === paymentBooking.id}>
                  {endingBookingId === paymentBooking.id ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Check className="h-5 w-5" /> Payment Received & End Ride</>}
                </Button>
                <Button variant="ghost" className="w-full text-sm text-slate-400 hover:text-slate-600" onClick={() => setPaymentBooking(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}