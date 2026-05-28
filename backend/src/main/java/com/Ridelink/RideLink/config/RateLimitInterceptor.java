package com.Ridelink.RideLink.config;

import com.Ridelink.RideLink.Service.RateLimitingService;
import io.github.bucket4j.Bucket;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class RateLimitInterceptor implements HandlerInterceptor {

    @Autowired
    private RateLimitingService rateLimitingService;

    @Override
    public boolean preHandle(HttpServletRequest req, HttpServletResponse res, Object handler) throws Exception {

        // User ka IP Address nikalo
        String ipAddress = req.getRemoteAddr();

        //Agar backend reverse proxy (Nginx/Cloudflare) ke peeche hai, to real Ip address yahan se milega
        String xForwardFor = req.getHeader("X-FORWARDED-FOR");
        if (xForwardFor != null && !xForwardFor.isEmpty()) {
            ipAddress= xForwardFor.split(",")[0];
        }

        // Check karo ki user konsa URL hit kar raha hai
        String uri = req.getRequestURI();
        String apiType = "GENERAL"; // Default sabko general mano

        if(uri.contains("/send-otp") || uri.contains("/verify-otp") || uri.contains("/update-kyc") || uri.contains("/book")) {
            apiType = "OTP";
        }



        // Us IP ki bucket nikalo
        Bucket tokenBucket = rateLimitingService.resolveBucket(ipAddress, apiType);

        // Ek token consume karne ki koshish karo
        if(tokenBucket.tryConsume(1)){
            return true; // Token mill gaya request aage controller ke pass bhejo
        }
        else {
            res.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            res.getWriter().write("Too many requests. Please try again after 1 minute.");
            return false; // Request yahi se block ho jayegi
        }
    }
}
