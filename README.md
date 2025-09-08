# Power Pages Local Development Server

## Overview
This project provides a local development server for Microsoft Power Pages projects, enabling you to run and test your Power Pages applications locally without needing Microsoft's cloud infrastructure.

## Mission & Context
This server is designed to serve Power Pages projects locally by:
1. **Processing Liquid Templates**: Converting `.liquid` and `.html` files with Liquid syntax
2. **Serving Static Assets**: Handling CSS, JS, and image files from `web-files/`
3. **Mock API Integration**: Providing local JSON responses and easy mock generation from curl commands
4. **Multi-language Support**: Supporting Hebrew/English content from content-pages
5. **React Component Support**: Serving React components with proper compilation

## Power Pages Structure Understanding
The server handles the following Power Pages components:

### Web Pages (`web-pages/`)
- **Configuration**: `PageName.webpage.yml` - Contains page metadata and routing info
- **Content**: `content-pages/PageName.{lang}.webpage.copy.html` - Actual page content
- **Styles**: `content-pages/PageName.{lang}.webpage.custom_css.css` - Page-specific CSS
- **Scripts**: `content-pages/PageName.{lang}.webpage.custom_javascript.js` - Page-specific JS
- **Summary**: `content-pages/PageName.{lang}.webpage.summary.html` - Page summary/description

### Web Templates (`web-templates/`)
- **Template Files**: `TemplateName.webtemplate.source.html` - Liquid template files
- **Configuration**: `TemplateName.webtemplate.yml` - Template metadata

### Content Snippets (`content-snippets/`)
- **Snippet Files**: `SnippetName.contentsnippet.html` - Reusable content blocks
- **Configuration**: `SnippetName.contentsnippet.yml` - Snippet metadata

### Web Files (`web-files/`)
- Static assets (CSS, JS, images, fonts)
- Organized by file type and functionality

## Features
- **Liquid Template Engine**: Full Liquid syntax support with Power Pages extensions
- **Hot Reload**: Automatic refresh on file changes
- **Mock API Services**: Local JSON responses for all API calls
- **Multi-language Routing**: Proper handling of Hebrew/English content
- **React Integration**: Support for React components and JSX compilation
- **User Authentication Mock**: Simulated user sessions and roles
- **Progress Tracking**: Built-in task management system

## Project Structure
```
power-pages-local-server/
├── README.md                    # This file - load this context anytime
├── server.js                    # Main Express server
├── package.json                 # Node.js dependencies
├── config/
│   ├── server-config.json       # Server configuration
│   └── task-manager.json        # Task progress tracking
├── src/
│   ├── liquid-engine.js         # Liquid template processor
│   ├── page-handler.js          # Power Pages page processor
│   ├── template-handler.js      # Web template processor
│   ├── snippet-handler.js       # Content snippet processor
│   ├── file-handler.js          # Static file handler
│   ├── mock-api.js              # Mock API responses
│   ├── task-manager.js          # Progress tracking system
│   └── utils.js                 # Utility functions
├── mock-data/                   # Mock API responses
│   ├── users.json               # User data and authentication
│   ├── search.json              # Search results
│   ├── settings.json            # Site settings
│   ├── messages.json            # User messages
│   └── requests.json            # User requests data
├── compiled/                    # Compiled templates and assets
│   ├── pages/
│   ├── templates/
│   └── assets/
└── logs/                        # Server logs and debug info
```

## Installation & Setup

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Quick Start with Interactive Setup
```bash
# 1. Install dependencies
npm install

# 2. Run interactive setup wizard
npm run init

# 3. Start the server
npm start

# 4. Open browser
open http://localhost:3000
```

### Interactive Setup Wizard
The `npm run init` command will guide you through:

1. **Power Pages Base URL**: Your site's URL (e.g., `https://your-site.powerappsportals.com`)
2. **Authentication Setup**: Paste a cURL example from browser dev tools
3. **Mock User ID**: GUID for the test user
4. **Project Path**: Path to your Power Pages project files
5. **Server Configuration**: Port, languages, and other settings

### Authentication Setup
During initialization, you'll need to provide authentication:

1. Open your Power Pages site in browser
2. Open Developer Tools (F12)
3. Go to Network tab
4. Make any API request
5. Right-click on request → Copy → Copy as cURL
6. Paste the cURL command when prompted

### Manual Configuration
If you prefer manual setup, create a `.env` file:
```env
# Server Configuration
PORT=3000
HOT_RELOAD=true

# Power Pages Configuration
BASE_URL=https://your-site.powerappsportals.com
PROJECT_PATH=/path/to/your/project
LANGUAGES=en-US,he-IL

# Mock User Configuration
MOCK_USER_ID=your-user-guid
MOCK_USER_NAME=Test User

# Authentication
COOKIES=your-session-cookies
REQUEST_VERIFICATION_TOKEN=your-csrf-token
```

