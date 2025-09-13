# Cypress E2E Tests

This directory contains end-to-end tests for the Vestov Client Portal application, with a focus on invoice creation functionality.

## Test Files

### `invoice-creation.cy.ts`
Comprehensive tests for invoice creation functionality including:
- Manual invoice creation
- Service-based invoice creation  
- Developer management (add/remove)
- Pricing mode switching (hourly vs fixed)
- Service management
- Form validation
- Error handling
- UI interactions

### `invoice-pricing-fixes.cy.ts`
Focused tests for specific pricing calculation fixes:
- Developer removal updating calculated totals
- Pricing mode switching updating totals
- Combined scenarios testing both features
- UI state persistence

## Running Tests

### Prerequisites
1. Ensure the development server is running: `npm run dev`
2. Database should be seeded with test data
3. Admin user with credentials `admin/admin` should exist

### Interactive Mode (Recommended for development)
```bash
# Open Cypress Test Runner
npm run cy:open

# Open specific invoice creation tests
npm run test:e2e:open
```

### Headless Mode (CI/CD)
```bash
# Run all tests
npm run cy:run

# Run invoice creation tests only
npm run test:e2e

# Run in completely headless mode
npm run cy:run:headless
```

## Test Data Requirements

The tests assume the following test data exists in the database:

### Client Data
- Client ID: 1 (Test Client Corp)
- Services: Outsourcing service with assigned developers
- Developers: Eduardo Cerato, Sergei Vasilenko, Jéssica Ferreira

### User Authentication
- Admin user with username: `admin` and password: `admin`

## Test Structure

### Custom Commands
Located in `cypress/support/commands.ts`:
- `cy.loginAsAdmin()` - Handles admin authentication
- `cy.visitClientDetails(clientId)` - Navigate to client details page
- `cy.openCreateInvoiceDialog()` - Opens the invoice creation dialog
- `cy.selectService(serviceName)` - Selects a service in the invoice form
- `cy.switchDeveloperMode(developerName, mode)` - Changes pricing mode
- `cy.removeDeveloper(developerName)` - Removes a developer from service
- `cy.getCalculatedTotal()` - Gets the calculated total value

### Test Scenarios

#### Invoice Creation Tests
1. **Manual Invoice Creation**: Tests creating invoices with custom amounts
2. **Service-Based Creation**: Tests service selection and automatic pricing
3. **Developer Management**: Tests adding/removing developers and rate modifications
4. **Service Management**: Tests adding new services during invoice creation
5. **Form Validation**: Tests form validation and error handling
6. **Payment Status**: Tests paid vs unpaid invoice creation

#### Pricing Fixes Tests
1. **Developer Removal**: Verifies totals update when developers are removed
2. **Pricing Mode Switch**: Verifies totals update when switching between hourly/fixed
3. **Combined Scenarios**: Tests both features working together
4. **UI Persistence**: Tests that UI state is maintained correctly

## API Endpoints Tested

The tests intercept and verify the following API endpoints:
- `GET /api/services/clients/:id` - Client details
- `GET /api/invoices/client-service-options/:id` - Service options
- `POST /api/invoices/calculate-pricing/:id` - Pricing calculations  
- `POST /api/invoices` - Invoice creation
- `POST /api/services/clients/:id/services` - Add service to client

## Debugging Tests

### Viewing Network Requests
Tests use `cy.intercept()` to monitor API calls. Check the Cypress Test Runner's network tab to see all intercepted requests.

### Logging
Tests include `cy.log()` statements for debugging pricing calculations and state changes.

### Screenshots and Videos
Failed tests automatically capture screenshots. Videos are disabled by default but can be enabled in `cypress.config.ts`.

## Known Limitations

1. Tests assume specific test data exists in the database
2. Some tests may be sensitive to timing and require `cy.wait()` commands
3. UI selectors may need updates if the application UI changes significantly

## Maintenance

When updating tests:
1. Keep selectors up to date with UI changes
2. Update API intercepts if endpoints change
3. Maintain test data consistency
4. Add new test scenarios for new features

## Contributing

When adding new tests:
1. Follow the existing naming conventions
2. Use custom commands to reduce code duplication  
3. Include proper assertions and error handling
4. Document any new test data requirements