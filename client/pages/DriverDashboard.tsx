import { useEffect, useState, useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MapPin, User, Check, X, Loader2, Clock, Map, Play, Calendar, Car, Users, Phone, LogOut, Home, PlusCircle, Navigation } from "lucide-react";
import { toast } from "sonner";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

// Leaflet Map Imports
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const driverIcon = L.divIcon({
  className: "custom-marker",
  html: `<div class="w-5 h-5 bg-blue-600 border-2 border-white rounded-full shadow-md flex items-center justify-center animate-pulse"><div class="w-2 h-2 bg-white rounded-full"></div></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10]
});

const passengerIcon = L.divIcon({
  className: "custom-marker",
  html: `<div class="w-5 h-5 bg-emerald-500 border-2 border-white rounded-full shadow-md flex items-center justify-center"><div class="w-2 h-2 bg-white rounded-full"></div></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10]
});

const routePointIcon = (color: string) => L.divIcon({
  className: "custom-marker",
  html: `<div class="w-4 h-4 ${color} border-2 border-white rounded-full shadow-sm"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

export default function DriverDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"requests" | "active-rides">("requests");

  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [myRides, setMyRides] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);

  const [selectedRideId, setSelectedRideId] = useState<number | null>(null);
  const [manageRideId, setManageRideId] = useState<number | null>(null);

  const [rideBookings, setRideBookings] = useState<any[]>([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(false);

  const [otpInputs, setOtpInputs] = useState<Record<number, string>>({});
  const [verifyingBookingId, setVerifyingBookingId] = useState<number | null>(null);

  const [driverCoords, setDriverCoords] = useState<[number, number] | null>(null);
  const [passengersLiveCoords, setPassengersLiveCoords] = useState<Record<string, [number, number]>>({});

  const [realRoutePolyline, setRealRoutePolyline] = useState<[number, number][]>([]);

  const watchIdRef = useRef<number | null>(null);
  const stompClientRef = useRef<Client | null>(null);

  const fetchDashboardData = async () => {
    try {
      const authData = localStorage.getItem("ridelink:auth");
      if (!authData || authData === "null") return navigate("/login");

      const authObj = JSON.parse(authData);
      const token = authObj?.token;
      const driverId = authObj?.id || authObj?.userId;

      if (!driverId) return;

      const [pendingRes, ridesRes] = await Promise.all([
        fetch(`http://localhost:9090/api/bookings/driver/${driverId}/pending`, {
          headers: { "Authorization": `Bearer ${token}` }
        }),
        fetch(`http://localhost:9090/api/rides/driver/${driverId}`, {
          headers: { "Authorization": `Bearer ${token}` }
        }).catch(() => null)
      ]);

      if (pendingRes.ok) {
        setPendingRequests(await pendingRes.json());
      }
      if (ridesRes && ridesRes.ok) {
        setMyRides(await ridesRes.json());
      }
    } catch (error) {
      console.error("Dashboard fetch error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 10000);
    return () => clearInterval(interval);
  }, []);

  const groupedRequests = useMemo(() => {
    const groups: Record<number, { ride: any, requests: any[] }> = {};
    pendingRequests.forEach(req => {
      const rId = req.ride?.id;
      if (!rId) return;
      if (!groups[rId]) {
        groups[rId] = { ride: req.ride, requests: [] };
      }
      groups[rId].requests.push(req);
    });
    return groups;
  }, [pendingRequests]);

  const upcomingRides = useMemo(() => {
    return myRides.filter((ride) => {
      const rideTime = new Date(ride.departureTime).getTime();
      const currentTime = new Date().getTime();
      const threeHoursBuffer = 3 * 60 * 60 * 1000;
      const isFutureOrActive = (rideTime + threeHoursBuffer) > currentTime;
      const isNotFinished = ride.status !== 'COMPLETED' && ride.status !== 'CANCELLED';
      return isFutureOrActive && isNotFinished;
    });
  }, [myRides]);

  useEffect(() => {
    if (selectedRideId && !groupedRequests[selectedRideId]) {
      setSelectedRideId(null);
    }
  }, [groupedRequests, selectedRideId]);

  useEffect(() => {
    if (manageRideId) {
      const socket = new SockJS("http://localhost:9090/ws-provider");
      const client = new Client({
        webSocketFactory: () => socket,
        onConnect: () => {
          client.subscribe(`/topic/ride/${manageRideId}`, (message) => {
            const data = JSON.parse(message.body);
            if (data.senderRole === "PASSENGER" && data.passengerId) {
              setPassengersLiveCoords(prev => ({
                ...prev,
                [data.passengerId]: [data.latitude, data.longitude]
              }));
            }
          });
        }
      });

      client.activate();
      stompClientRef.current = client;

      if (navigator.geolocation) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            setDriverCoords([latitude, longitude]);

            if (client && client.connected) {
              client.publish({
                destination: "/app/update-location",
                body: JSON.stringify({
                  rideId: manageRideId,
                  senderRole: "DRIVER",
                  latitude,
                  longitude,
                })
              });
            }
          },
          (err) => console.error("GPS Tracking Error:", err),
          { enableHighAccuracy: true, maximumAge: 10000 }
        );
      }
    }

    return () => {
      if (stompClientRef.current) stompClientRef.current.deactivate();
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      setPassengersLiveCoords({});
      setDriverCoords(null);
      setRealRoutePolyline([]);
    };
  }, [manageRideId]);

  const openManageModal = async (rideId: number) => {
    setManageRideId(rideId);
    setIsLoadingBookings(true);
    try {
      const token = JSON.parse(localStorage.getItem("ridelink:auth") || "{}")?.token;
      const response = await fetch(`http://localhost:9090/api/bookings/ride/${rideId}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setRideBookings(data);
      }
    } catch (error) {
      toast.error("Failed to fetch passengers.");
    } finally {
      setIsLoadingBookings(false);
    }
  };

  const handleAccept = async (bookingId: number) => {
    setProcessingId(bookingId);
    try {
      const token = JSON.parse(localStorage.getItem("ridelink:auth") || "{}")?.token;
      const response = await fetch(`http://localhost:9090/api/bookings/${bookingId}/accept`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (response.ok) {
        toast.success("✅ Request Accepted!");
        setPendingRequests(prev => prev.filter(req => req.id !== bookingId));
        fetchDashboardData();
      } else {
        toast.error("Failed to accept request.");
      }
    } catch (error) {
      toast.error("Server error.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (bookingId: number) => {
    setProcessingId(bookingId);
    try {
      const token = JSON.parse(localStorage.getItem("ridelink:auth") || "{}")?.token;
      const response = await fetch(`http://localhost:9090/api/bookings/${bookingId}/reject`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (response.ok) {
        toast.success("❌ Request Rejected.");
        setPendingRequests(prev => prev.filter(req => req.id !== bookingId));
      } else {
        toast.error("Failed to reject request.");
      }
    } catch (error) {
      toast.error("Server error.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleCancelPassenger = async (bookingId: number) => {
    if (!window.confirm("Are you sure you want to cancel this passenger's ride? This will free up seats.")) return;

    setProcessingId(bookingId);
    try {
      const token = JSON.parse(localStorage.getItem("ridelink:auth") || "{}")?.token;
      const response = await fetch(`http://localhost:9090/api/bookings/${bookingId}/reject`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (response.ok) {
        toast.success("Passenger Cancelled Successfully.");
        setRideBookings(prev => prev.filter(b => b.id !== bookingId));
        fetchDashboardData();
      } else {
        toast.error("Failed to cancel passenger.");
      }
    } catch (error) {
      toast.error("Server error.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleVerifyOtp = async (bookingId: number) => {
    const currentOtp = otpInputs[bookingId] || "";
    if(currentOtp.length !== 4) {
      toast.error("Please enter a valid 4-digit OTP.");
      return;
    }

    setVerifyingBookingId(bookingId);
    try {
      const token = JSON.parse(localStorage.getItem("ridelink:auth") || "{}")?.token;
      const response = await fetch(`http://localhost:9090/api/bookings/verify-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ rideId: manageRideId, otp: currentOtp })
      });

      if (response.ok) {
        toast.success("🎉 OTP Verified! Passenger boarded.");
        setOtpInputs(prev => ({...prev, [bookingId]: ""}));
        openManageModal(manageRideId!);
      } else {
        toast.error("Invalid OTP. Please check again.");
      }
    } catch (error) {
      toast.error("Error verifying OTP.");
    } finally {
      setVerifyingBookingId(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("ridelink:auth");
    toast.success("Logged out successfully");
    navigate("/login");
  };

  const managedRideData = manageRideId ? upcomingRides.find(r => r.id === manageRideId) : null;
  const activeBookings = rideBookings.filter(b => b.status === "CONFIRMED" || b.status === "COMPLETED");

  const mapRouteData = useMemo(() => {
    if (!managedRideData) return null;
    const sLat = managedRideData.sourceLatitude || 22.7196;
    const sLng = managedRideData.sourceLongitude || 75.8577;
    const dLat = managedRideData.destinationLatitude || 22.7244;
    const dLng = managedRideData.destinationLongitude || 75.8839;
    return {
      source: [sLat, sLng] as [number, number],
      destination: [dLat, dLng] as [number, number],
      routePolyline: [[sLat, sLng], [dLat, dLng]] as [number, number][]
    };
  }, [managedRideData]);

  useEffect(() => {
    if (mapRouteData) {
      const fetchRealRoute = async () => {
        try {
          const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${mapRouteData.source[1]},${mapRouteData.source[0]};${mapRouteData.destination[1]},${mapRouteData.destination[0]}?overview=full&geometries=geojson`);
          const data = await response.json();
          if (data.routes && data.routes.length > 0) {
            const coordinates = data.routes[0].geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]]);
            setRealRoutePolyline(coordinates);
          }
        } catch (error) {
          setRealRoutePolyline([mapRouteData.source, mapRouteData.destination]);
        }
      };
      fetchRealRoute();
    }
  }, [mapRouteData]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* NAVBAR */}
      <nav className="bg-white border-b shadow-sm sticky top-0 z-[999]">
        <div className="container mx-auto px-4 max-w-5xl h-16 flex items-center justify-between">
          <Link to="/" className="text-2xl font-extrabold text-primary tracking-tight flex items-center gap-2">
            <Car className="h-7 w-7" />
            RideLink
          </Link>
          <div className="flex items-center gap-4 md:gap-6">
            <Link to="/" className="text-sm font-bold text-slate-600 hover:text-primary flex items-center gap-1.5 transition-colors">
              <Home className="h-4 w-4" /> <span className="hidden md:inline">Home</span>
            </Link>
            <Link to="/post-ride" className="text-sm font-bold text-slate-600 hover:text-primary flex items-center gap-1.5 transition-colors">
              <PlusCircle className="h-4 w-4" /> <span className="hidden md:inline">Post Ride</span>
            </Link>
            <div className="h-6 w-px bg-slate-200 mx-1 hidden md:block"></div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 font-bold flex items-center gap-2 shadow-sm transition-all"
            >
              <LogOut className="h-4 w-4" /> <span className="hidden md:inline">Logout</span>
            </Button>
          </div>
        </div>
      </nav>

      {/* MAIN DASHBOARD CONTENT */}
      <div className="container mx-auto px-4 py-8 max-w-5xl relative">
        <div className="mb-6">
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <Map className="h-8 w-8 text-primary" /> Driver Operations
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage instant requests and your scheduled rides from one place.
          </p>
        </div>

        <div className="flex space-x-1 bg-slate-200/60 p-1 rounded-lg mb-6 max-w-md shadow-inner">
          <Button
            variant={activeTab === "requests" ? "default" : "ghost"}
            className="flex-1 font-semibold"
            onClick={() => setActiveTab("requests")}
          >
            Ride Requests
            {pendingRequests.length > 0 && <Badge className="ml-2 bg-red-500 hover:bg-red-600 text-white">{pendingRequests.length}</Badge>}
          </Button>
          <Button
            variant={activeTab === "active-rides" ? "default" : "ghost"}
            className="flex-1 font-semibold"
            onClick={() => setActiveTab("active-rides")}
          >
            My Active Rides
          </Button>
        </div>

        {/* TAB 1: RIDE REQUESTS */}
        {activeTab === "requests" && (
          <div>
            {Object.keys(groupedRequests).length === 0 ? (
              <Card className="border-dashed shadow-sm">
                <CardContent className="flex flex-col items-center justify-center h-64 space-y-4">
                  <Clock className="h-12 w-12 text-slate-300" />
                  <div className="text-center">
                    <h3 className="font-semibold text-lg text-slate-700">No Pending Requests</h3>
                    <p className="text-slate-500 text-sm">You have no new ride requests right now.</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 lg:grid-cols-2">
                {Object.values(groupedRequests).map((group: any) => (
                  <Card key={group.ride.id} className="shadow-md border-primary/20 hover:shadow-lg transition-all relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
                    <CardHeader className="bg-slate-50 border-b py-4">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Car className="h-5 w-5 text-primary" />
                          {group.ride.sourceName.split(",")[0]} ➔ {group.ride.destinationName.split(",")[0]}
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                      <div className="flex justify-between items-center bg-amber-50/50 p-3 rounded-md border border-amber-100">
                        <div className="flex items-center gap-2">
                          <Users className="h-5 w-5 text-amber-600"/>
                          <div>
                            <p className="font-bold text-slate-800 leading-none">{group.requests.length} Passenger(s)</p>
                            <p className="text-xs text-slate-500 mt-1">Waiting for your approval</p>
                          </div>
                        </div>
                        <Badge className="bg-amber-100 text-amber-800 border-amber-200">Action Required</Badge>
                      </div>
                      <Button
                        className="w-full font-bold shadow-sm text-white bg-primary hover:bg-primary/90"
                        onClick={() => setSelectedRideId(group.ride.id)}
                      >
                        Review Requests
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MY ACTIVE RIDES */}
        {activeTab === "active-rides" && (
          <div>
            {upcomingRides.length === 0 ? (
              <Card className="border-dashed shadow-sm">
                <CardContent className="flex flex-col items-center justify-center h-64 space-y-4">
                  <Calendar className="h-12 w-12 text-slate-300" />
                  <div className="text-center">
                    <h3 className="font-semibold text-lg text-slate-700">No Active Rides</h3>
                    <p className="text-slate-500 text-sm">Post a future ride or accept instant requests to see them here.</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 lg:grid-cols-2">
                {upcomingRides.map((ride) => (
                  <Card key={ride.id} className="shadow-lg border-primary/20 flex flex-col justify-between">
                    <div>
                      <CardHeader className="bg-slate-50 border-b">
                        <div className="flex justify-between items-center">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Car className="h-5 w-5 text-primary" /> {ride.sourceName.split(",")[0]} ➔ {ride.destinationName.split(",")[0]}
                          </CardTitle>
                          <Badge className="bg-blue-500 text-white">{ride.status}</Badge>
                        </div>
                        <CardDescription className="font-medium flex gap-4 mt-2 text-slate-600">
                          <span className="flex items-center gap-1"><Calendar className="h-4 w-4"/> {new Date(ride.departureTime).toLocaleString()}</span>
                          <span className="flex items-center gap-1"><Users className="h-4 w-4"/> {ride.availableSeats} / {ride.totalSeats} Available</span>
                        </CardDescription>
                      </CardHeader>
                    </div>
                    <CardContent className="pt-4 bg-white">
                      <Button
                        className="w-full h-12 text-lg bg-slate-900 text-white hover:bg-slate-800 transition-transform active:scale-95 shadow-md"
                        onClick={() => openManageModal(ride.id)}
                      >
                        <Users className="h-5 w-5 mr-2 text-white" /> Manage Passengers
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MODAL 1: REVIEW PENDING REQUESTS */}
        {selectedRideId && groupedRequests[selectedRideId] && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
              <div className="bg-slate-50 border-b p-4 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-lg text-slate-800">Pending Requests</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {groupedRequests[selectedRideId].ride.sourceName.split(",")[0]} ➔ {groupedRequests[selectedRideId].ride.destinationName.split(",")[0]}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-slate-200 hover:bg-slate-300" onClick={() => setSelectedRideId(null)}>
                  <X className="h-4 w-4 text-slate-700" />
                </Button>
              </div>
              <div className="p-4 overflow-y-auto flex-1 space-y-3 bg-slate-100/50">
                {groupedRequests[selectedRideId].requests.map((request: any) => {
                  const reqTime = request.createdAt || request.bookingTime;
                  return (
                    <div key={request.id} className="bg-white p-4 rounded-lg border shadow-sm flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                            {request.passenger?.fullName?.[0] || <User className="h-5 w-5" />}
                          </div>
                          <div>
                            <p className="font-bold text-sm text-slate-800">{request.passenger?.fullName || "Passenger"}</p>
                            <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                              <Clock className="h-3 w-3"/>
                              {reqTime ? new Date(reqTime).toLocaleString() : "Requested recently"}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          {/* 🔥 FEATURE: Pending Request me Fare add kiya 🔥 */}
                          <p className="font-extrabold text-primary text-lg">₹{request.price || 'N/A'}</p>
                          <Badge variant="outline" className="bg-slate-50 mt-1">{request.seatsBooked} Seat(s)</Badge>
                        </div>
                      </div>

                      {/* 🔥 FEATURE: Driver ko Passenger ka Custom Pickup aur Drop dikh raha hai 🔥 */}
                      {(request.pickupLatitude && request.dropLatitude) && (
                        <div className="bg-slate-50 p-2 rounded border border-slate-100 mt-2 space-y-1">
                          <div className="text-[11px] text-slate-600 flex items-center gap-1.5">
                            <MapPin className="h-3 w-3 text-emerald-500" />
                            <span className="font-semibold text-slate-800">Boarding:</span> {request.pickupLatitude.toFixed(4)}, {request.pickupLongitude.toFixed(4)}
                          </div>
                          <div className="text-[11px] text-slate-600 flex items-center gap-1.5">
                            <Navigation className="h-3 w-3 text-red-500" />
                            <span className="font-semibold text-slate-800">Drop-off:</span> {request.dropLatitude.toFixed(4)}, {request.dropLongitude.toFixed(4)}
                          </div>
                          <a href={`https://www.google.com/maps/dir/${request.pickupLatitude},${request.pickupLongitude}/${request.dropLatitude},${request.dropLongitude}`} target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 font-bold hover:underline flex items-center gap-1 pt-1 w-fit">
                            <Map className="h-3 w-3"/> View Passenger Route on Map
                          </a>
                        </div>
                      )}

                      <div className="flex gap-2 pt-2">
                        <Button variant="outline" size="sm" className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => handleReject(request.id)} disabled={processingId === request.id}>
                          {processingId === request.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reject"}
                        </Button>
                        <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleAccept(request.id)} disabled={processingId === request.id}>
                          {processingId === request.id ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : "Accept"}
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* MODAL 2: MANAGE ACCEPTED PASSENGERS & LIVE MAP OVERVIEW */}
        {manageRideId && managedRideData && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col h-[90vh]">

              <div className="bg-slate-900 border-b p-4 flex justify-between items-center text-white">
                <div>
                  <h3 className="font-bold text-lg">Live Tracking & Management</h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {managedRideData.sourceName.split(",")[0]} ➔ {managedRideData.destinationName.split(",")[0]}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-slate-800 hover:bg-slate-700 text-white" onClick={() => { setManageRideId(null); setRideBookings([]); }}>
                  <X className="h-4 w-4 text-white" />
                </Button>
              </div>

              {mapRouteData && (
                <div className="h-72 w-full border-b relative z-10 bg-slate-100">
                  <MapContainer
                    center={driverCoords || mapRouteData.source}
                    zoom={13}
                    style={{ height: "100%", width: "100%" }}
                  >
                    <TileLayer
                      attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    <Marker position={mapRouteData.source} icon={routePointIcon("bg-amber-500")}>
                      <Popup><b>Main Start Point:</b> {managedRideData.sourceName}</Popup>
                    </Marker>
                    <Marker position={mapRouteData.destination} icon={routePointIcon("bg-red-600")}>
                      <Popup><b>Main Drop-off:</b> {managedRideData.destinationName}</Popup>
                    </Marker>

                    {realRoutePolyline.length > 0 && (
                      <Polyline positions={realRoutePolyline} color="#2563eb" weight={5} opacity={0.8} />
                    )}

                    {activeBookings.map(booking => {
                      return (
                        <div key={`markers-${booking.id}`}>
                          {booking.pickupLatitude && booking.pickupLongitude && (
                            <Marker
                              position={[booking.pickupLatitude, booking.pickupLongitude]}
                              icon={routePointIcon("bg-emerald-500")}
                            >
                              <Popup>
                                <b>Pickup Point:</b> <span className="text-primary">{booking.passenger?.fullName}</span> <br/>
                                {booking.passenger?.phone && (
                                  <a href={`tel:${booking.passenger.phone}`} className="text-xs text-blue-600 font-bold mt-1 inline-block">📞 Call Passenger</a>
                                )}
                              </Popup>
                            </Marker>
                          )}
                          {/* 🔥 FEATURE: Drop marker bhi show kiya gaya Map pe 🔥 */}
                          {booking.dropLatitude && booking.dropLongitude && (
                            <Marker
                              position={[booking.dropLatitude, booking.dropLongitude]}
                              icon={routePointIcon("bg-red-500")}
                            >
                              <Popup>
                                <b>Drop Point:</b> <span className="text-primary">{booking.passenger?.fullName}</span>
                              </Popup>
                            </Marker>
                          )}
                        </div>
                      )
                    })}

                    {driverCoords && (
                      <Marker position={driverCoords} icon={driverIcon}>
                        <Popup><b>You (Driver)</b> <br/> Sharing live location...</Popup>
                      </Marker>
                    )}

                    {Object.entries(passengersLiveCoords).map(([passengerId, coords]) => {
                      const matchedBooking = activeBookings.find(b => b.passenger?.id?.toString() === passengerId);
                      const name = matchedBooking?.passenger?.fullName || "Passenger";
                      return (
                        <Marker key={passengerId} position={coords} icon={passengerIcon}>
                          <Popup>
                            <div className="text-xs">
                              <b className="text-primary">{name}</b> <br />
                              Live Coords: {coords[0].toFixed(4)}, {coords[1].toFixed(4)}
                            </div>
                          </Popup>
                        </Marker>
                      );
                    })}
                  </MapContainer>
                </div>
              )}

              <div className="p-4 overflow-y-auto flex-1 space-y-4 bg-slate-50 relative">
                {isLoadingBookings ? (
                  <div className="flex justify-center items-center py-10">
                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                  </div>
                ) : activeBookings.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                    <h3 className="font-semibold text-slate-700">No Passengers Yet</h3>
                    <p className="text-sm text-slate-500 mt-1">Accept requests from the 'Ride Requests' tab.</p>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {activeBookings.map((booking: any) => {
                      const isVerified = booking.status === "COMPLETED";
                      const bookTime = booking.createdAt || booking.bookingTime;

                      const hasLiveLocation = !!passengersLiveCoords[booking.passenger?.id?.toString()];
                      const passCoords = passengersLiveCoords[booking.passenger?.id?.toString()];

                      const navLat = passCoords ? passCoords[0] : booking.pickupLatitude;
                      const navLng = passCoords ? passCoords[1] : booking.pickupLongitude;

                      return (
                        <div key={booking.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between gap-3">
                          <div>
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-3">
                                <div className="h-9 w-9 bg-slate-100 rounded-full flex items-center justify-center text-slate-700 font-bold text-sm">
                                  {booking.passenger?.fullName?.[0] || <User className="h-4 w-4" />}
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <p className="font-bold text-sm text-slate-800 leading-none">{booking.passenger?.fullName || "Passenger"}</p>
                                    {hasLiveLocation && <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />}
                                  </div>

                                  {/* 🔥 FEATURE: Fare aur Seats Modal 2 me add kiye 🔥 */}
                                  <div className="flex items-center gap-2 mt-1.5">
                                    <Badge variant="secondary" className="text-[10px] py-0 px-1.5">{booking.seatsBooked} Seat(s)</Badge>
                                    <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-none text-[10px] py-0 px-1.5 font-bold">₹{booking.price || 'N/A'} Fare</Badge>
                                  </div>
                                </div>
                              </div>

                              <div className="flex gap-1.5">
                                {navLat && navLng && (
                                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${navLat},${navLng}`} target="_blank" rel="noreferrer">
                                    <Button variant="outline" size="icon" className="h-8 w-8 rounded-full border-emerald-200 text-emerald-600 hover:bg-emerald-50">
                                      <Navigation className="h-3.5 w-3.5" />
                                    </Button>
                                  </a>
                                )}
                                {booking.passenger?.phone && (
                                  <a href={`tel:${booking.passenger.phone}`}>
                                    <Button variant="outline" size="icon" className="h-8 w-8 rounded-full border-blue-200 text-blue-600 hover:bg-blue-50">
                                      <Phone className="h-3.5 w-3.5" />
                                    </Button>
                                  </a>
                                )}
                              </div>
                            </div>

                            <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-2">
                              <Clock className="h-3 w-3" />
                              Booked: {bookTime ? new Date(bookTime).toLocaleString() : "N/A"}
                            </p>
                          </div>

                          {isVerified ? (
                            <div className="bg-emerald-50 border border-emerald-100 p-2 rounded-lg flex items-center justify-center gap-1.5 text-emerald-700 mt-1">
                              <Check className="h-4 w-4" />
                              <span className="font-bold text-xs tracking-wide">Verified & Boarded</span>
                            </div>
                          ) : (
                            <div className="border-t border-slate-100 pt-2 mt-1">
                              <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Verify OTP or Cancel</label>
                              <div className="flex gap-2">
                                <Input
                                  placeholder="OTP"
                                  maxLength={4}
                                  className="bg-slate-50 font-semibold tracking-widest h-8 text-xs w-20"
                                  value={otpInputs[booking.id] || ""}
                                  onChange={(e) => setOtpInputs(prev => ({...prev, [booking.id]: e.target.value}))}
                                />
                                <Button
                                  className="bg-primary text-white hover:bg-primary/90 font-bold h-8 text-xs px-3"
                                  onClick={() => handleVerifyOtp(booking.id)}
                                  disabled={verifyingBookingId === booking.id}
                                >
                                  {verifyingBookingId === booking.id ? <Loader2 className="h-3 w-3 animate-spin text-white"/> : "Verify"}
                                </Button>

                                <Button
                                  variant="outline"
                                  className="border-red-200 text-red-600 hover:bg-red-50 font-bold h-8 text-xs px-3"
                                  onClick={() => handleCancelPassenger(booking.id)}
                                  disabled={processingId === booking.id}
                                >
                                  {processingId === booking.id ? <Loader2 className="h-3 w-3 animate-spin"/> : "Cancel Passenger"}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}