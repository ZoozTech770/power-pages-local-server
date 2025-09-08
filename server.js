const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const chalk = require('chalk');

// Import our custom modules
const TaskManager = require('./src/task-manager');
const LiquidEngine = require('./src/liquid-engine');
const PageHandler = require('./src/page-handler');
const TemplateHandler = require('./src/template-handler');
const SnippetHandler = require('./src/snippet-handler');
const FileHandler = require('./src/file-handler');
const MockApi = require('./src/mock-api');
const MockMiddleware = require('./src/mock-middleware');
const Utils = require('./src/utils');
const ApiProxy = require('./src/api-proxy');
// Use simplified auth manager (like Dataverse REST Builder)
const AuthManager = require('./src/auth-manager-simple');
const AuthRoutes = require('./src/auth-routes');
const ConfigChecker = require('./config-checker');
const ConfigLoader = require('./config-loader');

class PowerPagesServer {
  constructor() {
    this.app = express();
    this.config = null;
    this.taskManager = null;
    this.liquidEngine = null;
    this.pageHandler = null;
    this.templateHandler = null;
    this.snippetHandler = null;
    this.fileHandler = null;
    this.mockApi = null;
    this.mockMiddleware = null;
    this.utils = null;
    this.apiProxy = null;
    this.authManager = null;
    this.authRoutes = null;
    this.mockConfig = null;
  }

  async initialize() {
    try {
      // Check if server is properly initialized
      const configCheck = await ConfigChecker.checkAndPromptInit();
      
      if (!configCheck.initialized) {
        console.log(chalk.red('❌ Server not properly initialized. Exiting...'));
        process.exit(1);
      }
      
      // Load configuration using new config loader
      const configLoader = new ConfigLoader();
      this.config = this.adaptOldConfigFormat(configLoader.config);
      
      console.log(chalk.green('✅ Configuration loaded successfully'));
      configLoader.displayConfig();
      
      // Initialize task manager
      this.taskManager = new TaskManager();
      await this.taskManager.initialize();
      
      // Initialize utility functions
      this.utils = new Utils(this.config);
      
      // Initialize OAuth2 authentication first
      this.authManager = new AuthManager(this.config);
      await this.authManager.initialize();
      this.authRoutes = new AuthRoutes(this.authManager);
      
      // Initialize components
      this.liquidEngine = new LiquidEngine(this.config);
      this.pageHandler = new PageHandler(this.config, this.liquidEngine);
      this.templateHandler = new TemplateHandler(this.config, this.liquidEngine);
      this.snippetHandler = new SnippetHandler(this.config, this.liquidEngine);
      this.fileHandler = new FileHandler(this.config);
      this.mockApi = new MockApi(this.config);
      this.mockMiddleware = new MockMiddleware();
      // Pass authManager to ApiProxy for OAuth2 support
      this.apiProxy = new ApiProxy(this.config, this.authManager);
      await this.apiProxy.initialize();
      
      // Setup Express middleware
      this.setupMiddleware();
      
      // Setup routes
      this.setupRoutes();
      
      // Mark initial tasks as complete
      await this.taskManager.completeTask('project-structure');
      await this.taskManager.completeTask('configuration');
      
      console.log(chalk.green('✅ Power Pages Local Server initialized successfully'));
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to initialize server:'), error);
      process.exit(1);
    }
  }

  /**
   * Adapt new config format to old format expected by existing code
   */
  adaptOldConfigFormat(newConfig) {
    return {
      port: newConfig.server.port,
      host: '127.0.0.1',
      powerPagesPath: newConfig.powerPages.projectPath,
      hotReload: newConfig.server.hotReload,
      supportedLanguages: newConfig.powerPages.languages,
      defaultLanguage: newConfig.powerPages.languages[0],
      mockApiEnabled: false, // We use proxy instead
      debug: true,
      cacheEnabled: true,
      staticFilesPath: 'web-files',
      templatesPath: 'web-templates',
      pagesPath: 'web-pages',
      snippetsPath: 'content-snippets',
      pageTemplatesPath: 'page-templates',
      mockUser: {
        enabled: true,
        userData: {
          id: newConfig.mockUser.id,
          fullname: newConfig.mockUser.name,
          firstname: newConfig.mockUser.name.split(' ')[0],
          lastname: newConfig.mockUser.name.split(' ').slice(1).join(' ') || '',
          email: `${newConfig.mockUser.name.toLowerCase().replace(' ', '.')}@example.com`,
          roles: 'לקוח- הגשת בקשות,Administrators'
        }
      },
      security: {
        enableHelmet: true,
        enableCors: true,
        enableCompression: true
      },
      logging: {
        level: 'debug',
        file: 'logs/server.log',
        console: true
      },
      liquidEngine: {
        cache: true,
        strictFilters: false,
        strictVariables: false
      },
      mockApi: {
        delay: 0,
        errorRate: 0,
        endpoints: {
          user: '/api/user',
          search: '/api/search',
          forms: '/api/forms',
          messages: '/api/messages'
        }
      },
      apiProxy: {
        enabled: true,
        configFile: 'api-proxy.json'
      },
      baseUrl: newConfig.powerPages.baseUrl,
      proxy: newConfig.proxy
    };
  }

