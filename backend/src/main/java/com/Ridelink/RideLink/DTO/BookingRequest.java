package com.Ridelink.RideLink.DTO;

import lombok.Data;

@Data
public class BookingRequest {
    private Long rideId;
    private Long passengerId;
    private Integer seatsBooked;
    private Double pickupLat;
    private Double pickupLng;
    private Double dropLat;
    private Double dropLng;

    private Double price;
}