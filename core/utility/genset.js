import fs from 'fs-extra';
import path from 'path';

const PATH = path.join(process.cwd(), 'json', 'settings.json');

const DEFAULTS = {
  maintenance: false,
  timezone: "Asia/Manila",
  prefix: "/",
  subprefix: ["+", "-", "."],
  developers: [],
  vip: []
};

/**
 * Reads settings, creating the file if missing.
 */
export const getSettings = () => {
  try {
    if (!fs.existsSync(PATH)) {
      fs.outputJsonSync(PATH, DEFAULTS, { spaces: 2 });
      return DEFAULTS;
    }
    return fs.readJsonSync(PATH);
  } catch (err) {
    throw new Error(`Failed to load settings: ${err.message}`);
  }
};

/**
 * Updates settings by merging new data with existing data.
 * @param {Object} newConfig 
 */
export const setSettings = (newConfig) => {
  try {
    const current = getSettings();
    const updated = { ...current, ...newConfig };
    fs.outputJsonSync(PATH, updated, { spaces: 2 });
    return updated;
  } catch (err) {
    throw new Error(`Failed to save settings: ${err.message}`);
  }
};