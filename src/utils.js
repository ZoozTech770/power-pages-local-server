const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const axios = require('axios');

class Utils {
  constructor(config) {
    this.config = config;
    this.apiProxyConfig = null;
    this.loadApiProxyConfig();
  }

  /**
   * Load API proxy configuration from file
   */
  async loadApiProxyConfig() {
    try {
      const configPath = path.join(__dirname, '../config/api-proxy.json');
      if (await fs.pathExists(configPath)) {
        this.apiProxyConfig = await fs.readJson(configPath);
        console.log(chalk.green('✅ API proxy loaded'));
      } else {
        console.log(chalk.yellow('⚠️ No API proxy configuration found'));
      }
    } catch (error) {
      console.error(chalk.red('❌ Error loading API proxy config:'), error);
    }
  }

  /**
   * Make an HTTP request using API proxy configuration
   */
  async makeApiRequest(details) {
    if (!this.apiProxyConfig || !this.apiProxyConfig.enabled) {
      throw new Error('API proxy is not enabled');
    }

    try {
      const { method, url, data } = details;
      const proxyUrl = this.apiProxyConfig.baseUrl + url;

      const response = await axios({
        method,
        url: proxyUrl,
        headers: this.apiProxyConfig.headers,
        data
      });

      return response.data;
    } catch (error) {
      console.error(chalk.red('❌ API request error:'), error.response ? error.response.data : error.message);
      throw error;
    }
  }

  /**
   * Logs a message with timestamp and color
   */
  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const colors = {
      info: chalk.blue,
      success: chalk.green,
      warning: chalk.yellow,
      error: chalk.red,
      debug: chalk.gray
    };

    const colorFn = colors[type] || chalk.blue;
    console.log(colorFn(`[${timestamp}] ${message}`));
  }

  /**
   * Ensures a directory exists
   */
  async ensureDir(dirPath) {
    try {
      await fs.ensureDir(dirPath);
      return true;
    } catch (error) {
      this.log(`Failed to create directory ${dirPath}: ${error.message}`, 'error');
      return false;
    }
  }

  /**
   * Safely reads a JSON file
   */
  async readJsonFile(filePath) {
    try {
      const data = await fs.readJson(filePath);
      return data;
    } catch (error) {
      this.log(`Failed to read JSON file ${filePath}: ${error.message}`, 'error');
      return null;
    }
  }

  /**
   * Safely writes a JSON file
   */
  async writeJsonFile(filePath, data) {
    try {
      await fs.writeJson(filePath, data, { spaces: 2 });
      return true;
    } catch (error) {
      this.log(`Failed to write JSON file ${filePath}: ${error.message}`, 'error');
      return false;
    }
  }

  /**
   * Validates if a path is safe (within allowed directories)
   */
  isPathSafe(filePath, allowedBasePath) {
    try {
      const resolvedPath = path.resolve(filePath);
      const resolvedBasePath = path.resolve(allowedBasePath);
      return resolvedPath.startsWith(resolvedBasePath);
    } catch (error) {
      this.log(`Path validation error: ${error.message}`, 'error');
      return false;
    }
  }

  /**
   * Extracts language from a filename
   */
  extractLanguageFromFilename(filename) {
    const match = filename.match(/\.([a-z]{2}-[A-Z]{2})\./);
    return match ? match[1] : null;
  }

  /**
   * Converts a Power Pages URL to a file path
   */
  urlToFilePath(url) {
    // Remove leading slash and convert to lowercase
    const cleanUrl = url.replace(/^\//, '').toLowerCase();
    
    // Convert URL segments to file path
    const segments = cleanUrl.split('/');
    return path.join(...segments);
  }

  /**
   * Formats a file size in bytes to human readable format
   */
  formatFileSize(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Debounces a function call
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * Creates a deep copy of an object
   */
  deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj);
    if (obj instanceof Array) return obj.map(item => this.deepClone(item));
    if (typeof obj === 'object') {
      const clonedObj = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          clonedObj[key] = this.deepClone(obj[key]);
        }
      }
      return clonedObj;
    }
  }

  /**
   * Sanitizes HTML content
   */
  sanitizeHtml(html) {
    return html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Validates email format
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Generates a random string
   */
  generateRandomString(length = 10) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Converts RTL text direction helper
   */
  isRTLLanguage(language) {
    const rtlLanguages = ['he', 'ar', 'fa', 'ur'];
    return rtlLanguages.includes(language.split('-')[0]);
  }

  /**
   * Formats a date for display
   */
  formatDate(date, locale = 'en-US') {
    try {
      const dateObj = new Date(date);
      return dateObj.toLocaleDateString(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      return date.toString();
    }
  }

  /**
   * Formats a date and time for display
   */
  formatDateTime(date, locale = 'en-US') {
    try {
      const dateObj = new Date(date);
      return dateObj.toLocaleString(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return date.toString();
    }
  }

  /**
   * Escapes special regex characters
   */
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Checks if a string is empty or whitespace
   */
  isEmptyString(str) {
    return !str || str.trim().length === 0;
  }

  /**
   * Merges objects deeply
   */
  mergeDeep(target, source) {
    const output = Object.assign({}, target);
    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach(key => {
        if (this.isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = this.mergeDeep(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }
    return output;
  }

  /**
   * Checks if a value is an object
   */
  isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
  }

  /**
   * Creates a progress bar string
   */
  createProgressBar(current, total, width = 20) {
    const progress = Math.round((current / total) * width);
    const filled = '█'.repeat(progress);
    const empty = '░'.repeat(width - progress);
    const percentage = Math.round((current / total) * 100);
    return `${filled}${empty} ${percentage}%`;
  }
}

module.exports = Utils;
