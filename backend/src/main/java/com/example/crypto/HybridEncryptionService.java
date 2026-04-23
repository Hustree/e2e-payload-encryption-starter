package com.example.crypto;

import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.RSADecrypter;
import com.nimbusds.jose.crypto.RSAEncrypter;
import com.nimbusds.jose.jwk.RSAKey;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.security.interfaces.RSAPublicKey;

@ApplicationScoped
public class HybridEncryptionService {

    private static final Logger LOG = Logger.getLogger(HybridEncryptionService.class);

    @Inject
    RSAKeyManager keyManager;
    
    public String decryptJWE(String jweToken) throws Exception {
        LOG.infof("Attempting to decrypt JWE token");
        
        try {
            JWEObject jweObject = JWEObject.parse(jweToken);
            
            RSADecrypter decrypter = new RSADecrypter(keyManager.getPrivateKey());
            jweObject.decrypt(decrypter);
            
            String payload = jweObject.getPayload().toString();
            LOG.infof("Successfully decrypted JWE payload");
            
            return payload;
            
        } catch (Exception e) {
            LOG.error("Failed to decrypt JWE", e);
            throw new RuntimeException("Failed to decrypt JWE: " + e.getMessage(), e);
        }
    }
    
    public String decryptJWEWithValidation(String jweToken, Map<String, Object> aad) throws Exception {
        LOG.infof("Attempting to decrypt JWE with AAD validation");

        try {
            String payload = decryptJWE(jweToken);

            // AAD = Additional Authenticated Data
            if (aad != null && aad.containsKey("ts")) {
                long timestamp = ((Number) aad.get("ts")).longValue();
                long currentTime = Instant.now().toEpochMilli();
                long maxSkew = 60000; // 60 seconds

                if (Math.abs(currentTime - timestamp) > maxSkew) {
                    throw new RuntimeException("Timestamp validation failed - request too old or future");
                }
            }

            LOG.infof("JWE decryption and validation successful");
            return payload;

        } catch (Exception e) {
            LOG.error("Failed to decrypt and validate JWE", e);
            throw new RuntimeException("Failed to decrypt and validate JWE: " + e.getMessage(), e);
        }
    }

    public String encryptJWE(String jsonPayload) throws Exception {
        LOG.infof("Attempting to encrypt JSON payload as JWE");

        try {
            // Create JWE header
            JWEHeader header = new JWEHeader.Builder(JWEAlgorithm.RSA_OAEP_256, EncryptionMethod.A256GCM)
                    .keyID(keyManager.getKeyId())
                    .build();

            // Create JWE object
            JWEObject jweObject = new JWEObject(header, new Payload(jsonPayload));

            // Create RSA encrypter
            RSAEncrypter encrypter = new RSAEncrypter(keyManager.getPublicKey());

            // Encrypt
            jweObject.encrypt(encrypter);

            String jweString = jweObject.serialize();
            LOG.infof("Successfully encrypted payload as JWE");

            return jweString;

        } catch (Exception e) {
            LOG.error("Failed to encrypt JWE", e);
            throw new RuntimeException("Failed to encrypt JWE: " + e.getMessage(), e);
        }
    }

    public String encryptJWEForFrontend(String jsonPayload, Map<String, Object> frontendPublicKeyJwk) throws Exception {
        LOG.infof("Attempting to encrypt JSON payload as JWE for frontend");

        try {
            // Parse frontend public key from JWK
            RSAKey frontendRSAKey = RSAKey.parse(frontendPublicKeyJwk);
            RSAPublicKey frontendPublicKey = frontendRSAKey.toRSAPublicKey();

            // Create JWE header
            JWEHeader header = new JWEHeader.Builder(JWEAlgorithm.RSA_OAEP_256, EncryptionMethod.A256GCM)
                    .keyID((String) frontendPublicKeyJwk.get("kid"))
                    .build();

            // Create JWE object
            JWEObject jweObject = new JWEObject(header, new Payload(jsonPayload));

            // Create RSA encrypter using frontend's public key
            RSAEncrypter encrypter = new RSAEncrypter(frontendPublicKey);

            // Encrypt
            jweObject.encrypt(encrypter);

            String jweString = jweObject.serialize();
            LOG.infof("Successfully encrypted payload as JWE for frontend");

            return jweString;

        } catch (Exception e) {
            LOG.error("Failed to encrypt JWE for frontend", e);
            throw new RuntimeException("Failed to encrypt JWE for frontend: " + e.getMessage(), e);
        }
    }
}