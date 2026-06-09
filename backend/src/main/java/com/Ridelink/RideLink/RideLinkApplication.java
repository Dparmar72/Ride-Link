package com.Ridelink.RideLink;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class RideLinkApplication {

	public static void main(String[] args) {
		SpringApplication.run(RideLinkApplication.class, args);
	}

}