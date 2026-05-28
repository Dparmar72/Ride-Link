import { Navigate, Outlet } from "react-router-dom";

export default function ProtectedRoute() {
  const authData = localStorage.getItem("ridelink:auth");

  // Agar user logged in nahi hai, toh seedha Login par phek do
  // 'replace' true karne se ye page history mein save nahi hota
  if (!authData || authData === "null") {
    return <Navigate to="/login" replace />;
  }

  // Agar logged in hai, toh aage (dashboard) jane do
  return <Outlet />;
}