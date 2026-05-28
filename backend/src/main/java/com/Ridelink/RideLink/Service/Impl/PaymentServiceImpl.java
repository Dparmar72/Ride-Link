package com.Ridelink.RideLink.Service.Impl;

import com.Ridelink.RideLink.Entity.Booking;
import com.Ridelink.RideLink.Entity.User;
import com.Ridelink.RideLink.Repository.BookingRepository;
import com.Ridelink.RideLink.Repository.UserRepository;
import com.Ridelink.RideLink.Service.PaymentService;
import com.razorpay.Order;
import com.razorpay.RazorpayClient;
import org.json.JSONObject;
import org.json.JSONArray;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;

@Service
public class PaymentServiceImpl implements PaymentService {

    @Value("${razorpay.key.id}")
    private String keyId;

    @Value("${razorpay.key.secret}")
    private String keySecret;

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private UserRepository userRepository;

    @Override
    public String createAdvanceOrder(Long bookingId) throws Exception {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Booking not found"));

        double totalFare = booking.getPrice() != null ? booking.getPrice() : 0;
        double advanceAmount = totalFare * 0.50; // 50% Advance

        RazorpayClient razorpay = new RazorpayClient(keyId, keySecret);

        JSONObject orderRequest = new JSONObject();
        orderRequest.put("amount", (int) (advanceAmount * 100)); // convert to paise
        orderRequest.put("currency", "INR");
        orderRequest.put("receipt", "txn_" + bookingId);

        Order order = razorpay.orders.create(orderRequest);

        booking.setRazorpayOrderId(order.get("id"));
        bookingRepository.save(booking);

        return order.toString();
    }

    @Override
    public void verifyPayment(Long bookingId, String paymentId) throws Exception {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Booking not found"));

        booking.setRazorpayPaymentId(paymentId);
        booking.setPaymentStatus("ADVANCE_PAID");
        bookingRepository.save(booking);
    }

    @Override
    public void releaseFundsToDriver(Long bookingId) throws Exception {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Booking not found"));

        if (!"ADVANCE_PAID".equals(booking.getPaymentStatus())) {
            throw new RuntimeException("Advance payment not done.");
        }

        // Driver ka Linked Razorpay ID
        String driverAccountId = booking.getRide().getDriver().getRazorpayAccountId();
        if(driverAccountId == null || driverAccountId.isEmpty()) {
            throw new RuntimeException("Driver's Razorpay Account ID not found.");
        }

        double advancePaid = (booking.getPrice() != null ? booking.getPrice() : 0) * 0.50;
        double adminCommission = advancePaid * 0.10; // 10% Platform fee
        double driverShare = advancePaid - adminCommission;

        RazorpayClient razorpay = new RazorpayClient(keyId, keySecret);

        JSONObject transferRequest = new JSONObject();
        JSONArray transfers = new JSONArray();
        JSONObject transfer = new JSONObject();

        transfer.put("account", driverAccountId);
        transfer.put("amount", (int) (driverShare * 100));
        transfer.put("currency", "INR");
        transfers.put(transfer);
        transferRequest.put("transfers", transfers);

        razorpay.payments.transfer(booking.getRazorpayPaymentId(), transferRequest);

        booking.setPaymentStatus("FULL_PAID");
        bookingRepository.save(booking);
    }


    @Override
    public String setupDriverRazorpayAccount(Long userId) throws Exception {
        User driver = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Driver not found"));

        // Agar pehle se account bana hai, toh naya nahi banayenge
        if (driver.getRazorpayAccountId() != null && !driver.getRazorpayAccountId().isEmpty()) {
            return driver.getRazorpayAccountId();
        }

        RazorpayClient razorpay = new RazorpayClient(keyId, keySecret);

        JSONObject accountRequest = new JSONObject();
        accountRequest.put("name", driver.getFullName());
        accountRequest.put("email", driver.getEmail());
        accountRequest.put("tnc_accepted", true);

        com.razorpay.Account linkedAccount = razorpay.account.create(accountRequest);
        String accountId = linkedAccount.get("id");

        driver.setRazorpayAccountId(accountId);
        userRepository.save(driver);

        return accountId;
    }

