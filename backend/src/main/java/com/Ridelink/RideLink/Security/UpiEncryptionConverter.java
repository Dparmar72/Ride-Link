package com.Ridelink.RideLink.Security;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

@Converter
@Component
public class UpiEncryptionConverter implements AttributeConverter<String, String> {

    private static final String ALGORITHM = "AES";
    private final SecretKeySpec secretKey;

    // application.properties se key read karna
    public UpiEncryptionConverter(@Value("${app.security.encryption-key}") String encryptionKey) {
        this.secretKey = new SecretKeySpec(encryptionKey.getBytes(StandardCharsets.UTF_8), ALGORITHM);
    }

    // DB mein save hone se pehle Encrypt hoga
    @Override
    public String convertToDatabaseColumn(String attribute) {
        if (attribute == null || attribute.trim().isEmpty()) {
            return null;
        }
        try {
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.ENCRYPT_MODE, secretKey);
            byte[] encryptedBytes = cipher.doFinal(attribute.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(encryptedBytes);
        } catch (Exception e) {
            throw new RuntimeException("Error encrypting UPI ID: " + e.getMessage(), e);
        }
    }

    // DB se nikalte waqt Decrypt hoga
    @Override
    public String convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.trim().isEmpty()) {
            return null;
        }
        try {
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.DECRYPT_MODE, secretKey);
            byte[] decryptedBytes = cipher.doFinal(Base64.getDecoder().decode(dbData));
            return new String(decryptedBytes, StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new RuntimeException("Error decrypting UPI ID: " + e.getMessage(), e);
        }
    }
}