#!/usr/bin/env node
const { exec } = require('child_process');
const chalk = require('chalk');

function killServerProcesses() {
  console.log(chalk.blue('🔍 Looking for existing server processes...'));
  
  // Find processes using port 3000
  exec('lsof -ti:3000', (error, stdout, stderr) => {
    if (error) {
      console.log(chalk.yellow('⚠️  No processes found using port 3000'));
      return;
    }
    
    const pids = stdout.trim().split('\n').filter(pid => pid);
    
    if (pids.length === 0) {
      console.log(chalk.green('✅ No server processes found'));
      return;
    }
    
    console.log(chalk.yellow(`🔄 Found ${pids.length} process(es) using port 3000`));
    
    pids.forEach(pid => {
      exec(`kill ${pid}`, (killError) => {
        if (killError) {
          console.log(chalk.red(`❌ Failed to kill process ${pid}: ${killError.message}`));
        } else {
          console.log(chalk.green(`✅ Killed process ${pid}`));
        }
      });
    });
    
    // Also kill any node server.js processes
    exec("ps aux | grep 'node server.js' | grep -v grep | awk '{print $2}'", (error, stdout) => {
      if (!error && stdout.trim()) {
        const serverPids = stdout.trim().split('\n').filter(pid => pid);
        serverPids.forEach(pid => {
          exec(`kill ${pid}`, (killError) => {
            if (!killError) {
              console.log(chalk.green(`✅ Killed node server.js process ${pid}`));
            }
          });
        });
      }
    });
    
    setTimeout(() => {
      console.log(chalk.blue('🚀 You can now restart the server with: npm start'));
    }, 1000);
  });
}

// Run if called directly
if (require.main === module) {
  killServerProcesses();
}

module.exports = killServerProcesses;
