#!/usr/bin/env node

const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');

class CurlTester {
    constructor() {
        // Import the parsing logic from mock-manager
        const MockManager = require('./mock-manager.js');
        this.mockManager = new MockManager();
    }

    testCurlCommand(curlCommand) {
        console.log(chalk.blue.bold('\n🧪 cURL Command Parser Test\n'));
        
        console.log(chalk.cyan('Input Command:'));
        console.log(chalk.gray(curlCommand));
        console.log();
        
        try {
            const result = this.mockManager.parseCurlCommand(curlCommand);
            
            console.log(chalk.green.bold('✅ Parsing Results:'));
            console.log(chalk.yellow('Method:'), result.method);
            console.log(chalk.yellow('URL:'), result.url);
            console.log(chalk.yellow('Endpoint:'), result.endpoint);
            
            if (Object.keys(result.queryParams).length > 0) {
                console.log(chalk.yellow('Query Parameters:'));
                Object.entries(result.queryParams).forEach(([key, value]) => {
                    console.log(chalk.gray(`  ${key}: ${value}`));
                });
            }
            
            if (Object.keys(result.headers).length > 0) {
                console.log(chalk.yellow(`Headers (${Object.keys(result.headers).length}):`));
                Object.entries(result.headers).forEach(([key, value]) => {
                    console.log(chalk.gray(`  ${key}: ${value.substring(0, 50)}${value.length > 50 ? '...' : ''}`));
                });
            }
            
            if (result.body) {
                console.log(chalk.yellow('Body:'));
                console.log(chalk.gray(typeof result.body === 'object' ? JSON.stringify(result.body, null, 2) : result.body));
            }
            
        } catch (error) {
            console.log(chalk.red('❌ Parsing Error:'));
            console.log(chalk.red(error.message));
        }
    }
    
    async testFromFile(filePath) {
        try {
            const curlCommand = await fs.readFile(filePath, 'utf8');
            this.testCurlCommand(curlCommand);
        } catch (error) {
            console.log(chalk.red('❌ Error reading file:'), error.message);
        }
    }
    
    async testFromClipboard() {
        try {
            const { exec } = require('child_process');
            const { promisify } = require('util');
            const execAsync = promisify(exec);
            
            const { stdout } = await execAsync('pbpaste');
            if (!stdout.trim()) {
                console.log(chalk.yellow('⚠️  Clipboard appears to be empty'));
                return;
            }
            
            this.testCurlCommand(stdout);
        } catch (error) {
            console.log(chalk.red('❌ Could not read from clipboard:'), error.message);
        }
    }
}

// Command line interface
async function main() {
    const args = process.argv.slice(2);
    const tester = new CurlTester();
    
    if (args.length === 0) {
        console.log(chalk.blue.bold('🧪 cURL Parser Tester\n'));
        console.log('Usage:');
        console.log('  node test-curl-parsing.js --clipboard  # Test from clipboard');
        console.log('  node test-curl-parsing.js --file path  # Test from file');
        console.log('  node test-curl-parsing.js "curl..."    # Test direct command');
        return;
    }
    
    if (args[0] === '--clipboard') {
        await tester.testFromClipboard();
    } else if (args[0] === '--file' && args[1]) {
        await tester.testFromFile(args[1]);
    } else {
        const curlCommand = args.join(' ');
        tester.testCurlCommand(curlCommand);
    }
}

if (require.main === module) {
    main().catch(console.error);
} else {
    module.exports = CurlTester;
}
