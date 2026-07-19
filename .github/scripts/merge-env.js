#!/usr/bin/env node
// merge-env.js — Injects secrets from ~/.env.secrets into the deploy directory's .env file.
// Usage: node merge-env.js /path/to/deploy/dir
const fs = require('fs');
const path = require('path');

const deployDir = process.argv[2];
if (!deployDir) {
  console.error('Usage: node merge-env.js <deploy-dir>');
  process.exit(1);
}

const secretsFile = path.join(process.env.HOME, '.env.secrets');
if (!fs.existsSync(secretsFile)) {
  console.log('No secrets file found, skipping.');
  process.exit(0);
}

const envFile = path.join(deployDir, '.env');
const exampleFile = path.join(deployDir, '.env.example');
let content = fs.existsSync(envFile)
  ? fs.readFileSync(envFile, 'utf8')
  : fs.readFileSync(exampleFile, 'utf8');

const secrets = fs.readFileSync(secretsFile, 'utf8');
for (const line of secrets.split('\n')) {
  const idx = line.indexOf('=');
  if (idx < 1) continue;
  const key = line.substring(0, idx).trim();
  const val = line.substring(idx + 1).trim();
  if (!key || !val) continue;
  const re = new RegExp('^' + key + '=.*', 'm');
  content = re.test(content)
    ? content.replace(re, key + '=' + val)
    : content + '\n' + key + '=' + val;
}

fs.writeFileSync(envFile, content, 'utf8');
console.log('✅ Secrets injected into .env successfully.');
