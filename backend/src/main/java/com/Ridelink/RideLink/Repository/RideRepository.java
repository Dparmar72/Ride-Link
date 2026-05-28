package com.Ridelink.RideLink.Repository;

import com.Ridelink.RideLink.Entity.Ride;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface RideRepository extends JpaRepository<Ride, Long> {

    @Query("SELECT r FROM Ride r WHERE " +
            "LOWER(r.sourceName) LIKE LOWER(CONCAT('%', :source, '%')) AND " +
            "LOWER(r.destinationName) LIKE LOWER(CONCAT('%', :destination, '%')) AND " +
            "r.departureTime BETWEEN :searchDateStart AND :searchDateEnd AND " +
            "r.departureTime >= :currentTime AND " +
            "r.availableSeats > 0") // Optional: AND r.rideType = 'SCHEDULED' agar DB me column hai
    List<Ride> findAvailableRides(
            @Param("source") String source,
            @Param("destination") String destination,
            @Param("searchDateStart") LocalDateTime searchDateStart,
            @Param("searchDateEnd") LocalDateTime searchDateEnd,
            @Param("currentTime") LocalDateTime currentTime
    );


    List<Ride> findByDriverId(Long driverId);

    // point(longitude, latitude) - MySQL me ulta hota hai isliye pehle lng fir lat diya hai
    @Query(value =
            "SELECT * FROM rides r " +
                    "WHERE r.status = 'OPEN' " + // Ensure tumhare RideStatus enum me OPEN ho
                    "AND r.available_seats >= :requiredSeats " +
                    // Pickup match: 3 KM (radius) ke andar koi nikal raha hai kya?
                    "AND ST_Distance_Sphere(point(r.source_longitude, r.source_latitude), point(:pLng, :pLat)) <= :radius " +
                    // Drop match: 3 KM (radius) ke andar koi jaa raha hai kya?
                    "AND ST_Distance_Sphere(point(r.destination_longitude, r.destination_latitude), point(:dLng, :dLat)) <= :radius " +
                    // Jo sabse pass se nikal raha ho wo list me sabse upar aaye
                    "ORDER BY ST_Distance_Sphere(point(r.source_longitude, r.source_latitude), point(:pLng, :pLat)) ASC",
            nativeQuery = true)
    List<Ride> findInstantCarpools(
            @Param("pLat") Double passengerPickupLat,
            @Param("pLng") Double passengerPickupLng,
            @Param("dLat") Double passengerDropLat,
            @Param("dLng") Double passengerDropLng,
            @Param("radius") Integer radiusInMeters,
            @Param("requiredSeats") Integer requiredSeats
    );
}