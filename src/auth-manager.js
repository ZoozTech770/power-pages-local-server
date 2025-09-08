const msal = require('@azure/msal-node');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const crypto = require('crypto');
// open is an ESM module, we'll load it dynamically when needed

class AuthManager {
  constructor(config) {
    this.config = config;
    this.tokenCachePath = path.join(__dirname, '../config', 'token-cache.json');
    this.authConfigPath = path.join(__dirname, '../config', 'auth-config.json');
    this.msalApp = null;
    this.currentToken = null;
    this.tokenExpiresAt = null;
    
    // Default Dataverse/Power Pages OAuth settings
    this.defaultAuthConfig = {
      clientId: null, // Will be set during setup
      tenantId: null, // Will be set during setup
      redirectUri: 'http://localhost:3000/auth/callback',
      authority: null, // Will be constructed from tenantId
      scopes: null // Will be set based on Power Pages URL
    };
  }

  async initialize() {
    try {
      // Load auth configuration if it exists
      if (await fs.pathExists(this.authConfigPath)) {
        const authConfig = await fs.readJson(this.authConfigPath);
        this.defaultAuthConfig = { ...this.defaultAuthConfig, ...authConfig };
        
        // Initialize MSAL if we have configuration
        if (authConfig.clientId && authConfig.tenantId) {
          this.initializeMSAL(authConfig);
          
          // Try to load cached token
          await this.loadCachedToken();
          
          console.log(chalk.green('✅ OAuth2 authentication initialized'));
          if (this.currentToken) {
            const minutesRemaining = Math.floor((this.tokenExpiresAt - Date.now()) / 60000);
            console.log(chalk.blue(`🔐 Cached token valid for ${minutesRemaining} minutes`));
          }
        }
      } else {
        console.log(chalk.yellow('⚠️  OAuth2 authentication not configured'));
        console.log(chalk.gray('Run "npm run auth-setup" to configure OAuth2 authentication'));
      }
    } catch (error) {
      console.error(chalk.red('❌ Failed to initialize auth manager:'), error);
    }
  }

  initializeMSAL(authConfig) {
    // MSAL configuration
    const msalConfig = {
      auth: {
        clientId: authConfig.clientId,
        authority: authConfig.authority || `https://login.microsoftonline.com/${authConfig.tenantId}`,
        clientSecret: authConfig.clientSecret // Optional, for confidential client
      },
      system: {
        loggerOptions: {
          loggerCallback(loglevel, message, containsPii) {
            if (!containsPii && loglevel === msal.LogLevel.Error) {
              console.error(chalk.red('MSAL Error:'), message);
            }
          },
          piiLoggingEnabled: false,
          logLevel: msal.LogLevel.Warning
        }
      }
    };

    // Create MSAL application instance
    if (authConfig.clientSecret) {
      // Confidential client (with secret)
      this.msalApp = new msal.ConfidentialClientApplication(msalConfig);
    } else {
      // Public client (device code flow)
      this.msalApp = new msal.PublicClientApplication(msalConfig);
    }
  }

