package com.example.crypto;

import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import javax.crypto.Cipher;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Base64;

@ApplicationScoped
public class AESCryptoService {
    
    private static final Logger LOG = Logger.getLogger(AESCryptoService.class);
    private static final String ALGORITHM = "AES/CBC/PKCS5Padding";
    private static final String KEY_ALGORITHM = "AES";
    
    @ConfigProperty(name = "encryption.key", defaultValue = "my-super-secret-aes-256-key-32ch")
    String encryptionKey;
    
    public String encrypt(String plainText) throws Exception {
        SecretKeySpec secretKey = getSecretKey();
        Cipher cipher = Cipher.getInstance(ALGORITHM);
        
        byte[] iv = new byte[16];
        Arrays.fill(iv, (byte) 0);
        IvParameterSpec ivParameterSpec = new IvParameterSpec(iv);
        
        cipher.init(Cipher.ENCRYPT_MODE, secretKey, ivParameterSpec);
        byte[] encrypted = cipher.doFinal(plainText.getBytes(StandardCharsets.UTF_8));
        
        return Base64.getEncoder().encodeToString(encrypted);
    }
    
    public String decrypt(String encryptedText) throws Exception {
        try {
            SecretKeySpec secretKey = getSecretKey();
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            
            byte[] iv = new byte[16];
            Arrays.fill(iv, (byte) 0);
            IvParameterSpec ivParameterSpec = new IvParameterSpec(iv);
            
            cipher.init(Cipher.DECRYPT_MODE, secretKey, ivParameterSpec);
            byte[] decrypted = cipher.doFinal(Base64.getDecoder().decode(encryptedText));
            
            return new String(decrypted, StandardCharsets.UTF_8);
        } catch (Exception e) {
            LOG.error("Decryption failed", e);
            throw new RuntimeException("Failed to decrypt data: " + e.getMessage());
        }
    }
    
    private SecretKeySpec getSecretKey() throws Exception {
        MessageDigest sha = MessageDigest.getInstance("SHA-256");
        byte[] key = encryptionKey.getBytes(StandardCharsets.UTF_8);
        key = sha.digest(key);
        key = Arrays.copyOf(key, 16);
        return new SecretKeySpec(key, KEY_ALGORITHM);
    }
    
