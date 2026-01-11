import { readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';
import { pathToFileURL } from 'url';
import log from './log.js';
import chalk from 'chalk';

/**
 * Recursively gets all files in a directory and its subdirectories
 * @param {string} dir - The directory to scan
 * @returns {string[]} - List of full file paths
 */
const getAllFiles = (dir) => {
  let results = [];
  try {
    const list = readdirSync(dir);
    list.forEach((file) => {
      const fullPath = join(dir, file);
      const stat = statSync(fullPath);
      if (stat && stat.isDirectory()) {
        results = results.concat(getAllFiles(fullPath));
      } else {
        results.push(fullPath);
      }
    });
  } catch (err) {
    return [];
  }
  return results;
};

/**
 * Generic loader to handle both Commands and Events
 * @param {string} type - 'commands' or 'events'
 * @param {string} dirPath - Relative path to the directory
 * @param {Map} targetMap - The global map to store the modules
 * @param {Array} requiredKeys - Keys required in the module (validation)
 */
const scanAndLoad = async (type, dirPath, targetMap, requiredKeys) => {
  const fullPath = resolve(process.cwd(), dirPath);
  const logMethod = type === 'commands' ? log.commands : log.events;

  // 1. Check Directory
  console.log(chalk.bold.blue(`SCANNING ${type.toUpperCase()} `));
  log.paldea(`${type} path: ${fullPath}`);

  const files = getAllFiles(fullPath).filter((file) => file.endsWith('.js') || file.endsWith('.ts'));

  if (files.length === 0) {
    logMethod(`Directory not found or empty: ${dirPath}`);
    return;
  }

  const validModules = [];

  // 2. Scan & Validate
  for (const file of files) {
    try {
      const modulePath = pathToFileURL(file).href;
      const imported = await import(modulePath);

      // --- NEW LOGIC: Support "meta" structure + named exports ---
      let content = {};

      if (imported.meta) {
        // Merge meta props with the top-level functions (onStart, onEvent, etc.)
        content = { ...imported.meta };
        // Create self-reference
        content.meta = imported.meta;

        // Attach handlers if they exist as named exports
        ['onStart', 'onChat', 'onReply', 'onEvent', 'onCallback'].forEach(fn => {
            if (imported[fn]) content[fn] = imported[fn];
        });
      } else {
        // Fallback to default export (Legacy support)
        content = imported.default || imported;
      }
      // ---------------------------------------------------------

      // Validation
      const missing = requiredKeys.find(key => {
        if (key === 'aliases') return !Array.isArray(content[key]);
        if (key.startsWith('on')) return typeof content[key] !== 'function';
        return typeof content[key] !== 'string';
      });

      const fileName = file.split(/[/\\]/).pop();

      if (missing) {
        log.error(`Scan failed ${fileName}: Invalid or missing '${missing}'`);
        continue;
      }

      logMethod(`Scanned ${fileName}`);
      validModules.push({ name: content.name, content, file, fileName });

    } catch (err) {
      log.error(`Error importing ${file}: ${err.message}`);
    }
  }

  if (validModules.length === 0) {
    log.error(`No valid ${type} found after scanning.`);
    return;
  }

  logMethod(`Scan complete: ${validModules.length} valid ${type} found.`);

  // 3. Deployment
  for (const { name, content, file } of validModules) {
    try {
      targetMap.set(name, content);
      logMethod(`Deployed ${name}`);
    } catch (error) {
      log.error(`Failed to deploy ${name} from ${file}: ${error.stack}`);
    }
  }

  logMethod(`Loaded ${validModules.length} valid ${type}. System Ready.`);
};

// --- Main Exports ---

const scripts = {
  async loadCommands() {
    await scanAndLoad(
      'commands',
      'apps/scripts/commands',
      global.paldea.commands,
      // Updated validation keys to match the new structure
      ['name', 'description', 'onStart']
    );
  },

  async loadEvents() {
    console.log(''); 

    await scanAndLoad(
      'events',
      'apps/scripts/events',
      global.paldea.events,
      // Updated validation keys to match the new structure
      ['name', 'description', 'onEvent']
    );
  }
};

export default scripts;
