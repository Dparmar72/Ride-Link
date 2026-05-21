package com.Ridelink.RideLink.DTO;

import lombok.Data;

@Data
public class VerifyAuthOtpRequestDto {
    private String email;
    private String otp;
}
