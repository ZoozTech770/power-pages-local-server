# Power Pages Local Server - Initialization Example

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Run the interactive initialization:
```bash
npm run init
```

## Example Initialization Session

Here's what the initialization process looks like:

```
🚀 Power Pages Local Server Initializer

This tool will help you set up your Power Pages local development environment.

📋 Configuration Setup

🌐 Enter your Power Pages base URL: https://oref-test.powerappsportals.com

🔐 Authentication Setup
Please provide a cURL example from your browser's developer tools
(Right-click on any API request → Copy → Copy as cURL)

Tip: You can paste multiline cURL - press Enter twice when done

📋 Paste your cURL example here (press Enter twice when done):

curl 'https://oref-test.powerappsportals.com/_api/contacts(d3dc8e0a-b733-f011-8c4d-7c1e5226723e)' \
  -H 'Cookie: __RequestVerificationToken=abc123; ARRAffinity=def456' \
  -H 'User-Agent: Mozilla/5.0...'

[Press Enter twice to finish]

✅ Extracted cookies from cURL
✅ Extracted RequestVerificationToken
✅ Extracted user ID: d3dc8e0a-b733-f011-8c4d-7c1e5226723e
✅ Successfully parsed authentication data from cURL example

👤 Enter the user ID for mock user (GUID format) [d3dc8e0a-b733-f011-8c4d-7c1e5226723e]: 

📁 Enter the path to your Power Pages project files: /Users/username/Documents/my-project

🌐 Enter the port number (default: 3000): 

🌍 Enter supported languages (comma-separated, default: en-US,he-IL): 

👤 Enter mock user display name: John Doe

🔥 Enable hot reload? (y/n, default: y): 

🔍 Validating configuration...
✅ Configuration validated successfully

📝 Generating configuration files...
✅ Generated .env file
✅ Generated config.json file
✅ Generated .gitignore file
✅ Updated package.json

📦 Installing dependencies...
✅ Dependencies installed successfully

✅ Initialization complete!

To start your server, run:
  npm start

Or use the development mode with auto-restart:
  npm run dev
```

## What Gets Created

After initialization, you'll have:

### `.env` file (sensitive data)
```env
# Power Pages Local Server Configuration
# Generated on 2025-01-17T10:00:00.000Z

# Server Configuration
PORT=3000
HOT_RELOAD=true

# Power Pages Configuration
BASE_URL=https://oref-test.powerappsportals.com
PROJECT_PATH=/Users/username/Documents/my-project
LANGUAGES=en-US,he-IL

# Mock User Configuration
MOCK_USER_ID=d3dc8e0a-b733-f011-8c4d-7c1e5226723e
MOCK_USER_NAME=John Doe

# Authentication (Keep these secure!)
COOKIES=__RequestVerificationToken=abc123; ARRAffinity=def456
REQUEST_VERIFICATION_TOKEN=abc123
```

### `config.json` file
```json
{
  "server": {
    "port": 3000,
    "hotReload": true
  },
  "powerPages": {
    "baseUrl": "https://oref-test.powerappsportals.com",
    "projectPath": "/Users/username/Documents/my-project",
    "languages": ["en-US", "he-IL"]
  },
  "mockUser": {
    "id": "d3dc8e0a-b733-f011-8c4d-7c1e5226723e",
    "name": "John Doe"
  },
  "proxy": {
    "enabled": true,
    "timeout": 30000,
    "retries": 3
  }
}
```

### `.gitignore` file
```
# Power Pages Local Server
.env
*.log
node_modules/
.DS_Store
.vscode/
*.tmp
*.cache

# Authentication files (keep secure!)
auth.json
cookies.txt
```

## Getting cURL Examples

### From Chrome DevTools:
1. Open your Power Pages site
2. Press F12 to open DevTools
3. Go to Network tab
4. Make any API request (navigate to a page, submit form, etc.)
5. Right-click on the request → Copy → Copy as cURL

### From Firefox DevTools:
1. Open your Power Pages site
2. Press F12 to open DevTools
3. Go to Network tab
4. Make any API request
5. Right-click on the request → Copy → Copy as cURL

## Troubleshooting

### Common Issues:

1. **"Invalid user ID format"**
   - Make sure the user ID is a valid GUID format
   - Check if the cURL example contains a contact API call

2. **"Project path does not exist"**
   - Verify the path to your Power Pages project files
   - Use absolute paths for better reliability

3. **"Could not parse cURL example"**
   - Make sure to paste the complete cURL command
   - Press Enter twice to finish input
   - Try copying the cURL again from browser

4. **Authentication issues**
   - Ensure your browser session is active
   - Re-copy the cURL with fresh authentication
   - Check that cookies are properly extracted

### Re-running Initialization:

If you need to reconfigure:
```bash
npm run init
```

This will overwrite existing configuration files.

### Manual Configuration:

If the automatic parsing fails, you can manually edit the `.env` file with the correct values.

## Next Steps

After initialization:

1. Start the server:
   ```bash
   npm start
   ```

2. Open your browser to:
   ```
   http://localhost:3000
   ```

3. Test your Power Pages templates locally!
