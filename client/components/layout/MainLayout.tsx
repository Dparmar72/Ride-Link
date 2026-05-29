import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";
// 🔥 X (Close) icon add kiya hai menu band karne ke liye
import { Menu, X, Leaf, TrendingUp, LogOut, ShieldCheck, Car, MapIcon } from "lucide-react";

// ================= USE AUTH HOOK =================
function useAuth() {
  const location = useLocation();
  const [auth, setAuth] = useState<any>(() => {
    try {
      return JSON.parse(localStorage.getItem("ridelink:auth") || "null");
    } catch {
      return null;
    }
  });
  useEffect(() => {
    const onStorage = () => {
      try {
        setAuth(JSON.parse(localStorage.getItem("ridelink:auth") || "null"));
      } catch {
        setAuth(null);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  useEffect(() => {
    try {
      setAuth(JSON.parse(localStorage.getItem("ridelink:auth") || "null"));
    } catch {
      setAuth(null);
    }
  }, [location.pathname]);
  return auth;
}

// ================= HEADER COMPONENT =================
function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();

  // 🔥 Mobile menu ke open/close ke liye state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    // Jaise hi user kisi link par click kare aur page change ho, mobile menu band ho jaye
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const linkBase =
    "px-3 py-2 text-sm font-medium text-foreground/80 hover:text-foreground flex items-center gap-1.5 transition-colors";

  const logout = () => {
    localStorage.removeItem("ridelink:auth");
    localStorage.removeItem("ridelink:currentRide");
    navigate("/login");
  };

  // Roles identification
  const roleString = String(auth?.role || "").toUpperCase();
  const isDriver = auth && (roleString.includes("RIDER") || roleString.includes("DRIVER"));
  const isPassenger = auth && !roleString.includes("ADMIN");

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-3 sm:px-4 lg:px-6">
        {/* LOGO */}
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
            <Leaf className="h-5 w-5" />
          </div>
          <span className="text-xl font-extrabold tracking-tight">
            RideLink
          </span>
        </Link>

        {/* --- DESKTOP NAVIGATION --- */}
        <nav className="hidden items-center gap-2 md:flex">
          <NavLink to="/" className={({ isActive }) => cn(linkBase, isActive && "text-primary font-bold")}>Home</NavLink>
          <NavLink to="/search" className={({isActive}) => cn(linkBase, isActive && "text-primary font-bold" )}>Search</NavLink>
          <NavLink to="/book" className={({ isActive }) => cn(linkBase, isActive && "text-primary font-bold")}>
            Book a ride
          </NavLink>

          <NavLink to="/post-ride" className={({ isActive }) => cn(linkBase, isActive && "text-primary font-bold")}>Post a ride</NavLink>

          {isPassenger && (
            <NavLink to="/passenger-dashboard" className={({ isActive }) => cn(linkBase, isActive && "text-primary font-bold text-blue-600", !isActive && "text-blue-600/80")}>
              <MapIcon className="h-4 w-4 mr-0.5" /> My Rides
            </NavLink>
          )}

          {isDriver && (
            <NavLink to="/driver-dashboard" className={({ isActive }) => cn(linkBase, isActive && "text-primary font-bold text-emerald-600", !isActive && "text-emerald-600/80")}>
              <Car className="h-4 w-4 mr-0.5" /> Driver Hub
            </NavLink>
          )}

          <NavLink to="/safety" className={({ isActive }) => cn(linkBase, isActive && "text-primary font-bold")}>Safety</NavLink>
          <NavLink to="/about" className={({ isActive }) => cn(linkBase, isActive && "text-primary font-bold")}>About</NavLink>
        </nav>

        <div className="flex items-center gap-2">
          {/* DESKTOP BUTTONS (NOT LOGGED IN) */}
          {!auth && (
            <>
              <Button asChild variant="ghost" className="hidden md:inline-flex">
                <Link to="/login">Log in</Link>
              </Button>
              <Button asChild className="shadow-sm hidden md:inline-flex">
                <Link to="/signup" className="inline-flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Start pooling
                </Link>
              </Button>
            </>
          )}

          {/* DESKTOP BUTTONS (LOGGED IN) */}
          {auth && (
            <div className="flex items-center gap-3">
              {roleString.includes("ADMIN") && (
                <Link
                  to="/admin/verify"
                  className="hidden sm:flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-red-700 active:scale-95"
                >
                  <ShieldCheck className="h-4 w-4" />
                  Admin Portal
                </Link>
              )}

              <Link
                to="/account"
                className="group flex items-center gap-2 rounded-full border border-border/60 bg-background/50 px-2 py-1 transition-all hover:border-primary/50 hover:bg-accent shadow-sm active:scale-95"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-sm transition-transform group-hover:scale-105">
                  {auth.name?.[0] || "U"}
                </div>
                <div className="hidden flex-col items-start pr-2 sm:flex">
                  <span className="text-xs font-bold leading-none text-foreground group-hover:text-primary transition-colors">
                    {auth.name}
                  </span>
                  <span className="text-[10px] uppercase tracking-tighter text-muted-foreground font-semibold">
                    • {String(auth?.role || "USER").replace("ROLE_", "")}
                  </span>
                </div>
              </Link>

              <Button variant="ghost" size="icon" className="hidden md:flex text-muted-foreground hover:text-destructive transition-colors" onClick={logout} title="Logout">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* 🔥 MOBILE HAMBURGER MENU BUTTON 🔥 */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* 🔥 MOBILE DROPDOWN PANEL (Yeh tabhi dikhega jab state true hogi) 🔥 */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t bg-background px-4 py-4 shadow-lg animate-in slide-in-from-top-2">
          <nav className="flex flex-col gap-3">
            <NavLink to="/" className={({ isActive }) => cn(linkBase, isActive && "text-primary font-bold", "w-full rounded-md hover:bg-accent")}>Home</NavLink>
            <NavLink to="/search" className={({ isActive }) => cn(linkBase, isActive && "text-primary font-bold", "w-full rounded-md hover:bg-accent")}>Search</NavLink>
            <NavLink to="/book" className={({ isActive }) => cn(linkBase, isActive && "text-primary font-bold", "w-full rounded-md hover:bg-accent")}>Book a ride</NavLink>
            <NavLink to="/post-ride" className={({ isActive }) => cn(linkBase, isActive && "text-primary font-bold", "w-full rounded-md hover:bg-accent")}>Post a ride</NavLink>

            {isPassenger && (
              <NavLink to="/passenger-dashboard" className={({ isActive }) => cn(linkBase, isActive && "text-primary font-bold text-blue-600", !isActive && "text-blue-600/80", "w-full rounded-md hover:bg-accent")}>
                <MapIcon className="h-4 w-4 mr-2" /> My Rides
              </NavLink>
            )}

            {isDriver && (
              <NavLink to="/driver-dashboard" className={({ isActive }) => cn(linkBase, isActive && "text-primary font-bold text-emerald-600", !isActive && "text-emerald-600/80", "w-full rounded-md hover:bg-accent")}>
                <Car className="h-4 w-4 mr-2" /> Driver Hub
              </NavLink>
            )}

            <NavLink to="/safety" className={({ isActive }) => cn(linkBase, isActive && "text-primary font-bold", "w-full rounded-md hover:bg-accent")}>Safety</NavLink>
            <NavLink to="/about" className={({ isActive }) => cn(linkBase, isActive && "text-primary font-bold", "w-full rounded-md hover:bg-accent")}>About</NavLink>

            {/* Mobile Action Buttons */}
            {!auth ? (
              <div className="flex flex-col gap-2 mt-4 pt-4 border-t">
                <Button asChild variant="outline" className="w-full">
                  <Link to="/login">Log in</Link>
                </Button>
                <Button asChild className="w-full">
                  <Link to="/signup">Start pooling</Link>
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 mt-4 pt-4 border-t">
                {roleString.includes("ADMIN") && (
                  <Button asChild variant="destructive" className="w-full mb-2">
                    <Link to="/admin/verify">
                      <ShieldCheck className="mr-2 h-4 w-4" /> Admin Portal
                    </Link>
                  </Button>
                )}
                <Button variant="ghost" className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50" onClick={logout}>
                  <LogOut className="mr-2 h-4 w-4" /> Logout
                </Button>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

// ================= FOOTER COMPONENT =================
function Footer() {
  return (
    <footer className="border-t bg-background">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Leaf className="h-4 w-4" />
            </div>
            <span className="text-base font-semibold">RideLink</span>
          </div>
          <p className="text-center text-sm text-muted-foreground md:text-right">
            Efficient, affordable and eco‑friendly ride pooling for daily commutes.
          </p>
        </div>
      </div>
    </footer>
  );
}

// ================= MAIN LAYOUT COMPONENT =================
export default function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("ridelink:auth") || "null");
    } catch {
      return null;
    }
  }, [location.pathname]);

  useEffect(() => {
    if (auth) return;
    if (location.pathname === "/login") return;

    const protectedPrefixes = [
      "/search",
      "/post-ride",
      "/account",
      "/admin",
      "/book",
      "/driver-dashboard",
      "/passenger-dashboard"
    ];

    const requiresAuth = protectedPrefixes.some((path) => {
      if (location.pathname === path) return true;
      return location.pathname.startsWith(`${path}/`);
    });

    if (!requiresAuth) return;

    const redirectTarget = `${location.pathname}${location.search}${location.hash}`;
    const params = new URLSearchParams();
    params.set("redirect", redirectTarget && redirectTarget !== "/" ? redirectTarget : "/");

    const roleHints: Record<string, "user" | "rider"> = {
      "/search": "user",
      "/book": "user",
      "/passenger-dashboard": "user",
      "/post-ride": "rider",
      "/driver-dashboard": "rider",
    };

    const hintedRole = Object.entries(roleHints).find(([path]) => {
      if (location.pathname === path) return true;
      return location.pathname.startsWith(`${path}/`);
    })?.[1];

    if (hintedRole) params.set("role", hintedRole);
    navigate(`/login?${params.toString()}`, { replace: true });
  }, [auth, location.pathname, location.search, location.hash, navigate]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}