## Usage Examples

### Starting the Server
```bash
# Development mode with hot reload
npm run dev

# Production mode
npm start

# Debug mode with verbose logging
npm run debug
```

### API Mock Examples
The server provides mock responses for common Power Pages API patterns:
- User authentication: `GET /api/user/current`
- User messages: `GET /api/user/messages`
- Search: `GET /api/search?q=query`
- Form submissions: `POST /api/forms/submit`

## Task Management System
The built-in task manager tracks development progress:

### Current Tasks Status
- ✅ **Server Setup**: Express server with routing
- ✅ **Project Structure**: Organized file structure
- ✅ **Configuration**: Server configuration system
- ⏳ **Liquid Engine**: Liquid template processing
- ⏳ **Page Handler**: Web page processing and routing
- ⏳ **Template Handler**: Web template processing
- ⏳ **Snippet Handler**: Content snippet processing
- ⏳ **File Handler**: Static file serving
- ⏳ **Mock API**: API endpoint simulation
- ⏳ **Hot Reload**: File watching and auto-refresh
- ⏳ **Multi-language**: Language switching support
- ⏳ **React Integration**: JSX compilation and serving

### Task Management Commands
```bash
# View current progress
npm run tasks

# Mark task as complete
npm run task-complete "Task Name"

# Reset all tasks
npm run task-reset

### Mock API Generation

**Generate Mock APIs from Curl Commands:**
```bash
# Create a mock from a real API call
npm run add-mock -- "curl -X GET https://api.example.com/users -H 'Authorization: Bearer token'"

# This will:
# 1. Execute the curl command to get real response data
# 2. Create a mock configuration file in mock-data/
# 3. Automatically add the route to server.js
# 4. Make the endpoint available at http://localhost:3000/users
```

**Generate Mock APIs from JSON Files:**
```bash
# Create mocks from a single JSON file
npm run add-mock -- --file examples/mock-example.json

# Create mocks from multiple JSON files in a directory
npm run add-mock -- --file examples/

# Alternative shortcut command
npm run add-mock-from-file examples/mock-example.json
```

**Mock File Format:**
```json
{
  "endpoint": "/api/example",
  "method": "GET",
  "description": "Optional description",
  "response": {
    "status": 200,
    "data": {
      "message": "Your mock response data"
    }
  }
}
```

**Multiple Mocks in One File:**
```json
[
  {
    "endpoint": "/api/users",
    "method": "GET",
    "response": { "data": ["user1", "user2"] }
  },
  {
    "endpoint": "/api/products",
    "method": "GET",
    "response": { "data": ["product1", "product2"] }
  }
]
```

**Features:**
- 🔧 **Smart Parsing**: Extracts method, URL, headers, and data from curl commands
- 📡 **Live Execution**: Captures real API responses for accurate mocking
- 💾 **Auto-Save**: Creates structured mock files in mock-data/
- 🔗 **Route Generation**: Automatically adds Express routes to server.js
- 📁 **Organization**: Clean file naming and directory structure

For detailed examples and usage, see: `docs/ADD_MOCK_USAGE.md`
```

## Sample Project Support
This server is specifically designed to work with the `oref---oref-dev` project which includes:
- **Home Page**: React-based dashboard with user authentication
- **User Profile**: User management and profile pages
- **Search**: Full-text search functionality
- **Forms**: Dynamic form handling
- **Multi-language**: Hebrew/English content support
- **Mobile Support**: Responsive design components

## Development Notes
- **Liquid Variables**: All Power Pages Liquid variables are mocked (user, website, settings, etc.)
- **Security**: All API calls are intercepted and served locally
- **Performance**: Templates are compiled and cached for faster serving
- **Debugging**: Comprehensive logging for troubleshooting

## Getting Started Checklist
1. ✅ Install Node.js and npm
2. ⏳ Clone/download this project
3. ⏳ Run `npm install`
4. ⏳ Configure `server-config.json` with your Power Pages path
5. ⏳ Start server with `npm start`
6. ⏳ Open browser to `http://localhost:3000`
7. ⏳ Test page loading and navigation

## Context Loading
**Important**: Load this README.md file anytime you need to understand the project context, structure, and current progress. This file contains all the essential information about the mission, architecture, and implementation details.

## Support
For any issues or questions, refer to the logs in the `logs/` directory or enable debug mode in the configuration.
