# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

This is a local development server for Microsoft Power Pages applications. It enables developers to run and test Power Pages projects locally without Microsoft's cloud infrastructure by serving Liquid templates, static assets, and providing API proxying capabilities.

**Critical Architecture Rule**: This server adapts to Power Pages projects, not vice versa. NEVER modify files in the Power Pages project directory (`powerPagesPath`). All fixes and modifications must be made only in the local server engine (`src/`, `config/`, root files).

## Development Commands

### Primary Commands
```bash
# Initialize new project setup (interactive)
npm run init

# Start development server with hot reload
npm run dev

# Start production server
npm start

# Debug with verbose logging  
npm run debug

# Kill server process
npm run kill-server
```

### Mock API Management
```bash
# Generate mock API from cURL command
npm run add-mock -- "curl -X GET https://api.example.com/users"

# Create mocks from JSON files
npm run add-mock-from-file examples/mock-example.json

# Manage existing mocks
npm run manage-mocks

# Update API proxy configuration
npm run update-proxy
```

### Task Management
```bash
# View development progress
npm run tasks

# Mark task as complete
npm run task-complete "Task Name"

# Reset all tasks
npm run task-reset
```

### Maintenance
```bash
# Clean reinstall dependencies
npm run clean

# Test server functionality
npm test
```

## Architecture Overview

### Core Class Structure
- **PowerPagesServer** (`server.js`): Main Express server orchestrating all components
- **LiquidEngine** (`src/liquid-engine.js`): Liquid template processor with Power Pages extensions
- **PageHandler** (`src/page-handler.js`): Processes web-pages with multi-language support
- **TemplateHandler** (`src/template-handler.js`): Handles web-templates
- **SnippetHandler** (`src/snippet-handler.js`): Processes content-snippets
- **FileHandler** (`src/file-handler.js`): Static file serving from web-files
- **MockApi** (`src/mock-api.js`): Local API response simulation
- **ApiProxy** (`src/api-proxy.js`): Real API proxying with authentication
- **TaskManager** (`src/task-manager.js`): Development progress tracking

### Power Pages Structure Understanding
The server processes four main Power Pages components:
1. **Web Pages** (`web-pages/`): Page configurations, content, CSS, and JS
2. **Web Templates** (`web-templates/`): Liquid template files
3. **Content Snippets** (`content-snippets/`): Reusable content blocks  
4. **Web Files** (`web-files/`): Static assets

### Template Processing Flow
1. HTTP Request → Express routing
2. Page Handler finds page config by URL matching
3. Content loaded (HTML, CSS, JS) for detected language
4. Liquid Engine processes templates with mock data injection
5. Include resolution (snippets → web-templates fallback)
6. Final HTML assembly and response

### Configuration System
- **New Format**: `config.json` (primary, managed by ConfigLoader)
- **Legacy Format**: `config/server-config.json` (adapted automatically)
- **API Proxy**: `config/api-proxy.json` (authentication headers)
- **Task Progress**: `config/task-manager.json` (development tracking)

## Critical Development Patterns

### Liquid Template Processing
- Custom include tag handles `{% include 'Template Name' %}`
- Name normalization: "Global React Components" → "global-react-components"
- Resolution priority: content-snippets → web-templates → error comment
- All Power Pages variables mocked (user, website, settings, weblinks, etc.)

### Multi-language Support
- Language detection from URL params or headers
- Content file pattern: `PageName.{lang}.webpage.copy.html`
- Fallback to default language if language-specific content missing
- Supported: en-US, he-IL (configurable)

### Authentication & API Proxying
- Two methods: Bearer Token (recommended) vs Cookie authentication
- Real API calls proxied to actual Power Pages backend
- Mock responses for development/testing scenarios
- Request/response logging for debugging

### File Resolution Patterns
```javascript
// Template include resolution
content-snippets/template-name/*.html
web-templates/template-name/*.webtemplate.source.html

// Page content resolution  
web-pages/{page-dir}/content-pages/{PageName}.{lang}.webpage.copy.html
web-pages/{page-dir}/content-pages/{PageName}.{lang}.webpage.custom_css.css
web-pages/{page-dir}/content-pages/{PageName}.{lang}.webpage.custom_javascript.js
```

### Error Handling Philosophy
- Graceful degradation: missing templates → HTML comments, not crashes
- Comprehensive logging with chalk-colored console output
- Fallback chains: specific language → default language → error state
- Development-friendly error messages with file paths

## Common Development Workflows

### Adding New Template Support
1. Extend `SnippetHandler` or `TemplateHandler` for new template types
2. Update Liquid Engine custom tags if needed  
3. Add template resolution patterns in appropriate handler
4. Test with existing Power Pages project structure

### Debugging Template Issues
1. Enable debug mode: `"debug": true` in config
2. Check console for colored status messages (✅ success, ❌ errors)
3. Look for "Include not found" comments in HTML output
4. Verify file naming patterns match expected structure

### API Integration Development  
1. Use `npm run add-mock` to create mocks from real cURL commands
2. Test with mock responses first, then enable proxy for real API calls
3. Check `config/api-proxy.json` for authentication freshness
4. Monitor network tab for actual API request patterns

### Multi-language Content Testing
1. Test both `/` and `/?lang=he-IL` URLs
2. Verify content fallback behavior when language files missing  
3. Check language detection logic in PageHandler
4. Validate Hebrew RTL support in templates

## Troubleshooting Quick Reference

### Template Resolution Issues
```bash
# Check template exists
ls web-templates/template-name/
find web-templates/ -name "*.webtemplate.source.html"

# Verify naming conversion
"Global React Components" → "global-react-components"
```

### Server Issues
```bash
# Kill port conflicts
lsof -ti:3000 | xargs kill -9

# Full reset
rm -rf node_modules package-lock.json && npm install
```

### API Proxy Issues
```bash
# Check proxy config
cat config/api-proxy.json

# Re-run initialization with fresh cURL
npm run init
```

## Testing Strategy

### Manual Testing
- Test template rendering: `curl http://localhost:3000/`
- Test language switching: `curl "http://localhost:3000/?lang=he-IL"`
- Verify API responses: check Network tab in browser
- Test hot reload: modify template files and check auto-refresh

### Integration Points
- Power Pages project compatibility (never modify project files)
- Liquid syntax compatibility with Microsoft's implementation
- API response format matching actual Power Pages responses
- Multi-language content serving behavior

## Configuration Validation

### Required Configuration
- `powerPagesPath`: Must point to valid Power Pages project directory
- `port`: Available port (default 3000)
- API authentication: Either Bearer token or Cookie headers in api-proxy.json
- Mock user: Valid GUID format for userId

### Project Structure Verification
```bash
# Verify Power Pages project structure
ls $POWER_PAGES_PATH/web-pages/
ls $POWER_PAGES_PATH/web-templates/  
ls $POWER_PAGES_PATH/content-snippets/
ls $POWER_PAGES_PATH/web-files/
```

This local server is designed to be a transparent development proxy for Power Pages applications, handling the complexity of Liquid templating, multi-language content, and API integration while maintaining compatibility with Microsoft's production environment.

<citations>
<document>
    <document_type>RULE</document_type>
    <document_id>39JjooFbDKdooJYp1nnST5</document_id>
</document>
<document>
    <document_type>RULE</document_type>
    <document_id>CZPX1PehaUbHdbe96AnvxS</document_id>
</document>
</citations>
