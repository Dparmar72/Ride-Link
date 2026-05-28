package com.Ridelink.RideLink.Service.Impl;

import com.Ridelink.RideLink.Entity.User;
import com.Ridelink.RideLink.Exception.ResourceNotFoundException;
import com.Ridelink.RideLink.Repository.UserRepository;
import com.Ridelink.RideLink.Service.PaymentService;
import com.Ridelink.RideLink.Service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class UserServiceImpl implements UserService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private PaymentService paymentService;

    @Override
    public User registerUser(User user) {
        user.setPassword(passwordEncoder.encode(user.getPassword()));
        return userRepository.save(user);
    }

    @Override
    public User findUserByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with email: " + email));
    }

    @Override
    public User findUserById(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + id));
    }

    @Override
    public boolean updateUpiId(Long userId, Map<String,String> request){
       try {
           String upiId = request.get("upiId");
           User user = userRepository.findById(userId).orElseThrow();
           user.setUpiId(upiId);
           userRepository.save(user);
           String razorpayId = paymentService.setupDriverRazorpayAccount(userId);
           System.out.println("Razorpay Escrow Account auto-created for Driver: " + razorpayId);
       }
       catch(Exception e){
           System.err.println("Razorpay account generation failed but UPI saved: " + e.getMessage());
           return false;
       }
       return true;
    }
}