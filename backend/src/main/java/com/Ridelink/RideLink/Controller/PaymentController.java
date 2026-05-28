package com.Ridelink.RideLink.Controller;

import com.Ridelink.RideLink.Service.PaymentService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/payments")
@CrossOrigin(origins = "*")
public class PaymentController {

    @Autowired
    private PaymentService paymentService;

    @PostMapping("/create-order/{bookingId}")
    public ResponseEntity<?> createOrder(@PathVariable Long bookingId) {
        try {
            return ResponseEntity.ok(paymentService.createAdvanceOrder(bookingId));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("Error: " + e.getMessage());
        }
    }

    @PostMapping("/verify")
    public ResponseEntity<?> verifyPayment(@RequestBody Map<String, String> payload) {
        try {
            Long bookingId = Long.parseLong(payload.get("bookingId"));
            String paymentId = payload.get("paymentId");
            paymentService.verifyPayment(bookingId, paymentId);
            return ResponseEntity.ok("Payment Verified Successfully");
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("Error: " + e.getMessage());
        }
    }
}