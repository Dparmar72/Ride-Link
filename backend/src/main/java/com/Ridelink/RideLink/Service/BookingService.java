package com.Ridelink.RideLink.Service;

import com.Ridelink.RideLink.DTO.BookingRequest;
import com.Ridelink.RideLink.Entity.Booking;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

public interface BookingService {
    Booking bookRide(BookingRequest bookingRequest);
    Booking verifyRideOtp(Long rideId, String otp);
    Booking processPayment(Long bookingId);


    List<Booking> getBookingsByPassangerId(Long passengerId);

    List<Booking> getBookingsByRideId(Long rideId);

    List<Booking> getPendingRequestsForDriver(Long driverId);
    Booking acceptBooking(Long bookingId);
    Booking rejectBooking(Long bookingId);

    Booking cancelBookingByPassenger(Long bookingId);

    void autoForwardToNextDriver(Booking failedBooking);

    Booking endPassengerRide(Long bookingId);

    Booking cancelBookingByDriver(Long bookingId);
}