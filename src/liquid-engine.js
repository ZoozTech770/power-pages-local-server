const { Liquid } = require('liquidjs');
const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const axios = require('axios');

class LiquidEngine {
  constructor(config) {
    this.config = config;
    this.engine = null;
    this.mockData = null;
    this.initialized = false;
    this.initialize();
  }

  async initialize() {
    try {
      this.engine = new Liquid({
        root: [
          path.join(this.config.powerPagesPath, this.config.templatesPath),
          path.join(this.config.powerPagesPath, this.config.snippetsPath),
          path.join(this.config.powerPagesPath, this.config.pagesPath)
        ],
        extname: '.html',
        cache: this.config.liquidEngine.cache,
        strictFilters: this.config.liquidEngine.strictFilters,
        strictVariables: this.config.liquidEngine.strictVariables
      });

      // Register custom Power Pages filters
      this.registerCustomFilters();
      
      // Register custom Power Pages tags
      this.registerCustomTags();
      
      console.log(chalk.green('✅ Liquid Engine initialized'));
    } catch (error) {
      console.error(chalk.red('❌ Failed to initialize Liquid Engine:'), error);
      throw error;
    }
  }

  registerCustomFilters() {
    // Power Pages specific filters
    this.engine.registerFilter('escape', (input) => {
      return input ? input.toString().replace(/[&<>"']/g, function(match) {
        return {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;'
        }[match];
      }) : '';
    });

    this.engine.registerFilter('h', (input) => {
      return this.engine.filters.escape(input);
    });

    this.engine.registerFilter('boolean', (input) => {
      if (typeof input === 'boolean') return input;
      if (typeof input === 'string') {
        return input.toLowerCase() === 'true';
      }
      return Boolean(input);
    });

    this.engine.registerFilter('default', (input, defaultValue) => {
      return input || defaultValue;
    });

    console.log(chalk.blue('✅ Custom filters registered'));
  }

  registerCustomTags() {
    // We'll handle includes by pre-processing the template content
    console.log(chalk.blue('✅ Custom include pre-processing enabled'));
  }

  async fetchUserDataFromAPI() {
    if (!this.config.mockUser.enabled) {
      return null;
    }

    try {
      // Get API proxy configuration
      const apiProxyConfigPath = path.join(__dirname, '../config/api-proxy.json');
      if (!await fs.pathExists(apiProxyConfigPath)) {
        console.log(chalk.yellow('⚠️ API proxy config not found, using fallback user data'));
        return this.createFallbackUserData();
      }

      const apiProxyConfig = await fs.readJson(apiProxyConfigPath);
      if (!apiProxyConfig.enabled) {
        console.log(chalk.yellow('⚠️ API proxy disabled, using fallback user data'));
        return this.createFallbackUserData();
      }

      const userId = this.config.mockUser.userData.id;
      const apiUrl = `${apiProxyConfig.baseUrl}/_api/contacts(${userId})?$select=firstname,lastname,emailaddress1,mobilephone,governmentid,oref_p_preferred_contact_method,_parentcustomerid_value`;

      console.log(chalk.blue(`🔄 Fetching user data from API: ${userId}`));

      const response = await axios.get(apiUrl, {
        headers: {
          'Cookie': apiProxyConfig.headers.Cookie,
          'Accept': 'application/json',
          'User-Agent': apiProxyConfig.headers['User-Agent']
        },
        timeout: 10000
      });

      if (response.status === 200 && response.data) {
        const userData = response.data;
        console.log(chalk.green(`✅ User data fetched successfully`));
        
        // Merge API data with config data
        return {
          ...this.config.mockUser.userData,
          firstname: userData.firstname || '',
          lastname: userData.lastname || '',
          emailaddress1: userData.emailaddress1 || this.config.mockUser.userData.email,
          mobilephone: userData.mobilephone || '',
          governmentid: userData.governmentid || '',
          oref_p_preferred_contact_method: userData.oref_p_preferred_contact_method || '',
          parentcustomerid: userData._parentcustomerid_value || '',
          fullname: `${userData.firstname || ''} ${userData.lastname || ''}`.trim() || this.config.mockUser.userData.fullname
        };
      } else {
        console.log(chalk.yellow('⚠️ API response not successful, using fallback user data'));
        return this.createFallbackUserData();
      }
    } catch (error) {
      console.log(chalk.yellow(`⚠️ Failed to fetch user data from API: ${error.message}`));
      return this.createFallbackUserData();
    }
  }

