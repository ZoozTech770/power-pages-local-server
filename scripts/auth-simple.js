#!/usr/bin/env node

const inquirer = require('inquirer');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const SimpleAuthManager = require('../src/auth-manager-simple');

// Parse command line arguments
const args = process.argv.slice(2);
const flags = {
    force: args.includes('--force') || args.includes('-f'),
    status: args.includes('--status') || args.includes('-s'),
    clear: args.includes('--clear') || args.includes('-c'),
    help: args.includes('--help') || args.includes('-h'),
    quiet: args.includes('--quiet') || args.includes('-q'),
    refresh: args.includes('--refresh') || args.includes('-r'),
    auth: args.includes('--auth') || args.includes('-a')
};

// Debug: Show parsed arguments (only when debugging)
if (process.env.DEBUG_AUTH) {
    console.log('DEBUG: Received args:', args);
    console.log('DEBUG: Parsed flags:', flags);
}

class SimpleAuthCLI {
  constructor() {
    this.authManager = new SimpleAuthManager({});
  }

  showHelp() {
    console.log(chalk.blue.bold('\n🔐 Power Pages OAuth2 Authentication CLI\n'));
    console.log(chalk.yellow('Usage:'));
    console.log('  npm run auth [options]\n');
    console.log(chalk.yellow('Options:'));
    console.log('  --status, -s      Check authentication status');
    console.log('  --auth, -a        Authenticate immediately (skip menu)');
    console.log('  --refresh, -r     Refresh token (if possible)');
    console.log('  --clear, -c       Clear authentication data');
    console.log('  --force, -f       Force re-authentication');
    console.log('  --quiet, -q       Minimal output');
    console.log('  --help, -h        Show this help\n');
    console.log(chalk.yellow('Examples:'));
    console.log('  npm run auth --status     # Check if authenticated');
    console.log('  npm run auth --auth       # Authenticate directly');
    console.log('  npm run auth --refresh    # Try to refresh token');
    console.log('  npm run auth --clear      # Clear all auth data\n');
    console.log(chalk.gray('💡 Note: OAuth2 token validity is controlled by Microsoft (typically ~1 hour)'));
    console.log(chalk.gray('   The server will automatically refresh tokens when they expire.\n'));
  }

