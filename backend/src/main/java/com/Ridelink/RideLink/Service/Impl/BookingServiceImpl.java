package com.Ridelink.RideLink.Service.Impl;

import com.Ridelink.RideLink.DTO.BookingRequest;
import com.Ridelink.RideLink.Entity.Booking;
import com.Ridelink.RideLink.Entity.BookingStatus;
import com.Ridelink.RideLink.Entity.Ride;
import com.Ridelink.RideLink.Entity.RideStatus;
import com.Ridelink.RideLink.Entity.User;
import com.Ridelink.RideLink.Exception.BadRequestException;
import com.Ridelink.RideLink.Exception.ResourceNotFoundException;
import com.Ridelink.RideLink.Repository.BookingRepository;
import com.Ridelink.RideLink.Repository.RideRepository;
import com.Ridelink.RideLink.Repository.UserRepository;
import com.Ridelink.RideLink.Service.BookingService;
import com.Ridelink.RideLink.Service.RideService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Random;
import java.util.UUID; // <-- Ye import zaroori hai Payment ID ke liye

@Service
public class BookingServiceImpl implements BookingService {

    @Autowired
    private BookingRepository bookingRepository;



    @Autowired
    private RideRepository rideRepository;

    @Autowired
    private UserRepository userRepository;
    @Autowired
    private RideService rideService;

    @Override
    @Transactional
    public Booking bookRide(BookingRequest bookingRequest) {
        Ride ride = rideRepository.findById(bookingRequest.getRideId())
                .orElseThrow(() -> new ResourceNotFoundException("Ride not found"));

        User passenger = userRepository.findById(bookingRequest.getPassengerId())
                .orElseThrow(() -> new ResourceNotFoundException("Passenger not found"));

        if (ride.getAvailableSeats() <= 0) {
            throw new BadRequestException("Ride is full!");
        }

        if (ride.getDriver().getId().equals(bookingRequest.getPassengerId())) {
            throw new BadRequestException("Driver cannot book their own ride.");
        }

        Booking booking = new Booking();
        booking.setRide(ride);
        booking.setPassenger(passenger);
        booking.setBookingTime(LocalDateTime.now());
        booking.setStatus(BookingStatus.PENDING);
        booking.setPaid(false); // Default payment status false rahega
        booking.setSeatsBooked(bookingRequest.getSeatsBooked());
        booking.setDropLatitude(bookingRequest.getDropLat());
        booking.setDropLongitude(bookingRequest.getDropLng());
        booking.setPickupLatitude(bookingRequest.getPickupLat());
        booking.setPickupLongitude(bookingRequest.getPickupLng());
        booking.setPrice(bookingRequest.getPrice());

        // OTP Generate Logic (4 Digit)
        String otp = String.format("%04d", new Random().nextInt(10000));
        booking.setRideOtp(otp);

        // Seat Minus Logic
        ride.setAvailableSeats(ride.getAvailableSeats() - bookingRequest.getSeatsBooked());
        if (ride.getAvailableSeats() == 0) {
            ride.setStatus(RideStatus.FULL);
        }
        rideRepository.save(ride);

        return bookingRepository.save(booking);
    }

    @Override
    public Booking verifyRideOtp(Long rideId, String otp) {
        Booking booking = bookingRepository.findByRideIdAndRideOtp(rideId, otp)
                .orElseThrow(() -> new BadRequestException("Invalid OTP or Booking not found"));

        booking.setStatus(BookingStatus.STARTED);
        return bookingRepository.save(booking);
    }

    // --- NEW METHOD: FAKE PAYMENT LOGIC ---
    @Override
    public Booking processPayment(Long bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found with ID: " + bookingId));

        if (booking.isPaid()) {
            throw new BadRequestException("Booking is already paid!");
        }

        // Fake Payment Process
        booking.setPaid(true);
        // Ek unique fake transaction ID generate kar rahe hain
        booking.setPaymentId("PAY_DEMO_" + UUID.randomUUID().toString());

        return bookingRepository.save(booking);
    }

    @Override
    public List<Booking> getBookingsByPassangerId(Long passengerId){
        return bookingRepository.findByPassengerId(passengerId);
    }

    @Override
    public List<Booking> getBookingsByRideId(Long rideId){
        return bookingRepository.findByRideId(rideId);
    }


    @Override
    public List<Booking> getPendingRequestsForDriver(Long driverId) {
        return bookingRepository.findByDriverIdAndStatus(driverId, BookingStatus.PENDING);
    }

    @Transactional
    @Override
    public Booking acceptBooking(Long bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking nahi mili"));

        booking.setStatus(BookingStatus.CONFIRMED);
        return bookingRepository.save(booking);
    }

