package com.Ridelink.RideLink.Entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "bookings")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Booking {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "ride_id", nullable = false)
    private Ride ride;

    @ManyToOne
    @JoinColumn(name = "passenger_id", nullable = false)
    private User passenger;

    private LocalDateTime bookingTime;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    private String rideOtp;

    @Enumerated(EnumType.STRING)
    private BookingStatus status;

    private Double pickupLatitude;
    private Double pickupLongitude;
    private Double dropLatitude;
    private Double dropLongitude;

    private Double price;

    private Integer seatsBooked;

    private String paymentId;
    private boolean isPaid;

    @Column(name = "payment_status")
    private String paymentStatus = "PENDING"; // PENDING, ADVANCE_PAID, FULL_PAID, REFUNDED

    @Column(name = "razorpay_order_id")
    private String razorpayOrderId;

    @Column(name = "razorpay_payment_id")
    private String razorpayPaymentId;
}