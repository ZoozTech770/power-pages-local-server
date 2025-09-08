#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');
const chalk = require('chalk');

class ExcludeManager {
    constructor() {
        this.configPath = path.join(__dirname, 'config.json');
        this.config = this.loadConfig();
    }

    loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const configContent = fs.readFileSync(this.configPath, 'utf8');
                return JSON.parse(configContent);
            }
        } catch (error) {
            console.error(chalk.red('❌ Error reading config:'), error.message);
        }
        return null;
    }

    saveConfig() {
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
            console.log(chalk.green('✅ Configuration saved successfully'));
        } catch (error) {
            console.error(chalk.red('❌ Error saving config:'), error.message);
        }
    }

    scanProjectFiles() {
        const powerPagesPath = this.config?.powerPagesPath || this.config?.powerPages?.projectPath;
        if (!powerPagesPath || !fs.existsSync(powerPagesPath)) {
            console.error(chalk.red('❌ Power Pages path not configured or invalid'));
            return [];
        }

        const files = [];
        const directories = ['web-templates', 'content-snippets'];

        directories.forEach(dir => {
            const dirPath = path.join(powerPagesPath, dir);
            if (fs.existsSync(dirPath)) {
                this.scanDirectory(dirPath, files);
            }
        });

        return files.sort();
    }

    scanDirectory(dirPath, files) {
        try {
            const items = fs.readdirSync(dirPath, { withFileTypes: true });
            
            items.forEach(item => {
                const itemPath = path.join(dirPath, item.name);
                
                if (item.isDirectory()) {
                    this.scanDirectory(itemPath, files);
                } else if (item.isFile()) {
                    const powerPagesPath = this.config?.powerPages?.projectPath || this.config?.powerPagesPath;
                    const relativePath = path.relative(powerPagesPath, itemPath);
                    files.push(relativePath);
                }
            });
        } catch (error) {
            console.warn(chalk.yellow('⚠️  Could not scan directory:'), dirPath);
        }
    }

    detectJavaScriptFiles(files) {
        const jsPatterns = [
            /\.js$/i,
            /\.min\.js$/i,
            /react/i,
            /redux/i,
            /bootstrap/i,
            /jquery/i,
            /angular/i,
            /vue/i,
            /bundle/i,
            /vendor/i,
            /library/i,
            /lib/i,
            /dist/i
        ];

        return files.filter(file => {
            const fileName = path.basename(file).toLowerCase();
            return jsPatterns.some(pattern => pattern.test(fileName));
        });
    }

    async showCurrentExcludes() {
        const excludes = this.config?.liquidExcludes || [];
        
        console.log(chalk.cyan('\n📝 Current file exclusions:'));
        if (excludes.length === 0) {
            console.log(chalk.gray('   No files are currently excluded'));
        } else {
            excludes.forEach((file, index) => {
                console.log(chalk.gray(`   ${index + 1}. ${file}`));
            });
        }
        console.log('');
    }

    async manageExcludes() {
        if (!this.config) {
            console.error(chalk.red('❌ No configuration found. Please run "npm run init" first.'));
            return;
        }

        console.log(chalk.blue('🔧 Power Pages Local Server - File Exclusion Manager'));
        console.log(chalk.gray('Manage files that should be excluded from Liquid template processing\n'));

        await this.showCurrentExcludes();

        const action = await inquirer.prompt([{
            type: 'list',
            name: 'action',
            message: 'What would you like to do?',
            choices: [
                { name: '➕ Add files to exclusion list', value: 'add' },
                { name: '➖ Remove files from exclusion list', value: 'remove' },
                { name: '🔄 Replace entire exclusion list', value: 'replace' },
                { name: '👀 View current exclusion list', value: 'view' },
                { name: '🚪 Exit', value: 'exit' }
            ]
        }]);

        switch (action.action) {
            case 'add':
                await this.addExcludes();
                break;
            case 'remove':
                await this.removeExcludes();
                break;
            case 'replace':
                await this.replaceExcludes();
                break;
            case 'view':
                await this.showCurrentExcludes();
                await this.manageExcludes();
                break;
            case 'exit':
                console.log(chalk.green('👋 Goodbye!'));
                return;
        }
    }

    async addExcludes() {
        console.log(chalk.cyan('🔍 Scanning project files...'));
        const allFiles = this.scanProjectFiles();
        const currentExcludes = this.config.liquidExcludes || [];
        
        // Filter out already excluded files
        const availableFiles = allFiles.filter(file => !currentExcludes.includes(file));
        
        if (availableFiles.length === 0) {
            console.log(chalk.yellow('⚠️  No additional files available to exclude'));
            return await this.manageExcludes();
        }

        const jsFiles = this.detectJavaScriptFiles(availableFiles);
        
        console.log(chalk.cyan(`\n📁 Found ${availableFiles.length} files (${jsFiles.length} detected as JavaScript)`));

        const choices = availableFiles.map(file => ({
            name: jsFiles.includes(file) ? 
                chalk.yellow(`${file} ${chalk.gray('(JS detected)')}`) : 
                file,
            value: file,
            checked: jsFiles.includes(file)
        }));

        const selected = await inquirer.prompt([{
            type: 'checkbox',
            name: 'files',
            message: 'Select files to add to exclusion list (Space to select, Enter to confirm):',
            choices: choices,
            pageSize: 15
        }]);

        if (selected.files.length > 0) {
            this.config.liquidExcludes = [...currentExcludes, ...selected.files];
            this.saveConfig();
            console.log(chalk.green(`✅ Added ${selected.files.length} files to exclusion list`));
        } else {
            console.log(chalk.gray('No files selected'));
        }

        await this.manageExcludes();
    }

    async removeExcludes() {
        const currentExcludes = this.config.liquidExcludes || [];
        
        if (currentExcludes.length === 0) {
            console.log(chalk.yellow('⚠️  No files are currently excluded'));
            return await this.manageExcludes();
        }

        const selected = await inquirer.prompt([{
            type: 'checkbox',
            name: 'files',
            message: 'Select files to remove from exclusion list:',
            choices: currentExcludes.map(file => ({ name: file, value: file })),
            pageSize: 15
        }]);

        if (selected.files.length > 0) {
            this.config.liquidExcludes = currentExcludes.filter(file => !selected.files.includes(file));
            this.saveConfig();
            console.log(chalk.green(`✅ Removed ${selected.files.length} files from exclusion list`));
        } else {
            console.log(chalk.gray('No files selected'));
        }

        await this.manageExcludes();
    }

    async replaceExcludes() {
        console.log(chalk.cyan('🔍 Scanning project files...'));
        const allFiles = this.scanProjectFiles();
        const jsFiles = this.detectJavaScriptFiles(allFiles);
        
        console.log(chalk.cyan(`\n📁 Found ${allFiles.length} files (${jsFiles.length} detected as JavaScript)`));

        const choices = allFiles.map(file => ({
            name: jsFiles.includes(file) ? 
                chalk.yellow(`${file} ${chalk.gray('(JS detected)')}`) : 
                file,
            value: file,
            checked: jsFiles.includes(file)
        }));

        const selected = await inquirer.prompt([{
            type: 'checkbox',
            name: 'files',
            message: 'Select ALL files that should be excluded from Liquid processing:',
            choices: choices,
            pageSize: 15
        }]);

        const confirmReplace = await inquirer.prompt([{
            type: 'confirm',
            name: 'confirm',
            message: `Replace entire exclusion list with ${selected.files.length} selected files?`,
            default: false
        }]);

        if (confirmReplace.confirm) {
            this.config.liquidExcludes = selected.files;
            this.saveConfig();
            console.log(chalk.green(`✅ Replaced exclusion list with ${selected.files.length} files`));
        } else {
            console.log(chalk.gray('Operation cancelled'));
        }

        await this.manageExcludes();
    }
}

// Main execution
async function main() {
    const manager = new ExcludeManager();
    await manager.manageExcludes();
}

if (require.main === module) {
    main().catch(error => {
        console.error(chalk.red('❌ Error:'), error.message);
        process.exit(1);
    });
}

module.exports = ExcludeManager;
