const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

class MockMiddleware {
    constructor() {
        this.mockConfigFile = path.join(__dirname, '..', 'mocks', 'mock-config.json');
        this.mocks = [];
        this.loadMocks();
        
        // Watch for changes to mock config
        this.watchMockConfig();
    }

    async loadMocks() {
        try {
            if (await fs.pathExists(this.mockConfigFile)) {
                const config = await fs.readJson(this.mockConfigFile);
                this.mocks = (config.mocks || []).filter(mock => mock.enabled);
                console.log(chalk.cyan(`📦 Loaded ${this.mocks.length} active mock(s)`));
            }
        } catch (error) {
            console.error(chalk.red('❌ Error loading mocks:'), error.message);
            this.mocks = [];
        }
    }

    watchMockConfig() {
        if (fs.existsSync(this.mockConfigFile)) {
            fs.watch(path.dirname(this.mockConfigFile), (eventType, filename) => {
                if (filename === 'mock-config.json') {
                    console.log(chalk.blue('🔄 Mock configuration changed, reloading...'));
                    this.loadMocks();
                }
            });
        }
    }

    /**
     * Express middleware function
     */
    middleware() {
        return async (req, res, next) => {
            // Debug: Log every request that comes through mock middleware
            console.log(chalk.gray(`🔍 Mock middleware checking: ${req.method} ${req.path}`));
            
            // Find matching mock
            const mock = this.findMatchingMock(req);
            
            if (!mock) {
                // No mock found, continue to next middleware (proxy)
                console.log(chalk.gray(`   ↳ No mock found, passing to next middleware`));
                return next();
            }

            console.log(chalk.green(`🎭 Mock matched: ${mock.name}`));
            console.log(chalk.gray(`   ${req.method} ${req.path}`));

            // Update mock statistics
            await this.updateMockStats(mock.id);

            // Apply response delay if configured
            if (mock.options?.delay > 0) {
                await new Promise(resolve => setTimeout(resolve, mock.options.delay));
            }

            // Set response headers
            if (mock.response.headers) {
                Object.entries(mock.response.headers).forEach(([key, value]) => {
                    res.setHeader(key, value);
                });
            }

            // Send response
            res.status(mock.response.status || 200);
            
            if (typeof mock.response.data === 'object') {
                res.json(mock.response.data);
            } else {
                res.send(mock.response.data);
            }
        };
    }

    findMatchingMock(req) {
        console.log(chalk.gray(`   Checking ${this.mocks.length} mock(s)...`));
        
        // Sort mocks by priority (already sorted in config)
        for (const mock of this.mocks) {
            console.log(chalk.gray(`   Checking mock: ${mock.name} [${mock.request.method} ${mock.request.endpoint}]`));
            
            if (this.matchesRequest(mock, req)) {
                console.log(chalk.green(`   ✓ Mock matched!`));
                return mock;
            }
        }
        return null;
    }

