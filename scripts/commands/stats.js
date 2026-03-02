import os from 'os';

// --- Helpers ---

function formatUptime(seconds) {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0) parts.push(`${s}s`);

  return parts.join(' ') || '0s';
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Status Command
 * Displays real-time system and bot statistics.
 */
export const meta = {
  name: 'status',
  version: '1.1.0',
  aliases: ['stats', 'botinfo', 'system'],
  description: 'Displays comprehensive real-time bot and server information.',
  author: 'Francis Loyd Raval',
  prefix: 'both',
  category: 'utility',
  type: 'anyone',
  cooldown: 5,
  guide: []
};

export async function onStart({ response }) {
  const start = Date.now();

  // 1. Send placeholder to calculate real API latency
  const loading = await response.reply('📊 **Accessing System Metrics...**');

  try {
    // 2. Gather Data
    const uptimeSeconds = process.uptime();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    const processMem = process.memoryUsage();
    const cpus = os.cpus();
    const cpuModel = cpus.length ? cpus[0].model.trim() : 'Unknown';
    const loadAvg = os.loadavg();

    // 3. Calculate Latency
    const latency = Date.now() - start;

    // 4. Build Report
    const info = [
      `🤖 **Paldea Bot Status**`,
      `• **Uptime:** ${formatUptime(uptimeSeconds)}`,
      `• **Latency:** ${latency}ms`,
      `• **Node.js:** ${process.version}`,
      `• **PID:** ${process.pid}`,
      ``,
      `💻 **System**`,
      `• **OS:** ${os.type()} ${os.arch()} (${os.release()})`,
      `• **CPU:** ${cpuModel} (${cpus.length} cores)`,
      `• **Load:** ${loadAvg.map(l => l.toFixed(2)).join(', ')}`,
      `• **Sys Uptime:** ${formatUptime(os.uptime())}`,
      ``,
      `🧠 **Memory (RAM)**`,
      `• **Total:** ${formatBytes(totalMem)}`,
      `• **Used:** ${formatBytes(usedMem)} (${((usedMem / totalMem) * 100).toFixed(1)}%)`,
      `• **Free:** ${formatBytes(freeMem)}`,
      ``,
      `📦 **Process Usage**`,
      `• **RSS:** ${formatBytes(processMem.rss)}`,
      `• **Heap:** ${formatBytes(processMem.heapUsed)} / ${formatBytes(processMem.heapTotal)}`
    ].join('\n');

    // 5. Update Message
    await response.edit('text', loading, info);

  } catch (err) {
    await response.edit('text', loading, `⚠️ **Error:** Failed to retrieve stats.\n\`${err.message}\``);
  }
}