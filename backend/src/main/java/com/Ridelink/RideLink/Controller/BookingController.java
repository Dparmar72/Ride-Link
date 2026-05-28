package com.Ridelink.RideLink.Controller;

import com.Ridelink.RideLink.DTO.BookingRequest;
import com.Ridelink.RideLink.DTO.VerifyOtpRequestDTO;
import com.Ridelink.RideLink.Entity.Booking;
import com.Ridelink.RideLink.Service.BookingService;
import com.Ridelink.RideLink.Service.PaymentService;
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

    @Autowired
    private PaymentService paymentService;

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
    public ResponseEntity<?> cancelRideByPassenger(@PathVariable Long bookingId) {
        try {
            // 1. Booking service se ride cancel karwao (Seats wapas free hongi, status CANCELLED hoga)
            Booking cancelBooking = bookingService.cancelBookingByPassenger(bookingId);

            // 2. Payment service se refund ki math process karwao
            cancelBooking = paymentService.processCancellationRefund(cancelBooking);

            return ResponseEntity.ok(cancelBooking);
        } catch (Exception e) {
            e.printStackTrace(); // Console mein error dekhne ke liye
            return ResponseEntity.badRequest().body("Error cancelling ride: " + e.getMessage());
        }
    }

    @PutMapping("/{bookingId}/driver-cancel")
    public ResponseEntity<?> cancelRideByDriver(@PathVariable("bookingId") Long bookingId) {
        try {
            // 1. Booking service se booking ko cancel mark karwao (Seats free hongi, status REJECTED/CANCELLED hoga)
            Booking cancelBooking = bookingService.cancelBookingByDriver(bookingId);

            // 2. Payment service se 100% full refund process karwao
            cancelBooking = paymentService.processDriverCancellationRefund(cancelBooking);

            return ResponseEntity.ok(cancelBooking);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.badRequest().body("Error: " + e.getMessage());
        }
    }

    @PutMapping("/{bookingId}/end-ride")
    public ResponseEntity<Booking> endRideOfPassenger(@PathVariable Long bookingId) {
       try {
           Booking endBooking = bookingService.endPassengerRide(bookingId);
           // INSTANT RIDE CHECK: Escrow sirf tabhi chalega jab advance pay hua ho
           if ("ADVANCE_PAID".equalsIgnoreCase(endBooking.getPaymentStatus())) {
               // Scheduled ride thi -> Escrow se baaki paise driver ko bhejo
               paymentService.releaseFundsToDriver(bookingId);
           } else {
               // Instant ride thi -> Escrow skip karo aur direct FULL_PAID mark karo
               // (Kyunki driver ne QR scan karke 100% payment le liya hai)
               endBooking.setPaymentStatus("FULL_PAID");

               // Agar aapki bookingService status save nahi karti, toh aapko yahan save call karna padega
               // bookingRepository.save(endBooking);
           }
        return ResponseEntity.ok(endBooking);
       } catch (Exception e) {
           return ResponseEntity.badRequest().build();
       }
    }
}