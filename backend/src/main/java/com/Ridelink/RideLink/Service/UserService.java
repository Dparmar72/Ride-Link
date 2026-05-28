package com.Ridelink.RideLink.Service;

import com.Ridelink.RideLink.Entity.User;

import java.util.Map;

public interface UserService {
    User registerUser(User user);
    User findUserByEmail(String email);
    User findUserById(Long id);

    boolean updateUpiId(Long userId, Map<String, String> request);
}