package com.Ridelink.RideLink.Service;

import com.Ridelink.RideLink.Entity.Booking;
import com.Ridelink.RideLink.Entity.BookingStatus;
import com.Ridelink.RideLink.Entity.Ride;
import com.Ridelink.RideLink.Repository.BookingRepository;
import com.Ridelink.RideLink.Repository.RideRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class BookingSchedulerService {

    private final BookingRepository bookingRepository;
    private final RideRepository rideRepository;

    public BookingSchedulerService(BookingRepository bookingRepository, RideRepository rideRepository) {
        this.bookingRepository = bookingRepository;
        this.rideRepository = rideRepository;
    }

    // Har 15 minute (900000 ms) mein ye function automatically chalega
    @Scheduled(fixedRate = 900000)
    @Transactional
    public void autoCancelUnpaidBookings() {
        // 2 ghante pehle ka time nikal lo
        LocalDateTime twoHoursAgo = LocalDateTime.now().minusHours(2);

        // Aisi bookings dhundho jo PENDING hain aur 2 ghante purani ho chuki hain
        List<Booking> expiredBookings = bookingRepository.findExpiredBookings("PENDING", twoHoursAgo);

        for (Booking booking : expiredBookings) {
            // 1. Booking ko cancel karo
            booking.setStatus(BookingStatus.CANCELLED);

            // 2. 🔥 Sabse Zaroori: Ride ki available seats wapas badhao taaki koi aur book kar sake
            Ride ride = booking.getRide();
            ride.setAvailableSeats(ride.getAvailableSeats() + booking.getSeatsBooked());

            rideRepository.save(ride);
            bookingRepository.save(booking);

            System.out.println("Auto-cancelled booking ID: " + booking.getId());
        }
    }
}
