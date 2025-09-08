#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const inquirer = require('inquirer');
const { URL } = require('url');
const crypto = require('crypto');
const readline = require('readline');

class MockManager {
    constructor() {
        this.mockDataDir = path.join(__dirname, '..', 'mocks');
        this.mockConfigFile = path.join(this.mockDataDir, 'mock-config.json');
        this.rl = null; // Will be initialized when needed
        this.initialize();
    }

    async initialize() {
        await fs.ensureDir(this.mockDataDir);
        if (!await fs.pathExists(this.mockConfigFile)) {
            await fs.writeJson(this.mockConfigFile, { mocks: [] }, { spaces: 2 });
        }
    }

    async run() {
        console.log(chalk.blue.bold('\n🎭 Power Pages Mock Manager\n'));
        
        const { action } = await inquirer.prompt([{
            type: 'list',
            name: 'action',
            message: 'What would you like to do?',
            choices: [
                { name: '➕ Add new mock from cURL', value: 'add' },
                { name: '📋 List all mocks', value: 'list' },
                { name: '🔍 View mock details', value: 'view' },
                { name: '✏️  Edit existing mock', value: 'edit' },
                { name: '🗑️  Delete mock', value: 'delete' },
                { name: '🔄 Toggle mock (enable/disable)', value: 'toggle' },
                { name: '📤 Export mocks', value: 'export' },
                { name: '📥 Import mocks', value: 'import' },
                { name: '🚪 Exit', value: 'exit' }
            ]
        }]);

        switch (action) {
            case 'add':
                await this.addMockInteractive();
                break;
            case 'list':
                await this.listMocks();
                break;
            case 'view':
                await this.viewMockDetails();
                break;
            case 'edit':
                await this.editMock();
                break;
            case 'delete':
                await this.deleteMock();
                break;
            case 'toggle':
                await this.toggleMock();
                break;
            case 'export':
                await this.exportMocks();
                break;
            case 'import':
                await this.importMocks();
                break;
            case 'exit':
                console.log(chalk.green('👋 Goodbye!'));
                process.exit(0);
        }

        // Continue with menu unless exit
        if (action !== 'exit') {
            await this.run();
        }
    }

