const fs = require('fs');
const path = require('path');
require('dotenv').config();

class ConfigLoader {
    constructor() {
        this.config = this.loadConfiguration();
    }

    loadConfiguration() {
        const config = {
            server: {
                port: process.env.PORT || 3000,
                hotReload: process.env.HOT_RELOAD === 'true'
            },
            powerPages: {
                baseUrl: process.env.BASE_URL || '',
                projectPath: process.env.PROJECT_PATH || process.cwd(),
                languages: process.env.LANGUAGES ? process.env.LANGUAGES.split(',') : ['en-US', 'he-IL']
            },
            mockUser: {
                id: process.env.MOCK_USER_ID || '',
                name: process.env.MOCK_USER_NAME || 'Test User'
            },
            auth: {
                cookies: process.env.COOKIES || '',
                requestVerificationToken: process.env.REQUEST_VERIFICATION_TOKEN || ''
            },
            proxy: {
                enabled: true,
                timeout: 30000,
                retries: 3
            }
        };

        // Try to load additional config from config.json
        try {
            const configJsonPath = path.join(process.cwd(), 'config.json');
            if (fs.existsSync(configJsonPath)) {
                const jsonConfig = JSON.parse(fs.readFileSync(configJsonPath, 'utf8'));
                this.mergeConfig(config, jsonConfig);
            }
        } catch (error) {
            console.warn('Could not load config.json:', error.message);
        }

        return config;
    }

    mergeConfig(target, source) {
        Object.keys(source).forEach(key => {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                target[key] = target[key] || {};
                this.mergeConfig(target[key], source[key]);
            } else if (source[key] !== undefined) {
                target[key] = source[key];
            }
        });
    }

    get(path) {
        return this.getNestedValue(this.config, path);
    }

    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }

    validate() {
        const errors = [];

        // Validate required fields
        if (!this.config.powerPages.baseUrl) {
            errors.push('Base URL is required');
        }

        if (!this.config.mockUser.id) {
            errors.push('Mock user ID is required');
        }

        // Note: Authentication cookies are no longer required
        // OAuth2 authentication is handled separately

        const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (this.config.mockUser.id && !guidRegex.test(this.config.mockUser.id)) {
            errors.push('Mock user ID must be a valid GUID');
        }

        if (!fs.existsSync(this.config.powerPages.projectPath)) {
            errors.push(`Project path does not exist: ${this.config.powerPages.projectPath}`);
        }

        return errors;
    }

    isConfigured() {
        return this.validate().length === 0;
    }

    getAuthHeaders() {
        const headers = {};
        
        if (this.config.auth.cookies) {
            headers['Cookie'] = this.config.auth.cookies;
        }
        
        if (this.config.auth.requestVerificationToken) {
            headers['RequestVerificationToken'] = this.config.auth.requestVerificationToken;
        }
        
        return headers;
    }

    getProxyConfig() {
        return {
            target: this.config.powerPages.baseUrl,
            changeOrigin: true,
            timeout: this.config.proxy.timeout,
            headers: this.getAuthHeaders(),
            logLevel: 'info'
        };
    }

    displayConfig() {
        console.log('\n📋 Current Configuration:');
        console.log('─'.repeat(50));
        console.log(`🌐 Base URL: ${this.config.powerPages.baseUrl}`);
        console.log(`👤 Mock User: ${this.config.mockUser.name} (${this.config.mockUser.id})`);
        console.log(`📁 Project Path: ${this.config.powerPages.projectPath}`);
        console.log(`🌍 Languages: ${this.config.powerPages.languages.join(', ')}`);
        console.log(`🌐 Port: ${this.config.server.port}`);
        console.log(`🔥 Hot Reload: ${this.config.server.hotReload ? 'Enabled' : 'Disabled'}`);
        console.log(`🔐 Authentication: Not configured`);
        console.log('         OAuth2 authentication will be checked separately');
        console.log('─'.repeat(50));
    }
}

module.exports = ConfigLoader;
