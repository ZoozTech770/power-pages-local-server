#!/usr/bin/env node
const { exec } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { URL } = require('url');

class MockGenerator {
  constructor() {
    this.mockDataDir = path.join(__dirname, '..', 'mock-data');
  }

  async generateMock(curlCommand) {
    try {
      console.log(chalk.blue('🔧 Parsing curl command...'));
      const request = this.parseCurlCommand(curlCommand);
      
      console.log(chalk.blue('📡 Executing request to get response...'));
      const response = await this.executeRequest(curlCommand);
      
      console.log(chalk.blue('💾 Saving mock configuration...'));
      const mockConfig = this.createMockConfig(request, response);
      await this.saveMockConfig(mockConfig);
      
      console.log(chalk.green('✅ Mock configuration created successfully!'));
      
    } catch (error) {
      console.error(chalk.red('❌ Error creating mock:'), error.message);
      process.exit(1);
    }
  }

  async addMockFromFile(filePath) {
    try {
      console.log(chalk.blue(`📂 Processing mock file: ${filePath}`));
      
      const absolutePath = path.resolve(filePath);
      const stats = await fs.stat(absolutePath);
      
      if (stats.isDirectory()) {
        await this.addMocksFromDirectory(absolutePath);
      } else if (stats.isFile() && absolutePath.endsWith('.json')) {
        await this.addMockFromJsonFile(absolutePath);
      } else {
        throw new Error('File must be a JSON file or a directory containing JSON files');
      }
      
      console.log(chalk.green('✅ Mock(s) added successfully from file!'));
      
    } catch (error) {
      console.error(chalk.red('❌ Error adding mock from file:'), error.message);
      process.exit(1);
    }
  }

  async addMocksFromDirectory(dirPath) {
    console.log(chalk.blue(`📁 Scanning directory: ${dirPath}`));
    
    const files = await fs.readdir(dirPath);
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    
    if (jsonFiles.length === 0) {
      console.log(chalk.yellow('⚠️  No JSON files found in directory'));
      return;
    }
    
    console.log(chalk.blue(`Found ${jsonFiles.length} JSON file(s)`));
    
    for (const file of jsonFiles) {
      const filePath = path.join(dirPath, file);
      await this.addMockFromJsonFile(filePath);
    }
  }

  async addMockFromJsonFile(filePath) {
    try {
      console.log(chalk.blue(`📄 Processing: ${path.basename(filePath)}`));
      
      const fileContent = await fs.readJson(filePath);
      
      // Check if it's a single mock config or an array of mock configs
      if (Array.isArray(fileContent)) {
        for (const mockConfig of fileContent) {
          await this.processMockConfig(mockConfig, filePath);
        }
      } else {
        await this.processMockConfig(fileContent, filePath);
      }
      
    } catch (error) {
      console.error(chalk.red(`❌ Error processing ${filePath}:`), error.message);
    }
  }

  async processMockConfig(mockConfig, sourceFilePath) {
    try {
      // Validate the mock configuration
      this.validateMockConfig(mockConfig);
      
      // Ensure the mock configuration has all required fields
      const normalizedConfig = this.normalizeMockConfig(mockConfig);
      
      // Save the mock configuration
      await this.saveMockConfigFromFile(normalizedConfig, sourceFilePath);
      
      console.log(chalk.green(`  ✅ Added mock: ${normalizedConfig.method} ${normalizedConfig.endpoint}`));
      
    } catch (error) {
      console.error(chalk.red(`  ❌ Error with mock config:`), error.message);
    }
  }

