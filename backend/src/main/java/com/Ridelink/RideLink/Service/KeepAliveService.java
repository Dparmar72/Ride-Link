package com.Ridelink.RideLink.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
public class KeepAliveService {

    private static final Logger logger = LoggerFactory.getLogger(KeepAliveService.class);
    private final RestTemplate restTemplate = new RestTemplate();

    // 600000 ms = 10 minutes. Yeh har 10 minute me chalega.
    @Scheduled(fixedRate = 600000)
    public void pingSelf() {
        try {
            String url = "https://ride-link-backend.onrender.com/health";

            String response = restTemplate.getForObject(url, String.class);
            logger.info("Self-Ping Status: App is awake! Response: " + response);
        } catch (Exception e) {
            logger.error("Self-Ping Failed: App might be sleeping or URL is wrong. Error: " + e.getMessage());
        }
    }
}
