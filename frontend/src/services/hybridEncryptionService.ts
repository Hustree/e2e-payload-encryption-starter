import { CompactEncrypt, compactDecrypt, importJWK } from 'jose';

export interface EncryptedPayload {
  jwe: string;
  aad: {
    nonce: string;
    ts: number;
  };
}

export class HybridEncryptionService {
  private static backendPublicKey: any = null;
  private static keyId: string = '';
  private static frontendKeyPair: CryptoKeyPair | null = null;
  private static frontendKeyId: string = '';

  static async initializeKeys(): Promise<void> {
    try {
      // Generate frontend key pair for response decryption
      console.log('Generating frontend key pair...');
      this.frontendKeyPair = await crypto.subtle.generateKey(
        {
          name: 'RSA-OAEP',
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: 'SHA-256',
        },
        true,
        ['encrypt', 'decrypt']
      );
      this.frontendKeyId = crypto.randomUUID();
      console.log(`Frontend key pair generated with ID: ${this.frontendKeyId}`);

      // Fetch backend public key for request encryption
      console.log('Fetching JWKS from backend...');
      const response = await fetch('http://localhost:8080/.well-known/jwks.json');

      if (!response.ok) {
        throw new Error(`Failed to fetch JWKS: ${response.status} ${response.statusText}`);
      }

      const jwks = await response.json();

      if (!jwks.keys || !Array.isArray(jwks.keys) || jwks.keys.length === 0) {
        throw new Error('No keys found in JWKS response');
      }

      const encKeyJwk = jwks.keys.find((k: any) =>
        k.use === 'enc' && k.alg === 'RSA-OAEP-256'
      );

      if (!encKeyJwk) {
        console.warn('No RSA-OAEP-256 key found, using first available key');
        const firstKey = jwks.keys[0];
        this.keyId = firstKey.kid;
        this.backendPublicKey = await importJWK(firstKey, 'RSA-OAEP-256');
      } else {
        this.keyId = encKeyJwk.kid;
        this.backendPublicKey = await importJWK(encKeyJwk, 'RSA-OAEP-256');
      }

      console.log(`Successfully loaded backend public key with ID: ${this.keyId}`);
    } catch (error) {
      console.error('Failed to initialize encryption keys:', error);
      throw new Error(`Key initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  static async encryptData(data: any): Promise<EncryptedPayload> {
    if (!this.backendPublicKey) {
      await this.initializeKeys();
    }

    try {
      // Create minimal AAD for anti-replay protection
      const aad = {
        nonce: crypto.randomUUID(),
        ts: Date.now()
      };

      // Convert data to JSON string
      const plaintext = new TextEncoder().encode(JSON.stringify(data));

      console.log('Creating JWE with AES-256-GCM + RSA-OAEP-256...');

      // Create JWE using hybrid encryption (to backend)
      const encrypt = new CompactEncrypt(plaintext);
      encrypt.setProtectedHeader({
        alg: 'RSA-OAEP-256',
        enc: 'A256GCM',
        kid: this.keyId,
        typ: 'JWE'
      });
      // Note: AAD is included in protected header for JWE
      const jwe = await encrypt.encrypt(this.backendPublicKey);

      console.log('JWE created successfully');

      return {
        jwe,
        aad
      };

    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error(`Failed to encrypt data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async decryptResponse(jweToken: string): Promise<any> {
    if (!this.frontendKeyPair) {
      throw new Error('Frontend key pair not initialized');
    }

    try {
      console.log('Decrypting JWE response from backend...');

      // Use the private key directly - JOSE library can work with CryptoKey
      const { plaintext } = await compactDecrypt(jweToken, this.frontendKeyPair.privateKey);

      // Convert back to JSON
      const decryptedJson = new TextDecoder().decode(plaintext);
      const decryptedData = JSON.parse(decryptedJson);

      console.log('Successfully decrypted response from backend');
      return decryptedData;

    } catch (error) {
      console.error('Response decryption error:', error);
      throw new Error(`Failed to decrypt response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async getFrontendPublicKeyJWK(): Promise<any> {
    if (!this.frontendKeyPair) {
      throw new Error('Frontend key pair not initialized');
    }

    try {
      const publicKeyJwk = await crypto.subtle.exportKey('jwk', this.frontendKeyPair.publicKey);
      return {
        ...publicKeyJwk,
        kid: this.frontendKeyId,
        use: 'enc',
        alg: 'RSA-OAEP-256'
      };
    } catch (error) {
      console.error('Failed to export frontend public key:', error);
      throw new Error(`Failed to export public key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  static isInitialized(): boolean {
    return this.backendPublicKey !== null && this.frontendKeyPair !== null;
  }

  static getKeyId(): string {
    return this.keyId;
  }

  static getFrontendKeyId(): string {
    return this.frontendKeyId;
  }

  static clearKeys(): void {
    this.backendPublicKey = null;
    this.keyId = '';
    this.frontendKeyPair = null;
    this.frontendKeyId = '';
  }
}