    public String decryptCryptoJS(String encryptedData) {
        LOG.infof("Attempting to decrypt data: %s", encryptedData.substring(0, Math.min(50, encryptedData.length())) + "...");
        
        try {
            byte[] keyBytes = encryptionKey.getBytes(StandardCharsets.UTF_8);
            MessageDigest sha = MessageDigest.getInstance("SHA-256");
            keyBytes = sha.digest(keyBytes);
            
            // Use first 16 bytes of SHA256 hash as IV (matching frontend logic)
            String keyHex = bytesToHex(keyBytes);
            String ivHex = keyHex.substring(0, 32);
            byte[] iv = hexStringToByteArray(ivHex);
            
            SecretKeySpec secretKey = new SecretKeySpec(keyBytes, KEY_ALGORITHM);
            IvParameterSpec ivSpec = new IvParameterSpec(iv);
            
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.DECRYPT_MODE, secretKey, ivSpec);
            
            byte[] decrypted = cipher.doFinal(Base64.getDecoder().decode(encryptedData));
            String result = new String(decrypted, StandardCharsets.UTF_8);
            LOG.infof("Successfully decrypted with simple method");
            return result;
            
        } catch (Exception e) {
            LOG.error("Simple decryption failed, trying CryptoJS format", e);
            
            try {
                if (encryptedData.startsWith("U2FsdGVkX1")) {
                    byte[] encryptedBytes = Base64.getDecoder().decode(encryptedData);
                    
                    byte[] saltBytes = Arrays.copyOfRange(encryptedBytes, 8, 16);
                    byte[] cipherBytes = Arrays.copyOfRange(encryptedBytes, 16, encryptedBytes.length);
                    
                    byte[][] keyAndIV = deriveKeyAndIVFromPassword(encryptionKey, saltBytes);
                    
                    SecretKeySpec secretKey = new SecretKeySpec(keyAndIV[0], KEY_ALGORITHM);
                    IvParameterSpec ivSpec = new IvParameterSpec(keyAndIV[1]);
                    
                    Cipher cipher = Cipher.getInstance(ALGORITHM);
                    cipher.init(Cipher.DECRYPT_MODE, secretKey, ivSpec);
                    
                    byte[] decrypted = cipher.doFinal(cipherBytes);
                    return new String(decrypted, StandardCharsets.UTF_8);
                } else {
                    throw new RuntimeException("Unknown encryption format");
                }
            } catch (Exception ex) {
                LOG.error("All decryption methods failed", ex);
                throw new RuntimeException("Failed to decrypt CryptoJS data: " + ex.getMessage());
            }
        }
    }
    
    private String decryptSimpleAES(String encryptedData) throws Exception {
        byte[] keyBytes = encryptionKey.getBytes(StandardCharsets.UTF_8);
        MessageDigest sha = MessageDigest.getInstance("MD5");
        keyBytes = sha.digest(keyBytes);
        keyBytes = Arrays.copyOf(keyBytes, 16);
        
        SecretKeySpec secretKey = new SecretKeySpec(keyBytes, KEY_ALGORITHM);
        
        Cipher cipher = Cipher.getInstance("AES/ECB/PKCS5Padding");
        cipher.init(Cipher.DECRYPT_MODE, secretKey);
        
        byte[] decrypted = cipher.doFinal(Base64.getDecoder().decode(encryptedData));
        return new String(decrypted, StandardCharsets.UTF_8);
    }
    
    private byte[] hexStringToByteArray(String s) {
        int len = s.length();
        byte[] data = new byte[len / 2];
        for (int i = 0; i < len; i += 2) {
            data[i / 2] = (byte) ((Character.digit(s.charAt(i), 16) << 4)
                    + Character.digit(s.charAt(i + 1), 16));
        }
        return data;
    }
    
    private String bytesToHex(byte[] bytes) {
        StringBuilder result = new StringBuilder();
        for (byte b : bytes) {
            result.append(String.format("%02x", b));
        }
        return result.toString();
    }
    
    private byte[][] deriveKeyAndIVFromPassword(String password, byte[] salt) throws Exception {
        MessageDigest md = MessageDigest.getInstance("MD5");
        byte[] passBytes = password.getBytes(StandardCharsets.UTF_8);
        
        byte[] hash1 = md.digest(concatenateByteArrays(passBytes, salt));
        byte[] hash2 = md.digest(concatenateByteArrays(hash1, passBytes, salt));
        byte[] hash3 = md.digest(concatenateByteArrays(hash2, passBytes, salt));
        
        byte[] key = Arrays.copyOfRange(concatenateByteArrays(hash1, hash2), 0, 32);
        byte[] iv = Arrays.copyOfRange(concatenateByteArrays(hash2, hash3), 16, 32);
        
        return new byte[][]{key, iv};
    }
    
    private byte[][] deriveKeyAndIV(byte[] password, byte[] salt) throws Exception {
        MessageDigest md = MessageDigest.getInstance("MD5");
        byte[] passAndSalt = concatenateByteArrays(password, salt);
        
        byte[] hash1 = md.digest(passAndSalt);
        byte[] hash2 = md.digest(concatenateByteArrays(hash1, passAndSalt));
        byte[] hash3 = md.digest(concatenateByteArrays(hash2, passAndSalt));
        
        byte[] key = Arrays.copyOfRange(concatenateByteArrays(hash1, hash2), 0, 32);
        byte[] iv = Arrays.copyOfRange(hash3, 0, 16);
        
        return new byte[][]{key, iv};
    }
    
    private byte[] concatenateByteArrays(byte[] a, byte[] b) {
        byte[] result = new byte[a.length + b.length];
        System.arraycopy(a, 0, result, 0, a.length);
        System.arraycopy(b, 0, result, a.length, b.length);
        return result;
    }
    
    private byte[] concatenateByteArrays(byte[] a, byte[] b, byte[] c) {
        byte[] result = new byte[a.length + b.length + c.length];
        System.arraycopy(a, 0, result, 0, a.length);
        System.arraycopy(b, 0, result, a.length, b.length);
        System.arraycopy(c, 0, result, a.length + b.length, c.length);
        return result;
    }
}