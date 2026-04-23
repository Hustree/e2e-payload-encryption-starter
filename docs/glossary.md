# 🔐 **Encryption Jargon Dictionary**
## **Complete Guide to Technical Terms in This POC**

---

## **Core Encryption Concepts**

### **RSA**
**RSA** stands for **Rivest–Shamir–Adleman**, the names of its inventors.

- **What it is**: An asymmetric encryption algorithm
- **How it works**: You have a public key (to lock/encrypt data) and a private key (to unlock/decrypt data)
- **In fintech**: RSA is often used to wrap symmetric keys (like AES keys), because RSA itself is too slow for bulk data
- **Key size**: 2048-bit (in our POC) - very secure but computationally expensive
- **Real-world analogy**: Like a mailbox - anyone can drop mail in (public key), but only you can take it out (private key)

### **AES**
**AES** means **Advanced Encryption Standard**.

- **What it is**: A symmetric encryption algorithm
- **How it works**: The same key encrypts and decrypts
- **Performance**: Very fast and secure, ideal for encrypting the actual JSON data
- **Key sizes**: 128, 192, or 256 bits (we use 256-bit for maximum security)
- **Real-world analogy**: Like a house key - the same key opens and closes the door

### **AES-256-GCM**
**AES** with a **256-bit key** (very strong) in **GCM mode**.

- **AES-256**: 256-bit key size (extremely secure)
- **GCM** = **Galois/Counter Mode**: A mode of AES that gives both encryption and integrity checks in one shot
- **Benefits**: Fast, secure, and protects against tampering
- **Why preferred in fintech**: It's fast and protects against tampering
- **Authentication**: Built-in integrity verification (if data is modified, decryption fails)

### **RSA-OAEP-256**
**RSA** with **Optimal Asymmetric Encryption Padding (OAEP)**.

- **OAEP**: Adds randomness and structure to RSA, making it more secure than older padding schemes
- **The "256"**: Refers to using SHA-256 hashing as part of the padding
- **Why padding matters**: Without it, the same message always encrypts to the same output (bad for security!)
- **Security**: Prevents various cryptographic attacks on RSA

---

## **Hybrid Encryption & Envelope Pattern**

### **Hybrid Encryption**
Combines **symmetric (AES)** and **asymmetric (RSA)** encryption.

- **The problem**: RSA is slow for large data, AES is fast but sharing the key is risky
- **The solution**: Use AES for data, RSA for the AES key
- **Result**: Fast + secure = best of both worlds
- **Real-world analogy**: Put your document in a locked briefcase (AES), put the briefcase key in a small safe (RSA)

### **Envelope Encryption**
A design pattern for hybrid encryption:

1. **Encrypt data** with a data key (AES)
2. **Encrypt the data key** with a master key (RSA)
3. **Send both** together

- **Used by**: Cloud KMS services (AWS KMS, Azure Key Vault)
- **Benefits**: Single expensive RSA operation per payload (~200µs target)
- **In our POC**: This is exactly what we implement

---

## **JOSE & JWE Standards**

### **JOSE**
**JOSE** = **JavaScript Object Signing and Encryption** (IETF standard family).

- **What it is**: A set of specs for handling JSON data securely
- **Includes**: JWE (JSON Web Encryption) for encryption and JWS (JSON Web Signature) for signing
- **Libraries**: `jose` (JavaScript) and `nimbus-jose-jwt` (Java) implement these standards
- **Why use it**: Industry standard, well-tested, secure

### **JWE**
**JWE** = **JSON Web Encryption**.

- **What it is**: A standard way to package encrypted data in JSON format
- **Output**: A compact string (five parts separated by dots)
- **Structure**: `Header.EncryptedKey.IV.Ciphertext.AuthTag`
- **Usage**: Widely used in fintech APIs for secure data transport
- **Example**: `eyJhbGc...U2FsdGVk...aGVsbG8...d29ybGQ...cGxlYXNl...`

### **JWE Components**
1. **Header**: Algorithm metadata (RSA-OAEP-256, A256GCM, kid)
2. **Encrypted Key**: The AES key locked with RSA
3. **IV** (Initialization Vector): Random data to make encryption unique
4. **Ciphertext**: Your actual encrypted loan data
5. **Auth Tag**: The tamper-proof seal

---

## **Key Management & Distribution**

### **JWKS**
**JWKS** = **JSON Web Key Set**.

- **What it is**: A standard endpoint (`/.well-known/jwks.json`) that publishes public keys
- **Purpose**: Frontends fetch this to know which key to use when encrypting
- **Format**: JSON containing public key information
- **Caching**: Usually cached for 24 hours
- **In our POC**: Backend serves RSA public key via JWKS endpoint

