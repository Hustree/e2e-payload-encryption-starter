import React, { useState, useEffect } from 'react';
import axios from 'axios';
// Legacy encryption service removed
import { HybridEncryptionService } from '../services/hybridEncryptionService';
import './LoanApplicationForm.css';

interface LoanApplication {
  customerId: string;
  customerName: string;
  amount: number;
  loanType: string;
  term: number;
  purpose: string;
}

const LoanApplicationForm: React.FC = () => {
  const [formData, setFormData] = useState<LoanApplication>({
    customerId: '',
    customerName: '',
    amount: 0,
    loanType: 'PERSONAL',
    term: 12,
    purpose: ''
  });
  
  const [encryptedPayload, setEncryptedPayload] = useState<string>('');
  const [decryptedResponse, setDecryptedResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [keyStatus, setKeyStatus] = useState<string>('Initializing...');
  
  useEffect(() => {
    const initKeys = async () => {
      try {
        await HybridEncryptionService.initializeKeys();
        setKeyStatus(`Ready - Key ID: ${HybridEncryptionService.getKeyId()}`);
      } catch (error) {
        setKeyStatus('Failed to load keys - Backend not available');
        setError('Failed to initialize encryption keys. Please ensure the backend is running.');
      }
    };
    
    initKeys();
  }, []);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'amount' || name === 'term' ? Number(value) : value
    }));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    
    try {
      if (!HybridEncryptionService.isInitialized()) {
        setError('Encryption keys not initialized. Please ensure the backend is running.');
        return;
      }

      const encryptedPayload = await HybridEncryptionService.encryptData(formData);
      setEncryptedPayload(encryptedPayload.jwe);

      // Get frontend public key for response encryption
      const frontendPublicKey = await HybridEncryptionService.getFrontendPublicKeyJWK();

      const response = await axios.post('http://localhost:8080/api/encrypted/loan', {
        jwe: encryptedPayload.jwe,
        aad: encryptedPayload.aad
      }, {
        headers: {
          'X-Frontend-Public-Key': JSON.stringify(frontendPublicKey)
        }
      });

      // Check if response is encrypted
      let responseData;
      if (response.data.encrypted && response.data.jwe) {
        console.log('Received encrypted response, decrypting...');
        responseData = await HybridEncryptionService.decryptResponse(response.data.jwe);
      } else {
        responseData = response.data;
      }

      setDecryptedResponse(responseData);
      setSuccess(`Loan application submitted successfully using ${responseData.encryptionMethod || 'Unknown encryption'}!`);
    } catch (err: any) {
      try {
        // Try to decrypt error response if it's encrypted
        if (err.response?.data?.encrypted && err.response?.data?.jwe) {
          const decryptedError = await HybridEncryptionService.decryptResponse(err.response.data.jwe);
          setError(decryptedError.message || 'Failed to submit application');
        } else {
          setError(err.response?.data?.message || 'Failed to submit application');
        }
      } catch (decryptError) {
        setError('Failed to submit application and decrypt error response');
      }
    } finally {
      setLoading(false);
    }
  };
  
  const handleTestEncryption = async () => {
    try {
      if (!HybridEncryptionService.isInitialized()) {
        setError('Encryption keys not initialized. Please ensure the backend is running.');
        return;
      }

      const encryptedPayload = await HybridEncryptionService.encryptData(formData);
      setEncryptedPayload(encryptedPayload.jwe);
      setDecryptedResponse({
        ...formData,
        encryptionMethod: 'JWE (AES-256-GCM + RSA-OAEP-256)',
        aad: encryptedPayload.aad,
        note: 'Frontend encryption test - decryption requires backend'
      });
    } catch (err: any) {
      setError(err.message);
    }
  };
  
  return (
    <div className="form-container">
      <h1>Loan Application - Encrypted Submission POC</h1>
      
      <div className="encryption-status">
        <h3>Hybrid Encryption (JWE: AES-256-GCM + RSA-OAEP-256)</h3>
        <div className="key-status">
          <strong>Status:</strong> {keyStatus}
        </div>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="customerId">Customer ID:</label>
          <input
            type="text"
            id="customerId"
            name="customerId"
            value={formData.customerId}
            onChange={handleInputChange}
            required
            placeholder="CUST-12345"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="customerName">Customer Name:</label>
          <input
            type="text"
            id="customerName"
            name="customerName"
            value={formData.customerName}
            onChange={handleInputChange}
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="amount">Loan Amount:</label>
          <input
            type="number"
            id="amount"
            name="amount"
            value={formData.amount}
            onChange={handleInputChange}
            required
            min="1000"
            max="50000000"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="loanType">Loan Type:</label>
          <select
            id="loanType"
            name="loanType"
            value={formData.loanType}
            onChange={handleInputChange}
            required
          >
            <option value="PERSONAL">Personal Loan</option>
            <option value="HOME">Home Loan</option>
            <option value="AUTO">Auto Loan</option>
            <option value="BUSINESS">Business Loan</option>
          </select>
        </div>
        
        <div className="form-group">
          <label htmlFor="term">Term (months):</label>
          <input
            type="number"
            id="term"
            name="term"
            value={formData.term}
            onChange={handleInputChange}
            required
            min="6"
            max="360"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="purpose">Purpose:</label>
          <textarea
            id="purpose"
            name="purpose"
            value={formData.purpose}
            onChange={handleInputChange}
            required
            rows={3}
          />
        </div>
        
        <div className="button-group">
          <button type="button" onClick={handleTestEncryption} className="btn-secondary">
            Test JWE Encryption
          </button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Submitting...' : 'Submit JWE Encrypted Application'}
          </button>
        </div>
      </form>
      
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
      
      <div className="debug-section">
        <h2>Debug Information</h2>
        
        <div className="debug-box">
          <h3>Original Form Data:</h3>
          <pre>{JSON.stringify(formData, null, 2)}</pre>
        </div>
        
        {encryptedPayload && (
          <div className="debug-box">
            <h3>Encrypted Payload:</h3>
            <pre className="encrypted-text">{encryptedPayload}</pre>
          </div>
        )}
        
        {decryptedResponse && (
          <div className="debug-box">
            <h3>Server Response / Decrypted Data:</h3>
            <pre>{JSON.stringify(decryptedResponse, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoanApplicationForm;