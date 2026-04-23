// Legacy encryption service kept for backward compatibility
// Note: crypto-js has been removed from dependencies

export class EncryptionService {
  private static readonly SECRET_KEY = process.env.REACT_APP_ENCRYPTION_KEY || 'my-super-secret-aes-256-key-32ch';
  
  static encryptData(data: any): string {
    throw new Error('Legacy encryption is no longer supported. Please use HybridEncryptionService.');
  }
  
  static decryptData(encryptedData: string): any {
    throw new Error('Legacy decryption is no longer supported. Please use HybridEncryptionService.');
  }
  
  static generateKey(): string {
    throw new Error('Legacy key generation is no longer supported. Keys are now managed via JWKS.');
  }
}