### **Key ID (kid)**
**Key ID** = **Key Identifier**.

- **What it is**: A unique identifier for each encryption key
- **Purpose**: Allows key rotation and multiple keys
- **In our POC**: `"2de32220-95a6-476f-8a35-749ba008185f"`
- **Usage**: Frontend includes kid in JWE header, backend uses it to select correct key

### **Key Rotation**
**Key Rotation** = **Periodically changing encryption keys**.

- **Why**: Limits damage if a key is compromised
- **How**: Generate new keys, update JWKS endpoint, phase out old keys
- **In our POC**: Fixed key for demo, but production would rotate keys

---

## **Security Features**

### **AAD (Additional Authenticated Data)**
**AAD** = **Additional Authenticated Data**.

- **What it is**: Extra metadata included in AES-GCM encryption
- **Properties**: Not encrypted, but integrity-protected
- **Examples**: nonce, timestamp, HTTP path
- **Purpose**: Prevents replay attacks or out-of-context use
- **In our POC**: `{ nonce: crypto.randomUUID(), ts: Date.now() }`

### **Nonce**
**Nonce** = **"Number used once"**.

- **What it is**: A unique random value for each encryption
- **Purpose**: Prevents attackers from reusing old encrypted messages
- **Generation**: `crypto.randomUUID()` in our POC
- **Security**: Ensures each encryption is unique, even with same data

### **Replay Protection**
**Replay Protection** = **Prevents replay attacks**.

- **What it is**: Prevents an attacker from taking an old valid message and resending it
- **How achieved**: Timestamps + nonces inside AAD
- **In our POC**: 60-second timestamp validation
- **Example**: If request is older than 60 seconds, it's rejected

### **Timestamp Validation**
**Timestamp Validation** = **Time-based request validation**.

- **What it is**: Checks that requests are recent (not old or future)
- **Tolerance**: Usually 60 seconds (configurable)
- **Purpose**: Prevents replay attacks and clock skew attacks
- **In our POC**: `Math.abs(currentTime - timestamp) > 60000`

---

## **Performance & Optimization Terms**

### **Envelope Pattern**
**Envelope Pattern** = **The core of hybrid encryption**.

- **What it is**: Encrypt data with fast symmetric key, encrypt that key with slow asymmetric key
- **Performance**: Single expensive RSA operation per payload
- **Target**: ~200µs encryption latency (fintech requirement)
- **Why efficient**: Only small AES key needs RSA encryption, not the entire payload

### **Compact Serialization**
**Compact Serialization** = **JWE in string format**.

- **What it is**: JWE as a single string with dots separating parts
- **Alternative**: JSON serialization (larger)
- **Benefits**: Smaller payload size, faster transmission
- **Format**: `header.encryptedKey.iv.ciphertext.authTag`

### **Key Caching**
**Key Caching** = **Storing keys in memory**.

- **What it is**: Frontend caches public key to avoid repeated JWKS requests
- **Benefits**: Reduces network calls, improves performance
- **In our POC**: `HybridEncryptionService` caches public key

---

## **Framework & Library Terms**

### **Quarkus**
**Quarkus** = **Java framework used in our backend**.

- **What it is**: Supersonic Subatomic Java framework
- **Benefits**: Fast startup, low memory usage, cloud-native
- **Startup time**: ~1 second (vs traditional Java ~10+ seconds)
- **In our POC**: Powers the backend encryption service

### **Nimbus JOSE JWT**
**Nimbus JOSE JWT** = **Java library for JOSE/JWT**.

- **What it is**: Production-grade JOSE/JWT library for Java
- **Version**: 9.41.2 in our POC
- **Features**: JWE creation/parsing, RSA operations, JWKS support
- **Why chosen**: Industry standard, well-tested, secure

### **JOSE Library (JavaScript)**
**JOSE Library** = **JavaScript library for JOSE**.

- **What it is**: Modern IETF JWE/JWS library for JavaScript
- **Version**: 5.9.6 in our POC
- **Features**: CompactEncrypt, importJWK, WebCrypto API integration
- **Why chosen**: TypeScript native, modern, standards-compliant

---

## **API & Protocol Terms**

### **CORS**
**CORS** = **Cross-Origin Resource Sharing**.

- **What it is**: HTTP mechanism for cross-origin requests
- **Problem**: Browsers block requests between different domains
- **Solution**: Server sends CORS headers to allow specific origins
- **In our POC**: Backend allows `http://localhost:3000`

### **JWKS Endpoint**
**JWKS Endpoint** = **The URL that serves public keys**.

