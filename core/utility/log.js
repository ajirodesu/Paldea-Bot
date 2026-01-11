import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve config relative to project root
const configPath = path.join(process.cwd(), 'core', 'utility', 'config.json');
const configLog = JSON.parse(fs.readFileSync(configPath, 'utf8'));

/**
 * Helper function to format the output
 * @param {string} tag - The label from config
 * @param {string} msg - The message content
 * @param {function} colorFn - The chalk color function (default: blue)
 */
const print = (tag, msg, colorFn = chalk.blue) => {
  // REMOVED: chalk.bold(msg)
  // The tag remains bold and colored, but the message is now plain text
  console.log(`${chalk.bold(colorFn(tag))} - ${msg}`);
};

// 1. Define the main generic log function (keeps backward compatibility)
const log = (logMsg, type) => {
  switch (type) {
    case 'load':
      print(configLog.load, logMsg);
      break;
    case 'error':
      print(configLog.error, logMsg, chalk.red);
      break;
    case 'warn':
      // REMOVED: chalk.bold(logMsg)
      console.warn(`${chalk.bold.yellow(configLog.warn)} - ${logMsg}`);
      break;
    case 'login':
      print(configLog.login, logMsg);
      break;
    case 'cmd':
      print(configLog.cmd, logMsg);
      break;
    case 'evnts':
      print(configLog.evnts, logMsg);
      break;
    default:
      print(configLog.load, logMsg);
      break;
  }
};

// 2. Attach specific methods to the log object to enable log.paldea("msg")
log.paldea = (message) => print(configLog.paldea, message);
log.commands = (message) => print(configLog.cmd, message);
log.events = (message) => print(configLog.evnts, message);
log.dev = (message) => print(configLog.dev, message);
log.login = (message) => print(configLog.login, message);

// Error is special (Red)
log.error = (message) => print(configLog.error, message, chalk.red);

// Database and System logs
log.database = (message) => print('database', message);
log.update = (message) => print('update', message);
log.backup = (message) => print('backup', message);
log.download = (message) => print('download', message);
log.install = (message) => print('install', message);

// 3. Export the log object as default
export default log;
