package com.example.resource;

import com.example.crypto.AESCryptoService;
import com.example.crypto.HybridEncryptionService;
import com.example.model.EncryptedPayload;
import com.example.model.LoanApplication;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.jboss.logging.Logger;
import com.fasterxml.jackson.core.type.TypeReference;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Path("/api/encrypted")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class EncryptedLoanResource {
    
    private static final Logger LOG = Logger.getLogger(EncryptedLoanResource.class);
    
    @Inject
    AESCryptoService cryptoService;
    
    @Inject
    HybridEncryptionService hybridService;
    
    @Inject
    ObjectMapper objectMapper;
    
    @POST
    @Path("/loan")
    public Response submitEncryptedLoan(EncryptedPayload payload, @Context HttpHeaders headers) {
        if (payload.getJwe() != null) {
            return submitJWELoan(payload, headers);
        }
        return submitLegacyEncryptedLoan(payload, headers);
    }
    
    private Response submitJWELoan(EncryptedPayload payload, HttpHeaders headers) {
        LOG.infof("Received JWE encrypted payload");
        
        try {
            String decryptedJson = hybridService.decryptJWEWithValidation(
                payload.getJwe(), 
                payload.getAdditionalAuthenticatedData()
            );
            LOG.infof("Successfully decrypted JWE payload");
            
            LoanApplication application = objectMapper.readValue(decryptedJson, LoanApplication.class);
            
            if (application.getApplicationId() == null) {
                application.setApplicationId("LOAN-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
            }
            
            if (application.getTimestamp() == null) {
                application.setTimestamp(Instant.now());
            }
            
            if (application.getStatus() == null) {
                application.setStatus("RECEIVED");
            }
            
            validateLoanApplication(application);
            
            LOG.infof("Processing loan application: %s for customer: %s (Amount: %.2f)", 
                     application.getApplicationId(), 
                     application.getCustomerId(),
                     application.getAmount());
            
            Map<String, Object> response = new HashMap<>();
            response.put("status", "SUCCESS");
            response.put("message", "JWE encrypted loan application received and processed");
            response.put("applicationId", application.getApplicationId());
            response.put("processedData", application);
            response.put("encryptionMethod", "JWE (AES-256-GCM + RSA-OAEP-256)");
            response.put("responseEncrypted", true);

            // Get frontend public key from header
            String frontendKeyHeader = headers.getHeaderString("X-Frontend-Public-Key");
            String encryptedResponse;

            if (frontendKeyHeader != null) {
                // Use frontend public key for response encryption
                Map<String, Object> frontendPublicKey = objectMapper.readValue(frontendKeyHeader,
                    new TypeReference<Map<String, Object>>() {});
                String responseJson = objectMapper.writeValueAsString(response);
                encryptedResponse = hybridService.encryptJWEForFrontend(responseJson, frontendPublicKey);
            } else {
                // Fallback to backend key encryption
                String responseJson = objectMapper.writeValueAsString(response);
                encryptedResponse = hybridService.encryptJWE(responseJson);
            }

            Map<String, Object> encryptedPayload = new HashMap<>();
            encryptedPayload.put("jwe", encryptedResponse);
            encryptedPayload.put("encrypted", true);

            return Response.ok(encryptedPayload)
                    .status(Response.Status.CREATED)
                    .build();
            
        } catch (Exception e) {
            LOG.error("Failed to process JWE encrypted payload", e);

            try {
                Map<String, String> errorResponse = new HashMap<>();
                errorResponse.put("status", "ERROR");
                errorResponse.put("message", "Failed to decrypt or process JWE loan application: " + e.getMessage());
                errorResponse.put("responseEncrypted", "true");

                // Encrypt the error response using frontend key if available
                String frontendKeyHeader = headers.getHeaderString("X-Frontend-Public-Key");
                String errorJson = objectMapper.writeValueAsString(errorResponse);
                String encryptedError;

                if (frontendKeyHeader != null) {
                    Map<String, Object> frontendPublicKey = objectMapper.readValue(frontendKeyHeader,
                        new TypeReference<Map<String, Object>>() {});
                    encryptedError = hybridService.encryptJWEForFrontend(errorJson, frontendPublicKey);
                } else {
                    encryptedError = hybridService.encryptJWE(errorJson);
                }

                Map<String, Object> encryptedPayload = new HashMap<>();
                encryptedPayload.put("jwe", encryptedError);
                encryptedPayload.put("encrypted", true);

                return Response.status(Response.Status.BAD_REQUEST)
                        .entity(encryptedPayload)
                        .build();
            } catch (Exception encryptionException) {
                // Fallback to unencrypted error if encryption fails
                LOG.error("Failed to encrypt error response", encryptionException);
                Map<String, String> fallbackError = new HashMap<>();
                fallbackError.put("status", "ERROR");
                fallbackError.put("message", "Critical encryption failure");
                return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                        .entity(fallbackError)
                        .build();
            }
        }
    }
    
    private Response submitLegacyEncryptedLoan(EncryptedPayload payload, HttpHeaders headers) {
        LOG.infof("Received legacy encrypted payload: %s", payload.getEncryptedData());
        
        try {
            String decryptedJson = cryptoService.decryptCryptoJS(payload.getEncryptedData());
            LOG.infof("Successfully decrypted legacy payload: %s", decryptedJson);
            
            LoanApplication application = objectMapper.readValue(decryptedJson, LoanApplication.class);
            
            if (application.getApplicationId() == null) {
                application.setApplicationId("LOAN-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
            }
            
            if (application.getTimestamp() == null) {
                application.setTimestamp(Instant.now());
            }
            
            if (application.getStatus() == null) {
                application.setStatus("RECEIVED");
            }
            
            validateLoanApplication(application);
            
            LOG.infof("Processing loan application: %s for customer: %s (Amount: %.2f)", 
                     application.getApplicationId(), 
                     application.getCustomerId(),
                     application.getAmount());
            
            Map<String, Object> response = new HashMap<>();
            response.put("status", "SUCCESS");
            response.put("message", "Legacy encrypted loan application received and processed");
            response.put("applicationId", application.getApplicationId());
            response.put("processedData", application);
            response.put("encryptionMethod", "Legacy AES-256-CBC");
            response.put("responseEncrypted", true);

            // Get frontend public key from header
            String frontendKeyHeader = headers.getHeaderString("X-Frontend-Public-Key");
            String encryptedResponse;

            if (frontendKeyHeader != null) {
                // Use frontend public key for response encryption
                Map<String, Object> frontendPublicKey = objectMapper.readValue(frontendKeyHeader,
                    new TypeReference<Map<String, Object>>() {});
                String responseJson = objectMapper.writeValueAsString(response);
                encryptedResponse = hybridService.encryptJWEForFrontend(responseJson, frontendPublicKey);
            } else {
                // Fallback to backend key encryption
                String responseJson = objectMapper.writeValueAsString(response);
                encryptedResponse = hybridService.encryptJWE(responseJson);
            }

            Map<String, Object> encryptedPayload = new HashMap<>();
            encryptedPayload.put("jwe", encryptedResponse);
            encryptedPayload.put("encrypted", true);

            return Response.ok(encryptedPayload)
                    .status(Response.Status.CREATED)
                    .build();
            
        } catch (Exception e) {
            LOG.error("Failed to process legacy encrypted payload", e);

            try {
                Map<String, String> errorResponse = new HashMap<>();
                errorResponse.put("status", "ERROR");
                errorResponse.put("message", "Failed to decrypt or process legacy loan application: " + e.getMessage());
                errorResponse.put("responseEncrypted", "true");

                // Encrypt the error response using frontend key if available
                String frontendKeyHeader = headers.getHeaderString("X-Frontend-Public-Key");
                String errorJson = objectMapper.writeValueAsString(errorResponse);
                String encryptedError;

                if (frontendKeyHeader != null) {
                    Map<String, Object> frontendPublicKey = objectMapper.readValue(frontendKeyHeader,
                        new TypeReference<Map<String, Object>>() {});
                    encryptedError = hybridService.encryptJWEForFrontend(errorJson, frontendPublicKey);
                } else {
                    encryptedError = hybridService.encryptJWE(errorJson);
                }

                Map<String, Object> encryptedPayload = new HashMap<>();
                encryptedPayload.put("jwe", encryptedError);
                encryptedPayload.put("encrypted", true);

                return Response.status(Response.Status.BAD_REQUEST)
                        .entity(encryptedPayload)
                        .build();
            } catch (Exception encryptionException) {
                // Fallback to unencrypted error if encryption fails
                LOG.error("Failed to encrypt error response", encryptionException);
                Map<String, String> fallbackError = new HashMap<>();
                fallbackError.put("status", "ERROR");
                fallbackError.put("message", "Critical encryption failure");
                return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                        .entity(fallbackError)
                        .build();
            }
        }
    }
    
    @POST
    @Path("/test-decrypt")
    public Response testDecryption(EncryptedPayload payload) {
        try {
            String decrypted = cryptoService.decryptCryptoJS(payload.getEncryptedData());
            
            Map<String, Object> response = new HashMap<>();
            response.put("status", "SUCCESS");
            response.put("encryptedData", payload.getEncryptedData());
            response.put("decryptedData", decrypted);
            
            return Response.ok(response)
                    .build();
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("status", "ERROR");
            error.put("message", e.getMessage());
            
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(error)
                    .build();
        }
    }
    
    @GET
    @Path("/health")
    public Response health() {
        Map<String, String> health = new HashMap<>();
        health.put("status", "UP");
        health.put("service", "Encrypted Loan Processing");
        health.put("timestamp", Instant.now().toString());
        
        return Response.ok(health)
                .build();
    }
    
    @OPTIONS
    @Path("{path:.*}")
    public Response options() {
        return Response.ok()
                .build();
    }
    
    private void validateLoanApplication(LoanApplication application) {
        if (application.getCustomerId() == null || application.getCustomerId().isEmpty()) {
            throw new BadRequestException("Customer ID is required");
        }
        
        if (application.getAmount() == null || application.getAmount() <= 0) {
            throw new BadRequestException("Loan amount must be greater than 0");
        }
        
        if (application.getAmount() > 50000000) {
            throw new BadRequestException("Loan amount exceeds maximum limit of 50,000,000");
        }
    }
}