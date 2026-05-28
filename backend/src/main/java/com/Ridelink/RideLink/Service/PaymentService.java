package com.Ridelink.RideLink.Service;

import com.Ridelink.RideLink.Entity.Booking;

public interface PaymentService {

    // 1. Create Advance Order (50%)
    String createAdvanceOrder(Long bookingId) throws Exception;

    // 2. Verify Payment (Frontend call karega)
    void verifyPayment(Long bookingId, String paymentId) throws Exception;

    // 3. Route Funds to Driver (Escrow Release)
    void releaseFundsToDriver(Long bookingId) throws Exception;

    String setupDriverRazorpayAccount(Long userId) throws Exception;

    Booking processCancellationRefund(Booking booking);

    Booking processDriverCancellationRefund(Booking booking);
}