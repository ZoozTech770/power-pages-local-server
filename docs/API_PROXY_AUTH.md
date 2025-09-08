# API Proxy Authentication Methods

The API proxy supports two authentication methods to connect to your Power Pages backend:

## 1. Bearer Token Authentication (Recommended)

This method uses Azure AD JWT tokens for authentication. This is the current default method.

### Configuration

In `config/api-proxy.json`:

```json
{
  "enabled": true,
  "baseUrl": "https://your-portal.powerappsportals.com",
  "headers": {
    "Accept": "application/json",
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Authorization": "Bearer YOUR_JWT_TOKEN_HERE"
  },
  "useAuthorizationHeader": true
}
```

### How to get the Bearer Token

1. Open your Power Pages portal in a web browser
2. Open Developer Tools (F12)
3. Go to the Network tab
4. Make any API request (refresh the page or interact with the portal)
5. Look for requests to your portal's API endpoints
6. In the request headers, find the `Authorization` header
7. Copy the entire value (including "Bearer ")
8. Paste it into the `Authorization` field in the config

### Advantages

- More secure than cookies
- Works better with modern authentication flows
- Tokens are self-contained and don't require session state

## 2. Cookie Authentication (Legacy)

This method uses browser cookies for authentication, similar to how a web browser would authenticate.

### Configuration

In `config/api-proxy.json`:

```json
{
  "enabled": true,
  "baseUrl": "https://your-portal.powerappsportals.com",
  "headers": {
    "Accept": "application/json",
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Cookie": "ARRAffinitySameSite=...; ARRAffinity=...; __RequestVerificationToken=...; .AspNet.ApplicationCookie=..."
  },
  "useAuthorizationHeader": false
}
```

### How to get the Cookies

1. Open your Power Pages portal in a web browser
2. Open Developer Tools (F12)
3. Go to the Network tab
4. Make any API request (refresh the page or interact with the portal)
5. Look for requests to your portal's API endpoints
6. In the request headers, find the `Cookie` header
7. Copy the entire cookie string
8. Paste it into the `Cookie` field in the config

### Disadvantages

- Cookies can expire more frequently
- More complex to manage session state
- Less secure than token-based authentication

## Switching Between Methods

To switch from Bearer token to Cookie authentication:

1. Set `useAuthorizationHeader: false` in your config
2. Ensure the `Cookie` header is properly set
3. Restart your local server

To switch from Cookie to Bearer token authentication:

1. Set `useAuthorizationHeader: true` in your config
2. Ensure the `Authorization` header is properly set
3. Restart your local server

## Troubleshooting

### 403 Forbidden Errors

- Check that your token/cookies are not expired
- Verify that you're using the correct authentication method
- Ensure the token/cookies are from the same domain as your `baseUrl`

### 401 Unauthorized Errors

- Your token/cookies have likely expired
- Re-extract fresh authentication credentials from your browser
- Update the config file with the new credentials

### Token Expiration

JWT tokens typically expire after 1-2 hours. You'll need to refresh them periodically:

1. Refresh your Power Pages portal in the browser
2. Extract the new token from the network requests
3. Update the config file
4. Restart the local server (or it will pick up changes automatically)

## Security Notes

- Never commit your actual tokens or cookies to version control
- Use placeholder values in your config files when sharing code
- Tokens and cookies should be treated as sensitive credentials
- Consider using environment variables for production deployments