  async setupOAuth(powerPagesUrl) {
    console.log(chalk.blue('🔐 Setting up OAuth2 authentication for Power Pages'));
    
    try {
      // Parse the Power Pages URL to get the organization
      const url = new URL(powerPagesUrl);
      const hostname = url.hostname;
      
      // Determine the resource/scope based on the URL
      // For Power Pages, we typically need Dataverse API access
      let scopes;
      if (hostname.includes('.powerappsportals.com')) {
        // Extract the environment URL for Dataverse
        const envMatch = hostname.match(/([^.]+)\.powerappsportals\.com/);
        if (envMatch) {
          // Construct Dataverse URL from Power Pages URL
          // This is an approximation - may need adjustment based on actual environment
          scopes = [`https://${envMatch[1]}.api.crm.dynamics.com/.default`];
        }
      } else if (hostname.includes('.dynamics.com')) {
        scopes = [`https://${hostname}/.default`];
      } else {
        // Custom domain - will need manual configuration
        scopes = [`${powerPagesUrl}/.default`];
      }

      // Prompt for Azure AD app registration details
      console.log(chalk.yellow('\n📋 Azure AD App Registration Required'));
      console.log(chalk.gray('You need to register an app in Azure AD to use OAuth2 authentication.'));
      console.log(chalk.gray('Visit: https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade'));
      console.log(chalk.gray('\nSteps:'));
      console.log(chalk.gray('1. Create a new app registration'));
      console.log(chalk.gray('2. Add "http://localhost:3000/auth/callback" as a redirect URI (Web platform)'));
      console.log(chalk.gray('3. Grant API permissions for Dynamics CRM (user_impersonation)'));
      console.log(chalk.gray('4. Note the Application (client) ID and Directory (tenant) ID'));
      console.log(chalk.gray('5. Optionally create a client secret for server-side auth\n'));

      // For now, we'll create a configuration template
      const authConfig = {
        clientId: 'YOUR_CLIENT_ID_HERE',
        tenantId: 'YOUR_TENANT_ID_HERE',
        clientSecret: null, // Optional
        redirectUri: 'http://localhost:3000/auth/callback',
        authority: null, // Will be set based on tenantId
        scopes: scopes,
        powerPagesUrl: powerPagesUrl,
        configuredAt: new Date().toISOString()
      };

      // Save the configuration template
      await fs.writeJson(this.authConfigPath, authConfig, { spaces: 2 });
      
      console.log(chalk.green('\n✅ OAuth2 configuration template created'));
      console.log(chalk.yellow(`📝 Edit ${this.authConfigPath} with your Azure AD app details`));
      console.log(chalk.blue('\nConfiguration template saved with:'));
      console.log(chalk.gray(`  Scopes: ${scopes.join(', ')}`));
      console.log(chalk.gray(`  Redirect URI: ${authConfig.redirectUri}`));
      
      return authConfig;
    } catch (error) {
      console.error(chalk.red('❌ OAuth2 setup failed:'), error);
      throw error;
    }
  }

  async authenticateInteractive() {
    if (!this.msalApp) {
      throw new Error('MSAL not initialized. Run auth setup first.');
    }

    console.log(chalk.blue('🌐 Opening browser for authentication...'));
    
    try {
      let authResult;
      
      if (this.msalApp instanceof msal.PublicClientApplication) {
        // Use device code flow for public client
        const deviceCodeRequest = {
          scopes: this.defaultAuthConfig.scopes,
          deviceCodeCallback: (response) => {
            console.log(chalk.yellow('\n📱 Device Code Authentication'));
            console.log(chalk.gray(`Visit: ${response.verificationUri}`));
            console.log(chalk.blue(`Code: ${response.userCode}`));
            console.log(chalk.gray('\nOpening browser...'));
            import('open').then(module => module.default(response.verificationUri));
          }
        };
        
        authResult = await this.msalApp.acquireTokenByDeviceCode(deviceCodeRequest);
      } else {
        // Use auth code flow for confidential client
        const authCodeUrlParameters = {
          scopes: this.defaultAuthConfig.scopes,
          redirectUri: this.defaultAuthConfig.redirectUri,
          state: crypto.randomBytes(16).toString('hex')
        };
        
        const authUrl = await this.msalApp.getAuthCodeUrl(authCodeUrlParameters);
        console.log(chalk.gray(`Opening: ${authUrl}`));
        const open = await import('open');
        await open.default(authUrl);
        
        // Note: In a real implementation, you'd need to set up an Express route
        // to handle the callback and exchange the code for a token
        console.log(chalk.yellow('\n⚠️  Complete authentication in browser'));
        console.log(chalk.gray('The server will capture the token when you\'re redirected back'));
      }
      
      if (authResult) {
        await this.saveToken(authResult);
        console.log(chalk.green('✅ Authentication successful!'));
        return authResult;
      }
    } catch (error) {
      console.error(chalk.red('❌ Authentication failed:'), error);
      throw error;
    }
  }

