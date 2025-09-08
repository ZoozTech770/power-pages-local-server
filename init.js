#!/usr/bin/env node

const readline = require('readline');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { execSync } = require('child_process');
const glob = require('glob');
const inquirer = require('inquirer');

class PowerPagesInitializer {
    constructor() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        this.config = {
            baseUrl: '',
            userId: '',
            requestVerificationToken: '',
            projectPath: '',
            port: 3000,
            languages: ['en-US', 'he-IL'],
            mockUserName: '',
            hotReload: true,
            liquidExcludes: []
        };
        
        // Load existing configuration if available
        this.loadExistingConfig();
    }

    async init() {
        console.log(chalk.blue.bold('\n🚀 Power Pages Local Server Initializer\n'));
        console.log(chalk.gray('This tool will help you set up your Power Pages local development environment.\n'));
        
        // Show existing configuration status
        if (this.config.baseUrl || this.config.userId || this.config.projectPath) {
            console.log(chalk.blue('📄 Existing Configuration Found:'));
            if (this.config.baseUrl) console.log(chalk.gray(`   Base URL: ${this.config.baseUrl}`));
            if (this.config.userId) console.log(chalk.gray(`   User ID: ${this.config.userId.substring(0, 8)}...`));
            if (this.config.projectPath) console.log(chalk.gray(`   Project Path: ${this.config.projectPath}`));
            console.log(chalk.gray('   (Press Enter to keep existing values)\n'));
        }

        try {
            await this.gatherConfiguration();
            await this.validateConfiguration();
            await this.setupLiquidExclusions();
            await this.generateConfigFiles();
            await this.installDependencies();
            
            console.log(chalk.green.bold('\n✅ Initialization complete!'));
            console.log(chalk.yellow('\nNext steps:'));
            console.log(chalk.blue('1. Set up OAuth2 authentication:'));
            console.log(chalk.cyan('   npm run auth'));
            console.log(chalk.blue('2. Start your server:'));
            console.log(chalk.cyan('   npm start'));
            console.log(chalk.blue('3. Or use development mode with auto-restart:'));
            console.log(chalk.cyan('   npm run dev'));
            console.log(chalk.gray('\nNote: OAuth2 provides secure, token-based authentication'));
            console.log(chalk.gray('No more need to extract tokens from cURL commands!'));
            
        } catch (error) {
            console.error(chalk.red('\n❌ Initialization failed:'), error.message);
            process.exit(1);
        } finally {
            this.rl.close();
        }
    }

    async gatherConfiguration() {
        console.log(chalk.yellow.bold('📋 Configuration Setup\n'));

        // Get base URL from user
        console.log(chalk.yellow('🔐 Site Setup'));
        console.log(chalk.gray('We\'ll use OAuth2 authentication for secure API access.'));
        console.log(chalk.gray('No need to paste cURL examples - OAuth2 handles authentication automatically!'));
        
        const baseUrlPrompt = this.config.baseUrl 
            ? `\n🌐 Enter your Power Pages base URL [${this.config.baseUrl}]: `
            : '\n🌐 Enter your Power Pages base URL (e.g., https://yoursite.powerappsportals.com): ';
            
        const baseUrlInput = await this.askQuestion(baseUrlPrompt);
        this.config.baseUrl = baseUrlInput || this.config.baseUrl;
        
        if (!this.config.baseUrl || !this.config.baseUrl.startsWith('http')) {
            throw new Error('Please enter a valid URL starting with https://');
        }

        // Get user ID for mock user
        const userIdPrompt = this.config.userId 
            ? `\n👤 Enter the user ID for mock user (GUID format) [${this.config.userId}]: `
            : '\n👤 Enter the user ID for mock user (GUID format): ';
            
        const userIdInput = await this.askQuestion(userIdPrompt);
        this.config.userId = userIdInput || this.config.userId;

        // Get project path with validation
        await this.getValidProjectPath();

        // Use default values for these settings
        this.config.port = 3000;
        this.config.languages = ['en-US', 'he-IL'];
        this.config.mockUserName = 'Test User';
        this.config.hotReload = true;
        
        console.log(chalk.gray('\nℹ️  Using default settings:'));
        console.log(chalk.gray(`  • Port: ${this.config.port}`));
        console.log(chalk.gray(`  • Languages: ${this.config.languages.join(', ')}`));
        console.log(chalk.gray(`  • Mock User Name: ${this.config.mockUserName}`));
        console.log(chalk.gray(`  • Hot Reload: Enabled`));
    }

    // OAuth2 authentication is now handled by separate auth commands
    // No need to parse cURL examples anymore
    
    loadExistingConfig() {
        try {
            // Load from .env file
            if (fs.existsSync('.env')) {
                const envContent = fs.readFileSync('.env', 'utf8');
                const envLines = envContent.split('\n');
                
                envLines.forEach(line => {
                    if (line.includes('BASE_URL=')) {
                        this.config.baseUrl = line.split('=')[1] || '';
                    }
                    if (line.includes('MOCK_USER_ID=')) {
                        this.config.userId = line.split('=')[1] || '';
                    }
                    if (line.includes('PROJECT_PATH=')) {
                        this.config.projectPath = line.split('=')[1] || '';
                    }
                    if (line.includes('PORT=')) {
                        const port = parseInt(line.split('=')[1]);
                        if (!isNaN(port)) this.config.port = port;
                    }
                    if (line.includes('MOCK_USER_NAME=')) {
                        this.config.mockUserName = line.split('=')[1] || '';
                    }
                    if (line.includes('LANGUAGES=')) {
                        const languages = line.split('=')[1];
                        if (languages) {
                            this.config.languages = languages.split(',');
                        }
                    }
                    if (line.includes('HOT_RELOAD=')) {
                        this.config.hotReload = line.split('=')[1] === 'true';
                    }
                });
            }
            
            // Load from config.json if available
            if (fs.existsSync('config.json')) {
                const configJson = JSON.parse(fs.readFileSync('config.json', 'utf8'));
                
                if (configJson.powerPages?.baseUrl) {
                    this.config.baseUrl = configJson.powerPages.baseUrl;
                }
                if (configJson.mockUser?.id) {
                    this.config.userId = configJson.mockUser.id;
                }
                if (configJson.mockUser?.name) {
                    this.config.mockUserName = configJson.mockUser.name;
                }
                if (configJson.powerPages?.projectPath) {
                    this.config.projectPath = configJson.powerPages.projectPath;
                }
                if (configJson.server?.port) {
                    this.config.port = configJson.server.port;
                }
                if (configJson.powerPages?.languages) {
                    this.config.languages = configJson.powerPages.languages;
                }
                if (configJson.server?.hotReload !== undefined) {
                    this.config.hotReload = configJson.server.hotReload;
                }
                if (configJson.liquidExcludes) {
                    this.config.liquidExcludes = configJson.liquidExcludes;
                }
            }
        } catch (error) {
            // Ignore errors - just use defaults
            console.log(chalk.gray('ℹ️  No existing configuration found, using defaults'));
        }
    }

    async validateConfiguration() {
        console.log(chalk.yellow('\n🔍 Validating configuration...'));

        // Validate base URL
        if (!this.config.baseUrl || !this.config.baseUrl.startsWith('http')) {
            throw new Error('Invalid base URL. Must start with http:// or https://');
        }

        // Validate user ID (should be GUID format)
        const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!guidRegex.test(this.config.userId)) {
            throw new Error('Invalid user ID format. Must be a valid GUID');
        }

        // Validate project path
        if (!fs.existsSync(this.config.projectPath)) {
            throw new Error(`Project path does not exist: ${this.config.projectPath}`);
        }

        // Validate port
        if (this.config.port < 1 || this.config.port > 65535) {
            throw new Error('Invalid port number. Must be between 1 and 65535');
        }

        console.log(chalk.green('✅ Configuration validated successfully'));
        console.log(chalk.blue('🔐 OAuth2 authentication will be set up separately'));
        console.log(chalk.gray('   Run "npm run auth" after initialization to authenticate'));
    }

    async setupLiquidExclusions() {
        console.log(chalk.yellow('\n🎯 Liquid Processing Exclusions Setup'));
        console.log(chalk.gray('Select files to exclude from Liquid template processing\n'));
        
        // Scan project files
        const projectFiles = await this.scanProjectFiles();
        
        if (projectFiles.length === 0) {
            console.log(chalk.yellow('⚠️  No template files found in project'));
            return;
        }
        
        // Show detected JavaScript files
        const jsFiles = projectFiles.filter(f => f.isJavaScript);
        if (jsFiles.length > 0) {
            console.log(chalk.blue('🔍 Detected JavaScript files:'));
            jsFiles.forEach((file, index) => {
                console.log(chalk.gray(`  ${index + 1}. ${file.name} (${file.type}) - ${file.size} chars`));
            });
            
            const preSelectJS = await this.askQuestion(
                '\n✨ Auto-exclude all detected JavaScript files? [Y/n]: ',
                'Y'
            );
            
            if (preSelectJS.toLowerCase() !== 'n') {
                this.config.liquidExcludes = jsFiles.map(f => f.name);
                console.log(chalk.green(`✅ Pre-selected ${jsFiles.length} JavaScript files`));
            }
        }
        
        // Interactive selection with inquirer
        const wantManualSelection = await this.askQuestion(
            '\n🎛️  Do you want to manually select/deselect files? [y/N]: ',
            'N'
        );
        
        if (wantManualSelection.toLowerCase() === 'y') {
            await this.inquirerFileSelection(projectFiles);
        }
        
        // Show final selection
        if (this.config.liquidExcludes.length > 0) {
            console.log(chalk.green(`\n✅ Selected ${this.config.liquidExcludes.length} files to exclude:`));
            this.config.liquidExcludes.forEach(name => {
                const file = projectFiles.find(f => f.name === name);
                console.log(chalk.gray(`  - ${name} (${file ? file.type : 'unknown'})`));
            });
        } else {
            console.log(chalk.yellow('⚠️  No files excluded from Liquid processing'));
        }
    }

    async scanProjectFiles() {
        console.log(chalk.gray('🔍 Scanning project files...'));
        
        const templatesPath = path.join(this.config.projectPath, 'web-templates');
        const snippetsPath = path.join(this.config.projectPath, 'content-snippets');
        
        const files = [];
        
        // Scan web-templates
        if (fs.existsSync(templatesPath)) {
            // Use forward slashes for glob pattern even on Windows
            const templatePattern = templatesPath.replace(/\\/g, '/') + '/**/*.webtemplate.source.html';
            const templateFiles = glob.sync(templatePattern);
            
            for (const file of templateFiles) {
                const relativePath = path.relative(templatesPath, file);
                const templateName = path.basename(path.dirname(relativePath));
                
                try {
                    const content = fs.readFileSync(file, 'utf8');
                    files.push({
                        name: templateName,
                        path: relativePath,
                        type: 'template',
                        size: content.length,
                        isJavaScript: this.detectJavaScript(content, templateName),
                        fullPath: file
                    });
                } catch (error) {
                    console.log(chalk.yellow(`⚠️  Could not read ${file}: ${error.message}`));
                }
            }
        }
        
        // Scan content-snippets  
        if (fs.existsSync(snippetsPath)) {
            // Use forward slashes for glob pattern even on Windows
            const snippetPattern = snippetsPath.replace(/\\/g, '/') + '/**/*.html';
            const snippetFiles = glob.sync(snippetPattern);
            
            for (const file of snippetFiles) {
                const relativePath = path.relative(snippetsPath, file);
                const snippetName = path.basename(path.dirname(relativePath));
                
                try {
                    const content = fs.readFileSync(file, 'utf8');
                    files.push({
                        name: snippetName,
                        path: relativePath,
                        type: 'snippet',
                        size: content.length,
                        isJavaScript: this.detectJavaScript(content, snippetName),
                        fullPath: file
                    });
                } catch (error) {
                    console.log(chalk.yellow(`⚠️  Could not read ${file}: ${error.message}`));
                }
            }
        }
        
        // Remove duplicates and sort
        const uniqueFiles = files.filter((file, index, self) => 
            index === self.findIndex(f => f.name === file.name && f.type === file.type)
        );
        
        console.log(chalk.green(`Found ${uniqueFiles.length} unique files`));
        return uniqueFiles.sort((a, b) => a.name.localeCompare(b.name));
    }

    detectJavaScript(content, fileName) {
        // File name patterns
        const jsFilePatterns = [
            /\.js$/i,
            /react/i,
            /redux/i,
            /bootstrap/i,
            /jquery/i,
            /babel/i,
            /webpack/i,
            /polyfill/i
        ];
        
        const hasJSFileName = jsFilePatterns.some(pattern => pattern.test(fileName));
        
        // Content patterns
        const jsContentPatterns = [
            /function\s*\(/,
            /var\s+\w+\s*=/,
            /const\s+\w+\s*=/,
            /let\s+\w+\s*=/,
            /console\./,
            /window\./,
            /document\./,
            /React\./,
            /ReactDOM\./,
            /typeof\s+\w+/,
            /"use strict"/,
            /!function\(/,
            /\bexports\b/,
            /\bmodule\b/,
            /define\(/,
            /__SECRET_INTERNALS/,
            /ReactCurrentDispatcher/,
            /"object"==typeof/
        ];
        
        let jsIndicatorCount = 0;
        jsContentPatterns.forEach(pattern => {
            if (pattern.test(content)) {
                jsIndicatorCount++;
            }
        });
        
        // Additional heuristics
        const hasMinifiedPattern = /!function\(\w+,\w+\)\{/.test(content);
        const hasUMDPattern = /"object"==typeof exports&&"undefined"!=typeof module/.test(content);
        const isLargeFile = content.length > 50000;
        const hasManyFunctions = (content.match(/function/g) || []).length > 10;
        
        return hasJSFileName || 
               jsIndicatorCount >= 3 || 
               hasMinifiedPattern || 
               hasUMDPattern || 
               (isLargeFile && hasManyFunctions);
    }

    async inquirerFileSelection(projectFiles) {
        console.log(chalk.blue('\n📋 Interactive File Selection'));
        console.log(chalk.gray('Use arrow keys to navigate, SPACE to select/deselect, ENTER to confirm\n'));
        
        // Create choices for inquirer
        const choices = projectFiles.map(file => ({
            name: `${file.name} (${file.type}) - ${file.size} chars ${file.isJavaScript ? chalk.yellow('🟨 JS') : ''}`,
            value: file.name,
            checked: this.config.liquidExcludes.includes(file.name)
        }));
        
        // Use inquirer checkbox prompt (v8 syntax)
        const answers = await inquirer.prompt([{
            type: 'checkbox',
            name: 'selectedFiles',
            message: 'Select files to exclude from Liquid processing:',
            choices: choices,
            pageSize: 15
        }]);
        
        this.config.liquidExcludes = answers.selectedFiles;
    }

    async simpleFileSelection(projectFiles) {
        console.log(chalk.blue('\n📋 Simple File Selection'));
        console.log(chalk.gray('Enter comma-separated file numbers or names\n'));
        
        // Display files with numbers
        projectFiles.forEach((file, index) => {
            const isSelected = this.config.liquidExcludes.includes(file.name);
            const marker = isSelected ? chalk.green('[✓]') : '[ ]';
            const jsIndicator = file.isJavaScript ? chalk.yellow('🟨 JS') : '';
            
            console.log(`${String(index + 1).padStart(3)}. ${marker} ${file.name} (${file.type}) - ${file.size} chars ${jsIndicator}`);
        });
        
        const input = await this.askQuestion(
            '\nEnter file numbers to toggle (e.g., 1,3,5) or "all"/"none"/"js": '
        );
        
        if (input.toLowerCase() === 'all') {
            this.config.liquidExcludes = projectFiles.map(f => f.name);
        } else if (input.toLowerCase() === 'none') {
            this.config.liquidExcludes = [];
        } else if (input.toLowerCase() === 'js') {
            this.config.liquidExcludes = projectFiles
                .filter(f => f.isJavaScript)
                .map(f => f.name);
        } else {
            // Parse numbers
            const numbers = input.split(/[,\s]+/)
                .map(n => parseInt(n.trim()))
                .filter(n => !isNaN(n) && n >= 1 && n <= projectFiles.length);
            
            numbers.forEach(num => {
                const file = projectFiles[num - 1];
                const index = this.config.liquidExcludes.indexOf(file.name);
                
                if (index === -1) {
                    this.config.liquidExcludes.push(file.name);
                } else {
                    this.config.liquidExcludes.splice(index, 1);
                }
            });
        }
    }

    async generateConfigFiles() {
        console.log(chalk.yellow('\n📝 Generating configuration files...'));

        // Generate .env file
        const envContent = `# Power Pages Local Server Configuration
# Generated on ${new Date().toISOString()}

# Server Configuration
PORT=${this.config.port}
HOT_RELOAD=${this.config.hotReload}

# Power Pages Configuration
BASE_URL=${this.config.baseUrl}
PROJECT_PATH=${this.config.projectPath}
LANGUAGES=${this.config.languages.join(',')}

# Mock User Configuration
MOCK_USER_ID=${this.config.userId}
MOCK_USER_NAME=${this.config.mockUserName}

# Authentication is now handled by OAuth2
# Run 'npm run auth' to set up authentication
`;

        fs.writeFileSync('.env', envContent);
        console.log(chalk.green('✅ Generated .env file'));

        // Generate config.json
        const configContent = {
            server: {
                port: this.config.port,
                hotReload: this.config.hotReload
            },
            powerPages: {
                baseUrl: this.config.baseUrl,
                projectPath: this.config.projectPath,
                languages: this.config.languages
            },
            mockUser: {
                id: this.config.userId,
                name: this.config.mockUserName
            },
            proxy: {
                enabled: true,
                timeout: 30000,
                retries: 3
            },
            liquidExcludes: this.config.liquidExcludes
        };

        fs.writeFileSync('config.json', JSON.stringify(configContent, null, 2));
        console.log(chalk.green('✅ Generated config.json file'));

        // Update API proxy configuration
        this.updateApiProxyConfig();

        // Update .gitignore
        const gitignoreContent = `# Power Pages Local Server
.env
*.log
node_modules/
.DS_Store
.vscode/
*.tmp
*.cache

# Authentication files (keep secure!)
auth.json
cookies.txt
`;

        fs.writeFileSync('.gitignore', gitignoreContent);
        console.log(chalk.green('✅ Generated .gitignore file'));

        // Generate package.json scripts if needed
        this.updatePackageJsonScripts();
    }

    updateApiProxyConfig() {
        try {
            // Ensure config directory exists
            const configDir = path.join(process.cwd(), 'config');
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }

            // Create API proxy configuration
            const apiProxyConfig = {
                enabled: true,
                baseUrl: this.config.baseUrl,
                note: "OAuth2 authentication is now used - this legacy config is kept for reference",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "Prefer": "odata.include-annotations=*"
                },
                useAuthorizationHeader: false,
                useOAuth2: true
            };

            const apiProxyPath = path.join(configDir, 'api-proxy.json');
            fs.writeFileSync(apiProxyPath, JSON.stringify(apiProxyConfig, null, 2));
            console.log(chalk.green('✅ Updated API proxy configuration'));
            console.log(chalk.gray(`   Base URL: ${this.config.baseUrl}`));
            console.log(chalk.gray(`   Authentication: OAuth2 (configure with 'npm run auth')`));
            
        } catch (error) {
            console.log(chalk.yellow('⚠️  Could not update API proxy config:', error.message));
        }
    }

    updatePackageJsonScripts() {
        try {
            const packageJsonPath = 'package.json';
            let packageJson = {};
            
            if (fs.existsSync(packageJsonPath)) {
                packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            }

            // Ensure scripts section exists
            if (!packageJson.scripts) {
                packageJson.scripts = {};
            }

            // Add/update scripts
            packageJson.scripts = {
                ...packageJson.scripts,
                "start": "node server.js",
                "dev": "nodemon server.js",
                "init": "node init.js",
                "test": "npm start",
                "clean": "rm -rf node_modules package-lock.json && npm install"
            };

            // Add dependencies if not present
            if (!packageJson.dependencies) {
                packageJson.dependencies = {};
            }

            const requiredDeps = {
                "express": "^4.18.2",
                "liquidjs": "^10.9.2",
                "http-proxy-middleware": "^2.0.6",
                "chalk": "^4.1.2",
                "chokidar": "^3.5.3",
                "cors": "^2.8.5",
                "dotenv": "^16.3.1",
                "glob": "^10.3.0",
                "inquirer": "^9.0.0"
            };

            Object.keys(requiredDeps).forEach(dep => {
                if (!packageJson.dependencies[dep]) {
                    packageJson.dependencies[dep] = requiredDeps[dep];
                }
            });

            fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
            console.log(chalk.green('✅ Updated package.json'));
            
        } catch (error) {
            console.log(chalk.yellow('⚠️  Could not update package.json:', error.message));
        }
    }

    async installDependencies() {
        console.log(chalk.yellow('\n📦 Installing dependencies...'));
        
        try {
            execSync('npm install', { stdio: 'inherit' });
            console.log(chalk.green('✅ Dependencies installed successfully'));
        } catch (error) {
            console.log(chalk.yellow('⚠️  Could not install dependencies automatically'));
            console.log(chalk.gray('Please run "npm install" manually'));
        }
    }

    askQuestion(question, defaultValue = '') {
        return new Promise((resolve) => {
            const prompt = defaultValue ? `${question}[${defaultValue}] ` : question;
            this.rl.question(chalk.cyan(prompt), (answer) => {
                resolve(answer.trim() || defaultValue);
            });
        });
    }

    askMultilineQuestion(question) {
        return new Promise((resolve) => {
            console.log(chalk.cyan(question));
            let lines = [];
            let emptyLineCount = 0;
            
            const handleLine = (line) => {
                if (line.trim() === '') {
                    emptyLineCount++;
                    if (emptyLineCount >= 2) {
                        this.rl.removeListener('line', handleLine);
                        resolve(lines.join('\n'));
                        return;
                    }
                } else {
                    emptyLineCount = 0;
                }
                lines.push(line);
            };
            
            this.rl.on('line', handleLine);
        });
    }

    extractBaseUrl(url) {
        try {
            // Handle cases where user provides full URL with path
            const urlObj = new URL(url);
            return `${urlObj.protocol}//${urlObj.hostname}`;
        } catch (error) {
            // If URL parsing fails, return as-is (might be already a base URL)
            return url;
        }
    }

    async getValidProjectPath() {
        let isValid = false;
        let attempts = 0;
        const maxAttempts = 5;
        
        while (!isValid && attempts < maxAttempts) {
            attempts++;
            
            let defaultPath = '';
            if (attempts === 1) {
                defaultPath = this.config.projectPath || process.cwd();
            }
            
            const prompt = this.config.projectPath && attempts === 1 
                ? `\n📁 Enter the path to your Power Pages project files [${this.config.projectPath}]: `
                : '\n📁 Enter the path to your Power Pages project files: ';
                
            const projectPathInput = await this.askQuestion(prompt, defaultPath);
            const projectPath = projectPathInput || this.config.projectPath || process.cwd();
            
            if (!fs.existsSync(projectPath)) {
                console.log(chalk.red(`❌ Path does not exist: ${projectPath}`));
                continue;
            }
            
            const validation = this.isValidPowerPagesProject(projectPath);
            
            if (validation.isValid) {
                this.config.projectPath = projectPath;
                console.log(chalk.green(`✅ Valid Power Pages project detected!`));
                console.log(chalk.gray(`   Found: ${validation.foundItems.join(', ')}`));
                isValid = true;
            } else {
                console.log(chalk.red(`❌ Invalid Power Pages project path`));
                console.log(chalk.gray(`   Missing required directories/files: ${validation.missingItems.join(', ')}`));
                console.log(chalk.gray(`   A valid Power Pages project should contain: web-pages, web-templates, content-snippets`));
                
                if (attempts >= maxAttempts) {
                    throw new Error('Maximum attempts reached. Please provide a valid Power Pages project path.');
                }
                
                console.log(chalk.yellow(`   Please try again (${attempts}/${maxAttempts})`));
            }
        }
    }

    isValidPowerPagesProject(projectPath) {
        // Essential directories for a Power Pages project
        const requiredItems = [
            'web-pages',
            'web-templates', 
            'content-snippets'
        ];
        
        // Optional but common items
        const optionalItems = [
            'web-files',
            'page-templates',
            'website.yml',
            'sitesetting.yml',
            '.portalconfig'
        ];
        
        const foundItems = [];
        const missingItems = [];
        
        // Check required items
        for (const item of requiredItems) {
            const itemPath = path.join(projectPath, item);
            if (fs.existsSync(itemPath)) {
                foundItems.push(item);
            } else {
                missingItems.push(item);
            }
        }
        
        // Check optional items
        for (const item of optionalItems) {
            const itemPath = path.join(projectPath, item);
            if (fs.existsSync(itemPath)) {
                foundItems.push(item);
            }
        }
        
        // A valid Power Pages project should have at least the 3 required directories
        const isValid = missingItems.length === 0;
        
        return {
            isValid,
            foundItems,
            missingItems,
            confidence: foundItems.length / (requiredItems.length + optionalItems.length)
        };
    }

    displaySummary() {
        console.log(chalk.blue.bold('\n📋 Configuration Summary'));
        console.log(chalk.gray('─'.repeat(50)));
        console.log(chalk.yellow('Base URL:'), this.config.baseUrl);
        console.log(chalk.yellow('User ID:'), this.config.userId);
        console.log(chalk.yellow('Project Path:'), this.config.projectPath);
        console.log(chalk.yellow('Port:'), this.config.port);
        console.log(chalk.yellow('Languages:'), this.config.languages.join(', '));
        console.log(chalk.yellow('Mock User:'), this.config.mockUserName);
        console.log(chalk.yellow('Hot Reload:'), this.config.hotReload ? 'Enabled' : 'Disabled');
        console.log(chalk.gray('─'.repeat(50)));
    }
}

// Run the initializer
if (require.main === module) {
    const initializer = new PowerPagesInitializer();
    initializer.init().catch(console.error);
}

module.exports = PowerPagesInitializer;
