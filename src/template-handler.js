const path = require('path');
const fs = require('fs-extra');
const yaml = require('yaml');
const chalk = require('chalk');

class TemplateHandler {
  constructor(config, liquidEngine) {
    this.config = config;
    this.liquidEngine = liquidEngine;
    this.templatesCache = new Map();
  }

  async getTemplate(templateName) {
    try {
      // Check cache first
      if (this.templatesCache.has(templateName)) {
        return this.templatesCache.get(templateName);
      }

      const templatesDir = path.join(this.config.powerPagesPath, this.config.templatesPath);
      const templateDir = path.join(templatesDir, templateName.toLowerCase());
      
      if (!await fs.pathExists(templateDir)) {
        console.warn(chalk.yellow(`⚠️  Template directory not found: ${templateName}`));
        return null;
      }

      const files = await fs.readdir(templateDir);
      const sourceFile = files.find(f => f.endsWith('.webtemplate.source.html'));
      const configFile = files.find(f => f.endsWith('.webtemplate.yml'));

      if (!sourceFile) {
        console.warn(chalk.yellow(`⚠️  Template source file not found: ${templateName}`));
        return null;
      }

      const sourcePath = path.join(templateDir, sourceFile);
      const content = await fs.readFile(sourcePath, 'utf8');

      let config = {};
      if (configFile) {
        const configPath = path.join(templateDir, configFile);
        const configContent = await fs.readFile(configPath, 'utf8');
        config = yaml.parse(configContent);
      }

      const template = {
        name: templateName,
        content,
        config,
        path: sourcePath
      };

      // Cache the template
      this.templatesCache.set(templateName, template);
      
      console.log(chalk.green(`✅ Loaded template: ${templateName}`));
      return template;

    } catch (error) {
      console.error(chalk.red(`❌ Error loading template ${templateName}:`), error);
      return null;
    }
  }

  async renderTemplate(templateName, data = {}) {
    try {
      const template = await this.getTemplate(templateName);
      if (!template) {
        return `<!-- Template not found: ${templateName} -->`;
      }

      const rendered = await this.liquidEngine.render(template.content, data);
      return rendered;

    } catch (error) {
      console.error(chalk.red(`❌ Error rendering template ${templateName}:`), error);
      return `<!-- Template render error: ${templateName} -->`;
    }
  }

  async processTemplateIncludes(content, data = {}) {
    try {
      // Process {% include 'TemplateName' %} tags
      const includeRegex = /{%\s*include\s+['"]([^'"]+)['"]\s*%}/g;
      let processedContent = content;
      let match;

      while ((match = includeRegex.exec(content)) !== null) {
        const templateName = match[1];
        const renderedTemplate = await this.renderTemplate(templateName, data);
        processedContent = processedContent.replace(match[0], renderedTemplate);
      }

      return processedContent;

    } catch (error) {
      console.error(chalk.red('❌ Error processing template includes:'), error);
      return content;
    }
  }

  clearCache() {
    this.templatesCache.clear();
    console.log(chalk.blue('🧹 Template cache cleared'));
  }
}

module.exports = TemplateHandler;
