import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import MainLayout from "@/components/layout/MainLayout";
import Placeholder from "@/pages/Placeholder";
import About from "@/pages/About";
import Help from "@/pages/Help";
import Safety from "@/pages/Safety";
import Search from "@/pages/Search";
import PostRide from "@/pages/PostRide";
import Login from "@/pages/Login";
import Account from "@/pages/Account";
import AdminKyc from "./pages/AdminKyc";
import BookRide from "@/pages/BookRide";
import DriverDashboard from "./pages/DriverDashboard";
import PassengerDashboard from "./pages/PassengerDashboard";
import Profile from "./pages/Profile.tsx";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import PublicRoute from "./components/auth/PublicRoute";
import "./utils/fetchInterceptor";
import { toast } from "sonner";

// 1. Original fetch function ko save kar lo
const originalFetch = window.fetch;

// 2. Global Fetch Interceptor banao
window.fetch = async (...args) => {
  // Har request pehle iske through jayegi
  const response = await originalFetch(...args);

  // Agar backend ne 401 (Unauthorized) ya 403 (Forbidden) bheja
  if (response.status === 401 || response.status === 403) {
    const authData = localStorage.getItem("ridelink:auth");

    // Agar user logged in tha aur token reject ho gaya
    if (authData) {
      // Token delete maaro
      localStorage.removeItem("ridelink:auth");

      // User ko alert do
      toast.error("Session expired! Server restarted. Please login again.");

      // Forcefully login page par bhej do (React Router ke bina direct redirect)
      window.location.href = "/login";
    }
  }

  return response;
};
const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<Index />} />
            <Route path="/search" element={<Search />} />
            <Route path="/post-ride" element={<PostRide />} />
            <Route path="/safety" element={<Safety />} />
            <Route path="/about" element={<About />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Placeholder title="Sign up" />} />
            <Route path="/account" element={<Account />} />
            <Route
              path="/history"
              element={<Placeholder title="Ride history" />}
            />
            <Route
              path="/billing"
              element={<Placeholder title="Billing & payments" />}
            />
            <Route path="/admin/verify" element={<AdminKyc />} />
            <Route path="/book" element={<BookRide />} />
            <Route path="/driver-dashboard" element={<DriverDashboard />} />
            <Route path="/passenger-dashboard" element={<PassengerDashboard />} />
          </Route>
          <Route path="/help" element={<Help />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />

          <Route path="/profile" element={<Profile/>}/>

          {/* 🔥 PUBLIC ROUTES: Sirf tabhi khulenge jab user logged out ho */}
          <Route element={<PublicRoute />}>
            <Route path="/login" element={<Login />} />
            {/* Agar Signup/Register page hai toh use bhi yahin add karein */}
          </Route>

          {/* 🔥 PROTECTED ROUTES: Sirf tabhi khulenge jab JWT Token hoga */}
          <Route element={<ProtectedRoute />}>
            <Route path="/driver-dashboard" element={<DriverDashboard />} />
            <Route path="/passenger-dashboard" element={<PassengerDashboard />} />
            <Route path="/profile" element={<Profile />} />
          </Route>

        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
