#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

class ApiProxySetup {
  constructor() {
    this.configPath = path.join(__dirname, 'config', 'api-proxy.json');
  }

  parseCurlCommand(curlCommand) {
    try {
      // Extract URL
      const urlMatch = curlCommand.match(/curl\s+'([^']+)'/);
      if (!urlMatch) {
        throw new Error('Could not extract URL from curl command');
      }
      const fullUrl = urlMatch[1];
      const url = new URL(fullUrl);
      
      // Extract headers
      const headers = {};
      const headerMatches = curlCommand.matchAll(/-H\s+'([^:]+):\s*([^']+)'/g);
      
      for (const match of headerMatches) {
        const headerName = match[1];
        const headerValue = match[2];
        
        // Skip certain headers that should not be proxied
        if (!['Host', 'Content-Length', 'Connection'].includes(headerName)) {
          headers[headerName] = headerValue;
        }
      }

      // Extract cookies
      const cookieMatch = curlCommand.match(/-b\s+'([^']+)'/);
      if (cookieMatch) {
        headers['Cookie'] = cookieMatch[1];
      }

      return {
        baseUrl: `${url.protocol}//${url.host}`,
        headers,
        sampleEndpoint: url.pathname + url.search
      };

    } catch (error) {
      console.error(chalk.red('❌ Error parsing curl command:'), error.message);
      throw error;
    }
  }

  async saveProxyConfig(config) {
    try {
      const proxyConfig = {
        enabled: true,
        baseUrl: config.baseUrl,
        headers: config.headers,
        sampleEndpoint: config.sampleEndpoint,
        createdAt: new Date().toISOString()
      };

      await fs.writeJson(this.configPath, proxyConfig, { spaces: 2 });
      console.log(chalk.green('✅ API proxy configuration saved'));
      return proxyConfig;
    } catch (error) {
      console.error(chalk.red('❌ Error saving proxy config:'), error);
      throw error;
    }
  }

  async updateServerConfig() {
    try {
      const serverConfigPath = path.join(__dirname, 'config', 'server-config.json');
      const serverConfig = await fs.readJson(serverConfigPath);
      
      // Add API proxy configuration
      serverConfig.apiProxy = {
        enabled: true,
        configFile: 'api-proxy.json'
      };
      
      await fs.writeJson(serverConfigPath, serverConfig, { spaces: 2 });
      console.log(chalk.green('✅ Server configuration updated'));
    } catch (error) {
      console.error(chalk.red('❌ Error updating server config:'), error);
      throw error;
    }
  }

  displayConfig(config) {
    console.log(chalk.blue('\n📋 API Proxy Configuration:'));
    console.log(chalk.gray('Base URL:'), config.baseUrl);
    console.log(chalk.gray('Sample Endpoint:'), config.sampleEndpoint);
    console.log(chalk.gray('Headers:'));
    Object.entries(config.headers).forEach(([key, value]) => {
      const displayValue = value.length > 50 ? value.substring(0, 50) + '...' : value;
      console.log(chalk.gray(`  ${key}:`), displayValue);
    });
  }

  async setup(curlCommand) {
    try {
      console.log(chalk.blue('🔧 Setting up API proxy from curl command...\n'));
      
      // Parse curl command
      const config = this.parseCurlCommand(curlCommand);
      
      // Save proxy configuration
      await this.saveProxyConfig(config);
      
      // Update server configuration
      await this.updateServerConfig();
      
      // Display configuration
      this.displayConfig(config);
      
      console.log(chalk.green('\n✅ API proxy setup complete!'));
      console.log(chalk.yellow('📝 Note: Restart the server for changes to take effect.'));
      
    } catch (error) {
      console.error(chalk.red('❌ Setup failed:'), error.message);
      process.exit(1);
    }
  }
}

// CLI Usage
if (require.main === module) {
  const curlCommand = process.argv[2];
  
  if (!curlCommand) {
    console.log(chalk.yellow('Usage: node setup-api-proxy.js "curl command"'));
    console.log(chalk.gray('Example: node setup-api-proxy.js "curl \'https://example.com/api\' -H \'Authorization: Bearer token\'"'));
    process.exit(1);
  }
  
  const setup = new ApiProxySetup();
  setup.setup(curlCommand);
}

module.exports = ApiProxySetup;