  async run() {
    // Handle command line flags
    if (flags.help) {
      this.showHelp();
      return;
    }
    
    if (flags.status) {
      await this.checkStatus();
      return;
    }
    
    if (flags.clear) {
      await this.clearAuth();
      return;
    }
    
    if (flags.refresh) {
      await this.refreshToken();
      return;
    }
    
    if (flags.auth || flags.force) {
      if (flags.force) {
        // Clear existing auth first
        await this.authManager.clearTokenCache();
      }
      await this.authenticate();
      return;
    }
    
    // No flags, show interactive menu
    if (!flags.quiet) {
      console.log(chalk.blue.bold('\n🔐 Dynamics CRM Authentication Setup (Simple)\n'));
      console.log(chalk.gray('Just like Dataverse REST Builder - no Azure AD app registration needed!\n'));
    }
    
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: '🆕 Configure Dynamics instance', value: 'setup' },
          { name: '🔑 Authenticate now', value: 'auth' },
          { name: '🔍 Check authentication status', value: 'status' },
          { name: '🔄 Refresh token', value: 'refresh' },
          { name: '🗑️  Clear authentication', value: 'clear' },
          { name: '❌ Exit', value: 'exit' }
        ]
      }
    ]);

    switch (action) {
      case 'setup':
        await this.setupInstance();
        break;
      case 'auth':
        await this.authenticate();
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

  async setupInstance() {
    console.log(chalk.yellow('\n📋 Configure Dynamics Instance'));
    console.log(chalk.gray('Enter your Dynamics CRM or Power Pages instance URL\n'));

    // Show examples
    console.log(chalk.gray('Examples:'));
    console.log(chalk.gray('  • https://yourorg.crm.dynamics.com'));
    console.log(chalk.gray('  • https://yourorg.crm4.dynamics.com (Europe)'));
    console.log(chalk.gray('  • https://your-site.powerappsportals.com\n'));

    const { instanceUrl } = await inquirer.prompt([
      {
        type: 'input',
        name: 'instanceUrl',
        message: 'Enter your instance URL:',
        default: 'https://orangelicence-dev.crm4.dynamics.com',
        validate: (input) => {
          try {
            const url = new URL(input);
            if (!url.protocol.startsWith('http')) {
              return 'URL must start with http:// or https://';
            }
            return true;
          } catch {
            return 'Please enter a valid URL';
          }
        },
        filter: (input) => {
          // Remove trailing slash if present
          return input.replace(/\/$/, '');
        }
      }
    ]);

    try {
      await this.authManager.setupInstance(instanceUrl);
      
      console.log(chalk.green('\n✅ Instance configured successfully!'));
      console.log(chalk.blue('\nNext steps:'));
      console.log(chalk.gray('1. Run "npm run auth-simple" and choose "Authenticate now"'));
      console.log(chalk.gray('2. Login with your Microsoft account'));
      console.log(chalk.gray('3. Start using the server with authenticated API calls\n'));
      
      const { authNow } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'authNow',
          message: 'Authenticate now?',
          default: true
        }
      ]);
      
      if (authNow) {
        await this.authenticate();
      }
    } catch (error) {
      console.error(chalk.red('❌ Setup failed:'), error.message);
    }
  }

  async authenticate() {
    try {
      // Check if instance is configured
      const instanceUrl = await this.authManager.getInstanceUrl();
      if (!instanceUrl) {
        console.log(chalk.yellow('⚠️  No instance configured'));
        console.log(chalk.gray('Please configure an instance first\n'));
        
        const { setup } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'setup',
            message: 'Configure instance now?',
            default: true
          }
        ]);
        
        if (setup) {
          await this.setupInstance();
        }
        return;
      }

      console.log(chalk.blue(`\n🔐 Authenticating to: ${instanceUrl}\n`));
      
      // Initialize if needed
      if (!this.authManager.isConfigured()) {
        await this.authManager.initializeMSAL(instanceUrl);
      }
      
      // Start authentication
      await this.authManager.authenticateInteractive();
      
      console.log(chalk.green('\n✅ Authentication complete!'));
      console.log(chalk.gray('You can now make authenticated API calls to your Dynamics instance.\n'));
      
    } catch (error) {
      console.error(chalk.red('❌ Authentication failed:'), error.message);
    }
  }

  async checkStatus() {
    console.log(chalk.blue('\n🔍 Authentication Status\n'));

    // Check instance configuration
    const instanceUrl = await this.authManager.getInstanceUrl();
    if (!instanceUrl) {
      console.log(chalk.red('❌ No instance configured'));
      console.log(chalk.gray('   Run setup to configure an instance'));
      return;
    }

    console.log(chalk.green('✅ Instance configured'));
    console.log(chalk.gray(`   URL: ${instanceUrl}`));

    // Initialize if needed
    if (!this.authManager.isConfigured()) {
      await this.authManager.initialize();
    }

    // Check authentication
    const isAuth = await this.authManager.isAuthenticated();
    if (isAuth) {
      const tokenCachePath = path.join(__dirname, '../config', 'token-cache.json');
      if (await fs.pathExists(tokenCachePath)) {
        const tokenCache = await fs.readJson(tokenCachePath);
        const expiresOn = new Date(tokenCache.expiresOn);
        const now = new Date();
        
        const hoursRemaining = Math.floor((expiresOn - now) / 3600000);
        const minutesRemaining = Math.floor(((expiresOn - now) % 3600000) / 60000);
        
        console.log(chalk.green('\n✅ Authenticated'));
        console.log(chalk.gray(`   Account: ${tokenCache.account?.username || 'N/A'}`));
        console.log(chalk.gray(`   Expires: ${expiresOn.toLocaleString()}`));
        console.log(chalk.gray(`   Time remaining: ${hoursRemaining}h ${minutesRemaining}m`));
        
        if (hoursRemaining === 0 && minutesRemaining < 10) {
          console.log(chalk.yellow('\n⚠️  Token expires soon! The server will auto-refresh when needed.'));
        }
        
        console.log(chalk.blue('\n💡 Token Info:'));
        console.log(chalk.gray('   • Token validity is controlled by Microsoft Azure AD'));
        console.log(chalk.gray('   • Standard validity: ~1 hour for access tokens'));
        console.log(chalk.gray('   • Server auto-refreshes tokens when they expire'));
        console.log(chalk.gray(`   • Use 'npm run auth-refresh' to manually refresh`));
      }
    } else {
      console.log(chalk.yellow('\n⚠️  Not authenticated'));
      console.log(chalk.gray('   Run "Authenticate now" to login'));
    }
  }

  async refreshToken() {
    try {
      const instanceUrl = await this.authManager.getInstanceUrl();
      if (!instanceUrl) {
        console.log(chalk.yellow('⚠️  No instance configured'));
        return;
      }

      console.log(chalk.blue('🔄 Refreshing token...'));
      
      // Initialize if needed
      if (!this.authManager.isConfigured()) {
        await this.authManager.initialize();
      }
      
      const result = await this.authManager.acquireTokenSilent();
      if (result) {
        console.log(chalk.green('✅ Token refreshed successfully'));
      } else {
        console.log(chalk.yellow('⚠️  Could not refresh silently'));
        console.log(chalk.gray('Please authenticate again'));
        
        const { authNow } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'authNow',
            message: 'Authenticate now?',
            default: true
          }
        ]);
        
        if (authNow) {
          await this.authenticate();
        }
      }
    } catch (error) {
      console.error(chalk.red('❌ Refresh failed:'), error.message);
    }
  }

  async clearAuth() {
    console.log(chalk.yellow('\n⚠️  This will clear all authentication data'));
    
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Are you sure?',
        default: false
      }
    ]);

    if (!confirm) {
      console.log(chalk.gray('Cancelled'));
      return;
    }

    // Clear token cache
    await this.authManager.clearTokenCache();
    
    const { clearConfig } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'clearConfig',
        message: 'Also clear instance configuration?',
        default: false
      }
    ]);

    if (clearConfig) {
      const configPath = path.join(__dirname, '../config', 'auth-config.json');
      if (await fs.pathExists(configPath)) {
        await fs.remove(configPath);
        console.log(chalk.green('✅ Instance configuration cleared'));
      }
    }

    console.log(chalk.green('✅ Authentication cleared'));
  }
}

// Run CLI
if (require.main === module) {
  const cli = new SimpleAuthCLI();
  cli.run().catch(error => {
    console.error(chalk.red('❌ Error:'), error.message);
    process.exit(1);
  });
}

module.exports = SimpleAuthCLI;
