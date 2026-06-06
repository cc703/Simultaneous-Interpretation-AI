import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const root = process.cwd();
const includeRoots = [
  'src',
  'server',
  'scripts',
  'docs',
  'public',
  '.env.example',
  'package.json',
  'README.md',
  '../README.md',
  '../design.md',
  '../AGENT.md',
  '../AGENTS.md',
  '../.gitignore',
];
const ignoredDirs = new Set(['node_modules', 'dist', 'logs', '.git']);
const patterns = [
  /sk-[A-Za-z0-9_-]{10,}/,
  /DASHSCOPE_API_KEY\s*=\s*[A-Za-z0-9_-]{20,}/,
  /OPENAI_API_KEY\s*=\s*sk-/,
  /Bearer\s+[A-Za-z0-9._-]{20,}/,
];
const hits = [];

for (const entry of includeRoots) {
  await scan(join(root, entry));
}

if (hits.length > 0) {
  for (const hit of hits) console.error(`SECRET? ${hit}`);
  process.exitCode = 1;
} else {
  console.log('PASS no obvious API secrets in tracked source surfaces.');
}

async function scan(path) {
  let entries;
  try {
    entries = await readdir(path, { withFileTypes: true });
  } catch {
    await scanFile(path);
    return;
  }

  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirs.has(entry.name)) continue;
    const child = join(path, entry.name);
    if (entry.isDirectory()) {
      await scan(child);
    } else {
      await scanFile(child);
    }
  }
}

async function scanFile(path) {
  const rel = relative(root, path).replace(/\\/g, '/');
  if (/\.(png|jpg|jpeg|gif|mp4|wav|mp3|m4a|webm|ogg|ico)$/i.test(rel)) return;
  let text;
  try {
    text = await readFile(path, 'utf8');
  } catch {
    return;
  }
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (patterns.some((pattern) => pattern.test(line))) {
      hits.push(`${rel}:${index + 1}`);
    }
  });
}
