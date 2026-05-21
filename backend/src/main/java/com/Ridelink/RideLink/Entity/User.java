package com.Ridelink.RideLink.Entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    @JsonIgnore
    private String password;

    @Column(name = "full_name", nullable = false)
    private String fullName;

    private String phone;

    // Roles: "ROLE_USER", "ROLE_DRIVER", "ROLE_ADMIN"
    private String role;

    @Column(name = "profile_image_url")
    private String profileImageUrl;

    @Column(name = "kyc_status")
    private String kycStatus = "PENDING"; // PENDING, APPROVED, REJECTED

    @Column(name = "kyc_applied_at")
    private LocalDateTime kycAppliedAt;

    @Column(name = "kyc_verified_at")
    private LocalDateTime kycVerifiedAt;

    @Column(name = "license_url")
    private String licenseUrl;

    @Column(name = "rc_url")
    private String rcUrl;



    @Column(name = "vehicle_number")
    private String vehicleNumber;
}