  async loadConfig() {
    try {
      const configPath = path.join(__dirname, 'config', 'server-config.json');
      const config = await fs.readJson(configPath);
      
      // Validate required configuration
      if (!config.powerPagesPath || !await fs.pathExists(config.powerPagesPath)) {
        throw new Error(`Power Pages path not found: ${config.powerPagesPath}`);
      }
      
      return config;
    } catch (error) {
      console.error(chalk.red('❌ Failed to load configuration:'), error);
      throw error;
    }
  }

  setupMiddleware() {
    // Security middleware
    if (this.config.security.enableHelmet) {
      this.app.use(helmet({
        contentSecurityPolicy: false // Disable CSP for development
      }));
    }
    
    if (this.config.security.enableCors) {
      this.app.use(cors());
    }
    
    if (this.config.security.enableCompression) {
      this.app.use(compression());
    }
    
    // Logging middleware
    if (this.config.logging.console) {
      this.app.use(morgan('combined'));
    }
    
    // Body parsing middleware
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    // Static files middleware
    this.app.use('/static', express.static(path.join(__dirname, 'compiled', 'assets')));
    
    console.log(chalk.blue('✅ Middleware setup complete'));
  }

  setupRoutes() {
    // OAuth2 authentication routes (before other routes)
    if (this.authRoutes) {
      this.app.use(this.authRoutes.setupRoutes());
      console.log(chalk.green('✅ OAuth2 authentication routes configured'));
    }
    
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        auth: {
          configured: this.authManager?.isConfigured() || false,
          authenticated: false // Will be checked async if needed
        }
      });
    });

    // Debug endpoint for API testing
    this.app.get('/debug/api-test', async (req, res) => {
      try {
        const axios = require('axios');
        const testResponse = await axios.get('http://127.0.0.1:3000/_api/orl_occupations?$select=orl_occupationid,orl_name');
        res.json({
          debug: true,
          status: testResponse.status,
          dataType: typeof testResponse.data,
          hasValue: !!testResponse.data.value,
          recordCount: testResponse.data.value?.length || 0,
          sampleRecord: testResponse.data.value?.[0] || null,
          rawKeys: testResponse.data.value?.[0] ? Object.keys(testResponse.data.value[0]) : [],
          fullResponse: testResponse.data
        });
      } catch (error) {
        res.status(500).json({
          debug: true,
          error: error.message,
          stack: error.stack
        });
      }
    });

    // Task management endpoints (these should be local only - setup before proxy)
    this.app.get('/api/tasks', async (req, res) => {
      try {
        const tasks = await this.taskManager.getAllTasks();
        res.json(tasks);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/tasks/:taskId/complete', async (req, res) => {
      try {
        await this.taskManager.completeTask(req.params.taskId);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Mock management endpoints
    this.app.get('/api/mocks', (req, res) => {
      try {
        const mockConfig = this.loadMockConfig();
        res.json(mockConfig);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/mocks/:mockId/toggle', (req, res) => {
      try {
        const { mockId } = req.params;
        const { enabled } = req.body;
        
        this.toggleMock(mockId, enabled);
        res.json({ success: true, mockId, enabled });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/mocks/global-toggle', (req, res) => {
      try {
        const { enabled } = req.body;
        this.toggleGlobalMock(enabled);
        res.json({ success: true, globalMockEnabled: enabled });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Mock endpoint for FetchUserLastMessages
    this.app.get('/FetchUserLastMassages/', (req, res) => {
      res.json({
        "totalRecordCount": "131",
        "records": [
          {
            "id": "b244015d-613c-f011-8779-7c1e52362bef",
            "incidentId": "bbf14efa-7d14-f011-998a-0022489c7949",
            "classification_id": "2d71c4b6-9be3-ef11-be20-7c1e52203013",
            "subject": "עדן בדיקה 3333",
            "description": "שדגשג",
            "createdon": "5/29/2025 7:48:55 AM",
            "createdby": "Eden Meshulam",
            "createdbyId": "ddd189d3-f2de-ef11-a730-000d3adbb748",
            "senderType": "0",
            "statuscode": "3",
            "createdbyname": "",
            "date": "5/29/2025 7:48:55 AM"
          },
          {
            "id": "1aebffe7-4a3c-f011-8779-7c1e52362bef",
            "incidentId": "bbf14efa-7d14-f011-998a-0022489c7949",
            "classification_id": "2d71c4b6-9be3-ef11-be20-7c1e52203013",
            "subject": "eden test plugin",
            "description": "הךהךהךהךהךהךהךהךהךהךה",
            "createdon": "5/29/2025 5:08:10 AM",
            "createdby": "Eden Meshulam",
            "createdbyId": "ddd189d3-f2de-ef11-a730-000d3adbb748",
            "senderType": "0",
            "statuscode": "3",
            "createdbyname": "",
            "date": "5/29/2025 5:08:10 AM"
          },
          {
            "id": "fceb7959-5d3c-f011-8779-7c1e52362bef",
            "incidentId": "bbf14efa-7d14-f011-998a-0022489c7949",
            "classification_id": "2d71c4b6-9be3-ef11-be20-7c1e52203013",
            "subject": "עדן בדיקה נוספת",
            "description": "desc update",
            "createdon": "5/29/2025 7:20:17 AM",
            "createdby": "Eden Meshulam",
            "createdbyId": "ddd189d3-f2de-ef11-a730-000d3adbb748",
            "senderType": "0",
            "statuscode": "3",
            "createdbyname": "",
            "date": "5/29/2025 7:20:17 AM"
          },
          {
            "id": "f7b2c500-7356-f011-877a-7c1e52362bef",
            "incidentId": "f2a8ca5a-4156-f011-877b-6045bdde78cc",
            "classification_id": "2d71c4b6-9be3-ef11-be20-7c1e52203013",
            "subject": "",
            "description": "שליחה והמתנה לתשובה",
            "createdon": "7/1/2025 12:00:41 PM",
            "createdby": "Assaf Semoun",
            "createdbyId": "2014b8c3-6209-f011-bae1-7c1e5288140d",
            "senderType": "0",
            "statuscode": "998920001",
            "createdbyname": "",
            "date": "7/1/2025 12:00:41 PM"
          },
          {
            "id": "d026d973-7860-f011-bec1-7ced8d40e3c5",
            "incidentId": "f2a8ca5a-4156-f011-877b-6045bdde78cc",
            "classification_id": "2d71c4b6-9be3-ef11-be20-7c1e52203013",
            "subject": "",
            "description": " הודעה שלישית",
            "createdon": "7/14/2025 6:04:58 AM",
            "createdby": "# Portals-OREF",
            "createdbyId": "669836a3-6b10-f011-998a-7c1e5288140d",
            "senderType": "1",
            "statuscode": "998920002",
            "createdbyname": "",
            "date": "7/14/2025 6:04:58 AM"
          }
        ]
      });
    });

    // Mock endpoint for /json
    this.app.get('/json', (req, res) => {
      const mockData = require('./mock-data/json.json');
      res.status(mockData.response.status).json(mockData.response.data);
    });

    // NEW: Mock middleware (checks mocks before proxy)
    // This middleware will intercept matching requests and serve mock responses
    if (this.mockMiddleware) {
      this.app.use('/_api', this.mockMiddleware.middleware());
      this.app.use('/api', this.mockMiddleware.middleware());
      
      // Mock management API endpoints
      this.app.use('/_mock-admin', this.mockMiddleware.apiRouter());
      console.log(chalk.cyan('🎭 Mock middleware loaded'));
    }
    
    // API Proxy routes (after mock middleware)
    // Note: Hardcoded mock endpoints removed to allow dynamic mock middleware to work
    

    this.app.post('/_api/cloudflow/v1.0/trigger/e63a9e21-142f-f011-8c4d-000d3a65bc1c', (req, res) => {
      const fs = require('fs');
      const path = require('path');
      const mockFilePath = path.join(__dirname, 'mock-data', '_api_cloudflow_v1_0_trigger_e63a9e21_142f_f011_8c4d_000d3a65bc1c.json');
      const mockDataString = fs.readFileSync(mockFilePath, 'utf8');
      const mockData = JSON.parse(mockDataString);
      
      res.status(mockData.response.status)
        .set(mockData.response.headers || {})
        .send(typeof mockData.response.data === 'string' ? mockData.response.data : JSON.stringify(mockData.response.data));
    });

    if (this.apiProxy && this.apiProxy.isEnabled()) {
      this.apiProxy.setupProxyRoutes(this.app);
      console.log(chalk.green('✅ API proxy loaded'));
    } else if (this.config.mockApiEnabled) {
      // Only setup mock API routes if proxy is disabled
      this.setupMockApiRoutes();
    }
    
    // Static file routes
    this.app.use('/web-files', (req, res, next) => {
      this.fileHandler.handleRequest(req, res, next);
    });
    
    // Handle direct asset requests by mapping them to web-files (avoid redirect loops)
    this.app.get('/*.png', (req, res) => {
      if (req.path.startsWith('/web-files/')) {
        return res.status(404).send('File not found');
      }
      res.redirect(`/web-files${req.path}`);
    });
    this.app.get('/*.jpg', (req, res) => {
      if (req.path.startsWith('/web-files/')) {
        return res.status(404).send('File not found');
      }
      res.redirect(`/web-files${req.path}`);
    });
    this.app.get('/*.jpeg', (req, res) => {
      if (req.path.startsWith('/web-files/')) {
        return res.status(404).send('File not found');
      }
      res.redirect(`/web-files${req.path}`);
    });
    this.app.get('/*.gif', (req, res) => {
      if (req.path.startsWith('/web-files/')) {
        return res.status(404).send('File not found');
      }
      res.redirect(`/web-files${req.path}`);
    });
    this.app.get('/*.css', (req, res) => {
      if (req.path.startsWith('/web-files/')) {
        return res.status(404).send('File not found');
      }
      res.redirect(`/web-files${req.path}`);
    });
    this.app.get('/*.js', (req, res) => {
      if (req.path.startsWith('/web-files/')) {
        return res.status(404).send('File not found');
      }
      res.redirect(`/web-files${req.path}`);
    });
    
    // Page routes (catch-all for Power Pages routing)
    this.app.get('*', async (req, res) => {
      try {
        await this.pageHandler.handleRequest(req, res);
      } catch (error) {
        console.error(chalk.red('❌ Page handler error:'), error);
        res.status(500).send('Internal Server Error');
      }
    });
    
    console.log(chalk.blue('✅ Routes setup complete'));
  }

  // Mock management methods
  loadMockConfig() {
    try {
      const configPath = path.join(__dirname, 'config', 'mock-config.json');
      if (fs.existsSync(configPath)) {
        return fs.readJsonSync(configPath);
      }
      return { globalMockEnabled: true, mocks: {} };
    } catch (error) {
      console.error(chalk.red('❌ Error loading mock config:'), error);
      return { globalMockEnabled: true, mocks: {} };
    }
  }

  saveMockConfig(config) {
    try {
      const configPath = path.join(__dirname, 'config', 'mock-config.json');
      fs.writeJsonSync(configPath, config, { spaces: 2 });
    } catch (error) {
      console.error(chalk.red('❌ Error saving mock config:'), error);
      throw error;
    }
  }

  isMockEnabled(mockId) {
    const config = this.loadMockConfig();
    if (!config.globalMockEnabled) {
      return false;
    }
    // If specific mock setting exists, use it; otherwise default to true
    return config.mocks[mockId] !== undefined ? config.mocks[mockId] : true;
  }

  toggleMock(mockId, enabled) {
    const config = this.loadMockConfig();
    config.mocks[mockId] = enabled;
    this.saveMockConfig(config);
    console.log(chalk.blue(`🔄 Mock ${mockId} ${enabled ? 'enabled' : 'disabled'}`));
  }

  toggleGlobalMock(enabled) {
    const config = this.loadMockConfig();
    config.globalMockEnabled = enabled;
    this.saveMockConfig(config);
    console.log(chalk.blue(`🔄 Global mock ${enabled ? 'enabled' : 'disabled'}`));
  }

  setupMockApiRoutes() {
    // User API endpoints
    this.app.get('/api/user/current', (req, res) => {
      this.mockApi.getCurrentUser(req, res);
    });
    
    this.app.get('/api/user/messages', (req, res) => {
      this.mockApi.getUserMessages(req, res);
    });
    
    // Search API endpoints
    this.app.get('/api/search', (req, res) => {
      this.mockApi.handleSearch(req, res);
    });
    
    // Form API endpoints
    this.app.post('/api/forms/submit', (req, res) => {
      this.mockApi.handleFormSubmit(req, res);
    });
    
    // Power Pages OData API endpoints (_api)
    this.app.get('/_api/incidents', (req, res) => {
      this.mockApi.getIncidents(req, res);
    });
    
    this.app.get('/_api/incidents/:id', (req, res) => {
      this.mockApi.getIncident(req, res);
    });
    
    this.app.post('/_api/incidents', (req, res) => {
      this.mockApi.createIncident(req, res);
    });
    
    this.app.put('/_api/incidents/:id', (req, res) => {
      this.mockApi.updateIncident(req, res);
    });
    
    console.log(chalk.blue('✅ Mock API routes setup complete'));
  }

  async findAvailablePort(startPort, maxPort = startPort + 10) {
    const net = require('net');
    
    for (let port = startPort; port <= maxPort; port++) {
      if (await this.isPortAvailable(port)) {
        return port;
      }
    }
    throw new Error(`No available ports found between ${startPort} and ${maxPort}`);
  }
  
  isPortAvailable(port) {
    const net = require('net');
    
    return new Promise((resolve) => {
      const server = net.createServer();
      
      server.listen(port, '127.0.0.1', () => {
        server.close(() => {
          resolve(true);
        });
      });
      
      server.on('error', () => {
        resolve(false);
      });
    });
  }

  async start() {
    try {
      await this.initialize();
      
      // Find an available port if the configured port is in use
      let serverPort = this.config.port;
      if (!await this.isPortAvailable(serverPort)) {
        console.log(chalk.yellow(`⚠️  Port ${serverPort} is already in use, finding alternative...`));
        serverPort = await this.findAvailablePort(serverPort);
        console.log(chalk.blue(`🔄 Using port ${serverPort} instead`));
      }
      
      const server = this.app.listen(serverPort, this.config.host, () => {
        console.log(chalk.green(`
🚀 Power Pages Local Server is running!
📍 URL: http://${this.config.host}:${serverPort}
📁 Project: ${this.config.powerPagesPath}
🔥 Hot Reload: ${this.config.hotReload ? 'Enabled' : 'Disabled'}
🌐 Languages: ${this.config.supportedLanguages.join(', ')}
👤 Mock User: ${this.config.mockUser.enabled ? 'Enabled (' + this.config.mockUser.userData.fullname + ')' : 'Disabled'}
        `));
      });
      
      // Handle server startup errors
      server.on('error', async (err) => {
        if (err.code === 'EADDRINUSE') {
          console.log(chalk.red(`❌ Port ${serverPort} is still in use`));
          try {
            const newPort = await this.findAvailablePort(serverPort + 1);
            console.log(chalk.blue(`🔄 Trying port ${newPort}...`));
            server.close();
            this.start(); // Retry with new port
          } catch (portError) {
            console.error(chalk.red('❌ Could not find available port:'), portError.message);
            process.exit(1);
          }
        } else {
          console.error(chalk.red('❌ Server error:'), err);
          process.exit(1);
        }
      });
      
      // Mark server setup as complete
      await this.taskManager.completeTask('server-setup');
      
      // Setup graceful shutdown
      const gracefulShutdown = (signal) => {
        console.log(chalk.yellow(`\n🛑 Received ${signal}. Shutting down server gracefully...`));
        
        server.close((err) => {
          if (err) {
            console.error(chalk.red('❌ Error during server shutdown:'), err);
            process.exit(1);
          }
          
          console.log(chalk.green('✅ Server stopped gracefully'));
          process.exit(0);
        });
        
        // Force shutdown after 5 seconds
        setTimeout(() => {
          console.log(chalk.red('⚠️  Forced shutdown after timeout'));
          process.exit(1);
        }, 5000);
      };
      
      // Handle different termination signals
      process.on('SIGINT', () => gracefulShutdown('SIGINT'));
      process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
      process.on('SIGQUIT', () => gracefulShutdown('SIGQUIT'));
      
      // Handle uncaught exceptions
      process.on('uncaughtException', (err) => {
        console.error(chalk.red('❌ Uncaught Exception:'), err);
        gracefulShutdown('uncaughtException');
      });
      
      process.on('unhandledRejection', (reason, promise) => {
        console.error(chalk.red('❌ Unhandled Rejection at:'), promise, 'reason:', reason);
        gracefulShutdown('unhandledRejection');
      });
      
      return server;
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to start server:'), error);
      process.exit(1);
    }
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  const server = new PowerPagesServer();
  server.start();
}

module.exports = PowerPagesServer;
