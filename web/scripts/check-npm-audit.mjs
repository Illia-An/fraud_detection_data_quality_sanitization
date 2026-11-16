/**
 * Fail CI on unexpected critical production advisories (Wave 3 / S-08).
 * Known transitive findings may be listed in npm-audit-allowlist.json by GHSA id.
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const allowPath = join(root, 'npm-audit-allowlist.json');

let allow = { critical: [] };
try {
  allow = JSON.parse(readFileSync(allowPath, 'utf8'));
} catch {
  // optional file
}
const allowed = new Set((allow.critical || []).map((x) => x.id));

let report;
try {
  const raw = execSync('npm audit --omit=dev --json', {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  report = JSON.parse(raw);
} catch (err) {
  const out = err.stdout?.toString?.() || '';
  if (!out.trim()) {
    console.error('npm audit failed with no JSON output');
    process.exit(1);
  }
  report = JSON.parse(out);
}

const vulns = report.vulnerabilities || {};

function collectGhsaIds(info, seenPkgs = new Set()) {
  const ids = [];
  for (const item of info.via || []) {
    if (typeof item === 'string') {
      if (vulns[item] && !seenPkgs.has(item)) {
        seenPkgs.add(item);
        ids.push(...collectGhsaIds(vulns[item], seenPkgs));
      }
      continue;
    }
    if (item && typeof item === 'object' && item.url) {
      const m = String(item.url).match(/GHSA-[\w-]+/);
      if (m) ids.push(m[0]);
    }
  }
  return [...new Set(ids)];
}

const unexpected = [];

for (const [name, info] of Object.entries(vulns)) {
  if ((info.severity || '').toLowerCase() !== 'critical') {
    continue;
  }
  const ids = collectGhsaIds(info, new Set([name]));
  if (ids.length === 0) {
    unexpected.push({ name, severity: info.severity, ids: [`pkg:${name}`] });
    continue;
  }
  if (!ids.every((id) => allowed.has(id))) {
    unexpected.push({ name, severity: info.severity, ids });
  }
}

if (unexpected.length) {
  console.error('Unexpected critical production advisories:');
  for (const row of unexpected) {
    console.error(`- ${row.name}: ${row.ids.join(', ')}`);
  }
  process.exit(1);
}

console.log('npm audit --omit=dev: no unexpected critical findings');
