#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const readline = require('readline');

async function extractToken() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    console.log(chalk.blue('🔐 RequestVerificationToken Extractor'));
    console.log(chalk.gray('Paste your cURL command here (press Enter twice when done):\n'));

    let curlCommand = '';
    
    const askForInput = () => {
        return new Promise((resolve) => {
            const onLine = (line) => {
                if (line.trim() === '' && curlCommand.trim() !== '') {
                    rl.off('line', onLine);
                    resolve();
                } else {
                    curlCommand += line + '\n';
                }
            };
            rl.on('line', onLine);
        });
    };

    await askForInput();
    rl.close();

    // Extract RequestVerificationToken
    const tokenMatch = curlCommand.match(/__RequestVerificationToken['":\s]*([^'"\s,;&]+)/i);
    
    if (tokenMatch) {
        const token = tokenMatch[1];
        console.log(chalk.green(`✅ Found token: ${token.substring(0, 20)}...`));
        
        // Update the API proxy config
        const configPath = path.join(__dirname, '../config/api-proxy.json');
        
        if (await fs.pathExists(configPath)) {
            const config = await fs.readJson(configPath);
            config.headers['__RequestVerificationToken'] = token;
            await fs.writeJson(configPath, config, { spaces: 2 });
            console.log(chalk.green('✅ Updated API proxy configuration'));
        }
        
        // Update .env file
        const envPath = path.join(__dirname, '../.env');
        if (await fs.pathExists(envPath)) {
            let envContent = await fs.readFile(envPath, 'utf8');
            if (envContent.includes('REQUEST_VERIFICATION_TOKEN=')) {
                envContent = envContent.replace(/REQUEST_VERIFICATION_TOKEN=.*/, `REQUEST_VERIFICATION_TOKEN=${token}`);
            } else {
                envContent += `\nREQUEST_VERIFICATION_TOKEN=${token}\n`;
            }
            await fs.writeFile(envPath, envContent);
            console.log(chalk.green('✅ Updated .env file'));
        }
        
        console.log(chalk.blue('\n🚀 Token updated! Restart your server and try again.'));
    } else {
        console.log(chalk.red('❌ Could not find RequestVerificationToken in cURL command'));
        console.log(chalk.yellow('Make sure you copied a cURL that includes the __RequestVerificationToken header'));
    }
}

extractToken().catch(console.error);
