#!/usr/bin/env node

const inquirer = require('inquirer');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
// open is an ESM module, we'll load it dynamically when needed

class AuthSetupCLI {
  constructor() {
    this.authConfigPath = path.join(__dirname, '../config', 'auth-config.json');
    this.tokenCachePath = path.join(__dirname, '../config', 'token-cache.json');
  }

  async run() {
    console.log(chalk.blue.bold('\n🔐 Power Pages OAuth2 Authentication Setup\n'));
    
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: '🆕 Configure OAuth2 for the first time', value: 'setup' },
          { name: '✏️  Update existing OAuth2 configuration', value: 'update' },
          { name: '🔍 Check authentication status', value: 'status' },
          { name: '🔄 Refresh authentication token', value: 'refresh' },
          { name: '🗑️  Clear cached authentication', value: 'clear' },
          { name: '📚 View setup instructions', value: 'instructions' },
          { name: '❌ Exit', value: 'exit' }
        ]
      }
    ]);

    switch (action) {
      case 'setup':
        await this.setupOAuth();
        break;
      case 'update':
        await this.updateOAuth();
        break;
      case 'status':
        await this.checkStatus();
        break;
      case 'refresh':
        await this.refreshToken();
        break;
      case 'clear':
        await this.clearAuth();
        break;
      case 'instructions':
        await this.showInstructions();
        break;
      case 'exit':
        console.log(chalk.gray('Goodbye! 👋'));
        process.exit(0);
    }

    // Ask if user wants to do something else
    const { continue: cont } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'continue',
        message: 'Would you like to do something else?',
        default: false
      }
    ]);

    if (cont) {
      await this.run();
    }
  }

  async setupOAuth() {
    console.log(chalk.yellow('\n📋 OAuth2 Configuration Setup'));
    console.log(chalk.gray('You\'ll need to register an app in Azure AD first.\n'));

    const { hasApp } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'hasApp',
        message: 'Have you already registered an app in Azure AD?',
        default: false
      }
    ]);

    if (!hasApp) {
      await this.showInstructions();
      console.log(chalk.yellow('\n👆 Complete these steps first, then run this setup again.\n'));
      return;
    }

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'powerPagesUrl',
        message: 'Enter your Power Pages URL:',
        default: 'https://your-site.powerappsportals.com',
        validate: (input) => {
          try {
            new URL(input);
            return true;
          } catch {
            return 'Please enter a valid URL';
          }
        }
      },
      {
        type: 'input',
        name: 'clientId',
        message: 'Enter your Azure AD App Client ID (Application ID):',
        validate: (input) => {
          const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          return guidRegex.test(input) || 'Please enter a valid GUID';
        }
      },
      {
        type: 'input',
        name: 'tenantId',
        message: 'Enter your Azure AD Tenant ID:',
        validate: (input) => {
          const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          return guidRegex.test(input) || input.includes('.') || 'Please enter a valid Tenant ID';
        }
      },
      {
        type: 'confirm',
        name: 'hasSecret',
        message: 'Do you have a client secret? (for server-side auth)',
        default: false
      }
    ]);

    if (answers.hasSecret) {
      const { clientSecret } = await inquirer.prompt([
        {
          type: 'password',
          name: 'clientSecret',
          message: 'Enter your client secret:',
          mask: '*'
        }
      ]);
      answers.clientSecret = clientSecret;
    }

    // Determine scopes based on Power Pages URL
    let scopes;
    const url = new URL(answers.powerPagesUrl);
    const hostname = url.hostname;
    
    if (hostname.includes('.powerappsportals.com')) {
      const envMatch = hostname.match(/([^.]+)\.powerappsportals\.com/);
      if (envMatch) {
        // Try to determine the Dataverse URL
        const { region } = await inquirer.prompt([
          {
            type: 'list',
            name: 'region',
            message: 'Select your Dataverse region:',
            choices: [
              { name: 'North America', value: 'crm' },
              { name: 'Europe', value: 'crm4' },
              { name: 'Asia Pacific', value: 'crm5' },
              { name: 'Australia', value: 'crm6' },
              { name: 'Japan', value: 'crm7' },
              { name: 'India', value: 'crm8' },
              { name: 'Canada', value: 'crm3' },
              { name: 'United Kingdom', value: 'crm11' },
              { name: 'France', value: 'crm12' }
            ],
            default: 'crm'
          }
        ]);
        scopes = [`https://${envMatch[1]}.api.${region}.dynamics.com/.default`];
      }
    } else if (hostname.includes('.dynamics.com')) {
      scopes = [`https://${hostname}/.default`];
    } else {
      // Custom domain
      const { dataverseUrl } = await inquirer.prompt([
        {
          type: 'input',
          name: 'dataverseUrl',
          message: 'Enter your Dataverse environment URL:',
          default: 'https://org.crm.dynamics.com',
          validate: (input) => {
            try {
              new URL(input);
              return true;
            } catch {
              return 'Please enter a valid URL';
            }
          }
        }
      ]);
      scopes = [`${dataverseUrl}/.default`];
    }

    const authConfig = {
      clientId: answers.clientId,
      tenantId: answers.tenantId,
      clientSecret: answers.clientSecret || null,
      redirectUri: 'http://localhost:3000/auth/callback',
      authority: `https://login.microsoftonline.com/${answers.tenantId}`,
      scopes: scopes,
      powerPagesUrl: answers.powerPagesUrl,
      configuredAt: new Date().toISOString()
    };

    await fs.writeJson(this.authConfigPath, authConfig, { spaces: 2 });
    
    console.log(chalk.green('\n✅ OAuth2 configuration saved successfully!'));
    console.log(chalk.blue('\nConfiguration details:'));
    console.log(chalk.gray(`  Client ID: ${authConfig.clientId}`));
    console.log(chalk.gray(`  Tenant ID: ${authConfig.tenantId}`));
    console.log(chalk.gray(`  Scopes: ${authConfig.scopes.join(', ')}`));
    console.log(chalk.gray(`  Redirect URI: ${authConfig.redirectUri}`));
    
    console.log(chalk.yellow('\n📝 Next steps:'));
    console.log(chalk.gray('1. Start the server: npm start'));
    console.log(chalk.gray('2. Navigate to: http://localhost:3000/auth'));
    console.log(chalk.gray('3. Click "Authenticate with Microsoft"'));
    console.log(chalk.gray('4. Complete the authentication flow'));
  }

  async updateOAuth() {
    if (!await fs.pathExists(this.authConfigPath)) {
      console.log(chalk.red('❌ No OAuth2 configuration found.'));
      console.log(chalk.yellow('Run setup first to create a configuration.'));
      return;
    }

    const currentConfig = await fs.readJson(this.authConfigPath);
    console.log(chalk.blue('\n📋 Current Configuration:'));
    console.log(chalk.gray(`  Client ID: ${currentConfig.clientId}`));
    console.log(chalk.gray(`  Tenant ID: ${currentConfig.tenantId}`));
    console.log(chalk.gray(`  Power Pages URL: ${currentConfig.powerPagesUrl}`));
    console.log(chalk.gray(`  Has Secret: ${!!currentConfig.clientSecret}`));

    const { fields } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'fields',
        message: 'Select fields to update:',
        choices: [
          { name: 'Client ID', value: 'clientId' },
          { name: 'Tenant ID', value: 'tenantId' },
          { name: 'Client Secret', value: 'clientSecret' },
          { name: 'Power Pages URL', value: 'powerPagesUrl' }
        ]
      }
    ]);

    const updates = {};
    for (const field of fields) {
      if (field === 'clientSecret') {
        const { hasSecret } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'hasSecret',
            message: 'Do you want to set a client secret?',
            default: !!currentConfig.clientSecret
          }
        ]);
        if (hasSecret) {
          const { value } = await inquirer.prompt([
            {
              type: 'password',
              name: 'value',
              message: 'Enter new client secret:',
              mask: '*'
            }
          ]);
          updates.clientSecret = value;
        } else {
          updates.clientSecret = null;
        }
      } else {
        const { value } = await inquirer.prompt([
          {
            type: 'input',
            name: 'value',
            message: `Enter new ${field}:`,
            default: currentConfig[field]
          }
        ]);
        updates[field] = value;
      }
    }

    const updatedConfig = { ...currentConfig, ...updates, updatedAt: new Date().toISOString() };
    await fs.writeJson(this.authConfigPath, updatedConfig, { spaces: 2 });
    
    console.log(chalk.green('✅ Configuration updated successfully!'));
  }

  async checkStatus() {
    console.log(chalk.blue('\n🔍 Authentication Status\n'));

    // Check configuration
    if (!await fs.pathExists(this.authConfigPath)) {
      console.log(chalk.red('❌ OAuth2 not configured'));
      console.log(chalk.gray('   Run setup to configure OAuth2'));
      return;
    }

    const config = await fs.readJson(this.authConfigPath);
    console.log(chalk.green('✅ OAuth2 configured'));
    console.log(chalk.gray(`   Client ID: ${config.clientId}`));
    console.log(chalk.gray(`   Power Pages: ${config.powerPagesUrl}`));

    // Check token cache
    if (!await fs.pathExists(this.tokenCachePath)) {
      console.log(chalk.yellow('\n⚠️  No cached token'));
      console.log(chalk.gray('   Authenticate via http://localhost:3000/auth'));
      return;
    }

    const tokenCache = await fs.readJson(this.tokenCachePath);
    const expiresOn = new Date(tokenCache.expiresOn);
    const now = new Date();
    
    if (expiresOn > now) {
      const hoursRemaining = Math.floor((expiresOn - now) / 3600000);
      const minutesRemaining = Math.floor(((expiresOn - now) % 3600000) / 60000);
      
      console.log(chalk.green('\n✅ Valid token cached'));
      console.log(chalk.gray(`   Expires: ${expiresOn.toLocaleString()}`));
      console.log(chalk.gray(`   Time remaining: ${hoursRemaining}h ${minutesRemaining}m`));
      console.log(chalk.gray(`   Scopes: ${tokenCache.scopes?.join(', ') || 'N/A'}`));
    } else {
      console.log(chalk.red('\n❌ Token expired'));
      console.log(chalk.gray(`   Expired: ${expiresOn.toLocaleString()}`));
      console.log(chalk.gray('   Re-authenticate via http://localhost:3000/auth'));
    }
  }

  async refreshToken() {
    console.log(chalk.blue('🔄 Refreshing token...'));
    console.log(chalk.yellow('\nNote: Token refresh requires the server to be running.'));
    console.log(chalk.gray('Start the server and navigate to http://localhost:3000/auth/refresh'));
    
    const { openBrowser } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'openBrowser',
        message: 'Open browser now?',
        default: true
      }
    ]);

    if (openBrowser) {
      const open = await import('open');
      await open.default('http://localhost:3000/auth/refresh');
    }
  }

  async clearAuth() {
    console.log(chalk.yellow('\n⚠️  This will clear all cached authentication data.'));
    
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Are you sure you want to clear authentication?',
        default: false
      }
    ]);

    if (!confirm) {
      console.log(chalk.gray('Cancelled.'));
      return;
    }

    let cleared = false;
    
    if (await fs.pathExists(this.tokenCachePath)) {
      await fs.remove(this.tokenCachePath);
      console.log(chalk.green('✅ Token cache cleared'));
      cleared = true;
    }

    const { clearConfig } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'clearConfig',
        message: 'Also clear OAuth2 configuration?',
        default: false
      }
    ]);

    if (clearConfig && await fs.pathExists(this.authConfigPath)) {
      await fs.remove(this.authConfigPath);
      console.log(chalk.green('✅ OAuth2 configuration cleared'));
      cleared = true;
    }

    if (!cleared) {
      console.log(chalk.gray('Nothing to clear.'));
    }
  }

  async showInstructions() {
    console.log(chalk.blue.bold('\n📚 Azure AD App Registration Instructions\n'));
    
    console.log(chalk.yellow('Step 1: Create App Registration'));
    console.log(chalk.gray('1. Go to: https://portal.azure.com'));
    console.log(chalk.gray('2. Navigate to Azure Active Directory → App registrations'));
    console.log(chalk.gray('3. Click "New registration"'));
    console.log(chalk.gray('4. Name: "Power Pages Local Dev" (or your preference)'));
    console.log(chalk.gray('5. Supported account types: "Single tenant"'));
    console.log(chalk.gray('6. Click "Register"\n'));

    console.log(chalk.yellow('Step 2: Configure Redirect URI'));
    console.log(chalk.gray('1. In your app, go to "Authentication"'));
    console.log(chalk.gray('2. Click "Add a platform" → "Web"'));
    console.log(chalk.gray('3. Redirect URI: http://localhost:3000/auth/callback'));
    console.log(chalk.gray('4. Check "Access tokens" and "ID tokens"'));
    console.log(chalk.gray('5. Click "Configure"\n'));

    console.log(chalk.yellow('Step 3: Add API Permissions'));
    console.log(chalk.gray('1. Go to "API permissions"'));
    console.log(chalk.gray('2. Click "Add a permission"'));
    console.log(chalk.gray('3. Select "Dynamics CRM"'));
    console.log(chalk.gray('4. Choose "Delegated permissions"'));
    console.log(chalk.gray('5. Select "user_impersonation"'));
    console.log(chalk.gray('6. Click "Add permissions"'));
    console.log(chalk.gray('7. (Optional) Click "Grant admin consent"\n'));

    console.log(chalk.yellow('Step 4: Get Configuration Values'));
    console.log(chalk.gray('1. Go to "Overview"'));
    console.log(chalk.gray('2. Copy "Application (client) ID"'));
    console.log(chalk.gray('3. Copy "Directory (tenant) ID"\n'));

    console.log(chalk.yellow('Step 5: (Optional) Create Client Secret'));
    console.log(chalk.gray('1. Go to "Certificates & secrets"'));
    console.log(chalk.gray('2. Click "New client secret"'));
    console.log(chalk.gray('3. Add description and expiry'));
    console.log(chalk.gray('4. Click "Add"'));
    console.log(chalk.gray('5. Copy the secret value immediately (won\'t be shown again)\n'));

    console.log(chalk.green('✅ Once complete, run this setup again to configure OAuth2.'));
    
    const { openPortal } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'openPortal',
        message: 'Open Azure Portal in browser?',
        default: true
      }
    ]);

    if (openPortal) {
      const open = await import('open');
      await open.default('https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade');
    }
  }
}

// Run CLI
if (require.main === module) {
  const cli = new AuthSetupCLI();
  cli.run().catch(error => {
    console.error(chalk.red('❌ Error:'), error.message);
    process.exit(1);
  });
}

module.exports = AuthSetupCLI;