  validateMockConfig(mockConfig) {
    const requiredFields = ['endpoint', 'method', 'response'];
    
    for (const field of requiredFields) {
      if (!mockConfig[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    if (!mockConfig.response.data && mockConfig.response.status === undefined) {
      throw new Error('Response must have either data or status field');
    }
    
    // Validate HTTP method
    const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
    if (!validMethods.includes(mockConfig.method.toUpperCase())) {
      throw new Error(`Invalid HTTP method: ${mockConfig.method}`);
    }
    
    // Validate endpoint format
    if (!mockConfig.endpoint.startsWith('/')) {
      throw new Error('Endpoint must start with "/"');
    }
  }

  normalizeMockConfig(mockConfig) {
    return {
      endpoint: mockConfig.endpoint,
      method: mockConfig.method.toUpperCase(),
      description: mockConfig.description || `Mock for ${mockConfig.method.toUpperCase()} ${mockConfig.endpoint}`,
      request: mockConfig.request || {
        url: mockConfig.endpoint,
        method: mockConfig.method.toUpperCase(),
        headers: {},
        data: null
      },
      response: {
        status: mockConfig.response.status || 200,
        data: mockConfig.response.data || mockConfig.response
      },
      createdAt: mockConfig.createdAt || new Date().toISOString()
    };
  }

  async saveMockConfigFromFile(mockConfig, sourceFilePath) {
    // Ensure mock-data directory exists
    await fs.ensureDir(this.mockDataDir);
    
    // Create filename from endpoint
    const endpoint = mockConfig.endpoint.replace(/^\//g, '').replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${endpoint}.json`;
    const filePath = path.join(this.mockDataDir, filename);
    
    // Save the mock config
    await fs.writeJson(filePath, mockConfig, { spaces: 2 });
    
    console.log(chalk.blue(`    📁 Saved to: ${path.relative(process.cwd(), filePath)}`));
    
    // Also update the server mock routes
    await this.updateServerMockRoutes(mockConfig);
  }

  parseCurlCommand(curlCommand) {
    // Remove 'curl' from the beginning if present
    const cleanCommand = curlCommand.replace(/^curl\s+/, '');
    
    // Split by space but respect quoted strings
    const parts = this.splitCommand(cleanCommand);
    
    let method = 'GET';
    let url = '';
    const headers = {};
    let data = null;
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      
      if (part === '-X' || part === '--request') {
        method = parts[++i]?.toUpperCase() || 'GET';
      } else if (part === '-H' || part === '--header') {
        const headerString = parts[++i];
        if (headerString) {
          const [key, ...valueParts] = headerString.split(':');
          if (key && valueParts.length > 0) {
            headers[key.trim()] = valueParts.join(':').trim();
          }
        }
      } else if (part === '-d' || part === '--data' || part === '--data-raw') {
        data = parts[++i];
      } else if (part.startsWith('http')) {
        url = part.replace(/["']/g, ''); // Remove quotes
      }
    }
    
    return { method, url, headers, data };
  }

  splitCommand(command) {
    const parts = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';
    
    for (let i = 0; i < command.length; i++) {
      const char = command[i];
      
      if (!inQuotes && (char === '"' || char === "'")) {
        inQuotes = true;
        quoteChar = char;
      } else if (inQuotes && char === quoteChar) {
        inQuotes = false;
        quoteChar = '';
      } else if (!inQuotes && char === ' ') {
        if (current.trim()) {
          parts.push(current.trim());
          current = '';
        }
      } else {
        current += char;
      }
    }
    
    if (current.trim()) {
      parts.push(current.trim());
    }
    
    return parts;
  }

  executeRequest(curlCommand) {
    return new Promise((resolve, reject) => {
      exec(curlCommand, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Request failed: ${error.message}`));
          return;
        }
        
        try {
          // Try to parse as JSON
          const jsonResponse = JSON.parse(stdout);
          resolve(jsonResponse);
        } catch (parseError) {
          // If not JSON, return as string
          resolve(stdout);
        }
      });
    });
  }

  createMockConfig(request, response) {
    const urlObj = new URL(request.url);
    const endpoint = urlObj.pathname;
    
    return {
      endpoint,
      method: request.method,
      description: `Mock for ${request.method} ${endpoint}`,
      request: {
        url: request.url,
        method: request.method,
        headers: request.headers,
        data: request.data
      },
      response: {
        status: 200,
        data: response
      },
      createdAt: new Date().toISOString()
    };
  }

  async saveMockConfig(mockConfig) {
    // Ensure mock-data directory exists
    await fs.ensureDir(this.mockDataDir);
    
    // Create filename from endpoint
    const endpoint = mockConfig.endpoint.replace(/^\//g, '').replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${endpoint}.json`;
    const filePath = path.join(this.mockDataDir, filename);
    
    // Save the mock config
    await fs.writeJson(filePath, mockConfig, { spaces: 2 });
    
    console.log(chalk.green(`📁 Mock saved to: ${path.relative(process.cwd(), filePath)}`));
    console.log(chalk.blue(`🔗 Endpoint: ${mockConfig.endpoint}`));
    console.log(chalk.blue(`📄 Method: ${mockConfig.method}`));
    
    // Also update the server mock routes
    await this.updateServerMockRoutes(mockConfig);
  }

  async updateServerMockRoutes(mockConfig) {
    const serverPath = path.join(__dirname, '..', 'server.js');
    const serverContent = await fs.readFile(serverPath, 'utf8');
    
    // Check if route already exists
    const routePattern = new RegExp(`this\\.app\\.(get|post|put|delete)\\('${mockConfig.endpoint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`);
    
    if (routePattern.test(serverContent)) {
      console.log(chalk.yellow('⚠️  Route already exists in server.js'));
      return;
    }
    
    // Find the mock endpoints section
    const mockSectionRegex = /(\/\/ Mock endpoint for FetchUserLastMessages[\s\S]*?\}\);)/;
    const match = serverContent.match(mockSectionRegex);
    
    if (match) {
      const newRoute = this.generateRouteCode(mockConfig);
      const updatedContent = serverContent.replace(
        match[0],
        match[0] + '\n\n' + newRoute
      );
      
      await fs.writeFile(serverPath, updatedContent);
      console.log(chalk.green('✅ Server route added to server.js'));
    } else {
      console.log(chalk.yellow('⚠️  Could not find mock section in server.js. Please add the route manually:'));
      console.log(chalk.cyan(this.generateRouteCode(mockConfig)));
    }
  }

  generateRouteCode(mockConfig) {
    const method = mockConfig.method.toLowerCase();
    const mockDataPath = `mock-data/${mockConfig.endpoint.replace(/^\//g, '').replace(/[^a-zA-Z0-9]/g, '_')}.json`;
    const routeId = mockConfig.endpoint.replace(/[^a-zA-Z0-9]/g, '_');
    
    // Check if this is an OData endpoint with query parameters
    const hasQueryParams = mockConfig.request && mockConfig.request.url && mockConfig.request.url.includes('?');
    
    if (hasQueryParams) {
      // For OData endpoints, we need to match both path and query
      const url = new URL(mockConfig.request.url);
      const basePath = url.pathname;
      const queryParams = url.search;
      
      return `    // Mock endpoint for ${mockConfig.endpoint} with query: ${queryParams}
    this.app.${method}('${basePath}', (req, res, next) => {
      // Check if mock is enabled for this endpoint
      if (this.isMockEnabled('${routeId}')) {
        // Check if this matches our specific query parameters
        const queryString = Object.keys(req.query).map(key => \`\${key}=\${req.query[key]}\`).join('&');
        const expectedQuery = '${queryParams.substring(1)}';
        
        // Normalize queries for comparison (handle URL encoding)
        const normalizedQuery = decodeURIComponent(queryString).replace(/%20/g, ' ');
        const normalizedExpected = decodeURIComponent(expectedQuery).replace(/%20/g, ' ');
        
        // Check for key query parameters to match this specific mock
        const queryMatches = ${this.generateQueryMatchLogic(queryParams)};
        
        if (queryMatches) {
          const fs = require('fs');
          const path = require('path');
          const mockFilePath = path.join(__dirname, '${mockDataPath}');
          const mockDataString = fs.readFileSync(mockFilePath, 'utf8');
          const mockData = JSON.parse(mockDataString);
          
          console.log(chalk.blue('📝 Using mock data for ${mockConfig.endpoint}'));
          return res.status(mockData.response.status)
            .set(mockData.response.headers || {})
            .send(typeof mockData.response.data === 'string' ? mockData.response.data : JSON.stringify(mockData.response.data));
        }
      }
      
      // If not our specific mock or mock disabled, continue to proxy
      next();
    });`;
    } else {
      // Simple endpoint without query parameters
      return `    // Mock endpoint for ${mockConfig.endpoint}
    this.app.${method}('${mockConfig.endpoint}', (req, res, next) => {
      // Check if mock is enabled for this endpoint
      if (this.isMockEnabled('${routeId}')) {
        const fs = require('fs');
        const path = require('path');
        const mockFilePath = path.join(__dirname, '${mockDataPath}');
        const mockDataString = fs.readFileSync(mockFilePath, 'utf8');
        const mockData = JSON.parse(mockDataString);
        
        console.log(chalk.blue('📝 Using mock data for ${mockConfig.endpoint}'));
        return res.status(mockData.response.status)
          .set(mockData.response.headers || {})
          .send(typeof mockData.response.data === 'string' ? mockData.response.data : JSON.stringify(mockData.response.data));
      } else {
        // Use proxy - let the request continue to proxy middleware
        console.log(chalk.blue('🔀 Using proxy for ${mockConfig.endpoint}'));
        next();
      }
    });`;
    }
  }
  
  generateQueryMatchLogic(queryParams) {
    // Extract key query parameters for matching logic
    const params = new URLSearchParams(queryParams);
    const conditions = [];
    
    for (const [key, value] of params.entries()) {
      if (key.startsWith('$select')) {
        const selectFields = value.split(',').slice(0, 3); // Take first 3 fields for matching
        conditions.push(`normalizedQuery.includes('$select') && ${selectFields.map(field => `normalizedQuery.includes('${field.trim()}')`).join(' && ')}`);
      } else if (key.startsWith('$expand')) {
        conditions.push(`normalizedQuery.includes('$expand') && normalizedQuery.includes('${value.split('(')[0]}')`); // Match expand entity
      } else if (key.startsWith('$filter')) {
        const filterParts = value.split(' ').slice(0, 3); // Take first few words for matching
        conditions.push(`normalizedQuery.includes('$filter') && ${filterParts.map(part => `normalizedQuery.includes('${part}')`).join(' && ')}`);
      }
    }
    
    return conditions.length > 0 ? conditions.join(' && ') : 'true';
  }
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(chalk.red('❌ Please provide either a curl command or a file path'));
    console.log(chalk.blue('Usage:'));
    console.log(chalk.blue('  From curl: npm run add-mock -- "curl -X GET https://example.com/api/endpoint"'));
    console.log(chalk.blue('  From file: npm run add-mock -- --file path/to/mock.json'));
    console.log(chalk.blue('  From dir:  npm run add-mock -- --file path/to/mock-directory/'));
    process.exit(1);
  }
  
  const generator = new MockGenerator();
  
  // Check if the first argument is --file or -f
  if (args[0] === '--file' || args[0] === '-f') {
    if (!args[1]) {
      console.log(chalk.red('❌ Please provide a file path after --file'));
      process.exit(1);
    }
    generator.addMockFromFile(args[1]);
  } else {
    // Treat as curl command
    const curlCommand = args.join(' ');
    generator.generateMock(curlCommand);
  }
}

module.exports = MockGenerator;
