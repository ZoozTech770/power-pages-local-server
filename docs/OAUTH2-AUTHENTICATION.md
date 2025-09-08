# OAuth2 Authentication for Power Pages Local Server

## Overview
This server now supports proper OAuth2 authentication using Microsoft Authentication Library (MSAL), similar to the Dataverse REST Builder extension. This provides secure, token-based authentication with automatic refresh capabilities.

## Key Features
- ✅ Browser-based authentication flow
- ✅ Tokens valid for ~3 hours (automatic refresh)
- ✅ Support for both public and confidential clients
- ✅ Secure token caching
- ✅ Automatic fallback to legacy authentication

## Quick Start

### 1. Setup OAuth2 Authentication
```bash
npm run auth-setup
```
This interactive CLI will guide you through:
- Azure AD app registration
- Client ID and Tenant ID configuration
- Dataverse region selection
- Optional client secret setup

### 2. Authenticate
Start the server and navigate to:
```
http://localhost:3000/auth
```

Click "Authenticate with Microsoft" and complete the login flow.

### 3. Check Status
```bash
npm run auth-status
```
Shows current authentication status and token validity.

## Azure AD App Registration

### Prerequisites
You need to register an application in Azure Active Directory:

1. **Go to Azure Portal**
   - Navigate to: https://portal.azure.com
   - Go to Azure Active Directory → App registrations

2. **Create New Registration**
   - Name: "Power Pages Local Dev" (or your preference)
   - Supported account types: Single tenant
   - Redirect URI: `http://localhost:3000/auth/callback` (Web platform)

3. **Configure API Permissions**
   - Add permission → Dynamics CRM
   - Select "user_impersonation" (Delegated)
   - Grant admin consent (if required by your organization)

4. **Get Configuration Values**
   - Application (client) ID
   - Directory (tenant) ID
   - (Optional) Create a client secret

## Authentication Methods

### Device Code Flow (Default)
Best for development scenarios without client secrets:
- Opens browser for authentication
- User enters a code
- No secrets stored locally

### Authorization Code Flow
For production scenarios with client secrets:
- More secure
- Requires client secret
- Suitable for server-side applications

## Configuration Files

### `config/auth-config.json`
Stores OAuth2 configuration:
```json
{
  "clientId": "your-client-id",
  "tenantId": "your-tenant-id",
  "clientSecret": null,
  "redirectUri": "http://localhost:3000/auth/callback",
  "scopes": ["https://org.api.crm.dynamics.com/.default"],
  "powerPagesUrl": "https://your-site.powerappsportals.com"
}
```

### `config/token-cache.json`
Stores cached access tokens (auto-generated, do not edit):
```json
{
  "accessToken": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "expiresOn": "2025-01-01T12:00:00.000Z",
  "scopes": ["https://org.api.crm.dynamics.com/.default"]
}
```

## API Usage

### Authentication Endpoints

#### Check Authentication Status
```
GET http://localhost:3000/auth/status
```
Response:
```json
{
  "authenticated": true,
  "configured": true,
  "expiresIn": 10800,
  "expiresAt": "2025-01-01T12:00:00.000Z"
}
```

#### Refresh Token
```
GET http://localhost:3000/auth/refresh
```

#### Logout
```
GET http://localhost:3000/auth/logout
```

## How It Works

### Authentication Flow
1. User navigates to `/auth`
2. Clicks "Authenticate with Microsoft"
3. Browser opens Microsoft login
4. User completes authentication
5. Token is received and cached
6. Server uses token for API calls

### Token Lifecycle
- Tokens are valid for ~3 hours
- Automatic refresh attempted when token expires
- Falls back to interactive auth if refresh fails
- Token cached locally for reuse

### API Proxy Integration
The API proxy automatically:
- Checks for valid OAuth2 token
- Adds Bearer token to API requests
- Handles token expiration
- Falls back to legacy auth if OAuth2 not configured

## Comparison with Legacy Authentication

| Feature | OAuth2 (New) | cURL/Cookie (Legacy) |
|---------|--------------|---------------------|
| Security | High (industry standard) | Medium (session-based) |
| Token Validity | ~3 hours | Session-dependent |
| Auto Refresh | ✅ Yes | ❌ No |
| Browser Required | First auth only | Every session |
| Azure AD Integration | ✅ Full | ❌ None |
| Best Practice | ✅ Yes | ⚠️ Workaround |

## Troubleshooting

### Common Issues

#### "OAuth2 not configured"
Run `npm run auth-setup` and follow the prompts.

#### "Token expired"
Navigate to `http://localhost:3000/auth` and re-authenticate.

#### "Authentication failed"
Check:
- Azure AD app permissions
- Client ID and Tenant ID are correct
- Redirect URI matches configuration
- Admin consent granted (if required)

#### "No scopes defined"
Ensure your Power Pages URL is correct in configuration.

### Debug Commands

```bash
# Check current auth status
npm run auth-status

# Clear all authentication
npm run auth-clear

# Re-run setup
npm run auth-setup
```

## Security Considerations

### Token Storage
- Tokens are stored locally in `config/token-cache.json`
- Add this file to `.gitignore` (already included)
- Never commit tokens to version control

### Client Secrets
- Store securely if using confidential client
- Consider using environment variables
- Never commit secrets to version control

### HTTPS in Production
- Use HTTPS for redirect URIs in production
- Update Azure AD app registration accordingly
- Consider using Azure Key Vault for secrets

## Migration from Legacy Authentication

### Before (cURL-based)
```javascript
// Old: Extract token from cURL
const token = extractFromCurl(curlCommand);
headers['__RequestVerificationToken'] = token;
```

### After (OAuth2)
```javascript
// New: Use OAuth2 token
const authHeaders = await authManager.getAuthHeaders();
// Includes Bearer token automatically
```

### Gradual Migration
The server supports both authentication methods:
1. OAuth2 takes precedence if configured
2. Falls back to legacy if OAuth2 not available
3. No breaking changes to existing setup

## Advanced Configuration

### Custom Scopes
Edit `config/auth-config.json`:
```json
{
  "scopes": [
    "https://org.api.crm.dynamics.com/.default",
    "https://graph.microsoft.com/User.Read"
  ]
}
```

### Multiple Environments
Create environment-specific configs:
- `config/auth-config.dev.json`
- `config/auth-config.prod.json`

### Programmatic Authentication
```javascript
const AuthManager = require('./src/auth-manager');
const authManager = new AuthManager(config);
await authManager.initialize();

// Get valid token
const token = await authManager.getValidToken();

// Use in API calls
const headers = await authManager.getAuthHeaders();
```

## Support

For issues or questions:
1. Check this documentation
2. Run `npm run auth-setup` and select "View instructions"
3. Check Azure AD app configuration
4. Review server logs for detailed error messages

## Next Steps

After successful OAuth2 setup:
1. ✅ Authentication is automatic
2. ✅ Tokens refresh automatically
3. ✅ API calls use proper Bearer tokens
4. ✅ Compatible with Power Pages/Dataverse APIs

Enjoy secure, modern authentication for your Power Pages local development!
