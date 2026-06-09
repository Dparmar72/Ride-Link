package com.Ridelink.RideLink.Controller;

import com.Ridelink.RideLink.DTO.*;
import com.Ridelink.RideLink.Entity.User;
import com.Ridelink.RideLink.Repository.UserRepository;
import com.Ridelink.RideLink.Security.JwtUtil;
import com.Ridelink.RideLink.Service.EmailService;
import com.Ridelink.RideLink.Service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.Random;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*") // Allow Frontend Access
public class AuthController {

    @Autowired
    private AuthenticationManager authenticationManager;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserService userService;

    @Autowired
    private JwtUtil jwtUtils;

    @Autowired
    private EmailService emailService;

    // Temporary storage for OTPs
    private final Map<String, String> otpStorage = new ConcurrentHashMap<>();
    @Autowired
    private UserDetailsService userDetailsService;


    @PostMapping("/login")
    public ResponseEntity<?> authenticateUser(@RequestBody LoginRequest loginRequest) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(loginRequest.getEmail(), loginRequest.getPassword()));

        SecurityContextHolder.getContext().setAuthentication(authentication);
        User userDetails = userRepository.findByEmail(loginRequest.getEmail()).orElseThrow();
        UserDetails userDetails1 = userDetailsService.loadUserByUsername(userDetails.getEmail());

        String jwt = jwtUtils.generateToken(userDetails.getEmail(), userDetails.getRole());
        String refreshToken = jwtUtils.generateRefreshToken(userDetails1);
        return ResponseEntity.ok(new JwtResponse(
                jwt,
                refreshToken,
                userDetails.getId(),
                userDetails.getEmail(),
                userDetails.getFullName(),
                userDetails.getRole(),
                userDetails.getKycStatus()));
    }

    @PostMapping("/register")
    public ResponseEntity<?> registerUser(@RequestBody RegisterRequest signUpRequest) {
        if (userRepository.existsByEmail(signUpRequest.getEmail())) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Email is already in use!"));
        }

        User user = User.builder()
                .fullName(signUpRequest.getFullName())
                .email(signUpRequest.getEmail())
                .password(signUpRequest.getPassword())
                .phone(signUpRequest.getPhone())
                .role(signUpRequest.getRole())
                .build();

        userService.registerUser(user);

        return ResponseEntity.ok(new MessageResponse("User registered successfully!"));
    }



    @PostMapping("/send-otp")
    public ResponseEntity<?> sendOtp(@RequestBody SendOtpRequestDto request) {
        try {
            // Null check and default value handling
            String email = request.getEmail();
            if (email == null || email.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(new MessageResponse("Email is required"));
            }

            String type = request.getType() != null ? request.getType() : "register";

            String normalizedEmail = email.trim().toLowerCase();
            boolean userExists = userRepository.existsByEmail(normalizedEmail);

            // 1. Agar Sign Up kar raha hai, aur email already hai -> Error
            if ("register".equalsIgnoreCase(type) && userExists) {
                return ResponseEntity.badRequest().body(new MessageResponse("This email is already registered. Please Login."));
            }

            // 2. Agar Login kar raha hai, aur email nahi hai -> Error
            if ("login".equalsIgnoreCase(type) && !userExists) {
                return ResponseEntity.badRequest().body(new MessageResponse("Account not found. Please Sign Up first."));
            }

            // 3. Sab sahi hai toh OTP bhejo
            String otp = String.format("%06d", new Random().nextInt(999999));
            otpStorage.put(normalizedEmail, otp);

            String subject = "Your RideLink Verification Code";
            String text = "Your RideLink verification OTP is: " + otp + "\n\nPlease do not share this code with anyone.";

            emailService.sendSimpleEmail(normalizedEmail, subject, text);

            return ResponseEntity.ok(new MessageResponse("OTP sent successfully to " + normalizedEmail));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(new MessageResponse("Failed to send OTP: " + e.getMessage()));
        }
    }


    @PostMapping("/verify-otp")
    public ResponseEntity<?> verifyOtp(@RequestBody VerifyAuthOtpRequestDto request) {
        String email = request.getEmail() != null ? request.getEmail().trim().toLowerCase() : "";
        String otp = request.getOtp();

        String storedOtp = otpStorage.get(email);

        if (storedOtp != null && storedOtp.equals(otp)) {
            // OTP is correct. Remove it after successful verification
            otpStorage.remove(email);
            return ResponseEntity.ok(new MessageResponse("OTP Verified Successfully!"));
        } else {
            return ResponseEntity.badRequest().body(new MessageResponse("Invalid or Expired OTP."));
        }
    }




    @PostMapping("/refresh-token")
    public ResponseEntity<?> refreshToken(@RequestBody Map<String, String> request) {
        String refreshToken = request.get("refreshToken");

        if (refreshToken == null) {
            return ResponseEntity.badRequest().body("Refresh token is missing");
        }

        try {
            // 1. Refresh token se email/username nikalein
            String username = jwtUtils.getUserNameFromJwtToken(refreshToken);

            if (username != null) {
                // 2. MySQL se user detail load karein
                UserDetails userDetails = userDetailsService.loadUserByUsername(username);

                // 3. Check karein ki refresh token valid aur unexpired hai ya nahi
                if (jwtUtils.isTokenValid(refreshToken, userDetails)) {

                    // 4. Sab theek hai toh Naya Access Token banao
                    String newAccessToken = jwtUtils.generateToken(userDetails);

                    // 5. Frontend ko dono tokens wapas bhej do
                    Map<String, String> response = new HashMap<>();
                    response.put("accessToken", newAccessToken);
                    response.put("refreshToken", refreshToken); // Purana refresh token wapas bhej diya taaki frontend chala sake

                    return ResponseEntity.ok(response);
                }
            }
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid Refresh Token");
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Token Expired or Invalid");
        }
    }
}