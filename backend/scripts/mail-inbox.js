const fs = require('node:fs/promises');
const path = require('node:path');
const env = require('../src/config/env');
const { mailDirectory } = require('../src/modules/auth/mail.service');
async function read() {
  if (env.nodeEnv === 'production') throw new Error('Local mail viewer is for development only.');
  const dir = mailDirectory();
  const names = (await fs.readdir(dir).catch(error => error.code === 'ENOENT' ? [] : Promise.reject(error))).filter(name => name.endsWith('.json')).sort().slice(-10);
  if (!names.length) return console.log('Hộp thư thử chưa có thư.');
  for (const name of names) {
    const mail = JSON.parse(await fs.readFile(path.join(dir, name), 'utf8'));
    console.log(`\n${mail.createdAt} — ${mail.to}\n${mail.subject}\n${mail.text}`);
  }
}
read().catch(error => { console.error(error.message); process.exitCode = 1; });