    async addMockInteractive() {
        console.log(chalk.cyan('\n📝 Add New Mock from cURL\n'));
        
        // Step 1: Get cURL command
        console.log(chalk.gray('Copy the cURL command from your browser\'s Network tab'));
        console.log(chalk.gray('(Right-click on request → Copy → Copy as cURL)\n'));
        
        // Step 1a: Choose input method
        const { inputMethod } = await inquirer.prompt([{
            type: 'list',
            name: 'inputMethod',
            message: 'How would you like to provide the cURL command?',
            choices: [
                { name: 'Read from clipboard (recommended)', value: 'clipboard' },
                { name: 'Paste multiline (supports large commands)', value: 'multiline' },
                { name: 'Read from existing file', value: 'file' }
            ]
        }]);

        let curlCommand = '';
        
        if (inputMethod === 'multiline') {
            console.log(chalk.yellow('\n📝 Multiline Input Mode'));
            console.log(chalk.gray('You can paste large multiline cURL commands here.'));
            console.log(chalk.gray('Perfect for commands copied from browser DevTools.\n'));
            
            curlCommand = await this.askMultilineQuestion('Paste your cURL command:');
            
            if (!curlCommand.trim()) {
                console.log(chalk.red('❌ No input provided'));
                this.closeReadline();
                return;
            }
            
            console.log(chalk.green('✅ cURL command captured successfully'));
            this.closeReadline();
        } else if (inputMethod === 'file') {
            const { filePath } = await inquirer.prompt([{
                type: 'input',
                name: 'filePath',
                message: 'Enter path to file containing cURL command:',
                validate: async (input) => {
                    if (!input.trim()) return 'File path is required';
                    try {
                        await fs.access(input);
                        return true;
                    } catch {
                        return 'File not found or not accessible';
                    }
                }
            }]);
            
            try {
                curlCommand = await fs.readFile(filePath, 'utf8');
            } catch (error) {
                console.log(chalk.red('Error reading file:', error.message));
                return;
            }
        } else if (inputMethod === 'clipboard') {
            try {
                // Try to read from clipboard using pbpaste on macOS
                const { exec } = require('child_process');
                const { promisify } = require('util');
                const execAsync = promisify(exec);
                
                const { stdout } = await execAsync('pbpaste');
                curlCommand = stdout;
                
                if (!curlCommand.trim()) {
                    console.log(chalk.yellow('Clipboard appears to be empty'));
                    return;
                }
                
                console.log(chalk.green('✅ Read from clipboard:'));
                console.log(chalk.gray(curlCommand.substring(0, 100) + (curlCommand.length > 100 ? '...' : '')));
                
                const { confirmClipboard } = await inquirer.prompt([{
                    type: 'confirm',
                    name: 'confirmClipboard',
                    message: 'Use this content from clipboard?',
                    default: true
                }]);
                
                if (!confirmClipboard) {
                    return;
                }
            } catch (error) {
                console.log(chalk.yellow('Could not read from clipboard. Using direct input instead.'));
                const { directInput } = await inquirer.prompt([{
                    type: 'input',
                    name: 'directInput',
                    message: 'Paste your cURL command:'
                }]);
                curlCommand = directInput;
            }
        }
        
        // Validate the cURL command
        if (!curlCommand.trim()) {
            console.log(chalk.red('❌ cURL command is required'));
            return;
        }
        
        if (!curlCommand.includes('curl') && !curlCommand.includes('http')) {
            console.log(chalk.red('❌ Invalid cURL command'));
            return;
        }

        // Parse cURL command
        const requestDetails = this.parseCurlCommand(curlCommand);
        
        // Show parsed details
        console.log(chalk.cyan('\n📊 Parsed Request Details:'));
        console.log(chalk.gray('  Method:'), chalk.yellow(requestDetails.method));
        console.log(chalk.gray('  URL:'), chalk.yellow(requestDetails.url));
        console.log(chalk.gray('  Endpoint:'), chalk.yellow(requestDetails.endpoint));
        if (Object.keys(requestDetails.headers).length > 0) {
            console.log(chalk.gray('  Headers:'), Object.keys(requestDetails.headers).length, 'headers');
        }
        if (requestDetails.body) {
            console.log(chalk.gray('  Body:'), 'Present');
        }

        // Step 2: Get mock response
        console.log(chalk.cyan('\n📥 Mock Response Configuration\n'));
        
        const responseConfig = await inquirer.prompt([
            {
                type: 'list',
                name: 'responseType',
                message: 'How would you like to provide the response?',
                choices: [
                    { name: 'Paste JSON response', value: 'json' },
                    { name: 'Paste raw response', value: 'raw' },
                    { name: 'Use empty response', value: 'empty' },
                    { name: 'Generate sample response', value: 'sample' }
                ]
            }
        ]);

        let responseData = {};
        let statusCode = 200;

        if (responseConfig.responseType === 'json') {
            const { responseInputMethod } = await inquirer.prompt([{
                type: 'list',
                name: 'responseInputMethod',
                message: 'How would you like to provide the JSON response?',
                choices: [
                    { name: 'Paste directly', value: 'paste' },
                    { name: 'Read from file', value: 'file' },
                    { name: 'Read from clipboard', value: 'clipboard' }
                ]
            }]);
            
            let jsonResponse = '';
            
            if (responseInputMethod === 'paste') {
                const { directJsonInput } = await inquirer.prompt([{
                    type: 'input',
                    name: 'directJsonInput',
                    message: 'Paste JSON response:',
                    validate: (input) => {
                        if (!input.trim()) return 'JSON response is required';
                        try {
                            JSON.parse(input);
                            return true;
                        } catch (e) {
                            return 'Invalid JSON: ' + e.message;
                        }
                    }
                }]);
                jsonResponse = directJsonInput;
            } else if (responseInputMethod === 'file') {
                const { jsonFilePath } = await inquirer.prompt([{
                    type: 'input',
                    name: 'jsonFilePath',
                    message: 'Enter path to JSON file:',
                    validate: async (input) => {
                        if (!input.trim()) return 'File path is required';
                        try {
                            await fs.access(input);
                            return true;
                        } catch {
                            return 'File not found or not accessible';
                        }
                    }
                }]);
                
                try {
                    jsonResponse = await fs.readFile(jsonFilePath, 'utf8');
                    // Validate JSON
                    JSON.parse(jsonResponse);
                } catch (error) {
                    if (error instanceof SyntaxError) {
                        console.log(chalk.red('Invalid JSON in file:', error.message));
                    } else {
                        console.log(chalk.red('Error reading file:', error.message));
                    }
                    return;
                }
            } else if (responseInputMethod === 'clipboard') {
                try {
                    const { exec } = require('child_process');
                    const { promisify } = require('util');
                    const execAsync = promisify(exec);
                    
                    const { stdout } = await execAsync('pbpaste');
                    jsonResponse = stdout;
                    
                    if (!jsonResponse.trim()) {
                        console.log(chalk.yellow('Clipboard appears to be empty'));
                        return;
                    }
                    
                    // Validate JSON
                    try {
                        JSON.parse(jsonResponse);
                    } catch (e) {
                        console.log(chalk.red('Invalid JSON in clipboard:', e.message));
                        return;
                    }
                    
                    console.log(chalk.green('✅ Read JSON from clipboard'));
                    console.log(chalk.gray(jsonResponse.substring(0, 100) + (jsonResponse.length > 100 ? '...' : '')));
                    
                    const { confirmJsonClipboard } = await inquirer.prompt([{
                        type: 'confirm',
                        name: 'confirmJsonClipboard',
                        message: 'Use this JSON from clipboard?',
                        default: true
                    }]);
                    
                    if (!confirmJsonClipboard) {
                        return;
                    }
                } catch (error) {
                    console.log(chalk.yellow('Could not read from clipboard. Using direct input instead.'));
                    const { directJsonInput } = await inquirer.prompt([{
                        type: 'input',
                        name: 'directJsonInput',
                        message: 'Paste JSON response:',
                        validate: (input) => {
                            if (!input.trim()) return 'JSON response is required';
                            try {
                                JSON.parse(input);
                                return true;
                            } catch (e) {
                                return 'Invalid JSON: ' + e.message;
                            }
                        }
                    }]);
                    jsonResponse = directJsonInput;
                }
            }
            
            responseData = JSON.parse(jsonResponse);
        } else if (responseConfig.responseType === 'raw') {
            const { rawInputMethod } = await inquirer.prompt([{
                type: 'list',
                name: 'rawInputMethod',
                message: 'How would you like to provide the raw response?',
                choices: [
                    { name: 'Paste directly', value: 'paste' },
                    { name: 'Read from file', value: 'file' },
                    { name: 'Read from clipboard', value: 'clipboard' }
                ]
            }]);
            
            let rawResponse = '';
            
            if (rawInputMethod === 'paste') {
                const { directRawInput } = await inquirer.prompt([{
                    type: 'input',
                    name: 'directRawInput',
                    message: 'Paste raw response:'
                }]);
                rawResponse = directRawInput;
            } else if (rawInputMethod === 'file') {
                const { rawFilePath } = await inquirer.prompt([{
                    type: 'input',
                    name: 'rawFilePath',
                    message: 'Enter path to response file:',
                    validate: async (input) => {
                        if (!input.trim()) return 'File path is required';
                        try {
                            await fs.access(input);
                            return true;
                        } catch {
                            return 'File not found or not accessible';
                        }
                    }
                }]);
                
                try {
                    rawResponse = await fs.readFile(rawFilePath, 'utf8');
                } catch (error) {
                    console.log(chalk.red('Error reading file:', error.message));
                    return;
                }
            } else if (rawInputMethod === 'clipboard') {
                try {
                    const { exec } = require('child_process');
                    const { promisify } = require('util');
                    const execAsync = promisify(exec);
                    
                    const { stdout } = await execAsync('pbpaste');
                    rawResponse = stdout;
                    
                    if (!rawResponse.trim()) {
                        console.log(chalk.yellow('Clipboard appears to be empty'));
                        return;
                    }
                    
                    console.log(chalk.green('✅ Read raw response from clipboard'));
                    console.log(chalk.gray(rawResponse.substring(0, 100) + (rawResponse.length > 100 ? '...' : '')));
                    
                    const { confirmRawClipboard } = await inquirer.prompt([{
                        type: 'confirm',
                        name: 'confirmRawClipboard',
                        message: 'Use this content from clipboard?',
                        default: true
                    }]);
                    
                    if (!confirmRawClipboard) {
                        return;
                    }
                } catch (error) {
                    console.log(chalk.yellow('Could not read from clipboard. Using direct input instead.'));
                    const { directRawInput } = await inquirer.prompt([{
                        type: 'input',
                        name: 'directRawInput',
                        message: 'Paste raw response:'
                    }]);
                    rawResponse = directRawInput;
                }
            }
            
            responseData = rawResponse;
        } else if (responseConfig.responseType === 'sample') {
            responseData = this.generateSampleResponse(requestDetails.endpoint);
        }

        // Get status code
        const { customStatus } = await inquirer.prompt([{
            type: 'number',
            name: 'customStatus',
            message: 'Response status code:',
            default: 200,
            validate: (input) => {
                if (input >= 100 && input < 600) return true;
                return 'Please enter a valid HTTP status code (100-599)';
            }
        }]);
        statusCode = customStatus;

        // Step 3: Mock configuration
        const mockConfig = await inquirer.prompt([
            {
                type: 'input',
                name: 'name',
                message: 'Mock name (for identification):',
                default: `${requestDetails.method} ${requestDetails.endpoint}`,
                validate: (input) => input.trim() ? true : 'Name is required'
            },
            {
                type: 'input',
                name: 'description',
                message: 'Description (optional):',
                default: ''
            },
            {
                type: 'confirm',
                name: 'enabled',
                message: 'Enable this mock immediately?',
                default: true
            },
            {
                type: 'number',
                name: 'delay',
                message: 'Response delay in milliseconds (0 for no delay):',
                default: 0,
                validate: (input) => input >= 0 ? true : 'Delay must be positive'
            },
            {
                type: 'list',
                name: 'priority',
                message: 'Mock priority (higher priority mocks are checked first):',
                choices: [
                    { name: 'High', value: 10 },
                    { name: 'Normal', value: 5 },
                    { name: 'Low', value: 1 }
                ],
                default: 5
            }
        ]);

        // Create mock object
        const mock = {
            id: this.generateMockId(),
            name: mockConfig.name,
            description: mockConfig.description,
            enabled: mockConfig.enabled,
            priority: mockConfig.priority,
            request: {
                method: requestDetails.method,
                endpoint: requestDetails.endpoint,
                url: requestDetails.url,
                headers: requestDetails.headers,
                body: requestDetails.body,
                queryParams: requestDetails.queryParams
            },
            response: {
                status: statusCode,
                data: responseData,
                headers: {
                    'Content-Type': typeof responseData === 'object' ? 'application/json' : 'text/plain'
                }
            },
            options: {
                delay: mockConfig.delay
            },
            createdAt: new Date().toISOString(),
            lastUsed: null,
            hitCount: 0
        };

        // Save mock
        await this.saveMock(mock);
        
        console.log(chalk.green(`\n✅ Mock "${mock.name}" created successfully!`));
        console.log(chalk.gray(`   ID: ${mock.id}`));
        console.log(chalk.gray(`   Endpoint: ${mock.request.method} ${mock.request.endpoint}`));
        if (mock.enabled) {
            console.log(chalk.green(`   Status: Enabled`));
        } else {
            console.log(chalk.yellow(`   Status: Disabled`));
        }
    }

