const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');

class TaskManager {
  constructor() {
    this.tasksPath = path.join(__dirname, '../config/task-manager.json');
  }

  async initialize() {
    try {
      const data = await fs.readJson(this.tasksPath);
      console.log(chalk.green('Task Manager initialized successfully.'));
      return data.tasks;
    } catch (error) {
      console.error(chalk.red('Failed to initialize Task Manager:'), error);
      throw error;
    }
  }

  async getAllTasks() {
    try {
      const data = await fs.readJson(this.tasksPath);
      return data.tasks;
    } catch (error) {
      console.error(chalk.red('Failed to get tasks:'), error);
      throw error;
    }
  }

  async completeTask(taskId) {
    try {
      const data = await fs.readJson(this.tasksPath);
      if (data.tasks[taskId]) {
        data.tasks[taskId].completed = true;
        data.progress.completedTasks += 1;
      }
      await fs.writeJson(this.tasksPath, data, { spaces: 2 });
      console.log(chalk.green(`Task ${taskId} marked as complete.`));
    } catch (error) {
      console.error(chalk.red(`Failed to complete task ${taskId}:`), error);
      throw error;
    }
  }
}

module.exports = TaskManager;
