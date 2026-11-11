#!/usr/bin/env node
// Copyright 2025 The perfetto-mcp-rs Authors
// SPDX-License-Identifier: Apache-2.0

// Assembles publishable npm packages from the release binaries.
//
//   node npm/scripts/build-packages.mjs --artifacts <dir> --out <dir> [--version X.Y.Z]
//
// <artifacts> holds the release assets (perfetto-mcp-rs-darwin-arm64, ...).
// Produces <out>/<platform-pkg>/ for every platform plus <out>/<main-pkg>/,
// with the main package's optionalDependencies pinned to the exact version.
// Version defaults to Cargo.toml's, which is the single source of truth.

import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

// npm `os`/`cpu` values -> release asset name produced by release.yml.
export const PLATFORMS = [
  { os: 'darwin', cpu: 'arm64', asset: 'perfetto-mcp-rs-darwin-arm64' },
  { os: 'darwin', cpu: 'x64', asset: 'perfetto-mcp-rs-darwin-amd64' },
  { os: 'linux', cpu: 'arm64', asset: 'perfetto-mcp-rs-linux-arm64' },
  { os: 'linux', cpu: 'x64', asset: 'perfetto-mcp-rs-linux-amd64' },
  { os: 'win32', cpu: 'x64', asset: 'perfetto-mcp-rs-windows-amd64.exe' },
];

function cargoVersion() {
  const toml = readFileSync(join(repoRoot, 'Cargo.toml'), 'utf8');
  const match = toml.match(/^\[package\][\s\S]*?^version\s*=\s*"([^"]+)"/m);
  if (!match) throw new Error('could not read [package] version from Cargo.toml');
  return match[1];
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

const { values } = parseArgs({
  options: {
    artifacts: { type: 'string' },
    out: { type: 'string' },
    version: { type: 'string' },
  },
});
if (!values.artifacts || !values.out) {
  console.error('usage: build-packages.mjs --artifacts <dir> --out <dir> [--version X.Y.Z]');
  process.exit(2);
}

const version = values.version ?? cargoVersion();
const artifacts = resolve(values.artifacts);
const out = resolve(values.out);
const main = JSON.parse(readFileSync(join(repoRoot, 'npm', 'perfetto-mcp', 'package.json'), 'utf8'));
const shared = {
  license: main.license,
  repository: main.repository,
  homepage: main.homepage,
  bugs: main.bugs,
};

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const optionalDependencies = {};
for (const { os, cpu, asset } of PLATFORMS) {
  const src = join(artifacts, asset);
  if (!existsSync(src)) throw new Error(`missing release asset: ${src}`);
  const name = `${main.name}-${os}-${cpu}`;
  const dir = join(out, name.replace('/', '__'));
  const exe = os === 'win32' ? 'perfetto-mcp-rs.exe' : 'perfetto-mcp-rs';
  mkdirSync(join(dir, 'bin'), { recursive: true });
  copyFileSync(src, join(dir, 'bin', exe));
  chmodSync(join(dir, 'bin', exe), 0o755);
  for (const license of ['LICENSE-MIT', 'LICENSE-APACHE']) {
    copyFileSync(join(repoRoot, license), join(dir, license));
  }
  writeFileSync(
    join(dir, 'README.md'),
    `# ${name}\n\nPrebuilt \`perfetto-mcp-rs\` binary for ${os}-${cpu}. ` +
      `Do not install directly; use [\`${main.name}\`](https://www.npmjs.com/package/${main.name}).\n`,
  );
  writeJson(join(dir, 'package.json'), {
    name,
    version,
    description: `${os}-${cpu} binary for ${main.name}`,
    ...shared,
    os: [os],
    cpu: [cpu],
    files: ['bin/', 'README.md', 'LICENSE-MIT', 'LICENSE-APACHE'],
    preferUnplugged: true,
  });
  optionalDependencies[name] = version;
  console.error(`built ${name}@${version}`);
}

const mainDir = join(out, main.name.replace('/', '__'));
mkdirSync(join(mainDir, 'bin'), { recursive: true });
copyFileSync(join(repoRoot, 'npm', 'perfetto-mcp', 'bin', 'perfetto-mcp.js'), join(mainDir, 'bin', 'perfetto-mcp.js'));
chmodSync(join(mainDir, 'bin', 'perfetto-mcp.js'), 0o755);
for (const file of ['README.md', 'LICENSE-MIT', 'LICENSE-APACHE']) {
  copyFileSync(join(repoRoot, file), join(mainDir, file));
}
writeJson(join(mainDir, 'package.json'), { ...main, version, optionalDependencies });
console.error(`built ${main.name}@${version}`);
