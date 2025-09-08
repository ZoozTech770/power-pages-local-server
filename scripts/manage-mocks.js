#!/usr/bin/env node
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

class MockManager {
  constructor() {
    this.configPath = path.join(__dirname, '..', 'config', 'mock-config.json');
    this.mockDataDir = path.join(__dirname, '..', 'mock-data');
  }

  async loadConfig() {
    try {
      if (await fs.pathExists(this.configPath)) {
        return await fs.readJson(this.configPath);
      }
      return { globalMockEnabled: true, mocks: {} };
    } catch (error) {
      console.error(chalk.red('❌ Error loading mock config:'), error);
      return { globalMockEnabled: true, mocks: {} };
    }
  }

  async saveConfig(config) {
    try {
      await fs.ensureDir(path.dirname(this.configPath));
      await fs.writeJson(this.configPath, config, { spaces: 2 });
    } catch (error) {
      console.error(chalk.red('❌ Error saving mock config:'), error);
      throw error;
    }
  }

  async listMocks() {
    try {
      const config = await this.loadConfig();
      const mockFiles = await fs.readdir(this.mockDataDir);
      const jsonFiles = mockFiles.filter(file => file.endsWith('.json'));

      console.log(chalk.blue('\n📝 Mock Configuration Status:'));
      console.log(chalk.blue(`🌐 Global Mocks: ${config.globalMockEnabled ? chalk.green('ENABLED') : chalk.red('DISABLED')}`));
      console.log(chalk.blue('\n📋 Available Mocks:'));

      if (jsonFiles.length === 0) {
        console.log(chalk.yellow('   No mock files found'));
        return;
      }

      for (const file of jsonFiles) {
        const mockId = path.basename(file, '.json');
        const isEnabled = config.globalMockEnabled && (config.mocks[mockId] !== false);
        const status = isEnabled ? chalk.green('✅ ENABLED') : chalk.red('❌ DISABLED');
        
        try {
          const mockData = await fs.readJson(path.join(this.mockDataDir, file));
          console.log(`   ${status} ${chalk.cyan(mockData.endpoint || mockId)} (${mockData.method || 'GET'})`);
        } catch (error) {
          console.log(`   ${status} ${chalk.cyan(mockId)} (Invalid JSON)`);
        }
      }
    } catch (error) {
      console.error(chalk.red('❌ Error listing mocks:'), error);
    }
  }

  async toggleGlobal(enabled) {
    try {
      const config = await this.loadConfig();
      config.globalMockEnabled = enabled;
      await this.saveConfig(config);
      
      console.log(chalk.green(`✅ Global mocks ${enabled ? 'enabled' : 'disabled'}`));
    } catch (error) {
      console.error(chalk.red('❌ Error toggling global mocks:'), error);
    }
  }

  async toggleMock(mockId, enabled) {
    try {
      const config = await this.loadConfig();
      config.mocks[mockId] = enabled;
      await this.saveConfig(config);
      
      console.log(chalk.green(`✅ Mock '${mockId}' ${enabled ? 'enabled' : 'disabled'}`));
    } catch (error) {
      console.error(chalk.red('❌ Error toggling mock:'), error);
    }
  }

  printUsage() {
    console.log(chalk.blue('\n📖 Mock Manager Usage:'));
    console.log(chalk.blue('  List all mocks:     npm run manage-mocks -- list'));
    console.log(chalk.blue('  Enable all mocks:   npm run manage-mocks -- global on'));
    console.log(chalk.blue('  Disable all mocks:  npm run manage-mocks -- global off'));
    console.log(chalk.blue('  Enable specific:    npm run manage-mocks -- enable <mock_id>'));
    console.log(chalk.blue('  Disable specific:   npm run manage-mocks -- disable <mock_id>'));
    console.log(chalk.blue('\n💡 Mock ID is the filename without .json extension'));
  }
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const manager = new MockManager();

  if (args.length === 0) {
    manager.printUsage();
    process.exit(0);
  }

  const command = args[0].toLowerCase();

  switch (command) {
    case 'list':
    case 'ls':
      manager.listMocks();
      break;
      
    case 'global':
      if (args.length < 2) {
        console.log(chalk.red('❌ Please specify "on" or "off" for global toggle'));
        process.exit(1);
      }
      const globalEnabled = args[1].toLowerCase() === 'on' || args[1].toLowerCase() === 'true';
      manager.toggleGlobal(globalEnabled);
      break;
      
    case 'enable':
    case 'on':
      if (args.length < 2) {
        console.log(chalk.red('❌ Please specify a mock ID to enable'));
        process.exit(1);
      }
      manager.toggleMock(args[1], true);
      break;
      
    case 'disable':
    case 'off':
      if (args.length < 2) {
        console.log(chalk.red('❌ Please specify a mock ID to disable'));
        process.exit(1);
      }
      manager.toggleMock(args[1], false);
      break;
      
    default:
      console.log(chalk.red(`❌ Unknown command: ${command}`));
      manager.printUsage();
      process.exit(1);
  }
}

module.exports = MockManager;
