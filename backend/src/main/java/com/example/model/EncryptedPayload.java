package com.example.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Map;

public class EncryptedPayload {
    
    private String encryptedData;
    
    @JsonProperty("jwe")
    private String jwe;
    
    @JsonProperty("aad")
    private Map<String, Object> additionalAuthenticatedData;
    
    public EncryptedPayload() {}
    
    public EncryptedPayload(String encryptedData) {
        this.encryptedData = encryptedData;
    }
    
    public EncryptedPayload(String jwe, Map<String, Object> aad) {
        this.jwe = jwe;
        this.additionalAuthenticatedData = aad;
    }
    
    public String getEncryptedData() {
        return encryptedData;
    }
    
    public void setEncryptedData(String encryptedData) {
        this.encryptedData = encryptedData;
    }
    
    public String getJwe() {
        return jwe;
    }
    
    public void setJwe(String jwe) {
        this.jwe = jwe;
    }
    
    public Map<String, Object> getAdditionalAuthenticatedData() {
        return additionalAuthenticatedData;
    }
    
    public void setAdditionalAuthenticatedData(Map<String, Object> aad) {
        this.additionalAuthenticatedData = aad;
    }
}