package com.Ridelink.RideLink.Controller;

import com.Ridelink.RideLink.DTO.BookingRequest;
import com.Ridelink.RideLink.DTO.VerifyOtpRequestDTO;
import com.Ridelink.RideLink.Entity.Booking;
import com.Ridelink.RideLink.Service.BookingService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/bookings")
@CrossOrigin(origins = "*")
public class BookingController {

    @Autowired
    private BookingService bookingService;

    // 1. Ride Book Karna
    @PostMapping("/book")
    public ResponseEntity<Booking> bookRide(@RequestBody BookingRequest bookingRequest) {
        Booking booking = bookingService.bookRide(bookingRequest);
        return ResponseEntity.ok(booking);
    }

    // 2. OTP Verify Karna
    @PostMapping("/verify-otp")
    public ResponseEntity<Booking> verifyOtp(@RequestBody VerifyOtpRequestDTO requestDTO) {
        Booking booking = bookingService.verifyRideOtp(requestDTO.getRideId(), requestDTO.getOtp());
        return ResponseEntity.ok(booking);
    }

    // 3. NEW: Fake Payment Process Karna (Added this endpoint)
    @PostMapping("/{bookingId}/pay")
    public ResponseEntity<Booking> payForBooking(@PathVariable Long bookingId) {
        Booking updatedBooking = bookingService.processPayment(bookingId);
        return ResponseEntity.ok(updatedBooking);
    }

    @GetMapping("/passenger/{passengerId}")
    public ResponseEntity<List<Booking>> getBookingsByPassenger(@PathVariable Long passengerId) {
        List<Booking> bookings = bookingService.getBookingsByPassangerId(passengerId);
        return ResponseEntity.ok(bookings);
    }


    @GetMapping("/ride/{rideId}")
    public ResponseEntity<List<Booking>> getBookingsByRideId(@PathVariable Long rideId) {
        return ResponseEntity.ok(bookingService.getBookingsByRideId(rideId));
    }


    //  Driver ke liye saari pending requests lana
    @GetMapping("/driver/{driverId}/pending")
    public ResponseEntity<List<Booking>> getPendingRequests(@PathVariable Long driverId) {
        List<Booking> pending = bookingService.getPendingRequestsForDriver(driverId);
        return ResponseEntity.ok(pending);
    }

    //  Request Accept karna
    @PutMapping("/{bookingId}/accept")
    public ResponseEntity<Booking> acceptRideRequest(@PathVariable Long bookingId) {
        Booking confirmedBooking = bookingService.acceptBooking(bookingId);
        return ResponseEntity.ok(confirmedBooking);
    }

    // Request Reject karna
    @PutMapping("/{bookingId}/reject")
    public ResponseEntity<Booking> rejectRideRequest(@PathVariable Long bookingId) {
        Booking cancelledBooking = bookingService.rejectBooking(bookingId);
        return ResponseEntity.ok(cancelledBooking);
    }

    @PutMapping("/{bookingId}/cancel")
    public ResponseEntity<Booking> cancelRideByPassenger(@PathVariable Long bookingId) {
        Booking cancelBooking = bookingService.cancelBookingByPassenger(bookingId);

        return ResponseEntity.ok(cancelBooking);
    }
}