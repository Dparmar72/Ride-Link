package com.Ridelink.RideLink.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
@CrossOrigin(origins = "*")
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // Frontend isse connect karega
        registry.addEndpoint("/ws-provider").setAllowedOriginPatterns("http://localhost:8080").withSockJS();
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // Messages receive karne ke liye prefix
        registry.setApplicationDestinationPrefixes("/app");
        // Messages broadcast (send) karne ke liye topic prefix
        registry.enableSimpleBroker("/topic");
    }
}