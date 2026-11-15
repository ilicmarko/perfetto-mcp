#!/usr/bin/env node
// Renders the Homebrew formula for a release from its SHA256SUMS file.
//
//   node .github/scripts/render-homebrew-formula.mjs \
//     --version 0.18.0 --sums dist/SHA256SUMS [--repo ilicmarko/perfetto-mcp] > perfetto-mcp.rb
//
// The whole formula is regenerated every release, so the tap repo needs no
// hand-maintained template.
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    version: { type: 'string' },
    sums: { type: 'string' },
    repo: { type: 'string', default: 'ilicmarko/perfetto-mcp' },
  },
});
if (!values.version || !values.sums) {
  console.error('usage: render-homebrew-formula.mjs --version X.Y.Z --sums SHA256SUMS [--repo owner/name]');
  process.exit(2);
}

const sums = new Map();
for (const line of readFileSync(values.sums, 'utf8').split('\n')) {
  const m = line.trim().match(/^([0-9a-f]{64})\s+\*?(\S+)$/);
  if (m) sums.set(m[2], m[1]);
}

const base = `https://github.com/${values.repo}/releases/download/v${values.version}`;
const asset = (name) => {
  const sha = sums.get(name);
  if (!sha) {
    console.error(`SHA256SUMS has no entry for ${name}`);
    process.exit(1);
  }
  return `      url "${base}/${name}"\n      sha256 "${sha}"`;
};

process.stdout.write(`class PerfettoMcp < Formula
  desc "MCP server for Perfetto trace analysis"
  homepage "https://github.com/${values.repo}"
  version "${values.version}"
  license any_of: ["MIT", "Apache-2.0"]

  on_macos do
    on_arm do
${asset('perfetto-mcp-darwin-arm64')}
    end
    on_intel do
${asset('perfetto-mcp-darwin-amd64')}
    end
  end

  on_linux do
    on_arm do
${asset('perfetto-mcp-linux-arm64')}
    end
    on_intel do
${asset('perfetto-mcp-linux-amd64')}
    end
  end

  def install
    bin.install Dir["perfetto-mcp-*"].first => "perfetto-mcp"
  end

  test do
    assert_match "perfetto-mcp #{version}", shell_output("#{bin}/perfetto-mcp --version")
  end
end
`);
