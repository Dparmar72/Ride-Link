package com.Ridelink.RideLink.Service.Impl;

import com.Ridelink.RideLink.Entity.Ride;
import com.Ridelink.RideLink.Entity.RideStatus;
import com.Ridelink.RideLink.Entity.User;
import com.Ridelink.RideLink.Exception.ResourceNotFoundException;
import com.Ridelink.RideLink.Repository.RideRepository;
import com.Ridelink.RideLink.Repository.UserRepository;
import com.Ridelink.RideLink.Service.RideService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
public class RideServiceImpl implements RideService {

    @Autowired
    private RideRepository rideRepository;

    @Autowired
    private UserRepository userRepository;

    @Override
    public Ride createRide(Ride ride, Long driverId) {
        User driver = userRepository.findById(driverId)
                .orElseThrow(() -> new ResourceNotFoundException("Driver not found with id: " + driverId));

        LocalDateTime departureTime = ride.getDepartureTime();
        LocalDateTime now = LocalDateTime.now();

        // Agar departure time agle 2 ghante ke andar ka hai, toh INSTANT manenge
        if (departureTime.isBefore(now.plusHours(1))) {
            ride.setRideType("INSTANT");
        } else {
            ride.setRideType("SCHEDULED");
        }

        ride.setDriver(driver);
        ride.setStatus(RideStatus.OPEN);
        ride.setAvailableSeats(ride.getTotalSeats());
        return rideRepository.save(ride);
    }

    @Override
    public List<Ride> searchRides(String source, String destination, LocalDateTime departureTime) {
        // 1. Jis din ki ride search ho rahi hai, us din ki shuruat (00:00:00)
        LocalDateTime searchDateStart = departureTime.toLocalDate().atStartOfDay();

        // 2. Us din ka khatma (23:59:59)
        LocalDateTime searchDateEnd = departureTime.toLocalDate().atTime(23, 59, 59);

        // 3. Abhi ka waqt (taaki purani rides filter ho sakein)
        LocalDateTime currentTime = LocalDateTime.now();

        // Repository ko saare parameters bhejien jo humne Repository Interface mein likhe hain
        return rideRepository.findAvailableRides(
                source,
                destination,
                searchDateStart,
                searchDateEnd,
                currentTime
        );
    }

    @Override
    public Ride getRideById(Long id) {
        return rideRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Ride not found with id: " + id));
    }

    @Override
    public List<Ride> getRidesByDriverId(Long driverId) {
        return rideRepository.findByDriverId(driverId);
    }

    @Override
    public List<Ride> searchInstantCarpools(Double pLat, Double pLng, Double dLat, Double dLng, Integer seats) {

        // 1. Initial filter: Database se badi range me rides nikalo (50 KM)
        List<Ride> allActiveRides = rideRepository.findInstantCarpools(pLat, pLng, dLat, dLng, 50000, seats);

        List<Ride> validRides = new ArrayList<>();

        for (Ride ride : allActiveRides) {

            // 🔥 FIX: Passed-Point Match Bug 🔥
            // Agar driver raste me hai aur WebSocket ne uski live location save ki hai,
            // toh search uski "Current Location" se hogi. Agar ride start nahi hui hai,
            // toh default "Source Location" hi rahegi.
            double driverLat1 = (ride.getCurrentLatitude() != null && ride.getCurrentLatitude() != 0.0)
                    ? ride.getCurrentLatitude()
                    : ride.getSourceLatitude();
            double driverLng1 = (ride.getCurrentLongitude() != null && ride.getCurrentLongitude() != 0.0)
                    ? ride.getCurrentLongitude()
                    : ride.getSourceLongitude();

            double driverLat2 = ride.getDestinationLatitude();
            double driverLng2 = ride.getDestinationLongitude();

            // 1. Bounding Box Check (Kya Passenger current aur end point ke rectangle ke beech me hai?)
            boolean isPassengerInBetween = isPointInBoundingBox(
                    driverLat1, driverLng1, driverLat2, driverLng2, pLat, pLng, 0.05); // 0.05 degrees ~ 5KM buffer

            if (!isPassengerInBetween) continue;

            // 2. Haversine check for direction and proximity from CURRENT location
            double distDriverCurrentToPassPickup = calculateDistance(driverLat1, driverLng1, pLat, pLng);
            double distDriverCurrentToPassDrop = calculateDistance(driverLat1, driverLng1, dLat, dLng);
            double distDriverEndToPassDrop = calculateDistance(driverLat2, driverLng2, dLat, dLng);

            // Driver ka bacha hua total safar (Current to Destination)
            double remainingDriverDistance = calculateDistance(driverLat1, driverLng1, driverLat2, driverLng2);

            // LOGIC RULES:
            // A. Passenger ka pickup driver ke BACHE HUE raste ke andar aana chahiye
            // B. Passenger aage ki disha me jana chahiye (Pickup is closer to driver's current position than Drop)
            // C. Passenger ka drop driver ke drop ke aage nahi nikalna chahiye

            if (distDriverCurrentToPassPickup < remainingDriverDistance &&
                    distDriverCurrentToPassPickup < distDriverCurrentToPassDrop &&
                    distDriverEndToPassDrop < remainingDriverDistance) {

                validRides.add(ride);
            }
        }

        return validRides;
    }

    // HELPER: Bounding Box (Kahin Passenger ulte raste par toh nahi?)
    private boolean isPointInBoundingBox(double lat1, double lng1, double lat2, double lng2, double px, double py, double buffer) {
        double minLat = Math.min(lat1, lat2) - buffer;
        double maxLat = Math.max(lat1, lat2) + buffer;
        double minLng = Math.min(lng1, lng2) - buffer;
        double maxLng = Math.max(lng1, lng2) + buffer;

        return (px >= minLat && px <= maxLat && py >= minLng && py <= maxLng);
    }

    // HELPER METHOD: Haversine formula do points ke beech ka distance (km me) nikalne ke liye
     public double calculateDistance(double lat1, double lon1, double lat2, double lon2) {
        final int R = 6371; // Earth ki radius kilometers mein
        double latDistance = Math.toRadians(lat2 - lat1);
        double lonDistance = Math.toRadians(lon2 - lon1);

        double a = Math.sin(latDistance / 2) * Math.sin(latDistance / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(lonDistance / 2) * Math.sin(lonDistance / 2);

        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }


    public void completeRide(Long rideId){
        Ride ride = rideRepository.findById(rideId).orElseThrow(()->new ResourceNotFoundException("Ride not found with id: " + rideId));

        ride.setStatus(RideStatus.COMPLETED);

        rideRepository.save(ride);
    }
}