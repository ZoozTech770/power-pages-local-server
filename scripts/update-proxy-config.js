#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

class CurlParser {
  constructor() {
    this.config = {
      enabled: true,
      baseUrl: '',
      headers: {},
      useAuthorizationHeader: false
    };
  }

  parseCurl(curlCommand) {
    // Clean up the curl command - remove line breaks and extra spaces
    const cleanCommand = curlCommand.replace(/\\\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Extract URL
    const urlMatch = cleanCommand.match(/curl\s+['"]?([^'"\s]+)['"]?/);
    if (urlMatch) {
      const fullUrl = urlMatch[1];
      const url = new URL(fullUrl);
      this.config.baseUrl = `${url.protocol}//${url.host}`;
      console.log(chalk.blue(`📡 Base URL: ${this.config.baseUrl}`));
    }

    // Extract headers
    const headerMatches = cleanCommand.matchAll(/-H\s+['"]([^'"]+)['"]?/g);
    for (const match of headerMatches) {
      const headerLine = match[1];
      const colonIndex = headerLine.indexOf(':');
      if (colonIndex > 0) {
        const key = headerLine.substring(0, colonIndex).trim();
        const value = headerLine.substring(colonIndex + 1).trim();
        this.config.headers[key] = value;
        console.log(chalk.gray(`📝 Header: ${key} = ${value.substring(0, 50)}${value.length > 50 ? '...' : ''}`));
      }
    }

    // Extract cookies using -b flag
    const cookieMatch = cleanCommand.match(/-b\s+['"]([^'"]+)['"]?/);
    if (cookieMatch) {
      this.config.headers['Cookie'] = cookieMatch[1];
      console.log(chalk.green(`🍪 Cookie extracted from -b flag`));
    }

    // Check if Authorization header exists (Bearer token)
    if (this.config.headers['Authorization']) {
      this.config.useAuthorizationHeader = true;
      console.log(chalk.blue(`🔐 Using Authorization header authentication`));
    } else {
      this.config.useAuthorizationHeader = false;
      console.log(chalk.blue(`🍪 Using Cookie authentication`));
    }

    // Set default headers if not present
    if (!this.config.headers['Accept']) {
      this.config.headers['Accept'] = 'application/json';
    }
    if (!this.config.headers['Content-Type']) {
      this.config.headers['Content-Type'] = 'application/json';
    }
    if (!this.config.headers['User-Agent']) {
      this.config.headers['User-Agent'] = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
    }

    return this.config;
  }

  async updateConfigFile(configPath) {
    try {
      await fs.ensureDir(path.dirname(configPath));
      await fs.writeJson(configPath, this.config, { spaces: 2 });
      console.log(chalk.green(`✅ Configuration updated: ${configPath}`));
      return true;
    } catch (error) {
      console.error(chalk.red(`❌ Failed to update configuration: ${error.message}`));
      return false;
    }
  }

  displayConfig() {
    console.log(chalk.yellow('\n📋 Final Configuration:'));
    console.log(chalk.white(JSON.stringify(this.config, null, 2)));
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(chalk.red('❌ No curl command provided'));
    console.log(chalk.yellow('Usage: node update-proxy-config.js "curl command here"'));
    console.log(chalk.yellow('   or: npm run update-proxy "curl command here"'));
    process.exit(1);
  }

  const curlCommand = args.join(' ');
  const configPath = path.join(__dirname, '../config/api-proxy.json');
  
  console.log(chalk.blue('🔄 Parsing curl command...'));
  
  const parser = new CurlParser();
  const config = parser.parseCurl(curlCommand);
  
  if (!config.baseUrl) {
    console.error(chalk.red('❌ Could not extract base URL from curl command'));
    process.exit(1);
  }

  parser.displayConfig();
  
  const success = await parser.updateConfigFile(configPath);
  
  if (success) {
    console.log(chalk.green('\n🎉 Proxy configuration updated successfully!'));
    console.log(chalk.yellow('💡 You can now restart your server to apply the changes.'));
  } else {
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('❌ Script failed:'), error);
    process.exit(1);
  });
}

module.exports = CurlParser;
