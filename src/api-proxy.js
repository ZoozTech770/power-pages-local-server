const axios = require('axios');
const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');

class ApiProxy {
  constructor(config, authManager = null) {
    this.config = config;
    this.proxyConfig = null;
    this.authManager = authManager; // OAuth2 auth manager
    this.useOAuth = false; // Will be determined during initialization
    // Initialize will be called explicitly
  }

  async initialize() {
    try {
      // Check if OAuth2 is configured and available
      if (this.authManager && this.authManager.isConfigured()) {
        this.useOAuth = true;
        console.log(chalk.green('✅ API Proxy initialized with OAuth2'));
        console.log(chalk.blue('🔐 Authentication: OAuth2 Bearer token'));
        
        // Still load legacy config for base URL if available
        if (this.config.apiProxy && this.config.apiProxy.enabled) {
          const configPath = path.join(__dirname, '../config', this.config.apiProxy.configFile);
          if (await fs.pathExists(configPath)) {
            this.proxyConfig = await fs.readJson(configPath);
            console.log(chalk.blue(`📡 Base URL: ${this.proxyConfig.baseUrl}`));
          }
        }
      } else if (this.config.apiProxy && this.config.apiProxy.enabled) {
        // Fall back to legacy authentication
        const configPath = path.join(__dirname, '../config', this.config.apiProxy.configFile);
        if (await fs.pathExists(configPath)) {
          this.proxyConfig = await fs.readJson(configPath);
          console.log(chalk.green('✅ API Proxy initialized (legacy mode)'));
          console.log(chalk.blue(`📡 Base URL: ${this.proxyConfig.baseUrl}`));
          
          // Log authentication method
          if (this.proxyConfig.useAuthorizationHeader) {
            console.log(chalk.blue('🔐 Authentication: Bearer token (legacy)'));
          } else {
            console.log(chalk.blue('🍪 Authentication: Cookies'));
          }
          console.log(chalk.yellow('⚠️  Consider setting up OAuth2 for better security'));
          console.log(chalk.gray('   Run "npm run auth-setup" to configure OAuth2'));
        } else {
          console.warn(chalk.yellow('⚠️ API proxy config file not found'));
        }
      }
    } catch (error) {
      console.error(chalk.red('❌ Failed to initialize API proxy:'), error);
    }
  }

  isEnabled() {
    return this.useOAuth || (this.proxyConfig && this.proxyConfig.enabled);
  }

