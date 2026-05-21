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
        // 3000 meters (3 KM) ka radius liya hai
        Integer searchRadius = 3000;

        // 1. Pehle DB se radius aur seats ke hisaab se saari rides nikal lo
        List<Ride> nearbyRides = rideRepository.findInstantCarpools(pLat, pLng, dLat, dLng, searchRadius, seats);

        // 2. Ab hum filter karenge ki gaadi sahi disha (forward direction) me ja rahi ho
        List<Ride> validDirectionRides = new ArrayList<>();

        for (Ride ride : nearbyRides) {
            // Driver ke Start point se Passenger ke Pickup aur Drop ka distance nikalo
            double distToPickup = calculateDistance(ride.getSourceLatitude(), ride.getSourceLongitude(), pLat, pLng);
            double distToDrop = calculateDistance(ride.getSourceLatitude(), ride.getSourceLongitude(), dLat, dLng);

            //  MAIN LOGIC: Agar Passenger ka Drop point jyada door hai (Driver ke source se)
            // tabhi gaadi sahi aage ki disha me ja rahi hai!
            if (distToPickup < distToDrop) {
                validDirectionRides.add(ride);
            }
        }

        return validDirectionRides;
    }

    // HELPER METHOD: Haversine formula do points ke beech ka distance (km me) nikalne ke liye
     double calculateDistance(double lat1, double lon1, double lat2, double lon2) {
        final int R = 6371; // Earth ki radius kilometers mein
        double latDistance = Math.toRadians(lat2 - lat1);
        double lonDistance = Math.toRadians(lon2 - lon1);

        double a = Math.sin(latDistance / 2) * Math.sin(latDistance / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(lonDistance / 2) * Math.sin(lonDistance / 2);

        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
}