const path = require('path');
const fs = require('fs-extra');
const yaml = require('yaml');
const chalk = require('chalk');

class PageHandler {
  constructor(config, liquidEngine) {
    this.config = config;
    this.liquidEngine = liquidEngine;
    this.pagesCache = new Map();
    // Import snippet handler
    const SnippetHandler = require('./snippet-handler');
    this.snippetHandler = new SnippetHandler(config, liquidEngine);
  }

  async handleRequest(req, res) {
    try {
      const urlPath = req.path === '/' ? '/' : req.path;
      const language = this.detectLanguage(req);
      
      console.log(chalk.blue(`📄 Processing page request: ${urlPath} (${language})`));
      
      // Find the page configuration
      const pageConfig = await this.findPageConfig(urlPath);
      if (!pageConfig) {
        return this.handleNotFound(req, res);
      }
      
      // Get page content
      const pageContent = await this.getPageContent(pageConfig, language);
      if (!pageContent) {
        return this.handleNotFound(req, res);
      }
      
      // Process the page through templates
      const finalHtml = await this.processPage(pageContent, pageConfig, language);
      
      // Send response
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(finalHtml);
      
    } catch (error) {
      console.error(chalk.red('❌ Page handler error:'), error);
      res.status(500).send('Internal Server Error');
    }
  }

  async findPageConfig(urlPath) {
    try {
      const pagesDir = path.join(this.config.powerPagesPath, this.config.pagesPath);
      const directories = await fs.readdir(pagesDir);
      
      let matchedConfigs = [];
      
      for (const dir of directories) {
        const dirPath = path.join(pagesDir, dir);
        const stat = await fs.stat(dirPath);
        
        if (stat.isDirectory()) {
          const configFiles = await fs.readdir(dirPath);
          const ymlFile = configFiles.find(f => f.endsWith('.webpage.yml'));
          
          if (ymlFile) {
            const configPath = path.join(dirPath, ymlFile);
            const configContent = await fs.readFile(configPath, 'utf8');
            const config = yaml.parse(configContent);
            
            // Check if this page matches the URL path
            const normalizedUrlPath = urlPath.replace(/\/$/, '') || '/';
            const normalizedPartialUrl = config.adx_partialurl || '';
            
            console.log(chalk.gray(`🔍 Checking ${dir}: URL='${normalizedUrlPath}' vs PartialURL='${normalizedPartialUrl}' (isRoot=${config.adx_isroot})`));
            
            let isMatch = false;
            
            // Check for exact partial URL match (case-sensitive)
            // Compare without leading slash for partial URLs
            const urlPathForComparison = normalizedUrlPath.startsWith('/') ? normalizedUrlPath.substring(1) : normalizedUrlPath;
            if (normalizedPartialUrl === urlPathForComparison && normalizedUrlPath !== '/') {
              console.log(chalk.green(`✅ Exact match: ${dir}`));
              isMatch = true;
            }
            // Check for root page match (only for home page when URL is '/')
            else if (normalizedUrlPath === '/' && (normalizedPartialUrl === '/' || normalizedPartialUrl === '') && config.adx_isroot) {
              console.log(chalk.green(`✅ Root match: ${dir}`));
              isMatch = true;
            }
            
            if (isMatch) {
              matchedConfigs.push({
                ...config,
                directory: dir,
                configPath: configPath
              });
            }
          }
        }
      }
      
      // If we have multiple matches, prioritize based on specific criteria
      if (matchedConfigs.length > 1) {
        // For root path, prioritize 'home' directory over others
        if (urlPath === '/') {
          const homeConfig = matchedConfigs.find(config => config.directory === 'home');
          if (homeConfig) {
            return homeConfig;
          }
        }
        // For other paths, prioritize exact URL match over root match
        const normalizedUrlPath = urlPath.replace(/\/$/, '') || '/';
        const exactMatch = matchedConfigs.find(config => config.adx_partialurl === normalizedUrlPath);
        if (exactMatch) {
          return exactMatch;
        }
      }
      
      // Return the first match if no specific priority applies
      return matchedConfigs.length > 0 ? matchedConfigs[0] : null;
      
    } catch (error) {
      console.error(chalk.red('❌ Error finding page config:'), error);
      return null;
    }
  }

