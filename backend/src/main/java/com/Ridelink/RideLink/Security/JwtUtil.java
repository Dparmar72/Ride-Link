package com.Ridelink.RideLink.Security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;
import java.security.Key;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Function;

@Component
public class JwtUtil {

    @Value("${app.jwt.secret}")
    private String jwtSecret;

    @Value("${app.jwt.expiration-ms}")
    private int jwtExpirationMs;

    private static final long SERVER_START_TIME = System.currentTimeMillis();

    private Key getSigningKey() {
        return Keys.hmacShaKeyFor(jwtSecret.getBytes());
    }

    private final long jwtExpiration = 1000 * 60 * 15; // 15 Minutes (Access Token)
    private final long refreshExpiration = 1000L * 60 * 60 * 24 * 7; // 7 Days (Refresh Token)

    public String generateToken(String email, String role) {
        return Jwts.builder()
                .setSubject(email)
                .claim("role", role)
                .setIssuedAt(new Date())
                .setExpiration(new Date((new Date()).getTime() + jwtExpirationMs))
                .signWith(getSigningKey(), SignatureAlgorithm.HS512)
                .compact();
    }

    public String getUserNameFromJwtToken(String token) {
        return Jwts.parserBuilder().setSigningKey(getSigningKey()).build()
                .parseClaimsJws(token).getBody().getSubject();
    }

    public boolean validateJwtToken(String authToken) {
        try {
           Claims claims=  Jwts.parserBuilder()
                   .setSigningKey(getSigningKey())
                   .build()
                   .parseClaimsJws(authToken)
                   .getBody();

            Date issuedAt = claims.getIssuedAt();
            if (issuedAt != null && issuedAt.getTime() < SERVER_START_TIME) {
                System.err.println("Old Token: Issued before server restart. Forcing Logout.");
                return false; // Token purana hai, isliye reject kar do
            }

            return true;
        } catch (JwtException e) {
            System.err.println("Invalid JWT signature: " + e.getMessage());
        }
        return false;
    }

    public boolean isTokenValid(String token, UserDetails userDetails) {
        // Step 1: Token ko sirf ek baar kholo aur saara data (Claims) nikal lo
        final Claims claims = extractAllClaims(token);

        // Step 2: Usi ek data object se Username aur Expiry dono nikal lo
        final String username = claims.getSubject();
        final Date expiration = claims.getExpiration();

        // Step 3: Check karo ki aaj ki date expiry se aage toh nahi nikal gayi
        boolean isTokenExpired = expiration.before(new Date());

        // Step 4: Final verification
        return (username.equals(userDetails.getUsername())) && !isTokenExpired;
    }

    /**
     * Token ko parse (decode) karta hai aur signature verify karta hai
     */
    private Claims extractAllClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(getSigningKey())
                .build()
                .parseClaimsJws(token)
                .getBody();
    }


    /**
     * Naya Access Token (Short Expiry) Generate karne ke liye
     */
    public String generateToken(UserDetails userDetails) {
        return buildToken(new HashMap<>(), userDetails, jwtExpiration);
    }

    /**
     * Naya Refresh Token (Long Expiry) Generate karne ke liye
     */
    public String generateRefreshToken(UserDetails userDetails) {
        return buildToken(new HashMap<>(), userDetails, refreshExpiration);
    }


    /**
     * Common Token Builder Method
     */
    private String buildToken(Map<String, Object> extraClaims, UserDetails userDetails, long expiration) {
        return Jwts.builder()
                .setClaims(extraClaims)
                .setSubject(userDetails.getUsername())
                .setIssuedAt(new Date(System.currentTimeMillis()))
                .setExpiration(new Date(System.currentTimeMillis() + expiration))
                .signWith(getSigningKey(), SignatureAlgorithm.HS256)
                .compact();
    }
}