    @Transactional
    @Override
    public Booking rejectBooking(Long bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking nahi mili"));

        booking.setStatus(BookingStatus.CANCELLED);

        // Agar driver reject kar rha h, toh seats wapas khali karo rides table me
        Ride ride = booking.getRide();
        ride.setAvailableSeats(ride.getAvailableSeats() + booking.getSeatsBooked());
        if (ride.getStatus() == RideStatus.FULL) {
            ride.setStatus(RideStatus.OPEN);
        }
        rideRepository.save(ride);

        autoForwardToNextDriver(booking);

        return bookingRepository.save(booking);
    }

    @Override
    public Booking cancelBookingByPassenger(Long bookingId) {
         Booking booking = bookingRepository.findById(bookingId)
                 .orElseThrow(()->new RuntimeException("Booking not found"));

         booking.setStatus(BookingStatus.CANCELLED);
          Ride ride = booking.getRide();
          ride.setAvailableSeats(ride.getAvailableSeats() + booking.getSeatsBooked());
          rideRepository.save(ride);
          return bookingRepository.save(booking);
    }

    @Override
    public void autoForwardToNextDriver(Booking failedBooking) {

        Long currentDriverId = failedBooking.getRide().getDriver().getId();

        List<Ride> alternativeDrivers = rideRepository.findInstantCarpools(
                failedBooking.getPickupLatitude(),
                failedBooking.getPickupLongitude(),
                failedBooking.getDropLatitude(),
                failedBooking.getDropLongitude(),
                3000,
                failedBooking.getSeatsBooked()
        );

        Ride nextBestRide = null;

        for(Ride r: alternativeDrivers) {
            if(!r.getDriver().getId().equals(currentDriverId) && r.getAvailableSeats()>=failedBooking.getSeatsBooked()) {
                double distToPickup = rideService.calculateDistance(r.getSourceLatitude(), r.getSourceLongitude(), failedBooking.getPickupLatitude(), failedBooking.getPickupLongitude());
                double distToDrop = rideService.calculateDistance(r.getSourceLatitude(), r.getSourceLongitude(), failedBooking.getDropLatitude(), failedBooking.getDropLongitude());

                if (distToPickup < distToDrop) {
                    nextBestRide = r;
                    break; // Agla best matched driver mil gaya!
                }
            }


        }

        if (nextBestRide != null) {

            Ride oldRide = failedBooking.getRide();
            oldRide.setAvailableSeats(oldRide.getAvailableSeats() + failedBooking.getSeatsBooked());
            rideRepository.save(oldRide);

            nextBestRide.setAvailableSeats(nextBestRide.getAvailableSeats() - failedBooking.getSeatsBooked());
            rideRepository.save(nextBestRide);

            failedBooking.setRide(nextBestRide);
            failedBooking.setStatus(BookingStatus.PENDING);
            bookingRepository.save(failedBooking);

            System.out.println("🚀 Request auto-forwarded to Driver ID: " + nextBestRide.getDriver().getId());
        } else {
            System.out.println("❌ No alternative drivers found on this route.");
        }
    }

    @Override
    public Booking endPassengerRide(Long bookingId) {
        // 1. Booking find karo
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Booking not found with id: " + bookingId));

        // 2. Sirf usi ride ko end karo jo already STARTED ya BOARDED hai
        if (booking.getStatus() != BookingStatus.STARTED && booking.getStatus() != BookingStatus.BOARDED) {
            throw new RuntimeException("Ride cannot be ended because it is not in STARTED state.");
        }

        // 3. Status ko COMPLETED set karke DB me save kar do
        booking.setStatus(BookingStatus.COMPLETED);

        //  passenger ko seat free karna chahte hain aage ke routes ke liye:
        Ride ride = booking.getRide();
         ride.setAvailableSeats(ride.getAvailableSeats() + booking.getSeatsBooked());
         rideRepository.save(ride);

        return bookingRepository.save(booking);
    }

    @Override
    public Booking cancelBookingByDriver(Long bookingId) {
        // 1. Database se booking nikalo
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Booking not found with ID: " + bookingId));

        // Agar already cancelled hai, toh wahi wapas return kar do
        if ("CANCELLED".equalsIgnoreCase(String.valueOf(booking.getStatus())) || "REJECTED".equalsIgnoreCase(String.valueOf(booking.getStatus()))) {
            return booking;
        }

        // 2. Booking ka status "CANCELLED" mark karo (Kyunki driver ne cancel ki hai)
        booking.setStatus(BookingStatus.CANCELLED);

        // 3.IMPORTANT: Passenger ki seats wapas gadi (Ride) mein add karo
        Ride ride = booking.getRide();
        if (ride != null) {
            int bookedSeats = booking.getSeatsBooked();

            // Available seats mein wapas add kar do
            ride.setAvailableSeats(ride.getAvailableSeats() + bookedSeats);

            // Ride ko database mein save karo taaki naye passengers ko ye seat dikhne lage
            rideRepository.save(ride);
        }

        // 4. Booking ko save karke return kar do
        return bookingRepository.save(booking);
    }

}