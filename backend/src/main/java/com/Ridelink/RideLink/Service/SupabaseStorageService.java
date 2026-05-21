package com.Ridelink.RideLink.Service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.util.UUID;

@Service
public class SupabaseStorageService {

    @Value("${supabase.url}")
    private String supabaseUrl;

    @Value("${supabase.key}")
    private String supabaseKey;

    @Value("${supabase.bucket}")
    private String bucketName;

    private final RestTemplate restTemplate = new RestTemplate();

    public String uploadFile(MultipartFile file) throws IOException {
        // Unique file name banana (e.g., driver_rc_45hg34.pdf)
        String fileName = UUID.randomUUID().toString() + "_" + file.getOriginalFilename().replaceAll("\\s+", "_");

        // Supabase Storage API endpoint
        String uploadUrl = supabaseUrl + "/storage/v1/object/" + bucketName + "/" + fileName;

        // HTTP Headers set karna (Authentication aur File type)
        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "Bearer " + supabaseKey);
        headers.set("apikey", supabaseKey);
        headers.setContentType(MediaType.valueOf(file.getContentType()));

        // File upload request bhejna
        HttpEntity<byte[]> requestEntity = new HttpEntity<>(file.getBytes(), headers);

        ResponseEntity<String> response = restTemplate.exchange(
                uploadUrl,
                HttpMethod.POST,
                requestEntity,
                String.class
        );

        if (response.getStatusCode().is2xxSuccessful()) {
            // Public URL generate karke return karna
            return supabaseUrl + "/storage/v1/object/public/" + bucketName + "/" + fileName;
        } else {
            throw new RuntimeException("Failed to upload file to Supabase: " + response.getBody());
        }
    }
}
