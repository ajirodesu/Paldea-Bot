/**
 * Developer Mode (Maintenance)
 * Toggles global maintenance mode. Only developers can use the bot when active.
 */

export const meta = {
  name: 'devmode',
  version: '1.1.0',
  aliases: ['maintenance', 'maintenancemode'],
  description: 'Toggle Global Maintenance Mode.',
  author: 'AjiroDesu',
  prefix: 'both',
  category: 'system',
  type: 'developer', // STRICTLY DEVELOPER
  cooldown: 5,
  guide: ['[on | off]']
};

export async function onStart({ args, response }) {
  const currentSettings = global.paldea.settings;
  const state = args[0]?.toLowerCase();

  // 1. Turn ON
  if (state === 'on' || state === 'enable') {
    if (currentSettings.maintenance) return response.reply("🚧 **Maintenance is already ACTIVE.**");

    // Update Global State
    global.paldea.settings = { ...currentSettings, maintenance: true };

    // IMPORTANT: If you have a file save function (like genset.js), you might need to call it here.
    // Example: saveSettings(global.paldea.settings);

    return response.reply(
      `🚧 **Maintenance Mode Enabled**\n\n` +
      `The bot is now locked for regular users.\n` +
      `Only developers can execute commands.`
    );
  }

  // 2. Turn OFF
  if (state === 'off' || state === 'disable') {
    if (!currentSettings.maintenance) return response.reply("🟢 **System is already ONLINE.**");

    global.paldea.settings = { ...currentSettings, maintenance: false };

    return response.reply(
      `🟢 **Maintenance Mode Disabled**\n\n` +
      `The bot is now available for all users.`
    );
  }

  // 3. Status Check (Default)
  const status = currentSettings.maintenance ? "🚧 ACTIVE" : "🟢 INACTIVE";
  return response.reply(`🛠️ **Maintenance Status:** ${status}`);
}