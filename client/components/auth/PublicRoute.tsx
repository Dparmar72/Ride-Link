import { Navigate, Outlet } from "react-router-dom";

export default function PublicRoute() {
  const authData = localStorage.getItem("ridelink:auth");

  // Agar user already logged in hai aur Login page kholne ki koshish kare
  if (authData && authData !== "null") {
    const user = JSON.parse(authData);
    const isDriver = String(user.role).toUpperCase().includes("DRIVER");

    // Usko seedha uske dashboard par bhej do
    return <Navigate to={isDriver ? "/driver-dashboard" : "/passenger-dashboard"} replace />;
  }

  return <Outlet />;
}