# Proxy Configuration Update Script

This script automatically updates the API proxy configuration by parsing curl commands from your browser's developer tools.

## How to Use

### Method 1: Using npm script (Recommended)

```bash
npm run update-proxy "your curl command here"
```

### Method 2: Direct node execution

```bash
node scripts/update-proxy-config.js "your curl command here"
```

## Step-by-Step Guide

1. **Open your browser** and navigate to your Power Pages site
2. **Open Developer Tools** (F12 or Right-click → Inspect)
3. **Go to Network tab** and clear existing requests
4. **Make an API request** that works (e.g., click something that loads data)
5. **Find the API request** in the Network tab (usually starts with `/_api/`)
6. **Right-click on the request** → Copy → Copy as cURL
7. **Run the script** with the copied curl command:

```bash
npm run update-proxy "curl 'https://your-site.com/_api/something' -H 'Authorization: Bearer token' -H 'Cookie: cookies=here' ..."
```

## What the Script Does

- **Extracts the base URL** from the curl command
- **Parses all headers** (-H flags) including:
  - `Authorization` (for Bearer tokens)
  - `Cookie` (for session cookies)
  - `__RequestVerificationToken` (for CSRF protection)
  - `Accept`, `Content-Type`, `User-Agent`, etc.
- **Extracts cookies** from -b flag if present
- **Determines authentication method** (Bearer token vs Cookies)
- **Updates the configuration file** automatically
- **Provides feedback** on what was extracted

## Example

```bash
npm run update-proxy "curl 'https://oref-test.powerappsportals.com/_api/incidents' -H 'Accept: application/json' -H 'Cookie: session=abc123' -H '__RequestVerificationToken: xyz789'"
```

This will automatically update `config/api-proxy.json` with the new configuration.

## After Running the Script

1. **Restart your server** to apply the changes:
   ```bash
   npm start
   ```

2. **Test your API requests** to ensure they work correctly

## Troubleshooting

- **"Could not extract base URL"**: Make sure your curl command includes the full URL
- **"No curl command provided"**: Ensure you're wrapping the curl command in quotes
- **Still getting authentication errors**: The token might have expired - get a fresh curl command

## Notes

- The `__RequestVerificationToken` typically expires within minutes, so you'll need to refresh it regularly
- Make sure to copy the curl command from a working API request
- The script will overwrite the existing configuration file
