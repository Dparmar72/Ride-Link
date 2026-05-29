// src/utils/fetchInterceptor.ts

const originalFetch = window.fetch;

window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  let authData = JSON.parse(localStorage.getItem("ridelink:auth") || "{}");

  const headers = new Headers(init?.headers || {});
  const urlString = typeof input === "string" ? input : input.toString();

  // 1. 🔥 FIX: Token sirf tabhi add karein jab request hamare apne backend (localhost:9090) par ja rahi ho
  if (
    authData?.token &&
    !headers.has("Authorization") &&
    (urlString.includes("localhost:9090") || urlString.startsWith("/api/"))
  ) {
    headers.set("Authorization", `Bearer ${authData.token}`);
  }

  const options: RequestInit = { ...init, headers };

  // 2. Original request bhejo
  let response = await originalFetch(input, options);

  // 3. Agar 401 (Unauthorized) aata hai aur Refresh Token majood hai (aur API hamari hi hai)
  if (response.status === 401 && authData?.refreshToken && urlString.includes("localhost:9090")) {

    // Infinite loop se bachne ke liye (agar refresh API hi fail ho jaye)
    if (urlString.includes("/refresh-token")) {
      return response;
    }

    try {
      // 4. Chupke se naya token mangwao
      const refreshRes = await originalFetch("https://ride-link-backend.onrender.com/api/auth/refresh-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: authData.refreshToken })
      });

      if (refreshRes.ok) {
        const data = await refreshRes.json();

        // 5. Naya token LocalStorage mein update karo
        authData.token = data.accessToken;
        if (data.refreshToken) authData.refreshToken = data.refreshToken;
        localStorage.setItem("ridelink:auth", JSON.stringify(authData));

        // 6. Fail hui request ko naye token ke sath WAPIS bhejo
        headers.set("Authorization", `Bearer ${data.accessToken}`);
        response = await originalFetch(input, { ...init, headers });
      } else {
        // Refresh token bhi expire ho gaya -> Logout
        localStorage.removeItem("ridelink:auth");
        window.location.href = "/login";
      }
    } catch (err) {
      localStorage.removeItem("ridelink:auth");
      window.location.href = "/login";
    }
  }

  return response;
};