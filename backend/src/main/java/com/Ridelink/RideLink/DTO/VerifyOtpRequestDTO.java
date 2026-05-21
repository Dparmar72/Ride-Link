package com.Ridelink.RideLink.DTO;

import lombok.Data;

@Data
public class VerifyOtpRequestDTO {
    private Long rideId;
    private String otp;
}
