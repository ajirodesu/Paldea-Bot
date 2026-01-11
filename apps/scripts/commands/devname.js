/**
 * Developer Username Generator
 * Generates creative usernames based on different tech styles.
 */
export const meta = {
  name: 'devname',
  version: '1.2.0',
  aliases: ['devnick', 'devuser'],
  description: 'Generate cool developer usernames.',
  author: 'JohnDev19',
  prefix: 'both',
  category: 'fun',
  type: 'anyone',
  cooldown: 3,
  guide: ['<name> [style]']
};

// --- Data ---
const PREFIXES = [
  'cyber','tech','code','dev','hack','byte','pixel','data','web','net','algo','script','logic','proto','meta',
  'digital','binary','quantum','neural','crypto','machine','cloud','zero','stack','core','spark','prime','matrix',
  'flux','nano','system','micro','intel','async','sync','root','admin','kernel','lambda','debug','circuit','network',
  'stream','buffer','cache','block','thread','signal','proxy','pulse','blade','bolt','drone','alpha','beta','gamma',
  'delta','echo','omega','ai','ml','deep','learn','brain','smart','compute','daemon','router','server','client','host'
];

const SUFFIXES = [
  'warrior','champion','elite','legend','titan','phoenix','dragon','wolf','hawk','fox','knight','samurai','ranger',
  'sentinel','guardian','shield','blade','storm','thunder','master','sage','guru','sensei','oracle','seer','architect',
  'hunter','scout','slayer','breaker','crusher','spark','flame','blaze','inferno','nova','star','comet','rocket','prime'
];

const TECH_STACK = [
  'git','node','react','vue','rust','java','py','go','ruby','swift','docker','k8s','nginx','redis','mongo',
  'graphql','ts','js','dart','elixir','svelte','next','nuxt','django','flask','aws','azure','linux','arch','bash'
];

const LEET_MAP = { a: '4', e: '3', i: '1', o: '0', s: '5', t: '7', b: '8', g: '9' };

// --- Generators ---

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randNum = (max = 999) => Math.floor(Math.random() * (max + 1));

const generators = {
  classic: (name, count) => {
    const out = [];
    for (let i = 0; i < count; i++) {
      out.push(`${rand(PREFIXES)}${name}${rand(SUFFIXES)}`);
    }
    return out;
  },

  leet: (name, count) => {
    const out = [];
    for (let i = 0; i < count; i++) {
      let leet = name.toLowerCase();
      Object.entries(LEET_MAP).forEach(([k, v]) => {
        if (Math.random() > 0.5) leet = leet.replace(new RegExp(k, 'g'), v);
      });
      out.push(`${rand(PREFIXES)}_${leet}_${randNum()}`);
    }
    return out;
  },

  minimalist: (name, count) => {
    const base = name.toLowerCase();
    const noVowels = base.replace(/[aeiou]/g, '') || base;
    return [
      `_${base}_`, `-${base}-`, `.${base}.`,
      `_${noVowels}_`, `-${noVowels}-`, `.${noVowels}.`
    ].slice(0, count);
  },

  tech: (name, count) => {
    const out = [];
    for (let i = 0; i < count; i++) {
      const tech = rand(TECH_STACK);
      out.push(i % 2 === 0 ? `${tech}.${name}.dev` : `${name}.${tech}.io`);
    }
    return out;
  }
};

// --- Command ---

export async function onStart({ args, response, usage }) {
  if (!args.length) return usage();

  const name = args[0].toLowerCase().trim();
  const style = args[1]?.toLowerCase();
  const validStyles = Object.keys(generators);

  // Validation
  if (!/^[a-z]{2,20}$/.test(name)) {
    return response.reply('⚠️ **Invalid Name**\nUse 2-20 letters (A-Z) only.');
  }

  if (style && !validStyles.includes(style)) {
    return response.reply(`⚠️ **Invalid Style**\nAvailable: ${validStyles.join(', ')}`);
  }

  const loading = await response.reply('🎨 **Generating usernames...**');

  try {
    let message = '';

    if (style) {
      // Specific Style
      const names = generators[style](name, 6);
      message = `🎯 **${style.toUpperCase()} Usernames**\n\n` + 
                names.map((n, i) => `${i + 1}. \`${n}\``).join('\n');
    } else {
      // All Styles
      const blocks = validStyles.map(s => {
        const names = generators[s](name, 4); // 4 per style to keep message short
        return `**${s.toUpperCase()}**\n${names.map(n => `• \`${n}\``).join('\n')}`;
      });
      message = `🎨 **Username Suggestions**\n\n${blocks.join('\n\n')}`;
    }

    await response.edit('text', loading, message);

  } catch (err) {
    await response.edit('text', loading, `⚠️ **Error:** ${err.message}`);
  }
}