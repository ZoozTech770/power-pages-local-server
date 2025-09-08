const msal = require('@azure/msal-node');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const crypto = require('crypto');

class SimpleAuthManager {
  constructor(config) {
    this.config = config;
    this.tokenCachePath = path.join(__dirname, '../config', 'token-cache.json');
    this.authConfigPath = path.join(__dirname, '../config', 'auth-config.json');
    this.msalApp = null;
    this.currentToken = null;
    this.tokenExpiresAt = null;
    
    // Microsoft's pre-registered Dynamics CRM application
    // This is the same app ID used by tools like Dataverse REST Builder, XrmToolBox, etc.
    this.DYNAMICS_CRM_APP_ID = '51f81489-12ee-4a9e-aaae-a2591f45987d'; // Well-known Microsoft app
    this.REDIRECT_URI = 'http://localhost:8080/'; // Standard redirect for public clients
  }

  async initialize() {
    try {
      // Load saved instance URL if exists
      if (await fs.pathExists(this.authConfigPath)) {
        const authConfig = await fs.readJson(this.authConfigPath);
        
        if (authConfig.instanceUrl) {
          console.log(chalk.green('✅ OAuth2 initialized'));
          console.log(chalk.blue(`📡 Instance: ${authConfig.instanceUrl}`));
          
          // Initialize MSAL with the instance
          await this.initializeMSAL(authConfig.instanceUrl);
          
          // Try to load cached token
          await this.loadCachedToken();
          
          if (this.currentToken) {
            const minutesRemaining = Math.floor((this.tokenExpiresAt - Date.now()) / 60000);
            console.log(chalk.blue(`🔐 Cached token valid for ${minutesRemaining} minutes`));
          }
        }
      } else {
        console.log(chalk.yellow('⚠️  No Dynamics instance configured'));
        console.log(chalk.gray('Run "npm run auth-setup" to configure'));
      }
    } catch (error) {
      console.error(chalk.red('❌ Failed to initialize auth:'), error);
    }
  }

  async setupInstance(instanceUrl) {
    try {
      // Parse and validate the instance URL
      const url = new URL(instanceUrl);
      
      // Determine tenant from the URL (for .dynamics.com domains)
      let tenantId = 'organizations'; // Multi-tenant by default
      
      // Save configuration
      const authConfig = {
        instanceUrl: instanceUrl,
        resource: instanceUrl,
        configuredAt: new Date().toISOString()
      };
      
      await fs.writeJson(this.authConfigPath, authConfig, { spaces: 2 });
      
      console.log(chalk.green('✅ Instance configured successfully'));
      console.log(chalk.blue(`Instance URL: ${instanceUrl}`));
      
      // Initialize MSAL
      await this.initializeMSAL(instanceUrl);
      
      return authConfig;
    } catch (error) {
      console.error(chalk.red('❌ Failed to setup instance:'), error);
      throw error;
    }
  }

  async initializeMSAL(instanceUrl) {
    // MSAL configuration using Microsoft's pre-registered app
    const msalConfig = {
      auth: {
        clientId: this.DYNAMICS_CRM_APP_ID,
        authority: 'https://login.microsoftonline.com/organizations', // Multi-tenant
        knownAuthorities: ['login.microsoftonline.com']
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

    // Create public client application
    this.msalApp = new msal.PublicClientApplication(msalConfig);
    
    // Set the resource/scope for this instance
    this.scopes = [`${instanceUrl}/.default`];
  }

  async authenticateInteractive() {
    if (!this.msalApp) {
      throw new Error('Instance not configured. Run setup first.');
    }

    console.log(chalk.blue('🌐 Starting authentication...'));
    
    try {
      // Use device code flow (most compatible)
      const deviceCodeRequest = {
        scopes: this.scopes,
        deviceCodeCallback: (response) => {
          console.log(chalk.yellow('\n📱 Device Code Authentication'));
          console.log(chalk.yellow('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
          console.log(chalk.white.bold(`\n1. Visit: ${response.verificationUri}`));
          console.log(chalk.white.bold(`2. Enter code: ${response.userCode}\n`));
          console.log(chalk.gray('Waiting for authentication...'));
          
          // Try to open browser
          import('open').then(module => {
            module.default(response.verificationUri).catch(() => {
              console.log(chalk.gray('(Could not open browser automatically)'));
            });
          });
        }
      };
      
      const authResult = await this.msalApp.acquireTokenByDeviceCode(deviceCodeRequest);
      
      if (authResult) {
        await this.saveToken(authResult);
        console.log(chalk.green('\n✅ Authentication successful!'));
        console.log(chalk.gray(`Logged in as: ${authResult.account?.username || 'User'}`));
        return authResult;
      }
    } catch (error) {
      if (error.errorCode === 'authorization_pending') {
        console.log(chalk.yellow('⏱️  Waiting for user to complete authentication...'));
      } else if (error.errorCode === 'expired_token') {
        console.log(chalk.red('❌ Authentication code expired. Please try again.'));
      } else {
        console.error(chalk.red('❌ Authentication failed:'), error.message);
      }
      throw error;
    }
  }

  async acquireTokenSilent() {
    if (!this.msalApp || !this.currentToken) {
      return null;
    }

    try {
      // Get all accounts
      const accounts = await this.msalApp.getTokenCache().getAllAccounts();
      
      if (accounts.length === 0) {
        return null;
      }
      
      const silentRequest = {
        account: accounts[0], // Use first account
        scopes: this.scopes,
        forceRefresh: false
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
      this.tokenExpiresAt = tokenResponse.expiresOn ? tokenResponse.expiresOn.getTime() : 
                            Date.now() + (tokenResponse.expiresIn * 1000);
      
      // Cache the token
      const tokenCache = {
        accessToken: tokenResponse.accessToken,
        expiresOn: new Date(this.tokenExpiresAt).toISOString(),
        account: tokenResponse.account,
        scopes: tokenResponse.scopes || this.scopes,
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

  // Check if authentication is configured
  isConfigured() {
    return this.msalApp !== null;
  }

  async isAuthenticated() {
    if (!this.isConfigured()) {
      return false;
    }
    
    // Check if we have a valid token
    if (this.currentToken && this.tokenExpiresAt > Date.now() + 300000) {
      return true;
    }
    
    // Try to refresh silently
    const result = await this.acquireTokenSilent();
    return result !== null;
  }

  async getInstanceUrl() {
    if (await fs.pathExists(this.authConfigPath)) {
      const config = await fs.readJson(this.authConfigPath);
      return config.instanceUrl;
    }
    return null;
  }
}

module.exports = SimpleAuthManager;