  async acquireTokenSilent() {
    if (!this.msalApp || !this.currentToken) {
      return null;
    }

    try {
      const silentRequest = {
        account: this.currentToken.account,
        scopes: this.defaultAuthConfig.scopes
      };
      
      const result = await this.msalApp.acquireTokenSilent(silentRequest);
      await this.saveToken(result);
      return result;
    } catch (error) {
      console.log(chalk.yellow('⚠️  Silent token refresh failed, interactive auth required'));
      return null;
    }
  }

  async getValidToken() {
    // Check if we have a valid cached token
    if (this.currentToken && this.tokenExpiresAt > Date.now() + 300000) { // 5 min buffer
      return this.currentToken.accessToken;
    }

    console.log(chalk.yellow('🔄 Token expired or expiring soon, refreshing...'));
    
    // Try silent refresh first
    const silentResult = await this.acquireTokenSilent();
    if (silentResult) {
      return silentResult.accessToken;
    }
    
    // Fall back to interactive authentication
    const interactiveResult = await this.authenticateInteractive();
    return interactiveResult ? interactiveResult.accessToken : null;
  }

  async saveToken(tokenResponse) {
    try {
      this.currentToken = tokenResponse;
      this.tokenExpiresAt = tokenResponse.expiresOn.getTime();
      
      // Cache the token securely
      const tokenCache = {
        accessToken: tokenResponse.accessToken,
        expiresOn: tokenResponse.expiresOn.toISOString(),
        account: tokenResponse.account,
        scopes: tokenResponse.scopes,
        cachedAt: new Date().toISOString()
      };
      
      await fs.writeJson(this.tokenCachePath, tokenCache, { spaces: 2 });
      
      const hoursValid = Math.floor((this.tokenExpiresAt - Date.now()) / 3600000);
      console.log(chalk.green(`✅ Token cached (valid for ~${hoursValid} hours)`));
    } catch (error) {
      console.error(chalk.red('❌ Failed to save token:'), error);
    }
  }

  async loadCachedToken() {
    try {
      if (await fs.pathExists(this.tokenCachePath)) {
        const tokenCache = await fs.readJson(this.tokenCachePath);
        const expiresOn = new Date(tokenCache.expiresOn);
        
        // Check if token is still valid (with 5 min buffer)
        if (expiresOn.getTime() > Date.now() + 300000) {
          this.currentToken = {
            accessToken: tokenCache.accessToken,
            expiresOn: expiresOn,
            account: tokenCache.account,
            scopes: tokenCache.scopes
          };
          this.tokenExpiresAt = expiresOn.getTime();
          return true;
        } else {
          console.log(chalk.yellow('⚠️  Cached token expired'));
          await fs.remove(this.tokenCachePath);
        }
      }
    } catch (error) {
      console.error(chalk.red('❌ Failed to load cached token:'), error);
    }
    return false;
  }

  async clearTokenCache() {
    try {
      await fs.remove(this.tokenCachePath);
      this.currentToken = null;
      this.tokenExpiresAt = null;
      console.log(chalk.green('✅ Token cache cleared'));
    } catch (error) {
      console.error(chalk.red('❌ Failed to clear token cache:'), error);
    }
  }

  // Get headers for API requests
  async getAuthHeaders() {
    const token = await this.getValidToken();
    if (!token) {
      throw new Error('No valid authentication token available');
    }
    
    return {
      'Authorization': `Bearer ${token}`,
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
      'Accept': 'application/json',
      'Content-Type': 'application/json; charset=utf-8',
      'Prefer': 'odata.include-annotations="*"'
    };
  }

  // Check if authentication is configured and valid
  isConfigured() {
    return this.msalApp !== null && this.defaultAuthConfig.clientId !== 'YOUR_CLIENT_ID_HERE';
  }

  async isAuthenticated() {
    if (!this.isConfigured()) {
      return false;
    }
    
    // Check if we have a valid token or can get one silently
    if (this.currentToken && this.tokenExpiresAt > Date.now() + 300000) {
      return true;
    }
    
    // Try to refresh silently
    const result = await this.acquireTokenSilent();
    return result !== null;
  }
}

module.exports = AuthManager;