  async getPageContent(pageConfig, language) {
    try {
      const contentDir = path.join(
        this.config.powerPagesPath, 
        this.config.pagesPath, 
        pageConfig.directory, 
        'content-pages'
      );
      
      if (!await fs.pathExists(contentDir)) {
        return null;
      }
      
      // Look for content files for the specified language
      const contentFiles = await fs.readdir(contentDir);
      const langCode = language.replace('-', '-');
      
      console.log(chalk.gray(`🔍 Content files in ${pageConfig.directory}: ${contentFiles.join(', ')}`));
      console.log(chalk.gray(`🔍 Looking for language: ${langCode}`));
      
      // Find the main content file
      const contentFile = contentFiles.find(f => 
        f.includes(langCode) && f.endsWith('.webpage.copy.html')
      );
      
      if (!contentFile) {
        // Fall back to any content file
        const fallbackFile = contentFiles.find(f => f.endsWith('.webpage.copy.html'));
        if (!fallbackFile) {
          return null;
        }
        const contentPath = path.join(contentDir, fallbackFile);
        const content = await fs.readFile(contentPath, 'utf8');
        
        // Still load CSS and JS files even in fallback case
        const cssFile = contentFiles.find(f => f.endsWith('.webpage.custom_css.css'));
        const jsFile = contentFiles.find(f => f.endsWith('.webpage.custom_javascript.js'));
        
        let customCss = '';
        let customJs = '';
        
        if (cssFile) {
          const cssPath = path.join(contentDir, cssFile);
          customCss = await fs.readFile(cssPath, 'utf8');
          console.log(chalk.green(`✅ Loaded CSS file: ${cssFile}`));
        }
        
        if (jsFile) {
          const jsPath = path.join(contentDir, jsFile);
          customJs = await fs.readFile(jsPath, 'utf8');
          console.log(chalk.green(`✅ Loaded JavaScript file: ${jsFile}`));
        }
        
        return { content, customCss, customJs, hasLanguageFile: false };
      }
      
      const contentPath = path.join(contentDir, contentFile);
      const content = await fs.readFile(contentPath, 'utf8');
      
      // Get CSS and JS files - there's always only one of each
      const cssFile = contentFiles.find(f => f.endsWith('.webpage.custom_css.css'));
      const jsFile = contentFiles.find(f => f.endsWith('.webpage.custom_javascript.js'));
      
      let customCss = '';
      let customJs = '';
      
      if (cssFile) {
        const cssPath = path.join(contentDir, cssFile);
        customCss = await fs.readFile(cssPath, 'utf8');
        console.log(chalk.green(`✅ Loaded CSS file: ${cssFile}`));
      }
      
      if (jsFile) {
        const jsPath = path.join(contentDir, jsFile);
        customJs = await fs.readFile(jsPath, 'utf8');
        console.log(chalk.green(`✅ Loaded JavaScript file: ${jsFile}`));
      }
      
      return {
        content,
        customCss,
        customJs,
        hasLanguageFile: true
      };
      
    } catch (error) {
      console.error(chalk.red('❌ Error getting page content:'), error);
      return null;
    }
  }

