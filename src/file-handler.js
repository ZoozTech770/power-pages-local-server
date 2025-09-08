const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const yaml = require('yaml');

class FileHandler {
  constructor(config) {
    this.config = config;
    this.staticFilesPath = path.join(config.powerPagesPath, config.staticFilesPath);
    this.mimeTypes = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
      '.eot': 'application/vnd.ms-fontobject',
      '.ico': 'image/x-icon',
      '.pdf': 'application/pdf',
      '.zip': 'application/zip',
      '.txt': 'text/plain',
      '.xml': 'application/xml',
      '.webp': 'image/webp'
    };
  }

  async handleRequest(req, res, next) {
    try {
      console.log(chalk.blue(`🔍 FileHandler: Handling request for ${req.path}`));
      const filePath = await this.resolveFilePath(req.path);
      
      if (!filePath) {
        console.log(chalk.yellow(`⚠️  FileHandler: No file path resolved for ${req.path}`));
        return next();
      }

      const stats = await fs.stat(filePath);
      
      if (stats.isDirectory()) {
        return this.handleDirectoryRequest(filePath, req, res);
      }

      if (stats.isFile()) {
        return this.serveFile(filePath, req, res);
      }

      next();

    } catch (error) {
      if (error.code === 'ENOENT') {
        // File not found, pass to next middleware
        next();
      } else {
        console.error(chalk.red('❌ File handler error:'), error);
        res.status(500).send('Internal Server Error');
      }
    }
  }

  async resolveFilePath(requestPath) {
    try {
      console.log(chalk.blue(`🔍 resolveFilePath: Processing request path: ${requestPath}`));
      
      // Remove leading slash and normalize path
      let normalizedPath = requestPath.replace(/^\/web-files\//, '');
      
      // Remove any remaining leading slash
      normalizedPath = normalizedPath.replace(/^\//, '');
      
      console.log(chalk.blue(`🔍 resolveFilePath: Normalized path: ${normalizedPath}`));
      
      const directFilePath = path.join(this.staticFilesPath, normalizedPath);

      // Security check: ensure the resolved path is within the static files directory
      if (!directFilePath.startsWith(this.staticFilesPath)) {
        console.warn(chalk.yellow(`⚠️  Access denied to path outside static files: ${requestPath}`));
        return null;
      }

      // First, try to find the file directly
      if (await fs.pathExists(directFilePath)) {
        console.log(chalk.green(`✅ Found direct file: ${directFilePath}`));
        return directFilePath;
      }

      // If not found, check for YAML webfile mappings
      const mappedFilePath = await this.findFileByYamlMapping(normalizedPath);
      if (mappedFilePath) {
        return mappedFilePath;
      }

      return null;

    } catch (error) {
      console.error(chalk.red('❌ Error resolving file path:'), error);
      return null;
    }
  }

  async findFileByYamlMapping(requestedFileName) {
    try {
      console.log(chalk.blue(`🔍 Looking for YAML mapping for: ${requestedFileName}`));
      
      // Read all files in the web-files directory
      const webFilesDir = this.staticFilesPath;
      const files = await fs.readdir(webFilesDir);
      
      // Look for .webfile.yml files
      const yamlFiles = files.filter(file => file.endsWith('.webfile.yml'));
      console.log(chalk.blue(`📁 Found ${yamlFiles.length} YAML files in web-files directory`));
      
      for (const yamlFile of yamlFiles) {
        const yamlPath = path.join(webFilesDir, yamlFile);
        
        try {
          const yamlContent = await fs.readFile(yamlPath, 'utf8');
          const config = yaml.parse(yamlContent);
          
          console.log(chalk.gray(`📄 Checking ${yamlFile}: adx_partialurl=${config.adx_partialurl}, adx_name=${config.adx_name}`));
          
          // Check if the adx_partialurl matches the requested file
          if (config.adx_partialurl === requestedFileName) {
            // Found a match! Return the path to the actual file
            const actualFileName = config.adx_name;
            const actualFilePath = path.join(webFilesDir, actualFileName);
            
            // Verify the actual file exists
            if (await fs.pathExists(actualFilePath)) {
              console.log(chalk.cyan(`🔗 Mapped ${requestedFileName} → ${actualFileName}`));
              return actualFilePath;
            } else {
              console.warn(chalk.yellow(`⚠️  YAML mapping found but actual file missing: ${actualFileName}`));
            }
          }
        } catch (yamlError) {
          console.warn(chalk.yellow(`⚠️  Error reading YAML file ${yamlFile}:`, yamlError.message));
        }
      }
      
      console.log(chalk.yellow(`⚠️  No YAML mapping found for: ${requestedFileName}`));
      return null;
    } catch (error) {
      console.error(chalk.red('❌ Error searching YAML mappings:'), error);
      return null;
    }
  }

  async serveFile(filePath, req, res) {
    try {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = this.mimeTypes[ext] || 'application/octet-stream';

      // Set appropriate headers
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour in development

      // Check if file supports range requests (for large files)
      const stats = await fs.stat(filePath);
      const range = req.headers.range;

      if (range && stats.size > 1024 * 1024) { // Only for files > 1MB
        return this.handleRangeRequest(filePath, range, stats, res);
      }

      // Regular file serving
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);

      console.log(chalk.green(`📁 Served file: ${path.relative(this.staticFilesPath, filePath)}`));

    } catch (error) {
      console.error(chalk.red('❌ Error serving file:'), error);
      res.status(500).send('Internal Server Error');
    }
  }

  async handleRangeRequest(filePath, range, stats, res) {
    try {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;

      const chunkSize = (end - start) + 1;
      const fileStream = fs.createReadStream(filePath, { start, end });

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stats.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': this.mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
      });

      fileStream.pipe(res);

      console.log(chalk.green(`📁 Served file range: ${path.relative(this.staticFilesPath, filePath)} (${start}-${end})`));

    } catch (error) {
      console.error(chalk.red('❌ Error serving file range:'), error);
      res.status(500).send('Internal Server Error');
    }
  }

  async handleDirectoryRequest(dirPath, req, res) {
    try {
      // Look for index files
      const indexFiles = ['index.html', 'index.htm', 'default.html'];
      
      for (const indexFile of indexFiles) {
        const indexPath = path.join(dirPath, indexFile);
        if (await fs.pathExists(indexPath)) {
          return this.serveFile(indexPath, req, res);
        }
      }

      // Generate directory listing if no index file found
      if (this.config.debug) {
        return this.generateDirectoryListing(dirPath, req, res);
      }

      res.status(404).send('Not Found');

    } catch (error) {
      console.error(chalk.red('❌ Error handling directory request:'), error);
      res.status(500).send('Internal Server Error');
    }
  }

  async generateDirectoryListing(dirPath, req, res) {
    try {
      const files = await fs.readdir(dirPath);
      const relativePath = path.relative(this.staticFilesPath, dirPath);
      
      let html = `<!DOCTYPE html>
<html>
<head>
    <title>Directory Listing: /${relativePath}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        h1 { color: #333; }
        ul { list-style: none; padding: 0; }
        li { margin: 5px 0; }
        a { text-decoration: none; color: #007bff; }
        a:hover { text-decoration: underline; }
        .file { color: #666; }
        .directory { color: #007bff; font-weight: bold; }
    </style>
</head>
<body>
    <h1>Directory Listing: /${relativePath}</h1>
    <ul>`;

      if (relativePath) {
        html += `<li><a href="../" class="directory">../</a></li>`;
      }

      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = await fs.stat(filePath);
        const isDirectory = stats.isDirectory();
        const className = isDirectory ? 'directory' : 'file';
        const href = isDirectory ? `${file}/` : file;
        
        html += `<li><a href="${href}" class="${className}">${file}${isDirectory ? '/' : ''}</a></li>`;
      }

      html += `</ul>
</body>
</html>`;

      res.setHeader('Content-Type', 'text/html');
      res.send(html);

    } catch (error) {
      console.error(chalk.red('❌ Error generating directory listing:'), error);
      res.status(500).send('Internal Server Error');
    }
  }
}

module.exports = FileHandler;
