package com.Ridelink.RideLink.Controller;

import com.Ridelink.RideLink.Entity.User;
import com.Ridelink.RideLink.Repository.UserRepository;
import com.Ridelink.RideLink.Service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/users")
@CrossOrigin(origins = "*")
public class UserController {

    @Autowired
    private UserService userService;

    @Autowired
    private UserRepository userRepository;


    @PutMapping("/{userId}/upi")
    public ResponseEntity<?> updateUpiId(@PathVariable Long userId, @RequestBody Map<String, String> request) {
        boolean isUpdated = userService.updateUpiId(userId,request);
        if (!isUpdated) {
            return new ResponseEntity<>("Upi Id update failed", HttpStatus.BAD_REQUEST);
        }
        return ResponseEntity.ok("UPI ID Updated Successfully");
    }

    @GetMapping("/{userId}")
    public ResponseEntity<?> getUserProfile(@PathVariable Long userId) {
        return userRepository.findById(userId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
