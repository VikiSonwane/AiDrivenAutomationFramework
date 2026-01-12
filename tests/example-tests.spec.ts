import { test, expect } from './fixtures/agentic-test';

test.describe('E-commerce Purchase Flow', () => {
  test('User can purchase a product with discount code', async ({ agent }) => {
    const result = await agent.execute(`
      Test Scenario: Complete purchase with discount code
      
      Steps:
      1. Navigate to https://demo.playwright.dev/ecommerce
      2. Login with username "test_user" and password "Test123!"
      3. Search for "Blue T-Shirt" in the search bar
      4. Click on the first product in the search results
      5. Select size "Medium"
      6. Click "Add to Cart" button
      7. Navigate to cart by clicking cart icon
      8. Apply discount code "SAVE20"
      9. Verify that the discount is applied (20% off)
      10. Verify the final total is $40
      11. Click "Proceed to Checkout"
      12. Fill in shipping information with realistic test data
      13. Select payment method "Credit Card"
      14. Complete the purchase
      15. Verify order confirmation message appears
    `);

    // Assert test execution results
    expect(result.success).toBeTruthy();
    expect(result.errors).toHaveLength(0);
  });

  test('User can add multiple items to cart', async ({ agent }) => {
    const result = await agent.execute(`
      Test Scenario: Add multiple products to cart
      
      Steps:
      1. Navigate to the product listing page
      2. Add the first product to cart
      3. Continue shopping
      4. Add the second product to cart
      5. Open cart
      6. Verify both products are in the cart
      7. Verify the cart total is correct
    `);

    expect(result.success).toBeTruthy();
  });
});

test.describe('User Registration Flow', () => {
  test('New user can register successfully', async ({ agent }) => {
    const result = await agent.execute(`
      Test Scenario: User registration with validation
      
      Steps:
      1. Navigate to the registration page
      2. Fill in all required fields with valid test data:
         - Email: generate unique email
         - Username: generate unique username
         - Password: secure password
         - Confirm Password: matching password
         - First Name: realistic name
         - Last Name: realistic name
         - Date of Birth: adult age
      3. Accept terms and conditions
      4. Click "Register" button
      5. Verify success message appears
      6. Verify user is redirected to dashboard
      7. Verify welcome message with username is displayed
    `);

    expect(result.success).toBeTruthy();
    expect(result.healingAttempts).toBeLessThan(3);
  });
});

test.describe('Search and Filter', () => {
  test('User can search and filter products', async ({ agent }) => {
    const result = await agent.execute(`
      Test Scenario: Advanced product search with filters
      
      Steps:
      1. Navigate to the product catalog
      2. Enter "laptop" in the search box
      3. Apply price range filter: $500-$1500
      4. Apply brand filter: select "Dell" and "HP"
      5. Apply rating filter: 4 stars and above
      6. Verify that search results are filtered correctly
      7. Verify all displayed products match the criteria
      8. Verify the result count is displayed
      9. Sort results by "Price: Low to High"
      10. Verify the first product is the cheapest matching item
    `);

    expect(result.success).toBeTruthy();
  });
});