  async processPage(pageContent, pageConfig, language) {
    try {
      // Create Liquid context with user and website data
      const liquidContext = {
        page: {
          id: pageConfig.adx_webpageid,
          title: pageConfig.adx_title,
          name: pageConfig.adx_name
        },
        website: {
          sign_in_url_substitution: '/SignIn',
          url: `http://${this.config.host}:${this.config.port}`,
          name: 'Power Pages Local Server'
        }
      };
      
      // Process the HTML content through Liquid first
      const processedHtmlContent = await this.liquidEngine.render(pageContent.content, liquidContext);

      // Process CSS through Liquid if it exists
      let processedCss = '';
      if (pageContent.customCss) {
        processedCss = await this.liquidEngine.render(pageContent.customCss, liquidContext);
      }

      // Process JavaScript through Liquid if it exists
      let processedJs = '';
      if (pageContent.customJs) {
        console.log(chalk.blue(`🔧 Processing JavaScript (${pageContent.customJs.length} chars)`));
        // Directly render without const function conversion to avoid processing library code
        processedJs = await this.liquidEngine.render(pageContent.customJs, liquidContext);
      } else {
        console.log(chalk.yellow(`⚠️  No custom JavaScript found`));
      }

      // Create the complete HTML page by combining all three files
      let html = `<!DOCTYPE html>
<html lang="${language}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${pageConfig.adx_title || 'Power Pages'}</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://unpkg.com/react-bootstrap@2.8.0/dist/react-bootstrap.min.js"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    
    <!-- Page-specific CSS from content-pages -->
    ${processedCss ? `<style>\n${processedCss}\n</style>` : ''}
    
    <!-- Theme CSS -->
    <link rel="stylesheet" href="/web-files/theme.css">
    
    <script>
      // Global utility functions for Power Pages
      window.saveToSession = function(key, data) {
        sessionStorage.setItem(key, JSON.stringify(data));
      };
      
      window.getFromSession = function(key) {
        const data = sessionStorage.getItem(key);
        return data ? JSON.parse(data) : null;
      };
      
      window.fetchUserData = async function() {
        try {
          const response = await fetch('/api/user/current');
          if (!response.ok) {
            throw new Error('Failed to fetch user data');
          }
          const userData = await response.json();
          return userData;
        } catch (error) {
          console.error('Error fetching user data:', error);
          throw error;
        }
      };
      
      window.directTo = function(page, params) {
        let url = '/';
        if (page && page !== '/' && page !== 'home') {
          url = page.startsWith('/') ? page : '/' + page;
        }
        if (params) {
          const searchParams = new URLSearchParams(params);
          url += '?' + searchParams.toString();
        }
        window.location.href = url;
      };
      
      // Initialize React Bootstrap components
      window.ReactBootstrap = ReactBootstrap;
      
      // Initialize localStorage with mock user data for local development
      window.localStorage.setItem('userId', '${this.config.mockUser.userData.id}');
      window.localStorage.setItem('userName', '${this.config.mockUser.userData.fullname}');
      console.log('🔧 Local Storage initialized with mock user:', {
        userId: '${this.config.mockUser.userData.id}',
        userName: '${this.config.mockUser.userData.fullname}'
      });
      
      // Mock shell object for local development (replaces Power Pages shell)
      window.shell = {
        getTokenDeferred: function() {
          // Generate a mock token for local development
          const mockToken = 'mock-token-' + Math.random().toString(36).substr(2, 9);
          
          // Return a jQuery-like deferred object
          return {
            done: function(callback) {
              // Call the callback with the mock token
              setTimeout(() => callback(mockToken), 0);
              return this;
            },
            fail: function(callback) {
              // For local development, we don't expect token failures
              return this;
            }
          };
        }
      };
      
      // Global safeAjax function for making API calls
      window.safeAjax = function(options) {
        const { url, method = 'GET', data, success, error } = options;
        
        return fetch(url, {
          method: method,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: data ? JSON.stringify(data) : undefined
        })
        .then(response => {
          if (!response.ok) {
            throw new Error(\`HTTP error! status: \${response.status}\`);
          }
          return response.json();
        })
        .then(data => {
          if (success) success(data);
          return data;
        })
        .catch(err => {
          console.error('API request failed:', err);
          if (error) error(err);
          throw err;
        });
      };
      
      // Global fetchIncidents function
      window.fetchIncidents = function() {
        return window.safeAjax({
          url: '/_api/incidents?$select=incidentid,title,createdon,_oref_status_id_value,_oref_incident_classification_id_value,oref_is_sent_to_safe,oref_num_ticketnumber&$expand=incident_oref_messageses($select=activityid,statuscode;$filter=statuscode%20eq%20998920002)&$filter=statecode%20ne%202',
          method: 'GET'
        });
      };
      
      
      // Global fetchAllUserMessages function
      window.fetchAllUserMessages = function(setMsgsCallback) {
        return new Promise((resolve, reject) => {
          let url = "/_api/oref_messages?$select=activityid,subject,description,createdon,createdby,statuscode,oref_p_sender_type,regardingobjectid" +
                    "&$expand=regardingobjectid_incident($select=incidentid,oref_incident_classification_id)" +
                    "&$filter=regardingobjectid ne null" +
                    "&$orderby=createdon desc" +
                    "&$top=50";

          window.safeAjax({
            url: url,
            method: 'GET',
            success: function (data) {
              if (data.value && data.value.length > 0) {
                const messages = data.value.map(item => ({
                  id: item.activityid,
                  incidentId: item.regardingobjectid_incident ? item.regardingobjectid_incident.incidentid : null,
                  classification_id: item.regardingobjectid_incident ? item.regardingobjectid_incident.oref_incident_classification_id : null,
                  subject: item.subject,
                  description: item.description,
                  createdon: item.createdon,
                  createdby: item.createdby ? item.createdby.name : "משתמש",
                  createdbyId: item.createdby ? item.createdby.id : null,
                  senderType: item.oref_p_sender_type,
                  statuscode: item.statuscode,
                  date: item.createdon
                }));
                
                messages.sort((a, b) => new Date(b.date) - new Date(a.date));
                setMsgsCallback(messages);
                resolve(messages);
              } else {
                setMsgsCallback([]);
                resolve([]);
              }
            },
            error: function (xhr) {
              console.error('Error fetching all user messages:', xhr);
              setMsgsCallback([]);
              reject(xhr);
            }
          });
        });
      };
      
      // Mock validateLoginSession function for local development
      window.validateLoginSession = function(data, textStatus, jqXHR, callback) {
        // In local development, we assume login is always valid
        if (callback && typeof callback === 'function') {
          callback(data, textStatus, jqXHR);
        }
      };
    </script>
    
    <!-- Tracking Code Snippet (moved to head for proper React component definition order) -->
    ${await this.renderTrackingCode()}
</head>
<body>
    <!-- Page content from HTML file -->
    ${processedHtmlContent}
    
    <!-- Page-specific JavaScript from content-pages -->
    ${processedJs ? `<script type="text/babel">\n${processedJs}\n</script>` : ''}
</body>
</html>`;

      return html;
      
    } catch (error) {
      console.error(chalk.red('❌ Error processing page:'), error);
      return this.getErrorPage(error);
    }
  }

