package com.Ridelink.RideLink.DTO;

import lombok.Data;

@Data
public class LocationUpdateDto {
    private Long rideId;
    private String senderRole; // "DRIVER" ya "PASSENGER"
    private double latitude;
    private double longitude;
}
