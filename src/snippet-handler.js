const path = require('path');
const fs = require('fs-extra');
const yaml = require('yaml');
const chalk = require('chalk');

class SnippetHandler {
  constructor(config, liquidEngine) {
    this.config = config;
    this.liquidEngine = liquidEngine;
    this.snippetsCache = new Map();
  }

  async getSnippet(snippetName) {
    try {
      // Check cache first
      if (this.snippetsCache.has(snippetName)) {
        return this.snippetsCache.get(snippetName);
      }

      const snippetsDir = path.join(this.config.powerPagesPath, this.config.snippetsPath);
      const snippetDir = path.join(snippetsDir, snippetName.toLowerCase().replace(/\s+/g, '-'));
      
      if (!await fs.pathExists(snippetDir)) {
        console.warn(chalk.yellow(`⚠️  Snippet directory not found: ${snippetName}`));
        return null;
      }

      const files = await fs.readdir(snippetDir);
      
      // Look for language-specific snippet files first, then fallback to generic
      // Priority: {Name}.{Lang}.contentsnippet.value.html > {Name}.contentsnippet.value.html > {Name}.contentsnippet.html
      const htmlFile = files.find(f => f.match(/\.[a-zA-Z]{2}-[a-zA-Z]{2}\.contentsnippet\.value\.html$/)) ||
                       files.find(f => f.endsWith('.contentsnippet.value.html')) || 
                       files.find(f => f.match(/\.[a-zA-Z]{2}-[a-zA-Z]{2}\.contentsnippet\.html$/)) ||
                       files.find(f => f.endsWith('.contentsnippet.html'));
                       
      const configFile = files.find(f => f.match(/\.[a-zA-Z]{2}-[a-zA-Z]{2}\.contentsnippet\.yml$/)) ||
                         files.find(f => f.endsWith('.contentsnippet.yml'));

      if (!htmlFile) {
        console.warn(chalk.yellow(`⚠️  Snippet HTML file not found: ${snippetName}`));
        return null;
      }

      const htmlPath = path.join(snippetDir, htmlFile);
      const content = await fs.readFile(htmlPath, 'utf8');

      let config = {};
      if (configFile) {
        const configPath = path.join(snippetDir, configFile);
        const configContent = await fs.readFile(configPath, 'utf8');
        config = yaml.parse(configContent);
      }

      const snippet = {
        name: snippetName,
        content,
        config,
        path: htmlPath
      };

      // Cache the snippet
      this.snippetsCache.set(snippetName, snippet);
      
      console.log(chalk.green(`✅ Loaded snippet: ${snippetName}`));
      return snippet;

    } catch (error) {
      console.error(chalk.red(`❌ Error loading snippet ${snippetName}:`), error);
      return null;
    }
  }

  async renderSnippet(snippetName, data = {}) {
    try {
      const snippet = await this.getSnippet(snippetName);
      if (!snippet) {
        return `<!-- Snippet not found: ${snippetName} -->`;
      }

      const rendered = await this.liquidEngine.render(snippet.content, data);
      return rendered;

    } catch (error) {
      console.error(chalk.red(`❌ Error rendering snippet ${snippetName}:`), error);
      return `<!-- Snippet render error: ${snippetName} -->`;
    }
  }

  async processSnippetReferences(content, data = {}) {
    try {
      // Process {% editable snippets "SnippetName" %} tags
      const editableRegex = /{%\s*editable\s+snippets\s+['"]([^'"]+)['"]\s*[^%]*%}/g;
      let processedContent = content;
      let match;

      while ((match = editableRegex.exec(content)) !== null) {
        const snippetName = match[1];
        const renderedSnippet = await this.renderSnippet(snippetName, data);
        processedContent = processedContent.replace(match[0], renderedSnippet);
      }

      // Process {{ snippets["SnippetName"] }} references
      const snippetRefRegex = /\{\{\s*snippets\[['"]([^'"]+)['"]\]\s*\}\}/g;
      
      while ((match = snippetRefRegex.exec(content)) !== null) {
        const snippetName = match[1];
        const renderedSnippet = await this.renderSnippet(snippetName, data);
        processedContent = processedContent.replace(match[0], renderedSnippet);
      }

      return processedContent;

    } catch (error) {
      console.error(chalk.red('❌ Error processing snippet references:'), error);
      return content;
    }
  }

  clearCache() {
    this.snippetsCache.clear();
    console.log(chalk.blue('🧹 Snippet cache cleared'));
  }
}

module.exports = SnippetHandler;