  detectLanguage(req) {
    // Check for language in query parameters
    if (req.query.lang) {
      return req.query.lang;
    }
    
    // Check Accept-Language header
    const acceptLanguage = req.headers['accept-language'];
    if (acceptLanguage) {
      if (acceptLanguage.includes('he')) {
        return 'he-IL';
      }
    }
    
    // Default to configured default language
    return this.config.defaultLanguage;
  }

  async handleNotFound(req, res) {
    try {
      // Look for a 404 page
      const notFoundPage = await this.findPageConfig('/page-not-found');
      if (notFoundPage) {
        const content = await this.getPageContent(notFoundPage, 'en-US');
        if (content) {
          const html = await this.processPage(content, notFoundPage, 'en-US');
          res.status(404).send(html);
          return;
        }
      }
      
      // Fallback 404 page
      const html = `<!DOCTYPE html>
<html>
<head>
    <title>Page Not Found</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        h1 { color: #333; }
        p { color: #666; }
        a { color: #007bff; text-decoration: none; }
        a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <h1>404 - Page Not Found</h1>
    <p>The page you requested could not be found.</p>
    <a href="/">Return to Home</a>
</body>
</html>`;
      
      res.status(404).send(html);
    } catch (error) {
      console.error(chalk.red('❌ Error handling 404:'), error);
      res.status(404).send('Page Not Found');
    }
  }

  async renderTrackingCode() {
    try {
      const trackingSnippet = await this.snippetHandler.renderSnippet('Tracking Code');
      return trackingSnippet;
    } catch (error) {
      console.error(chalk.red('❌ Error rendering tracking code:'), error);
      return '<!-- Tracking code snippet not found -->';
    }
  }

  getErrorPage(error) {
    return `<!DOCTYPE html>
<html>
<head>
    <title>Server Error</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 50px; }
        .error { background: #f8d7da; color: #721c24; padding: 20px; border-radius: 5px; }
        .error-details { background: #f8f9fa; padding: 15px; margin-top: 20px; border-left: 4px solid #dc3545; }
        pre { white-space: pre-wrap; }
    </style>
</head>
<body>
    <div class="error">
        <h1>Server Error</h1>
        <p>An error occurred while processing your request.</p>
    </div>
    ${this.config.debug ? `
    <div class="error-details">
        <h3>Error Details:</h3>
        <pre>${error.stack}</pre>
    </div>
    ` : ''}
</body>
</html>`;
  }
}

module.exports = PageHandler;