    matchesRequest(mock, req) {
        // Check method
        if (mock.request.method !== req.method.toUpperCase()) {
            return false;
        }

        // Extract path from mock endpoint (remove query parameters if any)
        let mockPath = mock.request.endpoint;
        if (mockPath.includes('?')) {
            mockPath = mockPath.split('?')[0];
        }
        
        const reqPath = req.path;

        // Exact path match
        if (mockPath === reqPath) {
            // If mock has query parameters, check them too
            if (mock.request.queryParams && Object.keys(mock.request.queryParams).length > 0) {
                return this.matchesQueryParams(mock.request.queryParams, req.query);
            }
            return true;
        }

        // Pattern matching (support wildcards)
        if (mockPath.includes('*')) {
            const pattern = mockPath
                .replace(/\*/g, '.*')
                .replace(/\//g, '\\/');
            const regex = new RegExp(`^${pattern}$`);
            if (regex.test(reqPath)) {
                // If path matches, also check query params if they exist
                if (mock.request.queryParams && Object.keys(mock.request.queryParams).length > 0) {
                    return this.matchesQueryParams(mock.request.queryParams, req.query);
                }
                return true;
            }
        }

        // Path parameter matching (e.g., /api/users/:id)
        if (mockPath.includes(':')) {
            const pattern = mockPath
                .replace(/:[^\/]+/g, '[^/]+')
                .replace(/\//g, '\\/');
            const regex = new RegExp(`^${pattern}$`);
            if (regex.test(reqPath)) {
                // If path matches, also check query params if they exist
                if (mock.request.queryParams && Object.keys(mock.request.queryParams).length > 0) {
                    return this.matchesQueryParams(mock.request.queryParams, req.query);
                }
                return true;
            }
        }

        return false;
    }
    
    /**
     * Check if query parameters match
     * For flexibility, we'll match key query parameters but allow additional ones
     */
    matchesQueryParams(mockQueryParams, reqQueryParams) {
        // If mock has no query params, any request matches
        if (!mockQueryParams || Object.keys(mockQueryParams).length === 0) {
            return true;
        }
        
        // Check if all mock query params exist in request
        // For $select, we'll be more flexible and check if key fields are present
        for (const [key, mockValue] of Object.entries(mockQueryParams)) {
            const reqValue = reqQueryParams[key];
            
            if (!reqValue) {
                return false; // Required query param missing
            }
            
            // For $select parameter, check if key fields are present (flexible matching)
            if (key === '$select') {
                const mockFields = mockValue.split(',').map(f => f.trim());
                const reqFields = reqValue.split(',').map(f => f.trim());
                
                // Check if at least some key fields match (flexible)
                const keyFields = ['incidentid', 'ticketnumber', 'statuscode'];
                const mockHasKeyFields = keyFields.some(field => mockFields.includes(field));
                const reqHasKeyFields = keyFields.some(field => reqFields.includes(field));
                
                if (mockHasKeyFields && reqHasKeyFields) {
                    continue; // Good enough match for $select
                }
            }
            
            // For other parameters, require exact match
            if (mockValue !== reqValue) {
                return false;
            }
        }
        
        return true;
    }

    async updateMockStats(mockId) {
        try {
            const config = await fs.readJson(this.mockConfigFile);
            const mock = config.mocks.find(m => m.id === mockId);
            
            if (mock) {
                mock.hitCount = (mock.hitCount || 0) + 1;
                mock.lastUsed = new Date().toISOString();
                await fs.writeJson(this.mockConfigFile, config, { spaces: 2 });
            }
        } catch (error) {
            // Silently fail - stats are not critical
        }
    }

    /**
     * Get mock statistics
     */
    async getStats() {
        try {
            const config = await fs.readJson(this.mockConfigFile);
            const mocks = config.mocks || [];
            
            return {
                total: mocks.length,
                enabled: mocks.filter(m => m.enabled).length,
                disabled: mocks.filter(m => !m.enabled).length,
                totalHits: mocks.reduce((sum, m) => sum + (m.hitCount || 0), 0),
                mocks: mocks.map(m => ({
                    name: m.name,
                    endpoint: `${m.request.method} ${m.request.endpoint}`,
                    enabled: m.enabled,
                    hits: m.hitCount || 0,
                    lastUsed: m.lastUsed
                }))
            };
        } catch (error) {
            return { error: error.message };
        }
    }

    /**
     * API endpoint to manage mocks programmatically
     */
    apiRouter() {
        const express = require('express');
        const router = express.Router();

        // Get all mocks
        router.get('/mocks', async (req, res) => {
            try {
                const config = await fs.readJson(this.mockConfigFile);
                res.json(config.mocks || []);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Get mock statistics
        router.get('/mocks/stats', async (req, res) => {
            const stats = await this.getStats();
            res.json(stats);
        });

        // Toggle mock
        router.post('/mocks/:id/toggle', async (req, res) => {
            try {
                const config = await fs.readJson(this.mockConfigFile);
                const mock = config.mocks.find(m => m.id === req.params.id);
                
                if (!mock) {
                    return res.status(404).json({ error: 'Mock not found' });
                }

                mock.enabled = !mock.enabled;
                await fs.writeJson(this.mockConfigFile, config, { spaces: 2 });
                
                // Reload mocks
                await this.loadMocks();
                
                res.json({ 
                    success: true, 
                    enabled: mock.enabled,
                    message: `Mock ${mock.enabled ? 'enabled' : 'disabled'}` 
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Delete mock
        router.delete('/mocks/:id', async (req, res) => {
            try {
                const config = await fs.readJson(this.mockConfigFile);
                const index = config.mocks.findIndex(m => m.id === req.params.id);
                
                if (index === -1) {
                    return res.status(404).json({ error: 'Mock not found' });
                }

                const deleted = config.mocks.splice(index, 1)[0];
                await fs.writeJson(this.mockConfigFile, config, { spaces: 2 });
                
                // Reload mocks
                await this.loadMocks();
                
                res.json({ 
                    success: true, 
                    deleted: deleted.name 
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Clear all mock statistics
        router.post('/mocks/clear-stats', async (req, res) => {
            try {
                const config = await fs.readJson(this.mockConfigFile);
                config.mocks.forEach(mock => {
                    mock.hitCount = 0;
                    mock.lastUsed = null;
                });
                await fs.writeJson(this.mockConfigFile, config, { spaces: 2 });
                
                res.json({ 
                    success: true, 
                    message: 'All mock statistics cleared' 
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        return router;
    }
}

module.exports = MockMiddleware;
