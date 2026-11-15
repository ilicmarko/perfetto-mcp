#!/usr/bin/env node
// Copyright 2025 The perfetto-mcp-rs Authors
// SPDX-License-Identifier: Apache-2.0

// Thin launcher: resolves the prebuilt perfetto-mcp binary shipped in the
// platform-specific optional dependency (e.g. `perfetto-mcp-darwin-arm64`) and
// runs it with inherited stdio, so MCP JSON-RPC flows straight through.
// Nothing may be written to stdout here: it is reserved for JSON-RPC.
'use strict';

const { spawn } = require('node:child_process');
const pkg = require('../package.json');

function resolveBinary() {
  if (process.env.PERFETTO_MCP_BINARY) {
    return process.env.PERFETTO_MCP_BINARY;
  }
  const platformKey = `${process.platform}-${process.arch}`;
  const packages = pkg.binaryPackages || {};
  const platformPkg = packages[platformKey] || `${pkg.name}-${platformKey}`;
  const exe = process.platform === 'win32' ? 'perfetto-mcp.exe' : 'perfetto-mcp';
  try {
    return require.resolve(`${platformPkg}/bin/${exe}`);
  } catch {
    const optional = pkg.optionalDependencies || {};
    const supported = Object.keys(packages).join(', ');
    process.stderr.write(
      Object.prototype.hasOwnProperty.call(optional, platformPkg)
        ? `perfetto-mcp: the binary package "${platformPkg}" is not installed.\n` +
            'It is an optional dependency; reinstall without --no-optional / --omit=optional,\n' +
            `or install it directly: npm install ${platformPkg}@${pkg.version}\n`
        : `perfetto-mcp: no prebuilt binary for ${platformKey}. Supported: ${supported || 'none'}.\n` +
            'Build from source instead: https://github.com/ilicmarko/perfetto-mcp#build-from-source\n',
    );
    process.exit(1);
  }
}

const child = spawn(resolveBinary(), process.argv.slice(2), {
  stdio: 'inherit',
  env: { ...process.env, PERFETTO_MCP_NPM_LAUNCHER: '1' },
  windowsHide: true,
});

const forwarded = ['SIGINT', 'SIGTERM', 'SIGHUP'];
for (const signal of forwarded) {
  process.on(signal, () => {
    if (child.exitCode === null && child.signalCode === null) child.kill(signal);
  });
}

child.on('error', (err) => {
  process.stderr.write(`perfetto-mcp: failed to start binary: ${err.message}\n`);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    for (const s of forwarded) process.removeAllListeners(s);
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