- **Standard path**: `/.well-known/jwks.json`
- **Purpose**: Discoverable public key distribution
- **Caching**: Usually cached for 24 hours
- **In our POC**: `http://localhost:8080/.well-known/jwks.json`

### **REST API**
**REST API** = **Representational State Transfer API**.

- **What it is**: Architectural style for web services
- **Methods**: GET, POST, PUT, DELETE
- **In our POC**: `/api/encrypted/loan` endpoint
- **Format**: JSON request/response

---

## **Data Format Terms**

### **JSON**
**JSON** = **JavaScript Object Notation**.

- **What it is**: Lightweight data interchange format
- **Structure**: Key-value pairs, arrays, objects
- **In our POC**: Loan application data, API responses
- **Example**: `{"customerId": "CUST-123", "amount": 50000}`

### **Base64**
**Base64** = **Binary-to-text encoding**.

- **What it is**: Encodes binary data as ASCII text
- **Usage**: Encodes encrypted data for JSON transmission
- **Characters**: A-Z, a-z, 0-9, +, /, =
- **Padding**: Uses = for padding

### **UTF-8**
**UTF-8** = **Unicode character encoding**.

- **What it is**: Variable-width character encoding
- **Usage**: Converts strings to bytes for encryption
- **In our POC**: `new TextEncoder().encode(JSON.stringify(data))`

---

## **Security Standards & Compliance**

### **FIPS 140-2**
**FIPS 140-2** = **Federal Information Processing Standard**.

- **What it is**: US government standard for cryptographic modules
- **Compliance**: Our algorithms (RSA-OAEP-256, AES-256-GCM) are FIPS-compliant
- **Importance**: Required for government and financial systems

### **PCI DSS**
**PCI DSS** = **Payment Card Industry Data Security Standard**.

- **What it is**: Security standards for handling credit card data
- **Relevance**: Our encryption system helps meet PCI requirements
- **Key management**: Proper key handling is PCI requirement

### **RFC 7516**
**RFC 7516** = **Request for Comments 7516**.

- **What it is**: IETF standard for JSON Web Encryption (JWE)
- **Compliance**: Our implementation follows RFC 7516
- **Benefits**: Interoperability, industry acceptance

---

## **Development & Testing Terms**

### **POC**
**POC** = **Proof of Concept**.

- **What it is**: A demonstration of feasibility
- **Purpose**: Validate technical approach before full implementation
- **In our case**: Demonstrate envelope encryption for financial data

### **MVP**
**MVP** = **Minimum Viable Product**.

- **What it is**: Basic version with core features
- **Goal**: Get to market quickly with essential functionality
- **Our POC**: Could be extended to full MVP

### **TypeScript**
**TypeScript** = **Typed superset of JavaScript**.

- **What it is**: JavaScript with static type checking
- **Benefits**: Catch errors at compile time, better IDE support
- **In our POC**: Frontend is written in TypeScript

---

## **Performance Metrics**

### **Latency**
**Latency** = **Time delay in operations**.

- **Target**: ~200µs encryption latency (fintech requirement)
- **Achieved**: ~180µs in our POC
- **Measurement**: Time from encryption start to completion

### **Throughput**
**Throughput** = **Operations per second**.

- **AES-256-GCM**: Very high throughput (thousands of ops/sec)
- **RSA-2048**: Lower throughput (hundreds of ops/sec)
- **Hybrid**: Best of both worlds

### **Payload Overhead**
**Payload Overhead** = **Extra data added by encryption**.

- **Target**: <30% overhead
- **Achieved**: ~25% in our POC
- **Components**: JWE header, encrypted key, IV, auth tag

---

## **Error Handling Terms**

### **Exception Safety**
**Exception Safety** = **Secure error handling**.

- **What it is**: Handling errors without leaking sensitive information
- **In our POC**: Generic error messages, no key exposure
- **Best practice**: Log details server-side, return generic errors to client

### **Graceful Degradation**
**Graceful Degradation** = **System continues working with reduced functionality**.

- **Example**: If JWKS fails, show error instead of crashing
- **In our POC**: Frontend shows "Backend not available" message

---

## **Summary**

This POC uses **industry-standard encryption** with **modern web technologies** to create a **secure, performant system** for **financial data transmission**. The jargon represents **best practices** in **cybersecurity**, **web development**, and **fintech applications**.

**Key takeaway**: Each term represents a specific security or performance requirement that, when combined, creates a robust encryption system suitable for production financial applications.

---

*Remember: Understanding these terms is crucial for implementing, maintaining, and extending secure encryption systems in production environments.*


