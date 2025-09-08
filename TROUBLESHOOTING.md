# Troubleshooting Quick Reference

## ⚠️ Important Development Rule

**NEVER MODIFY POWER PAGES PROJECT FILES TO FIX BUGS**

- **Rule**: All bug fixes must be implemented in the local server engine only
- **Power Pages files are read-only**: Never edit files in the Power Pages project directory
- **Engine-only changes**: Modifications should only be made to files in:
  - `src/` directory (liquid-engine.js, page-handler.js, template-handler.js, etc.)
  - `config/` directory
  - Server configuration files
- **Rationale**: 
  - Maintains compatibility with the original Power Pages project
  - Allows the same project to work both locally and in production
  - Prevents conflicts when syncing with the actual Power Pages environment
  - Ensures the local server adapts to the project, not vice versa

**Example**: If React components have dependency issues (like `MyToolbar not defined`), fix it by:
- ✅ Adjusting template rendering order in `page-handler.js`
- ✅ Modifying function processing in `liquid-engine.js`
- ❌ Never reordering functions in the Power Pages template files

---

## Common Issues & Solutions

### 🔍 Include Not Found Errors

**Error**: `<!-- Include not found: Template Name -->`

**Quick Fixes**:
```bash
# 1. Check if template exists
ls "web-templates/template-name/"

# 2. Verify file naming pattern
find web-templates/ -name "*.webtemplate.source.html"

# 3. Check content-snippets as fallback
ls "content-snippets/template-name/"
```

**Template Name Conversion**:
- `"Global React Components"` → `"global-react-components"`
- Spaces become hyphens
- Lowercase conversion

### 🚫 Server Won't Start

**Error**: `EADDRINUSE: address already in use`

**Quick Fixes**:
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm start
```

**Error**: `Cannot find module`

**Quick Fixes**:
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### 🔧 Liquid Parsing Errors

**Error**: `Liquid render error: unexpected token`

**Quick Fixes**:
1. Check for unmatched `{% %}` tags
2. Verify variable syntax `{{ variable }}`
3. Look for missing `{% endif %}` or `{% endfor %}`

**Enable Debug Mode**:
```json
// In config/server-config.json
{
  "debug": true,
  "logging": {
    "level": "debug",
    "console": true
  }
}
```

### 📁 File Not Found

**Error**: `ENOENT: no such file or directory`

**Quick Fixes**:
```bash
# Check Power Pages path
ls "/Users/itzharmordechai/Documents/ZoozTech/pikud-oref-posions/oref---oref-dev"

# Verify directory structure
ls web-templates/
ls content-snippets/
ls web-pages/
```

### 🔄 Changes Not Reflected

**Issue**: Template changes not showing

**Quick Fixes**:
```bash
# Clear cache and restart
rm -rf compiled/
npm restart

# Or disable cache temporarily
```

```json
// In config/server-config.json
{
  "liquidEngine": {
    "cache": false
  }
}
```

### 📊 Performance Issues

**Issue**: Slow page loading

**Quick Fixes**:
1. Enable caching in config
2. Check for circular includes
3. Optimize template size
4. Monitor memory usage: `ps aux | grep node`

### 🌐 Multi-language Issues

**Issue**: Wrong language content

**Quick Fixes**:
```bash
# Check language files exist
ls web-pages/*/content-pages/*.he-IL.*
ls web-pages/*/content-pages/*.en-US.*

# Test language switching
curl "http://localhost:3000/?lang=he-IL"
```

### 🔗 API Proxy Issues

**Issue**: API requests failing with 401/403 errors or mock tokens

**Symptoms**:
- Local requests show `mock-token-xxx` instead of real tokens
- API responses return authentication errors
- Proxy requests go to wrong base URL

**Root Cause**: The `init.js` script didn't properly update `config/api-proxy.json`

**Quick Fixes**:
```bash
# 1. Check current API proxy config
cat config/api-proxy.json

# 2. Verify base URL matches your actual Power Pages site
# Should be: https://your-actual-site.powerappsportals.com
# NOT: https://old-site.powerappsportals.com

# 3. Re-run initialization with correct cURL
npm run init
```

**Manual Fix**:
```json
// In config/api-proxy.json
{
  "enabled": true,
  "baseUrl": "https://your-actual-site.powerappsportals.com",
  "headers": {
    "Accept": "*/*",
    "Content-Type": "application/json",
    "Cookie": "YOUR_REAL_COOKIES_HERE",
    "__RequestVerificationToken": "YOUR_REAL_TOKEN_HERE",
    "Prefer": "odata.include-annotations=*",
    "X-Requested-With": "XMLHttpRequest"
  },
  "useAuthorizationHeader": false
}
```

**Getting Fresh Authentication**:
1. Open your actual Power Pages site in browser
2. Open Developer Tools (F12) → Network tab
3. Make any API request (refresh page, click something)
4. Right-click on API request → Copy → Copy as cURL
5. Run `npm run init` and paste the fresh cURL

## Debug Commands

### Check Server Status
```bash
# View running processes
ps aux | grep node

# Check port usage
lsof -i :3000

# View logs
tail -f logs/server.log
```

### Test Template Resolution
```bash
# Test specific template
curl -v "http://localhost:3000/api/template/test"

# Check snippet rendering
curl -v "http://localhost:3000/api/snippet/test"
```

### File System Checks
```bash
# Check permissions
ls -la web-templates/
ls -la content-snippets/

# Find all template files
find . -name "*.webtemplate.source.html"
find . -name "*.contentsnippet.html"
```

## Emergency Procedures

### Complete Reset
```bash
# Stop server
pkill -f "node.*server.js"

# Clear everything
rm -rf node_modules/
rm -rf compiled/
rm -rf logs/
rm package-lock.json

# Reinstall
npm install
npm start
```

### Backup & Restore
```bash
# Create backup
tar -czf backup-$(date +%Y%m%d).tar.gz config/ src/ mock-data/

# Restore from backup
tar -xzf backup-YYYYMMDD.tar.gz
```

## Error Code Reference

| Code | Description | Solution |
|------|-------------|----------|
| `EADDRINUSE` | Port already in use | Kill process or use different port |
| `ENOENT` | File not found | Check file paths and permissions |
| `EACCES` | Permission denied | Check file/directory permissions |
| `MODULE_NOT_FOUND` | Missing dependency | Run `npm install` |
| `LIQUID_PARSE_ERROR` | Invalid Liquid syntax | Check template syntax |

## Log Analysis

### Important Log Messages
- `✅ Liquid Engine initialized` - Engine started successfully
- `❌ Include processing error` - Template include failed
- `❌ Liquid render error` - Template parsing failed
- `✅ Server started on port 3000` - Server ready

### Log Locations
- Console output (if enabled)
- `logs/server.log`
- `logs/error.log`

## Contact & Support

For complex issues, include:
1. Error message
2. Server logs
3. Template content
4. Configuration file
5. Steps to reproduce

---

**Quick Start Checklist**:
1. ✅ Node.js installed
2. ✅ Dependencies installed (`npm install`)
3. ✅ Config file updated
4. ✅ Power Pages path exists
5. ✅ Port 3000 available
6. ✅ Start server (`npm start`)
