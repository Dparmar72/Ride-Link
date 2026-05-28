package com.Ridelink.RideLink.Service;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Refill;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class RateLimitingService {

    // Memory cache to store bucket per IP Address
    private  final Map<String, Bucket> cache = new ConcurrentHashMap<>();

    public Bucket resolveBucket(String ipAddress, String apiType) {
        // If the bucket is present for this ipAddress then return it else create new Bucket
        return cache.computeIfAbsent(ipAddress, this::newBucket);
    }

    private Bucket newBucket(String apiType) {

        if("OTP".equals(apiType)) {
            Refill refill = Refill.intervally(3, Duration.ofMinutes(1));
            Bandwidth limit = Bandwidth.classic(3, refill);
            return Bucket.builder()
                    .addLimit(limit)
                    .build();
        }
        else{

            Refill refill = Refill.intervally(20, Duration.ofMinutes(1));
            Bandwidth limit = Bandwidth.classic(100, refill);
            return Bucket.builder()
                    .addLimit(limit)
                    .build();
        }

    }
}
