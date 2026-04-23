package com.example.resource;

import com.example.crypto.RSAKeyManager;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.jboss.logging.Logger;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Path("/.well-known")
@Produces(MediaType.APPLICATION_JSON)
public class JWKSResource {
    
    private static final Logger LOG = Logger.getLogger(JWKSResource.class);
    
    @Inject
    RSAKeyManager keyManager;
    
    @GET
    @Path("/jwks.json")
    public Response getJWKS() {
        try {
            Map<String, Object> jwks = new HashMap<>();
            jwks.put("keys", List.of(keyManager.getPublicJWK()));
            
            LOG.infof("Serving JWKS endpoint with key ID: %s", keyManager.getKeyId());
            
            return Response.ok(jwks)
                    .header("Cache-Control", "public, max-age=86400") // Cache for 24 hours
                    .build();
                    
        } catch (Exception e) {
            LOG.error("Failed to serve JWKS", e);
            
            Map<String, String> error = new HashMap<>();
            error.put("error", "Failed to generate JWKS");
            error.put("message", e.getMessage());
            
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity(error)
                    .build();
        }
    }
    
    @OPTIONS
    @Path("/jwks.json")
    public Response optionsJWKS() {
        return Response.ok().build();
    }
}