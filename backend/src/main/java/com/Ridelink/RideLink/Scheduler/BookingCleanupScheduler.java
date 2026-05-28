package com.Ridelink.RideLink.Scheduler;

import com.Ridelink.RideLink.Entity.Booking;
import com.Ridelink.RideLink.Entity.BookingStatus;
import com.Ridelink.RideLink.Repository.BookingRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import java.time.LocalDateTime;
import java.util.List;

@Component
public class BookingCleanupScheduler {

    @Autowired
    private BookingRepository bookingRepository;

    // Har 10 minute mein check karega
    @Scheduled(fixedRate = 600000)
    public void cancelUnpaidBookings() {
        LocalDateTime twoHoursAgo = LocalDateTime.now().minusHours(2);

        List<Booking> unpaidBookings = bookingRepository.findByStatusAndPaymentStatusAndUpdatedAtBefore(
                "ACCEPTED", "PENDING", twoHoursAgo
        );

        for (Booking booking : unpaidBookings) {
            booking.setStatus(BookingStatus.CANCELLED);
            booking.setPaymentStatus("FAILED");
            // Driver ki seats wapas add karein
            booking.getRide().setAvailableSeats(booking.getRide().getAvailableSeats() + booking.getSeatsBooked());
            bookingRepository.save(booking);
        }
    }
}