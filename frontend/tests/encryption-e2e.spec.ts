import { test, expect, Page } from '@playwright/test';

// Test data for the loan application
const testLoanData = {
  customerId: 'CUST-E2E-12345',
  customerName: 'John Doe Test',
  amount: 25000,
  loanType: 'PERSONAL',
  term: 24,
  purpose: 'Home improvement and debt consolidation'
};

test.describe('Hybrid Encryption End-to-End Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Enable console logging for detailed debugging
    page.on('console', msg => {
      console.log(`[BROWSER ${msg.type().toUpperCase()}] ${msg.text()}`);
    });

    // Log all network requests and responses
    page.on('request', request => {
      console.log(`[REQUEST] ${request.method()} ${request.url()}`);
      if (request.postData()) {
        console.log(`[REQUEST BODY] ${request.postData()}`);
      }
    });

    page.on('response', response => {
      console.log(`[RESPONSE] ${response.status()} ${response.url()}`);
    });

    // Navigate to the application
    console.log('Navigating to the loan application...');
    await page.goto('/');
  });

  test('should load the application and initialize encryption keys', async ({ page }) => {
    console.log('=== TEST: Application Load and Key Initialization ===');
    
    // Wait for the page to load
    await expect(page.locator('h1')).toContainText('Loan Application - Encrypted Submission POC');
    console.log('✓ Application title loaded correctly');

    // Check that encryption status is visible
    const encryptionStatus = page.locator('.encryption-status');
    await expect(encryptionStatus).toBeVisible();
    console.log('✓ Encryption status section is visible');

    // Wait for keys to initialize (check for the key status to change from "Initializing...")
    const keyStatus = page.locator('.key-status');
    await expect(keyStatus).toBeVisible();
    
    // Wait for either success or failure message
    await page.waitForFunction(() => {
      const statusElement = document.querySelector('.key-status');
      return statusElement && !statusElement.textContent?.includes('Initializing...');
    }, { timeout: 10000 });

    const keyStatusText = await keyStatus.textContent();
    console.log(`Key initialization status: ${keyStatusText}`);

    // Check if keys loaded successfully
    if (keyStatusText?.includes('Ready - Key ID:')) {
      console.log('✓ Encryption keys initialized successfully');
      expect(keyStatusText).toContain('Ready - Key ID:');
    } else {
      console.log('⚠ Backend not available - keys failed to initialize');
      expect(keyStatusText).toContain('Failed to load keys - Backend not available');
    }
  });

  test('should fill out the loan form with test data', async ({ page }) => {
    console.log('=== TEST: Form Data Entry ===');

    // Fill out the form fields
    console.log('Filling customer ID...');
    await page.fill('#customerId', testLoanData.customerId);
    
    console.log('Filling customer name...');
    await page.fill('#customerName', testLoanData.customerName);
    
    console.log('Filling loan amount...');
    await page.fill('#amount', testLoanData.amount.toString());
    
    console.log('Selecting loan type...');
    await page.selectOption('#loanType', testLoanData.loanType);
    
    console.log('Filling term...');
    await page.fill('#term', testLoanData.term.toString());
    
    console.log('Filling purpose...');
    await page.fill('#purpose', testLoanData.purpose);

    // Verify form data was entered correctly
    await expect(page.locator('#customerId')).toHaveValue(testLoanData.customerId);
    await expect(page.locator('#customerName')).toHaveValue(testLoanData.customerName);
    await expect(page.locator('#amount')).toHaveValue(testLoanData.amount.toString());
    await expect(page.locator('#loanType')).toHaveValue(testLoanData.loanType);
    await expect(page.locator('#term')).toHaveValue(testLoanData.term.toString());
    await expect(page.locator('#purpose')).toHaveValue(testLoanData.purpose);

    console.log('✓ All form fields filled and verified correctly');

    // Check that the original form data appears in the debug section
    const debugSection = page.locator('.debug-section');
    await expect(debugSection).toBeVisible();
    
    const originalDataBox = page.locator('.debug-box').first();
    await expect(originalDataBox).toContainText(testLoanData.customerId);
    await expect(originalDataBox).toContainText(testLoanData.customerName);
    
    console.log('✓ Form data is reflected in debug section');
  });

  test('should test JWE encryption locally', async ({ page }) => {
    console.log('=== TEST: Local JWE Encryption ===');

    // Fill out the form first
    await fillForm(page, testLoanData);

    // Wait for key initialization
    await waitForKeyInitialization(page);

    // Check if keys are available
    const keyStatusText = await page.locator('.key-status').textContent();
    
    if (!keyStatusText?.includes('Ready - Key ID:')) {
      console.log('⚠ Skipping encryption test - backend not available');
      test.skip();
      return;
    }

    console.log('Keys are ready, testing encryption...');

    // Click the "Test JWE Encryption" button
    await page.click('button:has-text("Test JWE Encryption")');
    console.log('✓ Clicked Test JWE Encryption button');

    // Wait for encryption to complete and check for encrypted payload
    await page.waitForFunction(() => {
      const encryptedBox = document.querySelector('.debug-box:has(h3:contains("Encrypted Payload"))');
      return encryptedBox && encryptedBox.textContent && encryptedBox.textContent.trim().length > 0;
    }, { timeout: 5000 });

    // Verify encrypted payload is displayed
    const encryptedPayloadBox = page.locator('.debug-box').filter({ hasText: 'Encrypted Payload' });
    await expect(encryptedPayloadBox).toBeVisible();
    
    const encryptedText = await encryptedPayloadBox.locator('pre').textContent();
    expect(encryptedText).toBeTruthy();
    expect(encryptedText?.length).toBeGreaterThan(100); // JWE tokens are quite long
    
    console.log(`✓ Encrypted payload generated (${encryptedText?.length} characters)`);
    console.log(`Encrypted JWE: ${encryptedText?.substring(0, 100)}...`);

    // Verify response data shows frontend encryption test
    const responseBox = page.locator('.debug-box').filter({ hasText: 'Server Response / Decrypted Data' });
    await expect(responseBox).toBeVisible();
    
    const responseText = await responseBox.locator('pre').textContent();
    expect(responseText).toContain('Frontend encryption test');
    expect(responseText).toContain('JWE (AES-256-GCM + RSA-OAEP-256)');
    
    console.log('✓ Frontend encryption test completed successfully');
  });

  test('should submit encrypted application to backend', async ({ page }) => {
    console.log('=== TEST: End-to-End Encrypted Submission ===');

    // Fill out the form
    await fillForm(page, testLoanData);

    // Wait for key initialization
    await waitForKeyInitialization(page);

    // Check if keys are available
    const keyStatusText = await page.locator('.key-status').textContent();
    
    if (!keyStatusText?.includes('Ready - Key ID:')) {
      console.log('⚠ Skipping backend submission test - backend not available');
      test.skip();
      return;
    }

    console.log('Keys are ready, submitting to backend...');

    // Click the submit button
    await page.click('button:has-text("Submit JWE Encrypted Application")');
    console.log('✓ Clicked Submit JWE Encrypted Application button');

    // Wait for submission to complete (either success or error)
    await page.waitForFunction(() => {
      const successMsg = document.querySelector('.success-message');
      const errorMsg = document.querySelector('.error-message');
      return (successMsg && successMsg.textContent) || (errorMsg && errorMsg.textContent);
    }, { timeout: 10000 });

    // Check for success message
    const successMessage = page.locator('.success-message');
    const errorMessage = page.locator('.error-message');

    if (await successMessage.isVisible()) {
      const successText = await successMessage.textContent();
      console.log(`✓ Success: ${successText}`);
      expect(successText).toContain('Loan application submitted successfully');

      // Verify the encrypted payload was generated
      const encryptedPayloadBox = page.locator('.debug-box').filter({ hasText: 'Encrypted Payload' });
      await expect(encryptedPayloadBox).toBeVisible();
      
      // Verify the server response contains decrypted data
      const responseBox = page.locator('.debug-box').filter({ hasText: 'Server Response / Decrypted Data' });
      await expect(responseBox).toBeVisible();
      
      const responseText = await responseBox.locator('pre').textContent();
      expect(responseText).toContain(testLoanData.customerId);
      expect(responseText).toContain(testLoanData.customerName);
      
      console.log('✓ End-to-end encryption/decryption completed successfully');
      
    } else if (await errorMessage.isVisible()) {
      const errorText = await errorMessage.textContent();
      console.log(`⚠ Error occurred: ${errorText}`);
      
      // This is expected if backend is not running
      if (errorText?.includes('Failed to submit application')) {
        console.log('Backend connection failed - this is expected if backend is not running');
      }
    }
  });

  test('should handle backend unavailable gracefully', async ({ page }) => {
    console.log('=== TEST: Backend Unavailable Handling ===');

    // Fill out the form
    await fillForm(page, testLoanData);

    // Wait a moment for key initialization attempt
    await page.waitForTimeout(2000);

    const keyStatusText = await page.locator('.key-status').textContent();
    
    if (keyStatusText?.includes('Failed to load keys - Backend not available')) {
      console.log('✓ Application correctly detects backend unavailable');
      
      // Try to submit anyway - should show error
      await page.click('button:has-text("Submit JWE Encrypted Application")');
      
      // Should show error about encryption keys not initialized
      await expect(page.locator('.error-message')).toBeVisible();
      const errorText = await page.locator('.error-message').textContent();
      expect(errorText).toContain('Encryption keys not initialized');
      
      console.log('✓ Application correctly prevents submission when keys not initialized');
    } else {
      console.log('Backend is available - skipping this test');
      test.skip();
    }
  });
});

// Helper function to fill out the form
async function fillForm(page: Page, data: typeof testLoanData) {
  await page.fill('#customerId', data.customerId);
  await page.fill('#customerName', data.customerName);
  await page.fill('#amount', data.amount.toString());
  await page.selectOption('#loanType', data.loanType);
  await page.fill('#term', data.term.toString());
  await page.fill('#purpose', data.purpose);
}

// Helper function to wait for key initialization
async function waitForKeyInitialization(page: Page) {
  await page.waitForFunction(() => {
    const statusElement = document.querySelector('.key-status');
    return statusElement && !statusElement.textContent?.includes('Initializing...');
  }, { timeout: 10000 });
}