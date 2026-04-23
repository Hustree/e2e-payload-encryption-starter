package com.example.crypto;

import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.annotation.PostConstruct;
import org.jboss.logging.Logger;

import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.util.Map;

@ApplicationScoped
public class RSAKeyManager {
    
    private static final Logger LOG = Logger.getLogger(RSAKeyManager.class);
    
    private RSAKey rsaKey;
    private RSAPublicKey publicKey;
    private RSAPrivateKey privateKey;
    private String keyId;
    
    @PostConstruct
    public void init() {
        try {
            generateKeyPair();
            LOG.info("RSA key pair generated successfully");
        } catch (Exception e) {
            LOG.error("Failed to generate RSA key pair", e);
            throw new RuntimeException("Failed to initialize RSA keys", e);
        }
    }
    
    private void generateKeyPair() throws Exception {
        // Use fixed key ID temp - prod lvl would use UUID.randomUUID().toString() -- Joshua Bascos
        keyId = "2de32220-95a6-476f-8a35-749ba008185f"; // kid: FE and BE agree on which key is in use
        
        rsaKey = new RSAKeyGenerator(2048) // JB: 2048-bit RSA key pair
                .keyID(keyId)
                .keyUse(com.nimbusds.jose.jwk.KeyUse.ENCRYPTION)
                .algorithm(com.nimbusds.jose.Algorithm.parse("RSA-OAEP-256"))
                .generate();
        
        publicKey = rsaKey.toRSAPublicKey(); // clients can encrypt requests
        privateKey = rsaKey.toRSAPrivateKey(); // stays on the backend only and is used to decrypt the request.
    }
    
    public RSAPublicKey getPublicKey() {
        return publicKey;
    }
    
    public RSAPrivateKey getPrivateKey() {
        return privateKey;
    }
    
    public String getKeyId() {
        return keyId;
    }
    
    public Map<String, Object> getPublicJWK() {
        return rsaKey.toPublicJWK().toJSONObject();
    }
    
    public RSAKey getRSAKey() {
        return rsaKey;
    }
}