  createFallbackUserData() {
    return {
      ...this.config.mockUser.userData,
      firstname: this.config.mockUser.userData.fullname.split(' ')[0] || '',
      lastname: this.config.mockUser.userData.fullname.split(' ')[1] || '',
      emailaddress1: this.config.mockUser.userData.email || '',
      mobilephone: '050-1234567',
      governmentid: '123456789',
      oref_p_preferred_contact_method: '1,2,3',
      parentcustomerid: 'Test Company'
    };
  }

  async createMockData() {
    // Create user object based on configuration
    const userObject = this.config.mockUser.enabled ? 
      await this.fetchUserDataFromAPI() : 
      null;

    return {
      user: userObject,
      website: {
        sign_in_url_substitution: '/sign-in',
        sign_out_url_substitution: '/sign-out',
        adx_partialurl: '/',
        selected_language: {
          name: 'English'
        },
        languages: [
          { name: 'English', code: 'en-US' },
          { name: 'עברית', code: 'he-IL' }
        ]
      },
      settings: {
        'LanguageLocale/Code': 'en-US',
        'Profile/Enabled': true,
        'Search/Enabled': true,
        'Header/ShowAllProfileNavigationLinks': true
      },
      weblinks: {
        'Default': {
          weblinks: [
            { name: 'Home', url: '/', display_image_only: false },
            { name: 'Profile', url: '/profile', display_image_only: false },
            { name: 'Search', url: '/search', display_image_only: false }
          ]
        },
        'Profile Navigation': {
          weblinks: [
            { name: 'My Profile', url: '/profile' },
            { name: 'Settings', url: '/settings' }
          ]
        }
      },
      sitemarkers: {
        'Profile': { url: '/profile' },
        'Search': { url: '/search', id: 'search-page' },
        'Forums': { url: '/forums', id: 'forums-page' }
      },
      snippets: {
        'Mobile Header': '<div class="mobile-header">Mobile Header Content</div>',
        'Header/Toggle Navigation': 'Toggle Navigation',
        'Header/Search/ToolTip': 'Search',
        'Search/Title': 'Search Our Site',
        'Profile Link Text': 'Profile',
        'links/login': 'Sign In',
        'links/logout': 'Sign Out',
        'ReactDEV': '<!-- ReactDEV Snippet -->',
        'AutoLogout': '<!-- AutoLogout Snippet -->'
      },
      resx: {
        'Skip_To_Content': 'Skip to main content',
        'Main_Navigation': 'Main Navigation',
        'Toggle_Navigation': 'Toggle Navigation',
        'Search_DefaultText': 'Search',
        'Discover_Contoso': 'Discover Contoso',
        'Profile_Text': 'Profile',
        'Sign_In': 'Sign In',
        'Sign_Out': 'Sign Out',
        'Default_Profile_name': 'User'
      },
      page: {
        id: 'home-page',
        title: 'Home'
      },
      sitemap: {
        '/': {
          children: [
            { name: 'Home', url: '/', title: 'Home' },
            { name: 'Profile', url: '/profile', title: 'Profile' }
          ]
        }
      }
    };
  }

