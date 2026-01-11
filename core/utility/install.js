import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import module from 'module';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = process.cwd();

// --- Configuration ---
const IGNORE_DIRS = ['node_modules', '.git', '.github', 'dist', 'build', 'logs'];
const BUILTIN_MODULES = [
  ...module.builtinModules,
  'fs/promises', 'stream/web', 'timers/promises', 'util/types', 'sys'
];

/**
 * 📦 SYSTEM DEPENDENCY AUTO-INSTALLER
 * Scans project for missing imports and installs them automatically.
 * @param {object} log - Custom logger object
 */
export async function install(log) {
  console.log('');
  console.log(chalk.bold.blue('PALDEA AUTO-DEPENDENCY SCANNER'));

  try {
    // 1. Get all .js files recursively
    log.install('Scanning project files...');
    const files = getFilesRecursive(ROOT_DIR);
    log.install(`Scanned ${files.length} JavaScript files.`);

    // 2. Extract imports from all files
    const foundImports = new Set();
    files.forEach(file => {
      const content = fs.readFileSync(file, 'utf8');
      const imports = extractImports(content);
      imports.forEach(imp => foundImports.add(imp));
    });

    // 3. Filter valid npm packages
    const packageJsonPath = path.join(ROOT_DIR, 'package.json');
    const packageJson = fs.existsSync(packageJsonPath) 
      ? JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) 
      : { dependencies: {}, devDependencies: {} };

    const installed = new Set([
      ...Object.keys(packageJson.dependencies || {}),
      ...Object.keys(packageJson.devDependencies || {})
    ]);

    const missingPackages = [...foundImports].filter(pkg => {
      // FIX: Ignore internal node modules prefixed with "node:" (e.g. node:path)
      if (pkg.startsWith('node:')) return false;

      // Logic to resolve exact package name from import path
      const parts = pkg.split('/');
      const name = pkg.startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];

      // Filter out conditions
      const isBuiltIn = BUILTIN_MODULES.includes(name);
      const isInstalled = installed.has(name);
      const isLocal = pkg.startsWith('.') || pkg.startsWith('/');
      const isSelf = name === 'chalk' || name === 'fs-extra'; 

      return !isBuiltIn && !isInstalled && !isLocal && !isSelf;
    });

    // 4. Install missing packages
    if (missingPackages.length === 0) {
      log.install('System Healthy: All dependencies are installed.');
    } else {
      log.error('Missing Dependencies Detected:');
      missingPackages.forEach(pkg => console.log(chalk.gray(`   - ${pkg}`)));

      log.install('Installing packages... (This may take a moment)');

      const installCmd = `npm install ${missingPackages.join(' ')}`;

      try {
        execSync(installCmd, { stdio: 'inherit', cwd: ROOT_DIR });
        log.install('Installation Complete! System is ready.');
      } catch (err) {
        log.error('Installation Failed');
        console.error('Please try running manually:');
        console.error(`npm install ${missingPackages.join(' ')}`);
      }
    }

    console.log('');

  } catch (error) {
    log.error(`Critical Error during scan: ${error.message}`);
  }
}

// --- Helper Functions ---

function getFilesRecursive(dir) {
  let results = [];
  const list = fs.readdirSync(dir);

  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat && stat.isDirectory()) {
      if (!IGNORE_DIRS.includes(file)) {
        results = results.concat(getFilesRecursive(filePath));
      }
    } else if (file.endsWith('.js') && file !== 'install.js') {
      results.push(filePath);
    }
  });

  return results;
}

function extractImports(content) {
  const imports = new Set();

  const esmRegex = /(?:import|export)\s+(?:[\w\s{},*]*\s+from\s+)?['"]([^'"]+)['"]/g;
  let match;
  while ((match = esmRegex.exec(content)) !== null) {
    imports.add(match[1]);
  }

  const dynamicImportRegex = /import\(['"]([^'"]+)['"]\)/g;
  while ((match = dynamicImportRegex.exec(content)) !== null) {
    imports.add(match[1]);
  }

  const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
  while ((match = requireRegex.exec(content)) !== null) {
    imports.add(match[1]);
  }

  return [...imports];
}

export default install;