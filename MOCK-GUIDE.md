# Mock Manager Guide

## Quick Start

Run the interactive mock manager:
```bash
npm run mock
```

## Adding a New Mock

1. **Start the mock manager**
   ```bash
   npm run mock
   ```

2. **Select "➕ Add new mock from cURL"**

3. **Copy cURL from Browser**
   - Open browser DevTools (F12)
   - Go to Network tab
   - Make the request you want to mock
   - Right-click on the request
   - Select "Copy" → "Copy as cURL"

4. **Provide the cURL command**
   - Choose your input method:
     - **Paste directly**: Type or paste the cURL command
     - **Read from file**: Save cURL to a file and provide the path
     - **Read from clipboard**: Copy cURL and let the script read it automatically

5. **Provide the Response**
   - Choose response type and input method:
     - **JSON response**: For JSON API responses
       - Paste directly, read from file, or read from clipboard
     - **Raw response**: For HTML or text responses
       - Paste directly, read from file, or read from clipboard
     - **Empty response**: For endpoints that return no data
     - **Sample response**: Auto-generates based on endpoint

6. **Configure the Mock**
   - Set a name for easy identification
   - Add optional description
   - Choose to enable immediately
   - Set response delay (simulates network latency)
   - Set priority (higher priority mocks are checked first)

## Example cURL Commands

### GET Request
```bash
curl 'https://oref-ol-dev.powerappsportals.com/_api/user/profile' \
  -H 'Accept: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN'
```

### POST Request with JSON
```bash
curl 'https://oref-ol-dev.powerappsportals.com/_api/incidents' \
  -X POST \
  -H 'Content-Type: application/json' \
  -d '{"title":"Test","description":"Test incident"}'
```

### GET with Query Parameters
```bash
curl 'https://oref-ol-dev.powerappsportals.com/_api/incidents?$select=title,status&$filter=status%20eq%20%27active%27'
```

## Managing Mocks

### List All Mocks
Shows all configured mocks with their status, endpoint, and hit count.

### View Mock Details
See full configuration including request/response data for any mock.

### Edit Mock
Modify:
- Name and description
- Response data (paste directly, from file, or from clipboard)
- Status code
- Response delay
- Priority

### Toggle Mock
Enable or disable mocks without deleting them.

### Delete Mock
Remove mocks you no longer need.

## How It Works

1. **Priority System**: Mocks with higher priority (10=High, 5=Normal, 1=Low) are checked first
2. **Pattern Matching**: Supports exact match, wildcards (*), and path parameters (:id)
3. **Auto-reload**: Server automatically detects mock changes
4. **Statistics**: Tracks hit count and last used time

## Mock Storage

Mocks are stored in `mocks/mock-config.json` and are automatically loaded when the server starts.

## Server Integration

The mock middleware runs BEFORE the API proxy, so:
1. Request arrives
2. Mock middleware checks for matching mock
3. If found → Return mock response
4. If not found → Continue to API proxy

## Tips

- **Use High Priority** for specific mocks that should override general patterns
- **Add Delay** to simulate real network conditions (100-500ms is realistic)
- **Disable Instead of Delete** to keep mocks for later use
- **Export/Import** to share mocks with team members

## Troubleshooting

### Mock Not Working?
1. Check if mock is enabled: `npm run mock` → List all mocks
2. Verify endpoint matches exactly (or use wildcards)
3. Check method (GET, POST, etc.) matches
4. Look at server console for "🎭 Mock matched" messages

### Server Not Loading Mocks?
1. Restart the server after adding mocks
2. Check `mocks/mock-config.json` exists
3. Look for "📦 Loaded X active mock(s)" in server startup

## API Management Endpoints

When server is running, you can also manage mocks via API:

- `GET /_mock-admin/mocks` - List all mocks
- `GET /_mock-admin/mocks/stats` - Get statistics
- `POST /_mock-admin/mocks/:id/toggle` - Toggle mock
- `DELETE /_mock-admin/mocks/:id` - Delete mock
- `POST /_mock-admin/mocks/clear-stats` - Reset statistics