  isJavaScriptContent(content) {
    // Check if content appears to be JavaScript by looking for common JavaScript patterns
    const jsPatterns = [
      /^\s*\/\*[\s\S]*?\*\//,  // Starts with block comment
      /^\s*\/\//,               // Starts with line comment
      /^\s*\(function\s*\(/,    // IIFE pattern
      /^\s*function\s+\w+/,     // Function declaration
      /^\s*var\s+\w+/,          // var declaration
      /^\s*const\s+\w+/,        // const declaration
      /^\s*let\s+\w+/,          // let declaration
      /typeof\s+exports/,       // CommonJS/UMD pattern
      /typeof\s+define/,        // AMD pattern
      /global\s*=\s*typeof\s*globalThis/, // UMD globalThis pattern
      /!function\s*\(/,         // Minified IIFE pattern
      /window\s*\[\s*["']ReactDOM["']\s*\]/,  // React library assignment pattern
      /e\s*=\s*e\s*\|\|\s*self/,  // Common UMD pattern from React DOM
      /<script[^>]*type=["']text\/babel["'][^>]*>/,  // JSX script tags
      /React\.createElement/,   // React patterns
      /ReactDOM\./,             // ReactDOM usage
      // React DOM specific patterns
      /React\.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED/,
      /ReactCurrentDispatcher/,
      /ReactCurrentBatchConfig/,
      /prepareStackTrace/,
      /Error\.prepareStackTrace/,
      /ReactDebugCurrentFrame/,
      /getStackAddendum/,
      // React DOM development build patterns
      /"object"==typeof exports&&"undefined"!=typeof module/,
      /define\.amd\?define/,
      /this,\(function\(e,t\)\{"use strict"/
    ];
    
    // Also check if the content is overwhelmingly JavaScript-like
    const jsIndicators = [
      /\bReactDOM\s*=\s*{}/,
      /typeof\s+\w+/g,
      /function\s*\(/g,
      /\bvar\s+\w+/g,
      /\bconst\s+\w+/g,
      /\blet\s+\w+/g,
      /console\.[a-zA-Z]+\s*\(/g,  // Console methods
      /\b\w+\s*=\s*function\s*\(/g,  // Function assignments
      /\bif\s*\([^)]+\)\s*\{/g,    // If statements
      /\bfor\s*\([^)]+\)\s*\{/g,   // For loops
      /\btry\s*\{/g,              // Try blocks
      /\bcatch\s*\(/g,            // Catch blocks
      /===|!==|&&|\|\|/g,         // JavaScript operators
      /\b\w+\.prototype\./g,      // Prototype usage
      /\bnew\s+\w+\s*\(/g,        // Constructor calls
      /\bthis\./g,               // 'this' keyword usage
      /\breturn\s+[^;]+;/g,       // Return statements
      /\bcase\s+[^:]+:/g,         // Switch cases
      // Additional React DOM specific indicators
      /ReactCurrentBatchConfig/g,
      /ReactCurrentDispatcher/g,
      /ReactDebugCurrentFrame/g,
      /ReactDOM\./g,
      /React\./g,
      /__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED/g,
      /prepareStackTrace/g,
      /getStackAddendum/g,
      /"object"==typeof/g,
      /"function"==typeof/g,
      /"undefined"!=typeof/g
    ];
    
    // Count JavaScript indicators
    let indicatorCount = 0;
    jsIndicators.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        indicatorCount += matches.length;
      }
    });
    
    // Check for high concentration of JavaScript content
    const contentLength = content.length;
    const jsRatio = indicatorCount / (contentLength / 1000); // JS indicators per 1000 characters
    
    // More aggressive detection for React DOM and other JS libraries
    const hasReactDOMSignature = /ReactDOM|React\.__SECRET_INTERNALS|ReactCurrentDispatcher|ReactDebugCurrentFrame/.test(content);
    const hasUMDPattern = /"object"==typeof exports&&"undefined"!=typeof module/.test(content);
    const hasMinifiedJSPattern = /!function\(e,t\)\{"use strict"/.test(content) || /this,\(function\(e,t\)/.test(content);
    
    // Very aggressive detection for large JavaScript content (like after preprocessing)
    const isVeryLargeWithJSPatterns = contentLength > 100000 && 
                                     (content.match(/function\s*\(/g) || []).length > 100;
    
    // Check if content contains many excluded file signatures (post-preprocessing detection)
    const containsExcludedSignatures = this.config.liquidExcludes && 
                                      this.config.liquidExcludes.some(excludedFile => 
                                        content.includes(excludedFile) || 
                                        content.includes('react-dom.development.js') ||
                                        content.includes('react.development.js') ||
                                        content.includes('__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED')
                                      );
    
    // If we match explicit patterns or have a high concentration of JS indicators, treat as JS
    return jsPatterns.some(pattern => pattern.test(content)) || 
           hasReactDOMSignature ||
           hasUMDPattern ||
           hasMinifiedJSPattern ||
           isVeryLargeWithJSPatterns ||
           containsExcludedSignatures ||
           indicatorCount > 20 || 
           (jsRatio > 2 && contentLength > 1000) ||
           // Very large content that's mostly JS patterns
           (contentLength > 50000 && jsRatio > 1);
  }

  async render(templateContent, additionalData = {}) {
    try {
      // If this looks like JavaScript content, return it as-is
      if (this.isJavaScriptContent(templateContent)) {
        console.log(chalk.blue('⚫️  Detected JavaScript content, skipping Liquid processing'));
        return templateContent;
      }
      
      // Ensure mock data is initialized
      if (!this.mockData) {
        this.mockData = await this.createMockData();
      }
      
      // Pre-process includes before passing to Liquid engine
      const processedContent = await this.preprocessIncludes(templateContent, additionalData);
      
      // After preprocessing, check if the final content is predominantly JavaScript
      if (this.isJavaScriptContent(processedContent)) {
        console.log(chalk.blue('⚫️  Final processed content is JavaScript, skipping Liquid processing'));
        return processedContent;
      }
      
      const data = { ...this.mockData, ...additionalData, liquidEngine: this };
      console.log(chalk.blue(`Rendering with user ID: ${data.user ? data.user.id : 'No user'}`)); // Added logging
      const result = await this.engine.parseAndRender(processedContent, data);
      return result;
    } catch (error) {
      console.error(chalk.red('❌ Liquid render error:'), error);
      throw error;
    }
  }

  async renderFile(filePath, additionalData = {}) {
    try {
      const data = { ...this.mockData, ...additionalData };
      const result = await this.engine.renderFile(filePath, data);
      return result;
    } catch (error) {
      console.error(chalk.red('❌ Liquid render file error:'), error);
      throw error;
    }
  }

  async preprocessIncludes(templateContent, additionalData = {}, depth = 0) {
    try {
      // Prevent infinite recursion
      if (depth > 10) {
        console.log(chalk.yellow(`⚠️  Maximum include depth (${depth}) reached, stopping recursion`));
        return templateContent;
      }
      
      let processedContent = templateContent;
      
      // Process {{Snippets.SnippetName}} references first
      const snippetMatches = [...templateContent.matchAll(/\{\{\s*Snippets\.([^}]+)\s*\}\}/g)];
      for (const snippetMatch of snippetMatches) {
        const snippetName = snippetMatch[1].trim();
        const snippetContent = await this.loadSnippetContent(snippetName, depth + 1);
        processedContent = processedContent.replace(snippetMatch[0], snippetContent);
      }
      
      // Process {% include 'Template Name' %} tags
      const includeMatches = [...processedContent.matchAll(/{%\s*include\s+['"]([^'"]+)['"]\s*%}/g)];
      for (const match of includeMatches) {
        const includeName = match[1];
        const includeContent = await this.processInclude(includeName, additionalData, depth + 1);
        processedContent = processedContent.replace(match[0], includeContent);
      }
      
      return processedContent;
    } catch (error) {
      console.error(chalk.red('❌ Error preprocessing includes:'), error);
      return templateContent;
    }
  }

  makeConstFunctionsGlobal(content) {
    try {
      // First, fix invalid object literal syntax patterns
      let processedContent = this.fixInvalidObjectLiteralSyntax(content);
      
      // Find all const function declarations
      const constRegex = /\s*const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*\([^)]*\)\s*=>\s*{/g;
      let match;
      const functionsToReplace = [];
      
      while ((match = constRegex.exec(content)) !== null) {
        const functionName = match[1];
        const startIndex = match.index;
        const openBraceIndex = content.indexOf('{', match.index + match[0].length - 1);
        
        // Find the matching closing brace
        let braceCount = 1;
        let currentIndex = openBraceIndex + 1;
        
        while (currentIndex < content.length && braceCount > 0) {
          if (content[currentIndex] === '{') {
            braceCount++;
          } else if (content[currentIndex] === '}') {
            braceCount--;
          }
          currentIndex++;
        }
        
        if (braceCount === 0) {
          // Find the semicolon after the closing brace, or use end of function if no semicolon
          const endIndex = content.indexOf(';', currentIndex - 1);
          const actualEndIndex = endIndex !== -1 && endIndex < content.indexOf('\n', currentIndex) ? endIndex + 1 : currentIndex;
          
          const fullMatch = content.substring(startIndex, actualEndIndex);
          const functionBody = fullMatch.replace(/^\s*const\s+[a-zA-Z_$][a-zA-Z0-9_$]*\s*=\s*/, '').trim();
          
          // Ensure function body ends with semicolon
          const normalizedFunctionBody = functionBody.endsWith(';') ? functionBody : functionBody + ';';
          
          functionsToReplace.push({
            fullMatch,
            functionName,
            functionBody: normalizedFunctionBody,
            startIndex,
            endIndex: actualEndIndex
          });
        }
      }
      
      // Also find regular function declarations (more flexible regex)
      const functionRegex = /\b(?:(async)\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*{/g;
      let functionMatch;
      
      while ((functionMatch = functionRegex.exec(content)) !== null) {
        const isAsync = functionMatch[1] === 'async';
        const functionName = functionMatch[2];
        const startIndex = functionMatch.index;
        const openBraceIndex = content.indexOf('{', functionMatch.index + functionMatch[0].length - 1);
        
        // Find the matching closing brace
        let braceCount = 1;
        let currentIndex = openBraceIndex + 1;
        
        while (currentIndex < content.length && braceCount > 0) {
          if (content[currentIndex] === '{') {
            braceCount++;
          } else if (content[currentIndex] === '}') {
            braceCount--;
          }
          currentIndex++;
        }
        
        if (braceCount === 0) {
          const fullMatch = content.substring(startIndex, currentIndex);
          const asyncPrefix = isAsync ? 'async ' : '';
          const functionDeclaration = fullMatch.replace(/^\s*(?:async\s+)?function\s+[a-zA-Z_$][a-zA-Z0-9_$]*\s*/, `${asyncPrefix}function `);
          
          functionsToReplace.push({
            fullMatch,
            functionName,
            functionBody: functionDeclaration + ';',
            startIndex,
            endIndex: currentIndex
          });
        }
      }
      
      // Replace functions from end to beginning to maintain indices
      functionsToReplace.sort((a, b) => b.startIndex - a.startIndex);
      
      functionsToReplace.forEach(({ fullMatch, functionName, functionBody }) => {
        const windowAssignment = `    window.${functionName} = ${functionBody}`;
        processedContent = processedContent.replace(fullMatch, windowAssignment);
        console.log(chalk.yellow(`🔧 Converting function to global: ${functionName}`));
      });
      
      return processedContent;
    } catch (error) {
      console.error(chalk.red('❌ Error processing functions:'), error);
      return content;
    }
  }

  fixInvalidObjectLiteralSyntax(content) {
    try {
      // Pattern to match invalid object literal syntax like:
      // const obj = { prop1: value1, obj["prop2"]: value2 };
      // This is invalid JavaScript syntax and needs to be fixed
      
      // More robust approach: find object literals and parse them properly
      const objectLiteralRegex = /const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*\{/g;
      let processedContent = content;
      let match;
      
      while ((match = objectLiteralRegex.exec(content)) !== null) {
        const objectName = match[1];
        const startIndex = match.index;
        const openBraceIndex = content.indexOf('{', match.index);
        
        // Find the matching closing brace by counting braces
        let braceCount = 1;
        let currentIndex = openBraceIndex + 1;
        
        while (currentIndex < content.length && braceCount > 0) {
          const char = content[currentIndex];
          if (char === '{') {
            braceCount++;
          } else if (char === '}') {
            braceCount--;
          } else if (char === '`') {
            // Skip template literal content
            currentIndex++;
            while (currentIndex < content.length && content[currentIndex] !== '`') {
              if (content[currentIndex] === '\\') {
                currentIndex++; // Skip escaped character
              }
              currentIndex++;
            }
          } else if (char === '"' || char === "'") {
            // Skip string literal content
            const quote = char;
            currentIndex++;
            while (currentIndex < content.length && content[currentIndex] !== quote) {
              if (content[currentIndex] === '\\') {
                currentIndex++; // Skip escaped character
              }
              currentIndex++;
            }
          }
          currentIndex++;
        }
        
        if (braceCount === 0) {
          const objectBody = content.substring(openBraceIndex + 1, currentIndex - 1);
          const fullMatch = content.substring(startIndex, currentIndex);
          
          // Look for invalid patterns like: objectName["property"]: value
          const invalidPropertyRegex = new RegExp(`${objectName}\\[([^\\]]+)\\]\\s*:\\s*`, 'g');
          
          if (invalidPropertyRegex.test(objectBody)) {
            console.log(chalk.yellow(`🔧 Fixing invalid object literal syntax in ${objectName}`));
            
            // Parse properties more carefully
            const properties = this.parseObjectProperties(objectBody);
            const validProperties = [];
            const invalidProperties = [];
            
            properties.forEach(prop => {
              const invalidMatch = prop.match(new RegExp(`${objectName}\\[([^\\]]+)\\]\\s*:\\s*(.+)`));
              if (invalidMatch) {
                const propertyKey = invalidMatch[1];
                const propertyValue = invalidMatch[2].trim();
                invalidProperties.push({ key: propertyKey, value: propertyValue });
              } else if (prop.trim()) {
                validProperties.push(prop.trim());
              }
            });
            
            // Reconstruct the object with valid properties only
            const validObjectBody = validProperties.join(', ');
            const newObjectDeclaration = `const ${objectName} = {${validObjectBody}};`;
            
            // Add assignments for invalid properties after the object declaration
            const propertyAssignments = invalidProperties.map(({ key, value }) => 
              `    ${objectName}[${key}] = ${value};`
            ).join('\n');
            
            const replacement = newObjectDeclaration + (propertyAssignments ? '\n' + propertyAssignments : '');
            
            processedContent = processedContent.replace(fullMatch, replacement);
          }
        }
      }
      
      return processedContent;
    } catch (error) {
      console.error(chalk.red('❌ Error fixing object literal syntax:'), error);
      return content;
    }
  }
  
  parseObjectProperties(objectBody) {
    const properties = [];
    let currentProperty = '';
    let braceCount = 0;
    let inString = false;
    let stringChar = '';
    let inTemplate = false;
    let templateBraceCount = 0;
    
    for (let i = 0; i < objectBody.length; i++) {
      const char = objectBody[i];
      
      if (inTemplate) {
        if (char === '`' && objectBody[i - 1] !== '\\') {
          inTemplate = false;
        } else if (char === '{' && objectBody[i - 1] === '$') {
          templateBraceCount++;
        } else if (char === '}' && templateBraceCount > 0) {
          templateBraceCount--;
        }
        currentProperty += char;
      } else if (inString) {
        if (char === stringChar && objectBody[i - 1] !== '\\') {
          inString = false;
        }
        currentProperty += char;
      } else if (char === '`') {
        inTemplate = true;
        currentProperty += char;
      } else if (char === '"' || char === "'") {
        inString = true;
        stringChar = char;
        currentProperty += char;
      } else if (char === '{' || char === '(' || char === '[') {
        braceCount++;
        currentProperty += char;
      } else if (char === '}' || char === ')' || char === ']') {
        braceCount--;
        currentProperty += char;
      } else if (char === ',' && braceCount === 0) {
        properties.push(currentProperty.trim());
        currentProperty = '';
      } else {
        currentProperty += char;
      }
    }
    
    if (currentProperty.trim()) {
      properties.push(currentProperty.trim());
    }
    
    return properties;
  }

  async loadSnippetContent(snippetName, depth = 0) {
    try {
      // Convert snippet name to proper directory format
      const snippetDirName = snippetName.toLowerCase().replace(/\s+/g, '-');
      const snippetPath = path.join(this.config.powerPagesPath, this.config.snippetsPath, snippetDirName);
      
      if (await fs.pathExists(snippetPath)) {
        const files = await fs.readdir(snippetPath);
        // Look for .contentsnippet.value.html or .contentsnippet.html files
        const htmlFile = files.find(f => f.endsWith('.contentsnippet.value.html')) ||
                        files.find(f => f.endsWith('.contentsnippet.html'));
        
        if (htmlFile) {
          const content = await fs.readFile(path.join(snippetPath, htmlFile), 'utf8');
          console.log(chalk.green(`✅ Loaded snippet reference: ${snippetName} (depth: ${depth}) - ${content.length} chars`));
          
          // Log what includes are found in this content
          const includeMatches = content.match(/{%\s*include\s+['"]([^'"]+)['"]\s*%}/g);
          if (includeMatches) {
            console.log(chalk.blue(`ℹ️  Found ${includeMatches.length} includes: ${includeMatches.join(', ')}}`));
          }
          
          // Recursively process any nested snippet references
          return await this.preprocessIncludes(content, {}, depth);
        }
      }
      
      console.log(chalk.yellow(`⚠️ Snippet not found: ${snippetName}`));
      return `<!-- Snippet not found: ${snippetName} -->`;
    } catch (error) {
      console.error(chalk.red(`❌ Error loading snippet ${snippetName}:`), error);
      return `<!-- Snippet error: ${snippetName} -->`;
    }
  }

  isJavaScriptFile(fileName) {
    // Check if the file name indicates it's a JavaScript file or library
    const jsPatterns = [
      /\.js$/i,
      /react/i,
      /redux/i,
      /bootstrap/i,
      /jquery/i,
      /babel/i,
      /webpack/i,
      /polyfill/i
    ];
    
    return jsPatterns.some(pattern => pattern.test(fileName));
  }

  containsLiquidSyntax(content) {
    // Check if content contains Liquid template syntax
    const liquidPatterns = [
      /\{\{.*?\}\}/,  // {{ variable }}
      /\{%.*?%\}/,   // {% tag %}
      /\{\{-.*?-\}\}/, // {{- variable -}}
      /\{%-.*?-%\}/   // {%- tag -%}
    ];
    
    return liquidPatterns.some(pattern => pattern.test(content));
  }

  shouldSkipLiquidProcessing(fileName, content = '') {
    // Check if file is in the configured exclusion list
    if (this.config.liquidExcludes && this.config.liquidExcludes.includes(fileName)) {
      return true;
    }
    
    // Fallback to automatic detection if not in exclusion list
    // Only skip Liquid processing for pure JavaScript files without Liquid syntax
    if (!this.isJavaScriptFile(fileName)) {
      return false;
    }
    
    // If it's a JS file but contains Liquid syntax, don't skip processing
    if (content && this.containsLiquidSyntax(content)) {
      return false;
    }
    
    // Skip processing for pure JS libraries
    return true;
  }

  async processInclude(includeName, additionalData = {}, depth = 0) {
    try {
      // Look for the include in snippets first, then web-templates
      const snippetPath = path.join(this.config.powerPagesPath, this.config.snippetsPath, includeName.toLowerCase().replace(/\s+/g, '-'));
      const templatePath = path.join(this.config.powerPagesPath, this.config.templatesPath, includeName.toLowerCase().replace(/\s+/g, '-'));
      
      let content = '';
      
      // First check in snippets (for snippet includes)
      if (await fs.pathExists(snippetPath)) {
        const files = await fs.readdir(snippetPath);
        const htmlFile = files.find(f => f.endsWith('.html'));
        if (htmlFile) {
          content = await fs.readFile(path.join(snippetPath, htmlFile), 'utf8');
        }
      } 
      // Then check in web-templates (for template includes)
      else if (await fs.pathExists(templatePath)) {
        const files = await fs.readdir(templatePath);
        // Look for .webtemplate.source.html files in web-templates
        const webtemplateFile = files.find(f => f.endsWith('.webtemplate.source.html'));
        if (webtemplateFile) {
          const filePath = path.join(templatePath, webtemplateFile);
          content = await fs.readFile(filePath, 'utf8');
          console.log(chalk.green(`✅ Loaded template: ${includeName} (depth: ${depth}) - ${content.length} chars`));
        }
      }
      
      if (content) {
        // Check if we should skip Liquid processing based on content
        if (this.shouldSkipLiquidProcessing(includeName, content)) {
          console.log(chalk.blue(`⏭️  Skipping Liquid processing for JavaScript file: ${includeName}`));
          return content;
        }
        
        // Process Liquid content (including JS templates with Liquid syntax)
        return await this.preprocessIncludes(content, additionalData, depth);
      }
      
      return `<!-- Include not found: ${includeName} -->`;
    } catch (error) {
      console.error(chalk.red(`❌ Include processing error for ${includeName}:`), error);
      return `<!-- Include error: ${includeName} -->`;
    }
  }
}

module.exports = LiquidEngine;
