import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Select, SelectTrigger, SelectContent,
  SelectItem, SelectValue,
} from "@/components/ui/select";
import {
  ShieldCheck, MapPin, Navigation, Sparkles, Users,
  Calendar, Car, ArrowRight, Star, Zap, Leaf,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

/* ─── CSS ──────────────────────────────────────────────────────────── */
const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Clash+Display:wght@600;700&display=swap');
@import url('https://api.fontshare.com/v2/css?f[]=clash-display@600,700&display=swap');

* { font-family: 'Plus Jakarta Sans', sans-serif; }
.font-display { font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 800; letter-spacing: -0.03em; }

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes slideRight {
  from { opacity: 0; transform: translateX(-18px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes floatB {
  0%,100% { transform: translateY(0px); }
  50%      { transform: translateY(8px); }
}
@keyframes shimmer {
  0%   { background-position: -200% center; }
  100% { background-position:  200% center; }
}
@keyframes pulse-ring {
  0%   { transform: scale(1);   opacity: 0.6; }
  100% { transform: scale(1.8); opacity: 0;   }
}
@keyframes countUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes orb1 {
  0%,100% { transform: translate(0,0) scale(1); }
  33%      { transform: translate(35px,-25px) scale(1.12); }
  66%      { transform: translate(-18px,18px) scale(0.92); }
}
@keyframes orb2 {
  0%,100% { transform: translate(0,0) scale(1); }
  33%      { transform: translate(-40px,20px) scale(1.08); }
  66%      { transform: translate(25px,-12px) scale(0.96); }
}

.anim-fade-up  { animation: fadeUp 0.65s cubic-bezier(.22,1,.36,1) both; }
.anim-fade-in  { animation: fadeIn 0.5s ease both; }
.anim-slide-r  { animation: slideRight 0.55s cubic-bezier(.22,1,.36,1) both; }
.anim-count    { animation: countUp 0.6s ease both; }

.delay-1  { animation-delay: 0.1s; }
.delay-2  { animation-delay: 0.2s; }
.delay-3  { animation-delay: 0.3s; }
.delay-4  { animation-delay: 0.45s; }
.delay-5  { animation-delay: 0.6s; }
.delay-6  { animation-delay: 0.75s; }

.shimmer-text {
  background: linear-gradient(90deg, #fff 0%, #facc15 40%, #fff 60%, #facc15 100%);
  background-size: 200% auto;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: shimmer 4s linear infinite;
}

.card-hover {
  transition: transform 0.22s cubic-bezier(.22,1,.36,1), box-shadow 0.22s ease;
}
.card-hover:hover {
  transform: translateY(-4px);
  box-shadow: 0 20px 40px -8px rgba(0,0,0,0.13);
}

.btn-primary-glow:hover {
  box-shadow: 0 0 20px 4px hsla(46,95%,55%,0.35);
}

.orb1 { animation: orb1 12s ease-in-out infinite; }
.orb2 { animation: orb2 15s ease-in-out infinite; }

.input-focus-ring:focus-within {
  box-shadow: 0 0 0 3px hsla(46,95%,55%,0.22);
  border-color: hsl(46,95%,55%) !important;
}

/* Hero-specific responsive overrides */
.hero-section {
  min-height: 100svh;
}

.hero-grid {
  padding-top: 3.5rem;
  padding-bottom: 2.5rem;
}

@media (min-width: 768px) {
  .hero-grid {
    padding-top: 4rem;
    padding-bottom: 3rem;
  }
}

@media (min-width: 1024px) {
  .hero-grid {
    padding-top: 4.5rem;
    padding-bottom: 3.5rem;
  }
}

/* Fluid headline */
.hero-headline {
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: clamp(2rem, 4.5vw + 0.5rem, 3.6rem);
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.03em;
}

/* Shimmer word styling */
.hero-headline .shimmer-text {
  display: inline-block;
}

/* Fluid subtext */
.hero-sub {
  font-size: clamp(0.9rem, 1.3vw, 1rem);
  font-weight: 400;
  line-height: 1.7;
}

/* Search card gets constrained max-width on large screens */
.search-card {
  width: 100%;
}

@media (min-width: 1280px) {
  .search-card {
    max-width: 480px;
    margin-left: auto;
  }
}

/* Scroll hint only on md+ */
.scroll-hint {
  display: none;
}
@media (min-width: 768px) {
  .scroll-hint {
    display: flex;
  }
}
`;

/* ─── animated counter ───────────────────────────────────────────── */
function StatCounter({ end, suffix, label }: { end: number; suffix: string; label: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !started.current) {
        started.current = true;
        const duration = 1800;
        const step = (timestamp: number, startTime: number) => {
          const progress = Math.min((timestamp - startTime) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setCount(Math.floor(eased * end));
          if (progress < 1) requestAnimationFrame(t => step(t, startTime));
        };
        requestAnimationFrame(t => step(t, t));
      }
    }, { threshold: 0.5 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end]);

  return (
    <div ref={ref} className="text-center anim-count">
      <p className="font-display text-4xl font-extrabold text-white">
        {count.toLocaleString()}<span className="text-primary">{suffix}</span>
      </p>
      <p className="mt-1 text-sm text-white/50 font-medium">{label}</p>
    </div>
  );
}

/* ─── how-it-works step ──────────────────────────────────────────── */
function Step({ num, icon, title, body, delay }: {
  num: string; icon: React.ReactNode; title: string; body: string; delay: string;
}) {
  return (
    <div className={`group relative flex flex-col gap-4 anim-fade-up ${delay} card-hover`}>
      <div className="relative">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/20 group-hover:bg-primary/25 group-hover:ring-primary/40 transition-all duration-300">
          {icon}
        </div>
        <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-black text-neutral-950">
          {num}
        </span>
      </div>
      <div>
        <h3 className="font-display text-lg font-bold text-slate-900">{title}</h3>
        <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
export default function Index() {
  const navigate = useNavigate();
  const today    = format(new Date(), "yyyy-MM-dd");
  const [from,  setFrom]  = useState("");
  const [to,    setTo]    = useState("");
  const [date,  setDate]  = useState(today);
  const [seats, setSeats] = useState("1");

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (date < today) { toast.error("Please select a current or future date."); return; }
    navigate(`/search?${new URLSearchParams({ from, to, date, seats }).toString()}`);
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />

      <div className="flex flex-col">

        {/* ════════════════════════════════════════════════════════
            HERO
            ════════════════════════════════════════════════════════ */}
        <section className="hero-section relative overflow-hidden bg-neutral-950 text-white flex items-center">

          {/* Animated background orbs */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="orb1 absolute top-1/4 left-1/4 h-80 w-80 rounded-full bg-primary/8 blur-3xl" />
            <div className="orb2 absolute bottom-1/4 right-1/4 h-64 w-64 rounded-full bg-blue-500/5 blur-3xl" />
            {/* grid lines */}
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: "linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px)",
                backgroundSize: "56px 56px",
              }}
            />
            {/* radial glow */}
            <div className="absolute inset-0 bg-[radial-gradient(800px_500px_at_50%_-80px,hsla(46,95%,55%,0.12),transparent)]" />
          </div>

          {/* ── hero inner grid ───────────────────────────────── */}
          <div className="hero-grid relative z-10 mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-10 px-4 sm:px-6 md:grid-cols-2 md:gap-12 lg:gap-16 lg:px-8">

            {/* ── Left: copy ──────────────────────────────────── */}
            <div className="flex flex-col">

              {/* Badge */}
              <div className="anim-slide-r delay-1 mb-4 flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span
                    className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"
                    style={{ animation: "pulse-ring 1.5s ease-out infinite" }}
                  />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                <span className="text-[11px] font-bold uppercase tracking-widest text-primary">
                  Eco‑friendly ride pooling
                </span>
              </div>

              {/* Headline — fluid size, never overflows */}
              <h1 className="hero-headline anim-fade-up delay-2 font-display font-extrabold text-white">
                Pool smarter.<br />
                <span className="shimmer-text">Pay less.</span><br />
                Go greener.
              </h1>

              {/* Sub */}
              <p className="hero-sub anim-fade-up delay-3 mt-3 max-w-md text-white/55 leading-relaxed">
                RideLink matches commuters going the same way so you can save money, reduce traffic and cut emissions — every single day.
              </p>

              {/* Trust chips */}
              <div className="anim-fade-up delay-4 mt-5 flex flex-wrap gap-2.5">
                {[
                  { icon: <ShieldCheck className="h-3.5 w-3.5" />, label: "OTP Verified"      },
                  { icon: <Sparkles    className="h-3.5 w-3.5" />, label: "AI Matched"        },
                  { icon: <Users       className="h-3.5 w-3.5" />, label: "Trusted Community" },
                  { icon: <Leaf        className="h-3.5 w-3.5" />, label: "Carbon Saving"     },
                ].map(({ icon, label }) => (
                  <span
                    key={label}
                    className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/55 hover:border-white/20 hover:text-white/80 transition-all duration-200"
                  >
                    <span className="text-primary">{icon}</span> {label}
                  </span>
                ))}
              </div>

              {/* Scroll hint — hidden on mobile */}
              <div className="scroll-hint anim-fade-in delay-6 mt-8 items-center gap-2 text-xs font-medium text-white/30">
                <div className="flex h-8 w-5 items-center justify-center rounded-full border border-white/20">
                  <div
                    className="h-1.5 w-1 rounded-full bg-white/50"
                    style={{ animation: "floatB 1.8s ease-in-out infinite" }}
                  />
                </div>
                Scroll to explore
              </div>
            </div>

            {/* ── Right: search card ──────────────────────────── */}
            <div className="anim-fade-up delay-3 flex justify-center md:justify-end">
              <form
                onSubmit={onSearch}
                className="search-card rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5 sm:p-6 shadow-2xl ring-1 ring-white/5"
                style={{
                  boxShadow: "0 28px 56px -10px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)",
                }}
              >
                {/* Card header */}
                <div className="mb-5 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  <span className="text-[11px] font-bold uppercase tracking-widest text-white/70">Find a Carpool</span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

                  {/* From */}
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-white/35">
                      Pickup Location
                    </label>
                    <div className="relative rounded-xl border border-white/10 bg-white/5 input-focus-ring transition-all">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/70" />
                      <input
                        required
                        value={from}
                        onChange={e => setFrom(e.target.value)}
                        placeholder="e.g. Palasia, Indore"
                        className="h-11 w-full bg-transparent pl-9 pr-3 text-sm font-medium text-white placeholder:text-white/22 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* To */}
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-white/35">
                      Destination
                    </label>
                    <div className="relative rounded-xl border border-white/10 bg-white/5 input-focus-ring transition-all">
                      <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/70" />
                      <input
                        required
                        value={to}
                        onChange={e => setTo(e.target.value)}
                        placeholder="e.g. Vijay Nagar, Indore"
                        className="h-11 w-full bg-transparent pl-9 pr-3 text-sm font-medium text-white placeholder:text-white/22 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Date */}
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-white/35">
                      Date
                    </label>
                    <div className="relative rounded-xl border border-white/10 bg-white/5 input-focus-ring transition-all">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/70" />
                      <input
                        type="date"
                        required
                        value={date}
                        min={today}
                        onChange={e => setDate(e.target.value)}
                        className="h-11 w-full bg-transparent pl-9 pr-2 text-sm font-medium text-white [color-scheme:dark] focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Seats */}
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-white/35">
                      Seats
                    </label>
                    <Select value={seats} onValueChange={setSeats}>
                      <SelectTrigger className="h-11 rounded-xl border-white/10 bg-white/5 text-white text-sm font-medium focus:ring-0 focus:ring-offset-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-white/10 bg-neutral-900 text-white">
                        {["1","2","3","4"].map(n => (
                          <SelectItem key={n} value={n} className="focus:bg-white/10">
                            {n} Seat{n !== "1" ? "s" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Divider */}
                  <div className="sm:col-span-2 my-1 border-t border-white/8" />

                  {/* Actions */}
                  <div className="sm:col-span-2 flex flex-col gap-2.5">
                    <button
                      type="submit"
                      className="h-12 w-full rounded-xl bg-primary font-bold text-neutral-950 text-sm transition-all duration-200 hover:bg-primary/90 active:scale-[0.98] btn-primary-glow flex items-center justify-center gap-2"
                    >
                      <SearchIcon className="h-4 w-4" /> Find Rides
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate("/post-ride")}
                      className="h-11 w-full rounded-xl border border-white/15 bg-transparent font-medium text-white/70 text-sm transition-all duration-200 hover:border-white/30 hover:text-white hover:bg-white/5 flex items-center justify-center gap-2"
                    >
                      <Car className="h-4 w-4" /> Offer a ride
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════
            STATS BAR
            ════════════════════════════════════════════════════════ */}
        <section className="bg-neutral-900 border-y border-white/8">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
              <StatCounter end={12000} suffix="+"  label="Active Riders"     />
              <StatCounter end={850}   suffix="+"  label="Daily Rides"       />
              <StatCounter end={4200}  suffix="kg" label="CO₂ Saved Monthly" />
              <StatCounter end={98}    suffix="%"  label="Satisfaction Rate" />
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════
            HOW IT WORKS
            ════════════════════════════════════════════════════════ */}
        <section className="bg-white">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <div className="mb-12 max-w-2xl">
              <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-primary mb-3">
                How it works
              </span>
              <h2 className="font-display text-4xl font-extrabold text-slate-900 leading-tight">
                Your ride in three simple steps.
              </h2>
              <p className="mt-3 text-slate-500">From search to seat — the whole journey takes under a minute.</p>
            </div>

            <div className="grid gap-10 md:grid-cols-3">
              <Step num="1" delay="delay-1"
                    icon={<MapPin className="h-6 w-6" />}
                    title="Tell us your route"
                    body="Enter pickup, destination, date and seats. We compute the best matches near you instantly."
              />
              <Step num="2" delay="delay-2"
                    icon={<Sparkles className="h-6 w-6" />}
                    title="Get AI‑matched rides"
                    body="Our algorithm ranks drivers by route overlap, ETA, and minimal detour for maximum comfort."
              />
              <Step num="3" delay="delay-3"
                    icon={<ShieldCheck className="h-6 w-6" />}
                    title="Ride with trust"
                    body="OTP boarding, live GPS tracking, verified driver profiles and in-app SOS — always safe."
              />
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════
            FEATURES BENTO GRID
            ════════════════════════════════════════════════════════ */}
        <section className="bg-slate-50 border-t border-slate-100">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <div className="mb-10">
              <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-primary mb-3">
                Features
              </span>
              <h2 className="font-display text-4xl font-extrabold text-slate-900">Built for daily commuters.</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {/* Large card */}
              <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-white p-7 card-hover overflow-hidden relative">
                <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-primary/8 blur-2xl pointer-events-none" />
                <div className="relative">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4">
                    <Zap className="h-5 w-5" />
                  </div>
                  <h3 className="font-display text-xl font-bold text-slate-900">Instant Smart Matching</h3>
                  <p className="mt-2 text-sm text-slate-500 leading-relaxed max-w-md">
                    Our real-time engine compares your GPS coordinates with active drivers within a configurable radius — finding the best route overlap in milliseconds.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {["Real-time GPS","Route Overlap","Smart Radius","Low Latency"].map(t => (
                      <span key={t} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{t}</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Dark card */}
              <div className="rounded-2xl border border-slate-200 bg-neutral-950 p-7 card-hover overflow-hidden relative text-white">
                <div className="absolute -left-6 -bottom-6 h-32 w-32 rounded-full bg-primary/15 blur-2xl pointer-events-none" />
                <div className="relative flex flex-col h-full gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/20 text-primary">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <h3 className="font-display text-xl font-bold">Safety First</h3>
                  <p className="text-sm text-white/55 leading-relaxed">
                    OTP boarding, KYC-verified drivers, live location sharing, and a one-tap SOS button.
                  </p>
                  <div className="mt-auto space-y-2">
                    {["OTP Boarding","KYC Verified","Live Tracking","SOS Button"].map(f => (
                      <div key={f} className="flex items-center gap-2 text-xs font-medium text-white/60">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" /> {f}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom row */}
              {[
                { icon: <Leaf  className="h-5 w-5" />, title: "Eco Impact",        body: "Every shared ride removes one car off the road — track your CO₂ contribution in your profile."   },
                { icon: <Users className="h-5 w-5" />, title: "Trusted Community", body: "Ratings, reviews, and mutual verification build trust between drivers and passengers organically." },
                { icon: <Star  className="h-5 w-5" />, title: "Fair Pricing",      body: "Costs are split transparently. Drivers set their own price per seat — no surge, no surprise fees." },
              ].map(({ icon, title, body }) => (
                <div key={title} className="rounded-2xl border border-slate-200 bg-white p-6 card-hover overflow-hidden relative">
                  <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-primary/5 blur-xl pointer-events-none" />
                  <div className="relative">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary mb-3">
                      {icon}
                    </div>
                    <h3 className="font-display text-base font-bold text-slate-900">{title}</h3>
                    <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════
            CTA
            ════════════════════════════════════════════════════════ */}
        <section className="bg-neutral-950 text-white">
          <div className="relative overflow-hidden mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_400px_at_50%_50%,hsla(46,95%,55%,0.10),transparent)]" />
            <div className="relative text-center space-y-6">
              <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-primary">
                Start today
              </span>
              <h2 className="font-display text-4xl font-extrabold sm:text-5xl">
                Ready to start pooling?
              </h2>
              <p className="text-white/50 max-w-lg mx-auto">
                Join thousands of daily commuters who are saving money, reducing emissions, and making friends along the way.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                <button
                  onClick={() => navigate("/post-ride")}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 font-bold text-neutral-950 text-sm transition-all duration-200 hover:bg-primary/90 active:scale-[0.98] btn-primary-glow"
                >
                  <Car className="h-4 w-4" /> Offer a ride
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => navigate("/search")}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-8 py-3.5 font-semibold text-white text-sm transition-all duration-200 hover:border-white/30 hover:bg-white/5"
                >
                  <SearchIcon className="h-4 w-4" /> Find rides
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════
            FOOTER
            ════════════════════════════════════════════════════════ */}
        <footer className="bg-neutral-950 border-t border-white/8">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 font-display font-extrabold text-white">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
                  <Car className="h-3.5 w-3.5 text-neutral-950" />
                </div>
                RideLink
              </div>
              <p className="text-xs text-white/30 font-medium">
                © {new Date().getFullYear()} RideLink. Eco-friendly ride pooling for everyone.
              </p>
              <div className="flex gap-4">
                {[
                  { to: "/safety",  label: "Safety"  },
                  { to: "/profile", label: "Profile" },
                ].map(({ to, label }) => (
                  <Link
                    key={to}
                    to={to}
                    className="text-xs text-white/40 hover:text-white/70 transition-colors font-medium"
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </footer>

      </div>
    </>
  );
}

/* ── Inline Search icon ─────────────────────────────────────────── */
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}