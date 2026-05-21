import { useEffect, useState, useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, User, Users, X, Loader2, Clock, Map as MapIcon, Calendar, Car, Navigation, ShieldCheck, LogOut, Home, Phone } from "lucide-react";
import { toast } from "sonner";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const carIcon = L.divIcon({
  className: "",
  html: `<div style="font-size: 32px; line-height: 1; filter: drop-shadow(2px 4px 4px rgba(0,0,0,0.5)); transform: scaleX(-1);">🚗</div>`,
  iconSize: [35, 35],
  iconAnchor: [17, 17],
  popupAnchor: [0, -15]
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

export default function PassengerDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"active" | "history">("active");
  const [myBookings, setMyBookings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const [trackingBookingId, setTrackingBookingId] = useState<number | null>(null);
  const [passengerCoords, setPassengerCoords] = useState<[number, number] | null>(null);
  const [driverLiveCoords, setDriverLiveCoords] = useState<[number, number] | null>(null);
  const [realRoutePolyline, setRealRoutePolyline] = useState<[number, number][]>([]);

  const watchIdRef = useRef<number | null>(null);
  const stompClientRef = useRef<Client | null>(null);

  // 🔥 FEATURE: State tracker to detect driver cancellations 🔥
  const prevBookingsRef = useRef<any[]>([]);
  const passengerCancelledRefs = useRef<Set<number>>(new Set());

  const fetchBookings = async () => {
    try {
      const authData = localStorage.getItem("ridelink:auth");
      if (!authData || authData === "null") return navigate("/login");
      const authObj = JSON.parse(authData);
      const token = authObj?.token;
      const passengerId = authObj?.id || authObj?.userId;
      if (!passengerId) return;

      const response = await fetch(`http://localhost:9090/api/bookings/passenger/${passengerId}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        const bookingsArray = data.content || data.data || data;
        setMyBookings(Array.isArray(bookingsArray) ? bookingsArray : []);
      }
    } catch (error) {
      console.error("Dashboard fetch error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
    const interval = setInterval(fetchBookings, 10000);
    return () => clearInterval(interval);
  }, []);

  // 🔥 FEATURE: Auto-detect Cancellation & Auto-Forwarding Redirect Logic 🔥
  useEffect(() => {
    if (prevBookingsRef.current.length > 0) {
      myBookings.forEach(currentBooking => {
        const prevBooking = prevBookingsRef.current.find(b => b.id === currentBooking.id);

        if (prevBooking) {
          const wasActive = ["PENDING", "CONFIRMED", "ACCEPTED"].includes(prevBooking.status?.toUpperCase());
          const isNowActive = ["PENDING", "CONFIRMED", "ACCEPTED"].includes(currentBooking.status?.toUpperCase());
          const isNowCancelled = ["CANCELLED", "REJECTED"].includes(currentBooking.status?.toUpperCase());

          // CASE 1: Agar ride cancel ho gayi (Matlab auto-forwarding me bhi koi dusra driver nahi mila)
          if (wasActive && isNowCancelled) {
            if (!passengerCancelledRefs.current.has(currentBooking.id)) {
              toast.error("⚠️ No drivers available right now. Your request was cancelled.");

              if (trackingBookingId === currentBooking.id) {
                setTrackingBookingId(null);
              }
              navigate("/book");
            }
          }

          // CASE 2: 🔥 AUTO-FORWARDING DETECTED 🔥
          // Status abhi bhi active hai, lekin Ride ID (Driver) badal chuka hai
          if (wasActive && isNowActive && prevBooking.ride?.id !== currentBooking.ride?.id) {
            toast.info("🔄 Previous driver couldn't accept. We automatically matched you with a new driver!", {
              duration: 5000,
            });

            if (trackingBookingId === currentBooking.id) {
              setTrackingBookingId(null);
            }
          }
        }
      });
    }
    prevBookingsRef.current = myBookings;
  }, [myBookings, trackingBookingId, navigate]);

  const handleCancelRide = async (bookingId: number) => {
    if (!window.confirm("Are you sure you want to cancel this ride? Driver might be on the way.")) return;

    setCancellingId(bookingId);
    passengerCancelledRefs.current.add(bookingId);

    try {
      const token = JSON.parse(localStorage.getItem("ridelink:auth") || "{}")?.token;
      const response = await fetch(`http://localhost:9090/api/bookings/${bookingId}/cancel`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (response.ok) {
        toast.success("Ride cancelled successfully.");
        fetchBookings();
      } else {
        toast.error("Failed to cancel ride.");
      }
    } catch (error) {
      toast.error("Server error while cancelling.");
    } finally {
      setCancellingId(null);
    }
  };

  const activeRides = useMemo(() =>
      myBookings.filter(b => b.status?.toUpperCase() === "PENDING" || b.status?.toUpperCase() === "CONFIRMED" || b.status?.toUpperCase() === "ACCEPTED"),
    [myBookings]);

  const historyRides = useMemo(() =>
      myBookings.filter(b => b.status?.toUpperCase() === "COMPLETED" || b.status?.toUpperCase() === "CANCELLED" || b.status?.toUpperCase() === "REJECTED"),
    [myBookings]);

  const trackingData = useMemo(() => {
    if (!trackingBookingId) return null;
    const booking = activeRides.find(b => b.id === trackingBookingId);
    if (!booking || !booking.ride) return null;

    const sLat = booking.pickupLatitude || booking.ride.sourceLatitude || 22.7196;
    const sLng = booking.pickupLongitude || booking.ride.sourceLongitude || 75.8577;
    const dLat = booking.dropLatitude || booking.ride.destinationLatitude || 22.7244;
    const dLng = booking.dropLongitude || booking.ride.destinationLongitude || 75.8839;

    return {
      booking: booking,
      ride: booking.ride,
      source: [sLat, sLng] as [number, number],
      destination: [dLat, dLng] as [number, number]
    };
  }, [trackingBookingId, activeRides]);

  useEffect(() => {
    if (trackingData) {
      const fetchRealRoute = async () => {
        try {
          const start = trackingData.source;
          const end = trackingData.destination;
          const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`);
          const data = await response.json();
          if (data.routes && data.routes.length > 0) {
            const coordinates = data.routes[0].geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]]);
            setRealRoutePolyline(coordinates);
          }
        } catch (error) {
          setRealRoutePolyline([]);
        }
      };
      fetchRealRoute();
    }
  }, [trackingData]);

  useEffect(() => {
    if (trackingData) {
      const authData = JSON.parse(localStorage.getItem("ridelink:auth") || "{}");
      const myPassengerId = authData.id || authData.userId || 2;
      const currentRideId = trackingData.ride.id;

      const socket = new SockJS("http://localhost:9090/ws-provider");
      const client = new Client({
        webSocketFactory: () => socket,
        onConnect: () => {
          client.subscribe(`/topic/ride/${currentRideId}`, (message) => {
            const data = JSON.parse(message.body);
            if (data.senderRole === "DRIVER") {
              setDriverLiveCoords([data.latitude, data.longitude]);
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
            setPassengerCoords([latitude, longitude]);
            if (client && client.connected) {
              client.publish({
                destination: "/app/update-location",
                body: JSON.stringify({ rideId: currentRideId, senderRole: "PASSENGER", passengerId: myPassengerId, latitude, longitude })
              });
            }
          },
          (err) => console.error("Passenger GPS Error:", err),
          { enableHighAccuracy: true, maximumAge: 10000 }
        );
      }
    }
    return () => {
      if (stompClientRef.current) stompClientRef.current.deactivate();
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      setDriverLiveCoords(null);
      setRealRoutePolyline([]);
    };
  }, [trackingData]);

  const handleLogout = () => {
    localStorage.removeItem("ridelink:auth");
    navigate("/login");
  };

  if (isLoading) return <div className="flex justify-center items-center h-screen"><Loader2 className="h-10 w-10 text-primary animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b shadow-sm sticky top-0 z-[999]">
        <div className="container mx-auto px-4 max-w-5xl h-16 flex items-center justify-between">
          <Link to="/" className="text-2xl font-extrabold text-primary tracking-tight flex items-center gap-2"><Car className="h-7 w-7" /> RideLink</Link>
          <div className="flex items-center gap-4 md:gap-6">
            <Link to="/" className="text-sm font-bold text-slate-600 hover:text-primary flex items-center gap-1.5"><Home className="h-4 w-4" /> <span className="hidden md:inline">Home</span></Link>
            <Link to="/book" className="text-sm font-bold text-slate-600 hover:text-primary flex items-center gap-1.5"><MapPin className="h-4 w-4" /> <span className="hidden md:inline">Book Ride</span></Link>
            <div className="h-6 w-px bg-slate-200 mx-1 hidden md:block"></div>
            <Button variant="outline" size="sm" onClick={handleLogout} className="border-red-200 text-red-600 hover:bg-red-50 font-bold flex gap-2"><LogOut className="h-4 w-4" /> <span className="hidden md:inline">Logout</span></Button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-6">
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2"><User className="h-8 w-8 text-primary" /> My Rides</h1>
          <p className="text-muted-foreground mt-1">Track your upcoming journeys and booking history.</p>
        </div>

        <div className="flex space-x-1 bg-slate-200/60 p-1 rounded-lg mb-6 max-w-md shadow-inner">
          <Button variant={activeTab === "active" ? "default" : "ghost"} className="flex-1 font-semibold" onClick={() => setActiveTab("active")}>
            Active Trips {activeRides.length > 0 && <Badge className="ml-2 bg-emerald-500 hover:bg-emerald-600 text-white">{activeRides.length}</Badge>}
          </Button>
          <Button variant={activeTab === "history" ? "default" : "ghost"} className="flex-1 font-semibold" onClick={() => setActiveTab("history")}>
            Ride History
          </Button>
        </div>

        {activeTab === "active" && (
          <div>
            {activeRides.length === 0 ? (
              <Card className="border-dashed shadow-sm">
                <CardContent className="flex flex-col items-center justify-center h-64 space-y-4">
                  <MapIcon className="h-12 w-12 text-slate-300" />
                  <div className="text-center">
                    <h3 className="font-semibold text-lg text-slate-700">No Active Bookings</h3>
                    <p className="text-slate-500 text-sm">You haven't requested any rides yet.</p>
                    <Button asChild className="mt-4"><Link to="/book">Book a Ride Now</Link></Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 lg:grid-cols-2">
                {activeRides.map((booking) => {
                  const ride = booking.ride;
                  const isConfirmed = booking.status?.toUpperCase() === "CONFIRMED" || booking.status?.toUpperCase() === "ACCEPTED";

                  return (
                    <Card key={booking.id} className={`shadow-lg border-t-4 flex flex-col justify-between ${isConfirmed ? 'border-t-emerald-500' : 'border-t-amber-500'}`}>
                      <CardHeader className="bg-white border-b pb-4">
                        <div className="flex justify-between items-start">
                          <div>
                            {/* 🔥 FEATURE: Privacy Fix - Ab driver ka route nahi dikhega 🔥 */}
                            <CardTitle className="text-lg flex flex-col gap-2 mt-1">
                              <span className="flex items-center gap-2 text-sm font-bold text-slate-800">
                                <MapPin className="h-4 w-4 text-emerald-500"/> Your Boarding Point
                              </span>
                              <span className="flex items-center gap-2 text-sm font-bold text-slate-800">
                                <Navigation className="h-4 w-4 text-red-500"/> Your Drop-off Point
                              </span>
                            </CardTitle>
                          </div>
                          <Badge className={isConfirmed ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-amber-100 text-amber-800 border-amber-200 animate-pulse"}>
                            {isConfirmed ? "Driver Confirmed" : "Finding Driver..."}
                          </Badge>
                        </div>
                        <CardDescription className="font-medium flex gap-4 mt-4 text-slate-600">
                          <span className="flex items-center gap-1"><Calendar className="h-4 w-4"/> {ride?.departureTime ? new Date(ride.departureTime).toLocaleString() : "TBA"}</span>
                          <span className="flex items-center gap-1"><Users className="h-4 w-4"/> {booking.seatsBooked} Seat(s)</span>
                        </CardDescription>
                      </CardHeader>

                      <CardContent className="pt-4 bg-slate-50">
                        {isConfirmed ? (
                          <div className="space-y-4">
                            <div className="flex justify-between items-center bg-white p-3 rounded-lg border">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                                  {ride?.driver?.fullName?.[0] || "D"}
                                </div>
                                <div>
                                  <p className="font-bold text-sm">{ride?.driver?.fullName || "Your Driver"}</p>
                                  <p className="text-xs text-slate-500 flex items-center gap-1"><Car className="h-3 w-3"/> Vehicle Assigned</p>
                                </div>
                              </div>
                              <div className="text-center">
                                <p className="text-[10px] font-bold text-slate-500 uppercase">Boarding OTP</p>
                                <p className="text-xl font-black text-emerald-600 tracking-widest">{booking.rideOtp || booking.otp || "****"}</p>
                              </div>
                            </div>

                            <div className="flex gap-2">
                              <Button className="flex-1 font-bold bg-slate-900 text-white hover:bg-slate-800" onClick={() => setTrackingBookingId(booking.id)}>
                                <MapIcon className="mr-2 h-4 w-4" /> Track
                              </Button>
                              <Button
                                variant="outline"
                                className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 font-bold"
                                onClick={() => handleCancelRide(booking.id)}
                                disabled={cancellingId === booking.id}
                              >
                                {cancellingId === booking.id ? <Loader2 className="h-4 w-4 animate-spin"/> : "Cancel"}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="py-4 flex flex-col items-center justify-center text-center space-y-2">
                            <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
                            <p className="text-sm font-semibold text-slate-700">Waiting for driver approval...</p>

                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-600 hover:bg-red-50 mt-2 font-bold"
                              onClick={() => handleCancelRide(booking.id)}
                              disabled={cancellingId === booking.id}
                            >
                              {cancellingId === booking.id ? "Cancelling..." : "Cancel Request"}
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: RIDE HISTORY */}
        {activeTab === "history" && (
          <div className="grid gap-4 md:grid-cols-2">
            {historyRides.map((booking) => {
              const isRejected = booking.status?.toUpperCase() === "REJECTED";
              const isDriverCancelled = isRejected || (booking.status?.toUpperCase() === "CANCELLED" && !passengerCancelledRefs.current.has(booking.id));

              return (
                <Card key={booking.id} className="opacity-75 bg-slate-50">
                  <div className="p-4 flex justify-between items-center">
                    <div>
                      {/* 🔥 FEATURE: Privacy Fix in History 🔥 */}
                      <p className="font-bold text-sm flex items-center gap-1.5 text-slate-700"><MapPin className="h-3.5 w-3.5 text-emerald-500"/> Personal Commute</p>
                      <p className="text-xs text-slate-500 mt-1">{booking.ride?.departureTime ? new Date(booking.ride.departureTime).toLocaleString() : ""}</p>
                    </div>
                    <Badge variant="outline" className={booking.status?.toUpperCase() === "COMPLETED" ? "border-emerald-500 text-emerald-600" : "border-red-500 text-red-600 bg-red-50"}>
                      {isDriverCancelled ? "CANCELLED BY DRIVER" : booking.status}
                    </Badge>
                  </div>
                </Card>
              )
            })}
          </div>
        )}

        {/* TRACKING MODAL */}
        {trackingBookingId && trackingData && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col h-[90vh]">

              <div className="bg-slate-900 border-b p-4 flex justify-between items-center text-white">
                <div>
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span>
                    Live Ride Tracking
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">Your vehicle is heading to the pickup point</p>
                </div>
                <Button variant="ghost" size="icon" className="hover:bg-slate-700 text-white" onClick={() => setTrackingBookingId(null)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* LEAFLET MAP */}
              <div className="flex-1 w-full relative z-10 bg-slate-100 min-h-[50vh]">
                <MapContainer center={passengerCoords || trackingData.source} zoom={13} style={{ height: "100%", width: "100%" }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                  <Marker position={trackingData.source} icon={routePointIcon("bg-amber-500")}>
                    <Popup><b>Boarding Point</b></Popup>
                  </Marker>
                  <Marker position={trackingData.destination} icon={routePointIcon("bg-red-600")}>
                    <Popup><b>Drop-off Point</b></Popup>
                  </Marker>

                  {/* Draw main route */}
                  {realRoutePolyline.length > 0 ? (
                    <Polyline positions={realRoutePolyline} color="#2563eb" weight={5} opacity={0.7} />
                  ) : (
                    <Polyline positions={[trackingData.source, trackingData.destination]} color="#f59e0b" weight={4} opacity={0.7} dashArray="5, 10" />
                  )}

                  {driverLiveCoords && (
                    <Marker position={driverLiveCoords} icon={carIcon}>
                      <Popup><b>Your Driver</b> is here</Popup>
                    </Marker>
                  )}

                  {passengerCoords && (
                    <Marker position={passengerCoords} icon={passengerIcon}>
                      <Popup><b>You</b></Popup>
                    </Marker>
                  )}
                </MapContainer>

                <div className="absolute bottom-4 right-4 bg-white px-4 py-2 rounded-lg shadow-xl border-2 border-primary z-[1001] flex flex-col items-center">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Boarding OTP</p>
                  <p className="text-2xl font-black text-primary tracking-widest">{trackingData.booking.rideOtp || trackingData.booking.otp || "0000"}</p>
                </div>
              </div>

              <div className="p-5 bg-white border-t space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 bg-slate-100 rounded-full flex items-center justify-center">
                      <User className="h-6 w-6 text-slate-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800">{trackingData.ride?.driver?.fullName || "Driver"}</h4>
                      <p className="text-xs font-medium text-emerald-600 flex items-center gap-1 mt-0.5"><ShieldCheck className="h-3 w-3"/> Verified Partner</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="text-right">
                      <p className="text-xs text-slate-500 uppercase font-bold">Vehicle</p>
                      <p className="font-semibold text-slate-800 flex items-center gap-1 justify-end"><Car className="h-4 w-4 text-slate-400"/> {trackingData.ride?.vehicleType || "Car"}</p>
                    </div>
                    {/* Call Feature Button */}
                    {trackingData.ride?.driver?.phone && (
                      <a href={`tel:${trackingData.ride?.driver?.phone}`}>
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-7 text-xs">
                          <Phone className="h-3 w-3 mr-1.5"/> Call Driver
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg flex items-start gap-3 border text-sm text-slate-600">
                  <MapPin className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                  <p><b>Pickup Instruction:</b> Please stand at a safe spot near the boarding point (Orange marker). Share the OTP with the driver once you sit in the vehicle.</p>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}