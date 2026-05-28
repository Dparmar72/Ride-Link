package com.Ridelink.RideLink.DTO;
import lombok.Data;
import lombok.AllArgsConstructor;

@Data
@AllArgsConstructor
public class JwtResponse {
    private String token;
    private String refreshToken;
    private Long id;
    private String email;
    private String fullName;
    private String role;
    private String kycStatus;
}