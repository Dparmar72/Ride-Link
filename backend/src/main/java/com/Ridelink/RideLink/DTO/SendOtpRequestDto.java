package com.Ridelink.RideLink.DTO;

import lombok.Data;

@Data
public class SendOtpRequestDto {
    private String email;
    private String type; // "login" ya "register"
}
