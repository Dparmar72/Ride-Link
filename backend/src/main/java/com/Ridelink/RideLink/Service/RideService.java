package com.Ridelink.RideLink.Service;

import com.Ridelink.RideLink.Entity.Ride;
import java.time.LocalDateTime;
import java.util.List;

public interface RideService {
    Ride createRide(Ride ride, Long driverId);
    List<Ride> searchRides(String source, String destination, LocalDateTime departureTime);
    Ride getRideById(Long id);
    List<Ride> getRidesByDriverId(Long driverId);
    public List<Ride> searchInstantCarpools(Double pLat, Double pLng, Double dLat, Double dLng, Integer seats) ;
     double calculateDistance(double lat1, double lon1, double lat2, double lon2);

    void completeRide(Long rideId);
}