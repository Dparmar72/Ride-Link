package com.Ridelink.RideLink.Controller;

import com.Ridelink.RideLink.DTO.LocationUpdateDto;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;

@Controller
public class WebSocketLocationController {

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    // Frontend is path par message bhejega: /app/update-location
    @MessageMapping("/update-location")
    public void broadcastLocation(@Payload LocationUpdateDto locationData) {
        // Dynamic topic path banega rideId ke hisaab se
        String topic = "/topic/ride/" + locationData.getRideId();

        // Pura location data us ride se jude sabhi logo ko bhej do
        messagingTemplate.convertAndSend(topic, locationData);
    }
}