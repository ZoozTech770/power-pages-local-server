# Liquid Template Server - Architecture & Maintenance Guide

## Table of Contents
1. [System Architecture](#system-architecture)
2. [Core Components](#core-components)
3. [Data Flow](#data-flow)
4. [Liquid Engine Deep Dive](#liquid-engine-deep-dive)
5. [Template Resolution](#template-resolution)
6. [Troubleshooting Guide](#troubleshooting-guide)
7. [Maintenance Tasks](#maintenance-tasks)
8. [Development Workflows](#development-workflows)

## System Architecture

### High-Level Overview
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   HTTP Request  │───▶│  Express Server │───▶│   Page Handler  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
                                                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Final HTML    │◀───│  Liquid Engine  │◀───│  Template Data  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Request Flow
1. **HTTP Request** → Express server receives request
2. **Route Matching** → Page Handler matches URL to page configuration
3. **Content Loading** → Load HTML, CSS, JS from file system
4. **Template Processing** → Liquid Engine processes all templates
5. **Response** → Final HTML sent to client

## Core Components

### 1. Express Server (`server.js`)
- **Purpose**: Main entry point, handles routing and middleware
- **Key Features**:
  - CORS handling
  - Static file serving
  - API proxy setup
  - Error handling
  - Hot reload support

### 2. Liquid Engine (`src/liquid-engine.js`)
- **Purpose**: Core template processing engine
- **Key Features**:
  - Liquid template parsing and rendering
  - Custom Power Pages filters
  - Custom include tag for snippets and web-templates
  - Mock data injection
  - Error handling and logging

### 3. Page Handler (`src/page-handler.js`)
- **Purpose**: Processes Power Pages web-pages
- **Key Features**:
  - URL to page mapping
  - Multi-language content loading
  - CSS/JS integration
  - Final HTML assembly

### 4. Template Handler (`src/template-handler.js`)
- **Purpose**: Processes web-templates
- **Key Features**:
  - Template file loading
  - Liquid processing
  - Caching

### 5. Snippet Handler (`src/snippet-handler.js`)
- **Purpose**: Processes content snippets
- **Key Features**:
  - Snippet loading and caching
  - Template rendering
  - Error fallbacks

## Data Flow

### Template Processing Flow
```
┌─────────────────┐
│  Request URL    │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│  Find Page      │
│  Configuration  │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│  Load Content   │
│  (HTML/CSS/JS)  │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│  Process with   │
│  Liquid Engine  │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│  Resolve        │
│  Includes       │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│  Final HTML     │
│  Response       │
└─────────────────┘
```

## Liquid Engine Deep Dive

### Custom Tags
The Liquid Engine includes custom tags for Power Pages compatibility:

#### Include Tag
```liquid
{% include 'Template Name' %}
```

**Implementation**:
- Checks `content-snippets/` first for snippet files
- Falls back to `web-templates/` for template files
- Converts spaces to hyphens in template names
- Recursively processes included templates

### Custom Filters
- `escape`: HTML entity encoding
- `h`: Alias for escape
- `boolean`: Boolean conversion
- `default`: Default value assignment

### Mock Data Structure
```javascript
{
  user: {
    id: "user-123",
    fullname: "אריה כהן",
    email: "arye.cohen@example.com",
    roles: "לקוח- הגשת בקשות,Administrators"
  },
  website: {
    sign_in_url_substitution: '/sign-in',
    sign_out_url_substitution: '/sign-out',
    url: 'http://localhost:3000'
  },
  settings: {
    'LanguageLocale/Code': 'en-US',
    'Profile/Enabled': true
  },
  // ... more mock data
}
```

## Template Resolution

### Include Resolution Algorithm
1. **Normalize Name**: Convert "Template Name" → "template-name"
2. **Check Snippets**: Look in `content-snippets/template-name/`
3. **Check Templates**: Look in `web-templates/template-name/`
4. **File Search**: Find `.html` or `.webtemplate.source.html`
5. **Process**: Render through Liquid Engine
6. **Return**: Processed HTML or error comment

### File Path Examples
```
Input: {% include 'Global React Components' %}
├── Check: content-snippets/global-react-components/*.html
└── Check: web-templates/global-react-components/*.webtemplate.source.html
```

## Troubleshooting Guide

### Common Issues

#### 1. Template Not Found
**Symptoms**: `<!-- Include not found: Template Name -->` in output
**Causes**:
- Incorrect template name casing
- Missing template files
- Wrong directory structure

**Solutions**:
```bash
# Check if template exists
ls web-templates/template-name/
# Verify file naming
ls web-templates/template-name/*.webtemplate.source.html
```

#### 2. Liquid Parsing Errors
**Symptoms**: Server crashes or empty output
**Causes**:
- Invalid Liquid syntax
- Missing closing tags
- Undefined variables

**Solutions**:
- Check server logs for detailed error messages
- Enable debug mode in `config/server-config.json`
- Validate Liquid syntax

#### 3. Performance Issues
**Symptoms**: Slow page loading
**Causes**:
- Template caching disabled
- Too many nested includes
- Large template files

**Solutions**:
- Enable caching in configuration
- Optimize template structure
- Use template inheritance instead of includes

### Debug Mode
Enable detailed logging:
```json
{
  "debug": true,
  "logging": {
    "level": "debug",
    "console": true
  }
}
```

## Maintenance Tasks

### Regular Maintenance

#### 1. Log Rotation
```bash
# Clear old logs
rm logs/*.log
# Or rotate logs
mv logs/server.log logs/server.log.old
```

#### 2. Cache Management
```bash
# Clear compiled templates
rm -rf compiled/*
# Restart server to rebuild cache
npm restart
```

#### 3. Dependency Updates
```bash
# Check for outdated packages
npm outdated
# Update packages
npm update
```

### Performance Monitoring

#### 1. Template Compilation Times
Monitor console output for:
- `✅ Liquid Engine initialized`
- `✅ Custom filters registered`
- `✅ Custom include tag registered`

#### 2. Memory Usage
```bash
# Monitor server memory
ps aux | grep node
# Or use built-in Node.js monitoring
node --inspect server.js
```

## Development Workflows

### Adding New Templates

1. **Create Template File**
   ```bash
   mkdir web-templates/new-template
   touch web-templates/new-template/New-Template.webtemplate.source.html
   ```

2. **Add Template Content**
   ```liquid
   <div class="new-template">
     <h1>{{ page.title }}</h1>
     <p>Hello {{ user.fullname }}!</p>
   </div>
   ```

3. **Test Template**
   ```liquid
   <!-- In another template -->
   {% include 'New Template' %}
   ```

### Extending Liquid Engine

#### Adding Custom Filters
```javascript
// In registerCustomFilters()
this.engine.registerFilter('customFilter', (input) => {
  // Custom logic here
  return processedInput;
});
```

#### Adding Custom Tags
```javascript
// In registerCustomTags()
class CustomTag extends Tag {
  constructor(token, remainTokens, liquid) {
    super(token, remainTokens, liquid);
    // Tag initialization
  }
  
  async render(ctx) {
    // Tag rendering logic
    return renderedContent;
  }
}

this.engine.registerTag('custom', CustomTag);
```

### Testing Changes

#### Unit Testing
```bash
# Run existing tests
npm test

# Add new test
touch test/liquid-engine.test.js
```

#### Integration Testing
```bash
# Start server
npm start

# Test template rendering
curl http://localhost:3000/

# Check logs
tail -f logs/server.log
```

### Code Quality

#### Linting
```bash
# Check code quality
npm run lint

# Fix auto-fixable issues
npm run lint:fix
```

#### Code Structure
- Keep functions small and focused
- Use consistent error handling
- Add comprehensive logging
- Document complex logic
- Follow existing naming conventions

## Configuration Reference

### Server Configuration (`config/server-config.json`)
```json
{
  "powerPagesPath": "/path/to/power-pages-project",
  "port": 3000,
  "host": "localhost",
  "mockApiEnabled": true,
  "hotReload": true,
  "defaultLanguage": "en-US",
  "supportedLanguages": ["en-US", "he-IL"],
  "debug": true,
  "cacheEnabled": true,
  "staticFilesPath": "web-files",
  "templatesPath": "web-templates",
  "pagesPath": "web-pages",
  "snippetsPath": "content-snippets",
  "liquidEngine": {
    "cache": true,
    "strictFilters": false,
    "strictVariables": false
  }
}
```

### Environment Variables
```bash
# Override configuration
export POWER_PAGES_PATH="/custom/path"
export PORT=4000
export DEBUG=true
```

This guide should provide you with comprehensive information for maintaining and extending the Liquid Template Server. Refer to specific sections when troubleshooting issues or implementing new features.