    parseCurlCommand(curlCommand) {
        // Clean and normalize the command - handle multiline with backslashes
        let cleanCommand = curlCommand.trim();
        
        // Remove line breaks and backslashes for multiline cURL commands
        cleanCommand = cleanCommand.replace(/\\\s*\n\s*/g, ' ').replace(/\s+/g, ' ');
        
        if (cleanCommand.startsWith('curl')) {
            cleanCommand = cleanCommand.substring(4).trim();
        }

        const result = {
            method: 'GET',
            url: '',
            endpoint: '',
            headers: {},
            body: null,
            queryParams: {}
        };

        try {
            // Extract URL - look for first quoted string or first URL-like string
            let urlMatch = cleanCommand.match(/'([^']+)'/) || cleanCommand.match(/"([^"]+)"/); 
            if (!urlMatch) {
                // Try unquoted URL starting with http
                urlMatch = cleanCommand.match(/(https?:\/\/[^\s]+)/);
            }
            
            if (urlMatch) {
                let url = urlMatch[1];
                // Remove any trailing parameters that might have been included
                url = url.split(' ')[0];
                result.url = url;
                
                try {
                    const urlObj = new URL(url);
                    result.endpoint = urlObj.pathname + urlObj.search;
                    
                    // Extract query parameters
                    for (const [key, value] of urlObj.searchParams) {
                        result.queryParams[key] = value;
                    }
                } catch (e) {
                    // If not a full URL, treat as endpoint
                    result.endpoint = url.startsWith('/') ? url : '/' + url;
                }
            }

            // Parse headers using regex to handle quoted values properly
            const headerRegex = /-H\s+['"]([^:]+):\s*([^'"]*)['"/]/g;
            let headerMatch;
            while ((headerMatch = headerRegex.exec(cleanCommand)) !== null) {
                const key = headerMatch[1].trim();
                const value = headerMatch[2].trim();
                if (key && value) {
                    result.headers[key] = value;
                }
            }
            
            // Also try without quotes for headers
            const headerRegex2 = /-H\s+'([^']+)'/g;
            let headerMatch2;
            while ((headerMatch2 = headerRegex2.exec(cleanCommand)) !== null) {
                const headerStr = headerMatch2[1];
                const colonIndex = headerStr.indexOf(':');
                if (colonIndex > -1) {
                    const key = headerStr.substring(0, colonIndex).trim();
                    const value = headerStr.substring(colonIndex + 1).trim();
                    result.headers[key] = value;
                }
            }

            // Parse method
            const methodMatch = cleanCommand.match(/-X\s+([A-Z]+)/);
            if (methodMatch) {
                result.method = methodMatch[1].toUpperCase();
            }

            // Parse cookies (-b flag)
            const cookieMatch = cleanCommand.match(/-b\s+['"]([^'"]*)['"]/);
            if (cookieMatch) {
                result.headers['Cookie'] = cookieMatch[1];
            }

            // Parse data/body
            const dataMatch = cleanCommand.match(/-d\s+['"]([^'"]*)['"]/) || 
                            cleanCommand.match(/--data\s+['"]([^'"]*)['"]/) ||
                            cleanCommand.match(/--data-raw\s+['"]([^'"]*)['"]/);
            if (dataMatch) {
                const data = dataMatch[1];
                try {
                    result.body = JSON.parse(data);
                } catch {
                    result.body = data;
                }
                // If data is present and method is still GET, change to POST
                if (result.method === 'GET') {
                    result.method = 'POST';
                }
            }

        } catch (error) {
            console.log(chalk.yellow('Warning: Could not fully parse cURL command. Using basic extraction.'));
            console.log(chalk.gray('Error:', error.message));
            
            // Fallback: try to at least extract the URL
            const simpleUrlMatch = cleanCommand.match(/(https?:\/\/[^\s'"]+)/);
            if (simpleUrlMatch) {
                result.url = simpleUrlMatch[1];
                try {
                    const urlObj = new URL(result.url);
                    result.endpoint = urlObj.pathname + urlObj.search;
                } catch {
                    result.endpoint = '/api/fallback';
                }
            }
        }

        // Ensure we have at least a basic endpoint
        if (!result.endpoint && !result.url) {
            result.endpoint = '/api/mock-endpoint';
            result.url = 'http://localhost:3000/api/mock-endpoint';
        }

        return result;
    }

    parseCommandArgs(command) {
        const args = [];
        let current = '';
        let inQuote = false;
        let quoteChar = '';
        let escapeNext = false;

        for (let i = 0; i < command.length; i++) {
            const char = command[i];
            
            if (escapeNext) {
                current += char;
                escapeNext = false;
                continue;
            }
            
            if (char === '\\') {
                escapeNext = true;
                continue;
            }
            
            if ((char === '"' || char === "'") && !inQuote) {
                inQuote = true;
                quoteChar = char;
            } else if (char === quoteChar && inQuote) {
                inQuote = false;
                quoteChar = '';
            } else if (char === ' ' && !inQuote) {
                if (current) {
                    args.push(current);
                    current = '';
                }
            } else {
                current += char;
            }
        }
        
        if (current) {
            args.push(current);
        }
        
        return args;
    }

    generateMockId() {
        return crypto.randomBytes(8).toString('hex');
    }

    generateSampleResponse(endpoint) {
        // Generate contextual sample response based on endpoint
        if (endpoint.includes('user')) {
            return {
                id: 'user-123',
                name: 'Sample User',
                email: 'user@example.com'
            };
        } else if (endpoint.includes('search')) {
            return {
                results: [],
                total: 0
            };
        } else if (endpoint.includes('incident')) {
            return {
                value: []
            };
        } else {
            return {
                success: true,
                data: null,
                message: 'Sample response'
            };
        }
    }

    async saveMock(mock) {
        const config = await fs.readJson(this.mockConfigFile);
        config.mocks = config.mocks || [];
        config.mocks.push(mock);
        
        // Sort by priority (descending) and then by creation date
        config.mocks.sort((a, b) => {
            if (b.priority !== a.priority) {
                return b.priority - a.priority;
            }
            return new Date(b.createdAt) - new Date(a.createdAt);
        });
        
        await fs.writeJson(this.mockConfigFile, config, { spaces: 2 });
    }

    async listMocks() {
        const config = await fs.readJson(this.mockConfigFile);
        const mocks = config.mocks || [];
        
        if (mocks.length === 0) {
            console.log(chalk.yellow('\n⚠️  No mocks configured yet'));
            return;
        }

        console.log(chalk.cyan(`\n📋 Configured Mocks (${mocks.length} total)\n`));
        
        mocks.forEach((mock, index) => {
            const status = mock.enabled ? chalk.green('●') : chalk.gray('○');
            const priority = mock.priority === 10 ? '⬆' : mock.priority === 1 ? '⬇' : '➡';
            console.log(`${status} ${chalk.bold(index + 1)}. ${mock.name}`);
            console.log(`   ${chalk.gray('Method:')} ${chalk.yellow(mock.request.method)}`);
            console.log(`   ${chalk.gray('Endpoint:')} ${mock.request.endpoint}`);
            console.log(`   ${chalk.gray('Priority:')} ${priority} ${mock.priority}`);
            console.log(`   ${chalk.gray('Hits:')} ${mock.hitCount || 0}`);
            if (mock.description) {
                console.log(`   ${chalk.gray('Description:')} ${mock.description}`);
            }
            console.log('');
        });
    }

    async viewMockDetails() {
        const config = await fs.readJson(this.mockConfigFile);
        const mocks = config.mocks || [];
        
        if (mocks.length === 0) {
            console.log(chalk.yellow('\n⚠️  No mocks configured yet'));
            return;
        }

        const choices = mocks.map((mock, index) => ({
            name: `${mock.enabled ? '✅' : '❌'} ${mock.name} (${mock.request.method} ${mock.request.endpoint})`,
            value: index
        }));

        const { mockIndex } = await inquirer.prompt([{
            type: 'list',
            name: 'mockIndex',
            message: 'Select mock to view:',
            choices
        }]);

        const mock = mocks[mockIndex];
        
        console.log(chalk.cyan('\n🔍 Mock Details\n'));
        console.log(chalk.bold('General Information:'));
        console.log(`  ID: ${mock.id}`);
        console.log(`  Name: ${mock.name}`);
        console.log(`  Description: ${mock.description || 'None'}`);
        console.log(`  Status: ${mock.enabled ? chalk.green('Enabled') : chalk.red('Disabled')}`);
        console.log(`  Priority: ${mock.priority}`);
        console.log(`  Created: ${new Date(mock.createdAt).toLocaleString()}`);
        console.log(`  Hit Count: ${mock.hitCount || 0}`);
        if (mock.lastUsed) {
            console.log(`  Last Used: ${new Date(mock.lastUsed).toLocaleString()}`);
        }
        
        console.log(chalk.bold('\nRequest Configuration:'));
        console.log(`  Method: ${mock.request.method}`);
        console.log(`  Endpoint: ${mock.request.endpoint}`);
        if (Object.keys(mock.request.queryParams || {}).length > 0) {
            console.log(`  Query Params: ${JSON.stringify(mock.request.queryParams, null, 2)}`);
        }
        if (Object.keys(mock.request.headers).length > 0) {
            console.log(`  Headers: ${Object.keys(mock.request.headers).length} headers configured`);
        }
        if (mock.request.body) {
            console.log(`  Body: ${typeof mock.request.body === 'object' ? 'JSON' : 'Raw'} data`);
        }
        
        console.log(chalk.bold('\nResponse Configuration:'));
        console.log(`  Status Code: ${mock.response.status}`);
        console.log(`  Response Delay: ${mock.options?.delay || 0}ms`);
        
        const { showResponseData } = await inquirer.prompt([{
            type: 'confirm',
            name: 'showResponseData',
            message: 'Show response data?',
            default: false
        }]);

        if (showResponseData) {
            console.log(chalk.bold('\nResponse Data:'));
            console.log(JSON.stringify(mock.response.data, null, 2));
        }
    }

    async editMock() {
        const config = await fs.readJson(this.mockConfigFile);
        const mocks = config.mocks || [];
        
        if (mocks.length === 0) {
            console.log(chalk.yellow('\n⚠️  No mocks configured yet'));
            return;
        }

        const choices = mocks.map((mock, index) => ({
            name: `${mock.enabled ? '✅' : '❌'} ${mock.name} (${mock.request.method} ${mock.request.endpoint})`,
            value: index
        }));

        const { mockIndex } = await inquirer.prompt([{
            type: 'list',
            name: 'mockIndex',
            message: 'Select mock to edit:',
            choices
        }]);

        const mock = mocks[mockIndex];
        
        const { editField } = await inquirer.prompt([{
            type: 'list',
            name: 'editField',
            message: 'What would you like to edit?',
            choices: [
                { name: 'Name', value: 'name' },
                { name: 'Description', value: 'description' },
                { name: 'Response Data', value: 'responseData' },
                { name: 'Status Code', value: 'statusCode' },
                { name: 'Response Delay', value: 'delay' },
                { name: 'Priority', value: 'priority' },
                { name: 'Cancel', value: 'cancel' }
            ]
        }]);

        if (editField === 'cancel') return;

        switch (editField) {
            case 'name':
                const { newName } = await inquirer.prompt([{
                    type: 'input',
                    name: 'newName',
                    message: 'New name:',
                    default: mock.name
                }]);
                mock.name = newName;
                break;
                
            case 'description':
                const { newDescription } = await inquirer.prompt([{
                    type: 'input',
                    name: 'newDescription',
                    message: 'New description:',
                    default: mock.description
                }]);
                mock.description = newDescription;
                break;
                
            case 'responseData':
                const currentData = JSON.stringify(mock.response.data, null, 2);
                console.log(chalk.cyan('\nCurrent response data:'));
                console.log(chalk.gray(currentData.substring(0, 200) + (currentData.length > 200 ? '...' : '')));
                
                const { editMethod } = await inquirer.prompt([{
                    type: 'list',
                    name: 'editMethod',
                    message: 'How would you like to update the response data?',
                    choices: [
                        { name: 'Paste new data directly', value: 'paste' },
                        { name: 'Read from file', value: 'file' },
                        { name: 'Read from clipboard', value: 'clipboard' },
                        { name: 'Keep current data', value: 'keep' }
                    ]
                }]);
                
                if (editMethod === 'keep') {
                    break;
                }
                
                let newResponseData = '';
                
                if (editMethod === 'paste') {
                    const { directData } = await inquirer.prompt([{
                        type: 'input',
                        name: 'directData',
                        message: 'Paste new response data (JSON or text):',
                        default: currentData
                    }]);
                    newResponseData = directData;
                } else if (editMethod === 'file') {
                    const { dataFilePath } = await inquirer.prompt([{
                        type: 'input',
                        name: 'dataFilePath',
                        message: 'Enter path to file containing response data:',
                        validate: async (input) => {
                            if (!input.trim()) return 'File path is required';
                            try {
                                await fs.access(input);
                                return true;
                            } catch {
                                return 'File not found or not accessible';
                            }
                        }
                    }]);
                    
                    try {
                        newResponseData = await fs.readFile(dataFilePath, 'utf8');
                    } catch (error) {
                        console.log(chalk.red('Error reading file:', error.message));
                        break;
                    }
                } else if (editMethod === 'clipboard') {
                    try {
                        const { exec } = require('child_process');
                        const { promisify } = require('util');
                        const execAsync = promisify(exec);
                        
                        const { stdout } = await execAsync('pbpaste');
                        newResponseData = stdout;
                        
                        if (!newResponseData.trim()) {
                            console.log(chalk.yellow('Clipboard appears to be empty'));
                            break;
                        }
                        
                        console.log(chalk.green('✅ Read data from clipboard'));
                        console.log(chalk.gray(newResponseData.substring(0, 100) + (newResponseData.length > 100 ? '...' : '')));
                        
                        const { confirmDataClipboard } = await inquirer.prompt([{
                            type: 'confirm',
                            name: 'confirmDataClipboard',
                            message: 'Use this data from clipboard?',
                            default: true
                        }]);
                        
                        if (!confirmDataClipboard) {
                            break;
                        }
                    } catch (error) {
                        console.log(chalk.yellow('Could not read from clipboard. Using direct input instead.'));
                        const { directData } = await inquirer.prompt([{
                            type: 'input',
                            name: 'directData',
                            message: 'Paste new response data:',
                            default: currentData
                        }]);
                        newResponseData = directData;
                    }
                }
                
                // Try to parse as JSON first, if that fails, use as-is
                try {
                    mock.response.data = JSON.parse(newResponseData);
                    mock.response.headers['Content-Type'] = 'application/json';
                } catch {
                    mock.response.data = newResponseData;
                    mock.response.headers['Content-Type'] = 'text/plain';
                }
                
                console.log(chalk.green('✅ Response data updated'));
                break;
                
            case 'statusCode':
                const { newStatus } = await inquirer.prompt([{
                    type: 'number',
                    name: 'newStatus',
                    message: 'New status code:',
                    default: mock.response.status
                }]);
                mock.response.status = newStatus;
                break;
                
            case 'delay':
                const { newDelay } = await inquirer.prompt([{
                    type: 'number',
                    name: 'newDelay',
                    message: 'New delay (ms):',
                    default: mock.options?.delay || 0
                }]);
                mock.options = mock.options || {};
                mock.options.delay = newDelay;
                break;
                
            case 'priority':
                const { newPriority } = await inquirer.prompt([{
                    type: 'list',
                    name: 'newPriority',
                    message: 'New priority:',
                    choices: [
                        { name: 'High', value: 10 },
                        { name: 'Normal', value: 5 },
                        { name: 'Low', value: 1 }
                    ],
                    default: mock.priority
                }]);
                mock.priority = newPriority;
                break;
        }

        await fs.writeJson(this.mockConfigFile, config, { spaces: 2 });
        console.log(chalk.green('\n✅ Mock updated successfully!'));
    }

    async deleteMock() {
        const config = await fs.readJson(this.mockConfigFile);
        const mocks = config.mocks || [];
        
        if (mocks.length === 0) {
            console.log(chalk.yellow('\n⚠️  No mocks configured yet'));
            return;
        }

        const choices = mocks.map((mock, index) => ({
            name: `${mock.enabled ? '✅' : '❌'} ${mock.name} (${mock.request.method} ${mock.request.endpoint})`,
            value: index
        }));

        const { mockIndexes } = await inquirer.prompt([{
            type: 'checkbox',
            name: 'mockIndexes',
            message: 'Select mock(s) to delete:',
            choices
        }]);

        if (mockIndexes.length === 0) {
            console.log(chalk.gray('No mocks selected'));
            return;
        }

        const { confirmDelete } = await inquirer.prompt([{
            type: 'confirm',
            name: 'confirmDelete',
            message: `Delete ${mockIndexes.length} mock(s)?`,
            default: false
        }]);

        if (confirmDelete) {
            // Sort indexes in descending order to delete from end to start
            mockIndexes.sort((a, b) => b - a);
            mockIndexes.forEach(index => {
                mocks.splice(index, 1);
            });
            
            config.mocks = mocks;
            await fs.writeJson(this.mockConfigFile, config, { spaces: 2 });
            console.log(chalk.green(`\n✅ Deleted ${mockIndexes.length} mock(s)`));
        } else {
            console.log(chalk.gray('Deletion cancelled'));
        }
    }

    async toggleMock() {
        const config = await fs.readJson(this.mockConfigFile);
        const mocks = config.mocks || [];
        
        if (mocks.length === 0) {
            console.log(chalk.yellow('\n⚠️  No mocks configured yet'));
            return;
        }

        const choices = mocks.map((mock, index) => ({
            name: `${mock.enabled ? '✅' : '❌'} ${mock.name} (${mock.request.method} ${mock.request.endpoint})`,
            value: index
        }));

        const { mockIndexes } = await inquirer.prompt([{
            type: 'checkbox',
            name: 'mockIndexes',
            message: 'Select mock(s) to toggle:',
            choices
        }]);

        if (mockIndexes.length === 0) {
            console.log(chalk.gray('No mocks selected'));
            return;
        }

        mockIndexes.forEach(index => {
            mocks[index].enabled = !mocks[index].enabled;
        });

        await fs.writeJson(this.mockConfigFile, config, { spaces: 2 });
        
        console.log(chalk.green(`\n✅ Toggled ${mockIndexes.length} mock(s)`));
        mockIndexes.forEach(index => {
            const mock = mocks[index];
            const status = mock.enabled ? chalk.green('Enabled') : chalk.yellow('Disabled');
            console.log(`   ${mock.name}: ${status}`);
        });
    }

    async exportMocks() {
        const config = await fs.readJson(this.mockConfigFile);
        const mocks = config.mocks || [];
        
        if (mocks.length === 0) {
            console.log(chalk.yellow('\n⚠️  No mocks to export'));
            return;
        }

        const { exportPath } = await inquirer.prompt([{
            type: 'input',
            name: 'exportPath',
            message: 'Export file path:',
            default: `mocks-export-${Date.now()}.json`
        }]);

        const absolutePath = path.resolve(exportPath);
        await fs.writeJson(absolutePath, { mocks }, { spaces: 2 });
        
        console.log(chalk.green(`\n✅ Exported ${mocks.length} mock(s) to:`));
        console.log(chalk.gray(`   ${absolutePath}`));
    }

    async importMocks() {
        const { importPath } = await inquirer.prompt([{
            type: 'input',
            name: 'importPath',
            message: 'Import file path:',
            validate: async (input) => {
                if (!input) return 'File path is required';
                const absolutePath = path.resolve(input);
                if (!await fs.pathExists(absolutePath)) {
                    return 'File does not exist';
                }
                return true;
            }
        }]);

        const absolutePath = path.resolve(importPath);
        
        try {
            const importData = await fs.readJson(absolutePath);
            const importedMocks = importData.mocks || [];
            
            if (importedMocks.length === 0) {
                console.log(chalk.yellow('\n⚠️  No mocks found in import file'));
                return;
            }

            const config = await fs.readJson(this.mockConfigFile);
            const existingMocks = config.mocks || [];
            
            const { importMode } = await inquirer.prompt([{
                type: 'list',
                name: 'importMode',
                message: `Found ${importedMocks.length} mock(s). How should they be imported?`,
                choices: [
                    { name: 'Merge with existing mocks', value: 'merge' },
                    { name: 'Replace all existing mocks', value: 'replace' },
                    { name: 'Cancel', value: 'cancel' }
                ]
            }]);

            if (importMode === 'cancel') {
                console.log(chalk.gray('Import cancelled'));
                return;
            }

            if (importMode === 'replace') {
                config.mocks = importedMocks;
            } else {
                // Merge - assign new IDs to avoid conflicts
                importedMocks.forEach(mock => {
                    mock.id = this.generateMockId();
                    mock.imported = true;
                    mock.importedAt = new Date().toISOString();
                });
                config.mocks = [...existingMocks, ...importedMocks];
            }

            // Sort by priority
            config.mocks.sort((a, b) => {
                if (b.priority !== a.priority) {
                    return b.priority - a.priority;
                }
                return new Date(b.createdAt) - new Date(a.createdAt);
            });

            await fs.writeJson(this.mockConfigFile, config, { spaces: 2 });
            
            console.log(chalk.green(`\n✅ Successfully imported ${importedMocks.length} mock(s)`));
            
        } catch (error) {
            console.error(chalk.red('\n❌ Error importing mocks:'), error.message);
        }
    }
    
    // Multiline input methods (borrowed from init.js)
    initializeReadline() {
        if (!this.rl) {
            this.rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
        }
        return this.rl;
    }
    
    closeReadline() {
        if (this.rl) {
            this.rl.close();
            this.rl = null;
        }
    }
    
    askMultilineQuestion(question) {
        return new Promise((resolve) => {
            const rl = this.initializeReadline();
            console.log(chalk.cyan(question));
            console.log(chalk.gray('(Press Enter twice when finished)\n'));
            
            let lines = [];
            let emptyLineCount = 0;
            
            const handleLine = (line) => {
                if (line.trim() === '') {
                    emptyLineCount++;
                    if (emptyLineCount >= 2) {
                        rl.removeListener('line', handleLine);
                        resolve(lines.join('\n'));
                        return;
                    }
                } else {
                    emptyLineCount = 0;
                }
                lines.push(line);
            };
            
            rl.on('line', handleLine);
        });
    }
}

// Main execution
async function main() {
    const manager = new MockManager();
    await manager.run();
}

if (require.main === module) {
    main().catch(error => {
        console.error(chalk.red('❌ Error:'), error.message);
        process.exit(1);
    });
}

module.exports = MockManager;
