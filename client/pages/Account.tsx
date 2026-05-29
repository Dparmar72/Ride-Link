import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Car, Ticket, MapPin, Users, Phone, Loader2,
  ShieldCheck, CheckCircle2, ArrowRight, Clock,
  IndianRupee, Hash, AlertCircle, Navigation
} from "lucide-react";
import { toast } from "sonner";

/* ─── helpers ─────────────────────────────────────────────────────── */
const maskPhone = (phone?: string) => {
  if (!phone) return "N/A";
  if (phone.length <= 3) return phone;
  return "*".repeat(phone.length - 3) + phone.slice(-3);
};

const safeArray = (val: any): any[] => (Array.isArray(val) ? val : []);

/* ─── status pill ─────────────────────────────────────────────────── */
const STATUS_STYLES: Record<string, string> = {
  CONFIRMED:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  BOARDED:    "bg-blue-50 text-blue-700 border-blue-200",
  PENDING:    "bg-amber-50 text-amber-700 border-amber-200",
  CANCELLED:  "bg-red-50 text-red-600 border-red-200",
  COMPLETED:  "bg-slate-100 text-slate-600 border-slate-200",
};
function StatusPill({ status }: { status?: string }) {
  const s = (status || "PENDING").toUpperCase();
  const cls = STATUS_STYLES[s] ?? "bg-slate-100 text-slate-600 border-slate-200";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${cls}`}>
      {s}
    </span>
  );
}

/* ─── empty state ─────────────────────────────────────────────────── */
function Empty({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 py-14 text-slate-400">
      <AlertCircle className="h-8 w-8 opacity-40" />
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
export default function Account() {
  const [myRides,    setMyRides]    = useState<any[]>([]);
  const [myBookings, setMyBookings] = useState<any[]>([]);
  const [isLoading,  setIsLoading]  = useState(true);

  const [selectedRide,      setSelectedRide]      = useState<any>(null);
  const [selectedBooking,   setSelectedBooking]   = useState<any>(null);
  const [ridePassengers,    setRidePassengers]    = useState<any[]>([]);
  const [isFetchingPass,    setIsFetchingPass]    = useState(false);

  const [otpInputs,   setOtpInputs]   = useState<Record<number, string>>({});
  const [verifyingId, setVerifyingId] = useState<number | null>(null);

  const authData = JSON.parse(localStorage.getItem("ridelink:auth") || "{}");
  const userId   = authData.id;
  const token    = authData.token;

  useEffect(() => {
    const load = async () => {
      if (!userId || !token) { setIsLoading(false); return; }
      try {
        setIsLoading(true);
        const h = { Authorization: `Bearer ${token}` };

        const ridesRes    = await fetch(`https://ride-link-backend.onrender.com/api/rides/driver/${userId}`,    { headers: h });
        const ridesData   = await ridesRes.json();
        setMyRides(safeArray(ridesData));

        const bookingsRes  = await fetch(`https://ride-link-backend.onrender.com/api/bookings/passenger/${userId}`, { headers: h });
        const bookingsData = await bookingsRes.json();
        setMyBookings(safeArray(bookingsData));
      } catch {
        toast.error("Failed to load account data");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [userId, token]);

  const handleRideClick = async (ride: any) => {
    setSelectedRide(ride);
    setRidePassengers([]);
    setIsFetchingPass(true);
    setOtpInputs({});
    try {
      const res  = await fetch(`https://ride-link-backend.onrender.com/api/bookings/ride/${ride.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setRidePassengers(safeArray(data));
    } catch {
      toast.error("Could not load passenger details");
    } finally {
      setIsFetchingPass(false);
    }
  };

  const handleVerifyOtp = async (bookingId: number) => {
    const otp = otpInputs[bookingId];
    if (!otp || otp.length < 4) { toast.error("Please enter a valid 4-digit OTP"); return; }
    setVerifyingId(bookingId);
    try {
      const res = await fetch(
        `https://ride-link-backend.onrender.com/api/bookings/verify-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ rideId: selectedRide?.id, otp }),
        }
      );
      if (!res.ok) throw new Error("Invalid OTP");
      toast.success("Passenger verified successfully!");
      setRidePassengers(prev =>
        prev.map(p => p.id === bookingId ? { ...p, status: "BOARDED" } : p)
      );
    } catch (err: any) {
      toast.error(err.message || "Invalid OTP");
    } finally {
      setVerifyingId(null);
    }
  };

  if (isLoading)
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm font-medium">Loading your account…</p>
      </div>
    );

  const initials = (authData.name || authData.fullName || "U")
    .split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();

  /* ══════════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white pb-16">
      <div className="mx-auto max-w-3xl px-4 py-10">

        {/* ── profile strip ──────────────────────────────────────── */}
        <div className="mb-8 flex items-center gap-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <Link
            to="/profile"
            className="flex items-center gap-4 flex-1 min-w-0 group"
          >
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-xl font-black text-white shadow group-hover:bg-slate-700 transition-colors">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="truncate text-xl font-extrabold text-slate-900 tracking-tight group-hover:text-primary transition-colors underline-offset-2 group-hover:underline">
                {authData.name || authData.fullName || "User"}
              </h1>
              <p className="truncate text-sm text-slate-500">{authData.email}</p>
              <p className="text-[11px] font-semibold text-primary mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                View Profile →
              </p>
            </div>
          </Link>
          <span className="hidden sm:inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-600">
            {authData.role || "USER"}
          </span>
        </div>

        {/* ── tabs ───────────────────────────────────────────────── */}
        <Tabs defaultValue="bookings" className="w-full">
          <TabsList className="mb-6 grid w-full grid-cols-2 rounded-xl bg-slate-100 p-1">
            <TabsTrigger
              value="bookings"
              className="rounded-lg font-semibold gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <Ticket className="h-4 w-4" /> My Bookings
            </TabsTrigger>
            <TabsTrigger
              value="rides"
              className="rounded-lg font-semibold gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <Car className="h-4 w-4" /> My Rides
            </TabsTrigger>
          </TabsList>

          {/* ── bookings tab ─────────────────────────────────────── */}
          <TabsContent value="bookings" className="space-y-3 focus-visible:outline-none">
            {myBookings.length === 0 ? (
              <Empty label="No bookings found yet." />
            ) : (
              myBookings.map((b: any) => (
                <button
                  key={b.id}
                  onClick={() => setSelectedBooking(b)}
                  className="w-full text-left rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between gap-3 w-full">
                    <div className="space-y-2 flex-1 min-w-0">
                      {/* 🔥 FIX: Proper truncation logic for list view */}
                      <div className="flex items-center gap-2 font-bold text-slate-800 text-sm w-full">
                        <MapPin className="h-4 w-4 shrink-0 text-blue-500" />
                        <span className="flex-1 truncate" title={b.ride?.sourceName}>{b.ride?.sourceName}</span>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span className="flex-1 truncate" title={b.ride?.destinationName}>{b.ride?.destinationName}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill status={b.status} />
                        <span className="text-[11px] text-slate-500 font-medium">
                          {b.seatsBooked} seat{b.seatsBooked !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-extrabold text-slate-900">
                        ₹{(b.ride?.pricePerSeat ?? 0) * (b.seatsBooked ?? 1)}
                      </p>
                      <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wide mt-0.5">
                        Tap for OTP →
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </TabsContent>

          {/* ── rides tab ────────────────────────────────────────── */}
          <TabsContent value="rides" className="space-y-3 focus-visible:outline-none">
            {myRides.length === 0 ? (
              <Empty label="No rides posted yet." />
            ) : (
              myRides.map((r: any) => (
                <button
                  key={r.id}
                  onClick={() => handleRideClick(r)}
                  className="w-full text-left rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between gap-3 w-full">
                    <div className="space-y-2 flex-1 min-w-0">
                      {/* 🔥 FIX: Proper truncation logic for list view */}
                      <div className="flex items-center gap-2 font-bold text-slate-800 text-sm w-full">
                        <Car className="h-4 w-4 shrink-0 text-slate-500" />
                        <span className="flex-1 truncate" title={r.sourceName}>{r.sourceName}</span>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span className="flex-1 truncate" title={r.destinationName}>{r.destinationName}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-primary uppercase tracking-wide">
                        <Users className="h-3 w-3" /> View passengers & verify OTP
                      </div>
                    </div>
                    <div className="text-right shrink-0 space-y-0.5">
                      <p className="text-lg font-extrabold text-slate-900">₹{r.pricePerSeat}</p>
                      <p className="text-[11px] text-slate-500 font-medium">{r.availableSeats} seat{r.availableSeats !== 1 ? "s" : ""} left</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ════════════════════════════════════════════════════════════
          MODAL 1 — Passenger: Booking / OTP
          ════════════════════════════════════════════════════════════ */}
      <Dialog open={!!selectedBooking} onOpenChange={() => setSelectedBooking(null)}>
        <DialogContent className="max-w-sm rounded-2xl p-0 overflow-hidden gap-0">
          <DialogHeader className="bg-slate-50 border-b px-5 py-4">
            <DialogTitle className="text-base font-bold text-slate-900">Ride Summary</DialogTitle>
          </DialogHeader>

          {selectedBooking && (
            <div className="p-5 space-y-5">
              {/* 🔥 FIX: Modal Route - Vertical layout for long addresses */}
              <div className="flex flex-col gap-3 rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
                <div className="flex items-start gap-2.5">
                  <MapPin className="h-4 w-4 shrink-0 text-blue-500 mt-0.5" />
                  <span className="font-bold text-blue-900 text-sm leading-snug">
                    {selectedBooking.ride?.sourceName}
                  </span>
                </div>
                <div className="flex items-start gap-2.5 pl-0.5">
                  <Navigation className="h-3.5 w-3.5 shrink-0 text-blue-400 mt-0.5" />
                  <span className="font-bold text-blue-900 text-sm leading-snug">
                    {selectedBooking.ride?.destinationName}
                  </span>
                </div>
              </div>

              {/* stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Seats</p>
                  <p className="text-2xl font-extrabold text-slate-800">{selectedBooking.seatsBooked}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Amount</p>
                  <p className="text-2xl font-extrabold text-slate-800">
                    ₹{(selectedBooking.ride?.pricePerSeat ?? 0) * (selectedBooking.seatsBooked ?? 1)}
                  </p>
                </div>
              </div>

              {/* OTP */}
              <div className="rounded-xl bg-slate-900 p-4 text-center space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Your Boarding OTP</p>
                <p className="text-3xl font-black tracking-[0.3em] text-emerald-400">
                  {selectedBooking.otp ?? "••••"}
                </p>
              </div>

              <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 font-medium">
                <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
                Share OTP only after you board the vehicle.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════════════════
          MODAL 2 — Driver: Passenger list + OTP verify
          ════════════════════════════════════════════════════════════ */}
      <Dialog open={!!selectedRide} onOpenChange={() => setSelectedRide(null)}>
        <DialogContent className="max-w-md rounded-2xl p-0 overflow-hidden gap-0">
          <DialogHeader className="bg-slate-50 border-b px-5 py-4">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base font-bold text-slate-900">Passenger List</DialogTitle>
              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-bold text-slate-600">
                {ridePassengers.length} booking{ridePassengers.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* 🔥 FIX: Header Route - Proper wrapping for long addresses */}
            {selectedRide && (
              <div className="mt-3 space-y-1.5 bg-white p-3 rounded-lg border shadow-sm">
                <div className="flex items-start gap-2 text-xs text-slate-600 font-medium">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-emerald-500 mt-0.5" />
                  <span className="leading-relaxed">{selectedRide.sourceName}</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-slate-600 font-medium">
                  <Navigation className="h-3.5 w-3.5 shrink-0 text-red-500 mt-0.5" />
                  <span className="leading-relaxed">{selectedRide.destinationName}</span>
                </div>
              </div>
            )}
          </DialogHeader>

          <div className="p-4 space-y-3 max-h-[420px] overflow-y-auto">
            {isFetchingPass ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : ridePassengers.length === 0 ? (
              <Empty label="No bookings for this ride yet." />
            ) : (
              ridePassengers.map((booking: any) => {
                const boarded = booking.status === "BOARDED";
                return (
                  <div
                    key={booking.id}
                    className={`rounded-xl border p-4 transition-colors ${
                      boarded
                        ? "border-emerald-200 bg-emerald-50/60"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    {/* passenger row */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 border border-slate-200 text-xs font-black text-slate-600">
                          {booking.passenger?.fullName?.[0]?.toUpperCase() || "P"}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">
                            {booking.passenger?.fullName || "Passenger"}
                          </p>
                          <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <Phone className="h-3 w-3" />
                            {maskPhone(booking.passenger?.phone)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={`tel:${booking.passenger?.phone}`}
                          className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Phone className="h-3 w-3" />
                        </a>
                        <span className="rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                          {booking.seatsBooked} seat{booking.seatsBooked !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>

                    {/* OTP section */}
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      {boarded ? (
                        <div className="flex items-center justify-center gap-2 rounded-lg bg-emerald-100 py-2 text-xs font-bold text-emerald-700">
                          <CheckCircle2 className="h-4 w-4" />
                          Boarding Verified
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 shrink-0">
                            Verify OTP
                          </p>
                          <div className="flex items-center gap-2">
                            <Input
                              placeholder="0000"
                              maxLength={4}
                              inputMode="numeric"
                              value={otpInputs[booking.id] || ""}
                              onChange={(e) =>
                                setOtpInputs((prev) => ({
                                  ...prev,
                                  [booking.id]: e.target.value.replace(/\D/g, ""),
                                }))
                              }
                              className="h-9 w-20 text-center text-base font-black tracking-[0.25em] border-slate-300 bg-slate-50"
                            />
                            <Button
                              size="sm"
                              className="h-9 px-4 rounded-lg font-bold text-xs bg-slate-900 hover:bg-slate-700 text-white"
                              disabled={
                                verifyingId === booking.id ||
                                (otpInputs[booking.id]?.length ?? 0) < 4
                              }
                              onClick={() => handleVerifyOtp(booking.id)}
                            >
                              {verifyingId === booking.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                "Verify"
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}