  async proxyRequest(req, res) {
    if (!this.isEnabled()) {
      return res.status(503).json({ error: 'API proxy is not enabled' });
    }

    try {
      let targetUrl;
      let headers = {};
      
      // Use OAuth2 if available
      if (this.useOAuth && this.authManager) {
        try {
          // Check if authenticated
          if (!await this.authManager.isAuthenticated()) {
            console.log(chalk.yellow('⚠️  Not authenticated. Please authenticate first.'));
            return res.status(401).json({ 
              error: 'Authentication required',
              authUrl: '/auth'
            });
          }
          
          // Get OAuth headers
          const authHeaders = await this.authManager.getAuthHeaders();
          headers = { ...authHeaders };
          
          // Note: Dataverse API only needs OAuth2 Bearer token
          // RequestVerificationToken is not required (proven by REST Builder extension)
          
          // Get base URL from auth config or legacy config
          const authConfig = await fs.readJson(this.authManager.authConfigPath).catch(() => null);
          const baseUrl = authConfig?.instanceUrl || authConfig?.powerPagesUrl || this.proxyConfig?.baseUrl || '';
          
          // For Dataverse API calls, we need to add /api/data/v9.2 prefix
          // Check if this is an _api request (Dataverse OData)
          if (req.baseUrl === '/_api' || req.originalUrl.startsWith('/_api')) {
            targetUrl = baseUrl + '/api/data/v9.2' + req.url;
          } else {
            targetUrl = baseUrl + req.url;
          }
          
          console.log(chalk.blue('🔐 Using OAuth2 Bearer token for authentication'));
        } catch (error) {
          console.error(chalk.red('❌ OAuth2 authentication failed:'), error);
          return res.status(401).json({ 
            error: 'OAuth2 authentication failed',
            details: error.message
          });
        }
      } else if (this.proxyConfig) {
        // Fall back to legacy authentication
        targetUrl = this.proxyConfig.baseUrl + req.url;
        
        // Prepare headers
        headers = {
          'User-Agent': req.headers['user-agent'] || this.proxyConfig.headers['User-Agent']
        };

        if (this.proxyConfig.useAuthorizationHeader) {
          headers['Authorization'] = this.proxyConfig.headers['Authorization'];
          console.log(chalk.blue('🔐 Using Authorization header for authentication (legacy)'));
        } else {
          headers['Cookie'] = this.proxyConfig.headers['Cookie'];
          console.log(chalk.blue('🍪 Using Cookie header for authentication'));
        }

        // Add RequestVerificationToken if available
        if (this.proxyConfig.headers['__RequestVerificationToken']) {
          headers['__RequestVerificationToken'] = this.proxyConfig.headers['__RequestVerificationToken'];
          console.log(chalk.blue('🔒 Including RequestVerificationToken for CSRF protection'));
        }

        // Copy other configured headers
        Object.keys(this.proxyConfig.headers).forEach(key => {
          if (!['Authorization', 'Cookie', '__RequestVerificationToken', 'User-Agent'].includes(key)) {
            headers[key] = this.proxyConfig.headers[key];
          }
        });
      } else {
        return res.status(503).json({ error: 'No proxy configuration available' });
      }

      // Use exact headers from Dataverse REST Builder extension
      const dataverseHeaders = {
        'Accept': 'application/json',
        'Content-Type': 'application/json; charset=utf-8',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0', 
        'Prefer': 'odata.include-annotations=*'
      };
      
      // Merge Dataverse headers with auth headers
      headers = { ...headers, ...dataverseHeaders };

      console.log(chalk.blue(`🔀 Proxying ${req.method} ${req.url} to ${targetUrl}`));

      const response = await axios({
        method: req.method,
        url: targetUrl,
        headers: headers,
        data: req.body,
        timeout: 30000,
        validateStatus: () => true // Don't throw on HTTP error status codes
      });

      // Forward response headers
      Object.keys(response.headers).forEach(key => {
        if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(key.toLowerCase())) {
          res.setHeader(key, response.headers[key]);
        }
      });

      // Log response status for debugging
      if (response.status >= 400) {
        console.log(chalk.red(`❌ API Response Error: ${response.status} ${response.statusText}`));
        console.log(chalk.yellow(`Response data: ${JSON.stringify(response.data, null, 2)}`));
      } else {
        console.log(chalk.green(`✅ API Response Success: ${response.status}`));
        // Debug: Log the structure of successful responses
        if (response.data && response.data.value) {
          console.log(chalk.gray(`   Returned ${response.data.value.length} records`));
        }
      }
      
      // Ensure we're sending JSON response properly
      if (typeof response.data === 'object') {
        res.status(response.status).json(response.data);
      } else {
        res.status(response.status).send(response.data);
      }
      
    } catch (error) {
      console.error(chalk.red('❌ API proxy error:'), error.message);
      
      if (error.code === 'ECONNREFUSED') {
        return res.status(503).json({ error: 'Backend server is not available' });
      }
      
      if (error.response) {
        return res.status(error.response.status).json({
          error: 'Proxy request failed',
          details: error.response.data
        });
      }
      
      res.status(500).json({ error: 'Internal proxy error' });
    }
  }

  // Handle specific Power Pages API endpoints
  setupProxyRoutes(app) {
    if (!this.isEnabled()) {
      console.log(chalk.yellow('⚠️ API proxy is disabled, skipping route setup'));
      return;
    }

    // Proxy all _api requests (Power Pages OData API)
    // Use middleware style (app.use) instead of route handler (app.all) to respect middleware order
    app.use('/_api', (req, res, next) => {
      // Check if this was already handled by mock middleware
      // If response was already sent, don't proxy
      if (res.headersSent) {
        return;
      }
      
      console.log(chalk.blue(`🔀 Proxying _api request: ${req.method} ${req.url}`));
      this.proxyRequest(req, res);
    });

    // Proxy all /api requests (general API)
    app.use('/api', (req, res, next) => {
      // Check if this was already handled by mock middleware
      // If response was already sent, don't proxy
      if (res.headersSent) {
        return;
      }
      
      console.log(chalk.blue(`🔀 Proxying api request: ${req.method} ${req.url}`));
      this.proxyRequest(req, res);
    });

    console.log(chalk.green('✅ API proxy routes configured'));
  }
}

module.exports = ApiProxy;