    @Override
    public Booking processCancellationRefund(Booking booking) {
        // Agar advance pay nahi hua tha, toh kuch math karne ki zaroorat nahi hai
        if (!"ADVANCE_PAID".equalsIgnoreCase(booking.getPaymentStatus())) {
            return booking;
        }

        boolean isScheduled = "SCHEDULED".equalsIgnoreCase(booking.getRide().getRideType());
        double totalFare = booking.getPrice() != null ? booking.getPrice() : 0.0;
        double advancePaid = totalFare * 0.50;
        double refundAmount = advancePaid; // Default full advance refund maan kar chalte hain

        // 🔥 Sirf Scheduled Ride ke liye Cancellation Fee calculate hogi
        if (isScheduled) {
            LocalDateTime departureTime = booking.getRide().getDepartureTime();
            LocalDateTime now = LocalDateTime.now();
            long hoursUntilDeparture = ChronoUnit.HOURS.between(now, departureTime);

            double cancellationFee = 0;

            if (hoursUntilDeparture >= 24) {
                cancellationFee = 0;
            } else if (hoursUntilDeparture >= 12 && hoursUntilDeparture < 24) {
                cancellationFee = totalFare * 0.10;
            } else {
                cancellationFee = totalFare * 0.20;
            }

            refundAmount = advancePaid - cancellationFee;
            if (refundAmount < 0) refundAmount = 0; // Safe check: Refund negative na ho jaye

            // System Logs for Panel Presentation
            System.out.println("----- SCHEDULED RIDE CANCELLATION -----");
            System.out.println("Total Fare: ₹" + totalFare);
            System.out.println("Advance Paid: ₹" + advancePaid);
            System.out.println("Hours Left: " + hoursUntilDeparture);
            System.out.println("Cancellation Fee: ₹" + cancellationFee);
            System.out.println("Final Refund Issued: ₹" + refundAmount);
            System.out.println("---------------------------------------");
        } else {
            System.out.println("----- INSTANT RIDE CANCELLATION -----");
            System.out.println("Instant Ride: 100% Advance Refunded (₹" + refundAmount + ")");
        }

        // TODO: Razorpay ki Refund API yahan call karni hogi (Future mein)
        // razorpayClient.payments.refund(booking.getRazorpayPaymentId(), refundAmount);

        // Status update karke DB mein save kar do
        booking.setPaymentStatus("REFUNDED");
        return bookingRepository.save(booking);
    }

    @Override
    public Booking processDriverCancellationRefund(Booking booking) {
        // Agar passenger ne advance pay kiya hi nahi tha, toh kuch karne ki zaroorat nahi hai
        if (!"ADVANCE_PAID".equalsIgnoreCase(booking.getPaymentStatus())) {
            return booking;
        }

        boolean isScheduled = "SCHEDULED".equalsIgnoreCase(booking.getRide().getRideType());
        double totalFare = booking.getPrice() != null ? booking.getPrice() : 0.0;
        double refundAmount = totalFare * 0.50; // Passenger ne 50% diya tha, wahi poora wapas milega

        //  ONLY FOR SCHEDULED RIDES: 100% Refund policy
        if (isScheduled) {
            System.out.println("----- DRIVER CANCELLATION ALERT -----");
            System.out.println("Ride Type: SCHEDULED");
            System.out.println("Booking ID: " + booking.getId());
            System.out.println("Driver cancelled the ride. Penalty applies to driver if needed.");
            System.out.println("Passenger Refund Amount: ₹" + refundAmount + " (100% Refunded)");
            System.out.println("-------------------------------------");

            // Future Implementation: Razorpay Full Refund API Call
            // razorpayClient.payments.refund(booking.getRazorpayPaymentId(), refundAmount);

            booking.setPaymentStatus("REFUNDED");
            return bookingRepository.save(booking);
        }

        return booking;
    }
}