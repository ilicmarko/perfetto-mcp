# perfetto-mcp-rs

[![npm](https://img.shields.io/npm/v/perfetto-mcp?logo=npm)](https://www.npmjs.com/package/perfetto-mcp)
[![npm downloads](https://img.shields.io/npm/dm/perfetto-mcp)](https://www.npmjs.com/package/perfetto-mcp)
[![Release](https://img.shields.io/github/v/release/ilicmarko/perfetto-mcp?logo=github)](https://github.com/ilicmarko/perfetto-mcp/releases/latest)
[![CI](https://github.com/ilicmarko/perfetto-mcp/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/ilicmarko/perfetto-mcp/actions/workflows/ci.yml)
[![Release workflow](https://github.com/ilicmarko/perfetto-mcp/actions/workflows/release.yml/badge.svg?branch=main)](https://github.com/ilicmarko/perfetto-mcp/actions/workflows/release.yml)
[![License](https://img.shields.io/badge/license-MIT%20OR%20Apache--2.0-blue)](#license)

> [!NOTE]
> **This is a fork, maintained separately.** [`ilicmarko/perfetto-mcp`](https://github.com/ilicmarko/perfetto-mcp)
> is an independently maintained fork of
> [`tooluse-labs/perfetto-mcp-rs`](https://github.com/tooluse-labs/perfetto-mcp-rs),
> created and maintained by the perfetto-mcp-rs authors. All credit for the original
> design and implementation goes to them. The fork may diverge from upstream (for
> example, it upgrades `rmcp` so the server works with GitHub Copilot CLI), and
> issues here should not be reported upstream. The original license terms
> (MIT OR Apache-2.0, see [`LICENSE-MIT`](LICENSE-MIT) and
> [`LICENSE-APACHE`](LICENSE-APACHE)) and copyright notices are retained.
>
> Releases, the npm package (`perfetto-mcp`), the install scripts, and
> `update` / `check-update` all use **this fork's** releases.

An [MCP](https://modelcontextprotocol.io) server that lets LLMs analyze
[Perfetto](https://perfetto.dev) traces. Point Claude Code (or any MCP client) at
a trace file (`.pftrace` / `.perfetto-trace` / `.bin` / … — content-sniffed) and
ask in plain language. The server runs PerfettoSQL under the hood, backed by
`trace_processor_shell` — downloaded automatically on first run, no manual
Perfetto install required.

> Dedicated tools ship curated SQL; for custom analysis the agent writes PerfettoSQL — steered toward the right stdlib modules.

## Quick start

You drive perfetto-mcp through an MCP client (Claude Code, Copilot CLI, VS Code,
Cursor, Codex, …). The only requirement is [Node.js](https://nodejs.org) 18+:
`npx` fetches a prebuilt native binary for your platform, nothing is compiled.

**1. Add the server to your client.** Every client runs the same command:
`npx -y perfetto-mcp@latest`.

<details open>
<summary><b>Claude Code</b></summary>

```sh
claude mcp add perfetto --scope user -- npx -y perfetto-mcp@latest
```

</details>

<details>
<summary><b>GitHub Copilot CLI</b></summary>

```sh
copilot mcp add perfetto -- npx -y perfetto-mcp@latest
```

</details>

<details>
<summary><b>VS Code (Copilot Chat)</b></summary>

```sh
code --add-mcp '{"name":"perfetto","command":"npx","args":["-y","perfetto-mcp@latest"]}'
```

Or add it to `.vscode/mcp.json` for a single workspace:

```json
{
  "servers": {
    "perfetto": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "perfetto-mcp@latest"]
    }
  }
}
```

</details>

<details>
<summary><b>Codex</b></summary>

```sh
codex mcp add perfetto -- npx -y perfetto-mcp@latest
```

</details>

<details>
<summary><b>Cursor, Claude Desktop, Windsurf, Qoder, other JSON-configured clients</b></summary>

```json
{
  "mcpServers": {
    "perfetto": {
      "command": "npx",
      "args": ["-y", "perfetto-mcp@latest"]
    }
  }
}
```

Cursor: `~/.cursor/mcp.json`. Claude Desktop: Settings → Developer → Edit Config.

</details>

<details>
<summary><b>Windows note</b></summary>

Some clients can't spawn `npx` directly on Windows. If the server fails to
start, use `"command": "cmd"` with `"args": ["/c", "npx", "-y", "perfetto-mcp@latest"]`.

</details>

Restart the client (or start a new session) to pick it up. Prefer a standalone
binary without Node.js? See [Install options](#install-options).

**2. Ask in plain language:**

> Load `~/traces/scroll_jank.pftrace` and tell me the top scroll-jank causes.

Swap in any Perfetto trace you have — captured from the Perfetto UI,
`chrome://tracing`, or `record_android_trace`.

The agent calls `load_trace`, sees it's a Chrome trace, and reaches for the
dedicated `chrome_scroll_jank_summary` tool — no SQL to hand-write. When a
question falls outside the dedicated tools, it drops down to `execute_sql` with
raw PerfettoSQL on the same trace.

Works best with agentic clients (Claude Code, Codex, Claude Desktop, Cursor)
that chain multi-turn tool calls and follow the server's error-message nudges.
Non-agentic clients see the same tools and error nudges, but won't chain the
guided flow automatically.

## Tools

For one trace, other tools act on the most recently loaded trace by default. For
multiple traces, call `load_trace` with `paths`, keep the returned `trace_id` for
each file, and pass the intended id to every trace-bound tool call.

MCP tool annotations are client-facing intent and safety hints, not server-side
authorization or execution boundaries.

**Essential**

| Tool | Purpose |
|---|---|
| `load_trace` | Open one trace with `path`, or several with `paths`; returns an opaque `trace_id` and lightweight routing summary for each file (type/profile, duration, platform, process/thread counts, capabilities, redaction policy, recommended next tools) |
| `execute_sql` | Run a PerfettoSQL query (max 5000 returned rows). Prefer the dedicated `chrome_*` / `list_*` tools for standard analyses; use this for custom joins or aggregations they don't expose. Output shaping: `head`/`limit`, `summary`, `columns_only`, `include_row_count`, `max_string_len`. Sensitive URL/header/cookie/path values redacted by default |

**Exploration**

| Tool | Purpose |
|---|---|
| `list_tables` | List tables/views in the loaded trace, optional GLOB filter |
| `list_table_structure` | Show column names and types for a table |
| `list_processes` | List processes (pid, name, start/end timestamps) |
| `list_threads_in_process` | List threads under a process name (up to 2000) |
| `slice_descendants_breakdown` | Summarize child slices under a long slice id without hand-writing recursive CTEs |
| `list_stdlib_modules` | List PerfettoSQL stdlib modules, optional `domain` / `query` / `limit` filters (no trace needed) |

**Chrome traces** — dedicated tools so the agent doesn't hand-roll SQL. Each flags row/string truncation in its metadata.

| Tool | Purpose |
|---|---|
| `chrome_scroll_jank_summary` | Worst janky frames with cause, sub-cause, delay_since_last_frame |
| `chrome_page_load_summary` | Page loads: URL, raw boundary timestamps, FCP, LCP, DCL, load timings (ms) |
| `chrome_page_load_resource_summary` | Compact URL-level resource/request summary for page-load windows, ranked by max overlap with normalized origin, navigation/renderer relatedness, and attribution-scope evidence |
| `chrome_page_load_resource_pipeline` | One URL's lifecycle/request spans joined with background parse, script evaluation, and style/layout signals, plus an evidence boundary for DNS/TLS/TTFB/cache/download hypotheses |
| `chrome_page_load_resource_hotspots` | URL-bearing resource/request slices on thread, process, and async tracks ranked by page-load/window overlap, with process/thread identity where available |
| `chrome_page_load_script_hotspots` | Renderer main-thread script execution grouped by URL/slice/process within a page-load/window, with style/layout descendant signals |
| `chrome_main_thread_hotspots` | Top main-thread tasks by duration with ts, upid/pid, cpu_pct, and optional page-load/time-window filters |
| `chrome_startup_summary` | Browser startup events and time-to-first-visible-content |
| `chrome_web_content_interactions` | Web content interactions (clicks, taps, INP) ranked by duration |

**Resources**

| Resource | Purpose |
|---|---|
| `resource://perfetto-mcp/stdlib-quickref` | On-demand PerfettoSQL stdlib quick reference for Chrome, Android, and generic traces |

## Analyzing a trace

The right path depends on the trace type:

- **Chrome traces** — `load_trace` → dedicated `chrome_*` tools → `execute_sql`
  for deeper cuts on the returned rows. For slow FCP/load, check
  `chrome_page_load_resource_summary` first, then `chrome_page_load_resource_pipeline`
  for one slow URL or `chrome_page_load_resource_hotspots` for slice drilldown,
  before interpreting main-thread `ResourceLoad*` slices as full request time.
  The summary's `resource_timing_evidence` says whether DNS/TLS/TTFB/download/cache
  phase hints exist; keep conclusions at URL lifecycle-span level when phase
  breakdown is absent. Use `chrome_page_load_script_hotspots` for post-resource JS
  and style/layout work, and `slice_descendants_breakdown` on a long task `id`
  for its child-slice breakdown.
- **Other traces (Android, generic)** — `load_trace` → `list_stdlib_modules`
  (or read `resource://perfetto-mcp/stdlib-quickref`) to check for a ready-made
  module first (Android, generic modules like `slices.with_context`), then run it
  via `execute_sql` + `INCLUDE PERFETTO MODULE`. No module fits? Fall back to
  `list_tables` / `list_table_structure` for schema discovery, then `execute_sql`.

### Analyzing multiple traces

Load comparison targets together with `load_trace(paths=[...])`. The response
returns one stable `trace_id` per file. Run the same trace-bound tool for each id
(concurrently when the MCP client supports parallel tool calls), then compare
the returned evidence. Calls without `trace_id` remain backward compatible and
use the most recently loaded trace. If a loaded file changes on disk, its old id
is rejected with an explicit instruction to reload it.

**Privacy** — tool results enter the LLM context, and real traces can hold URLs,
headers, cookies, and local paths. `execute_sql` and the dedicated Chrome tools
mask sensitive user and credential-like values by default while keeping the
diagnostic structure visible. For raw forensic work, start the server with
`PERFETTO_MCP_REDACT_STRINGS_DEFAULT=false`; `load_trace` reports the active
policy in its summary.

**Precision** — dedicated Chrome tools preserve full string cells by default. Use
`max_string_len` only when you explicitly want to trade detail for a smaller
response.

## Under the hood: dedicated tool vs. raw SQL

The scroll-jank question above resolves to a single `chrome_scroll_jank_summary`
call — no SQL to write. When you need a cut the dedicated tools don't expose, the
agent drops to `execute_sql` with PerfettoSQL; the same breakdown by hand:

```sql
INCLUDE PERFETTO MODULE chrome.scroll_jank.scroll_jank_v3;
SELECT cause_of_jank, COUNT(*) AS n
FROM chrome_janky_frames
GROUP BY cause_of_jank
ORDER BY n DESC;
```

## Configuration

Server settings are read at startup; when both a CLI flag and environment variable exist, the CLI flag wins.

| Setting (flag / env) | Default | Effect |
|---|---|---|
| `PERFETTO_TP_PATH` | — | Path to an existing `trace_processor_shell` binary; skips auto-download |
| `--startup-timeout-ms` / `PERFETTO_STARTUP_TIMEOUT_MS` | `20000` | Max time to wait for a spawned `trace_processor_shell` to become ready (ms) |
| `--query-timeout-ms` / `PERFETTO_QUERY_TIMEOUT_MS` | `30000` | HTTP timeout for `/status` and `/query` requests (ms) |
| `--max-instances` | `3` | Maximum idle `trace_processor_shell` processes retained in the LRU; active instances stay registered until their queries finish |
| `--max-active-instances` | `10` | Maximum active `trace_processor_shell` instances; requests for additional distinct traces wait for a semaphore permit |
| `--span-timings` / `PERFETTO_MCP_SPAN_TIMINGS` | off | Emit tracing span-close timings for performance hotspot diagnosis (`1` / `true` / `yes` / `on`) |
| `--artifacts-base-url` / `PERFETTO_ARTIFACTS_BASE_URL` | LUCI bucket | Override the `trace_processor_shell` download source on a cache miss (mirror/proxy; same pinned version) |
| `PERFETTO_MCP_REDACT_STRINGS_DEFAULT` | `true` | Mask sensitive URL/header/cookie/path strings in tool output; set `false` for raw forensic work |
| `PERFETTO_MCP_FULL_TRACE_FINGERPRINT` | off | Use full-file SHA-256 for trace cache identity instead of head/middle/tail sampling (`1` / `true` / `yes` / `on`) |
| `RUST_LOG` | — | `tracing-subscriber` filter, e.g. `RUST_LOG=debug` for verbose logs (written to stderr) |

## Install options

<details>
<summary>Package managers, Claude scope, direct binary, manual registration</summary>

**Install script (no Node.js)** — downloads the prebuilt binary and, if Claude
Code and/or Codex are present, registers the MCP server automatically:

```sh
# Linux / macOS / Windows (Git Bash, MSYS2, Cygwin)
curl -fsSL https://raw.githubusercontent.com/ilicmarko/perfetto-mcp/main/install.sh | sh
```
```powershell
# Windows (PowerShell)
irm https://raw.githubusercontent.com/ilicmarko/perfetto-mcp/main/install.ps1 | iex
```

**Global npm install** — puts `perfetto-mcp` on your `PATH` instead of going
through `npx` on every start:

```sh
npm install -g perfetto-mcp
claude mcp add perfetto --scope user -- perfetto-mcp
```

If Qoder is detected during a script install, the installer prints a paste-ready
JSON snippet (Qoder has no programmatic MCP-registration API yet — open Qoder
Settings → MCP → + Add and paste).

**Claude scope** — registration defaults to `--scope user` (available from any
directory). For a project-local install, set `SCOPE=local` (or `project`) and run
the script from that project's directory:

```sh
SCOPE=local bash -c 'curl -fsSL https://raw.githubusercontent.com/ilicmarko/perfetto-mcp/main/install.sh | sh'
```

PowerShell equivalent: `$env:SCOPE = 'local'; irm ... | iex`. Codex has no scope
concept and ignores this variable.

**Direct binary** — supported platforms: linux amd64/arm64, macOS amd64/arm64,
Windows amd64. Grab the binary from the
[releases page](https://github.com/ilicmarko/perfetto-mcp/releases). Release
assets are named `perfetto-mcp-rs-<platform>` (e.g. `perfetto-mcp-rs-linux-amd64`);
rename or address the downloaded file explicitly when invoking `install`, and on
Unix mark it executable first (`chmod +x`) — the subcommand refuses
non-executable paths to avoid writing a broken MCP entry. Example:

```sh
# Linux amd64 example — adjust the asset name for your platform.
curl -fsSL -o perfetto-mcp-rs \
  https://github.com/ilicmarko/perfetto-mcp/releases/latest/download/perfetto-mcp-rs-linux-amd64
chmod +x perfetto-mcp-rs
./perfetto-mcp-rs install --scope user --binary-path "$PWD/perfetto-mcp-rs"
```

**Manual MCP client configuration** — if the installer's auto-registration
doesn't apply to your client.

Codex:

```sh
codex mcp add perfetto-rs -- /absolute/path/to/perfetto-mcp-rs
```

JSON-based clients (e.g. Claude Code, Claude Desktop, Cursor):

```json
{
  "mcpServers": {
    "perfetto-rs": {
      "command": "/absolute/path/to/perfetto-mcp-rs"
    }
  }
}
```

</details>

## Upgrade & uninstall

<details>
<summary>Upgrade, pin a version, check for updates, uninstall</summary>

**npx / npm installs** — `npx -y perfetto-mcp@latest` resolves the newest
release each time the client starts the server, so there is nothing to upgrade.
For a global npm install, run `npm install -g perfetto-mcp@latest`. Pin a version
with `npx -y perfetto-mcp@0.18.0`. The `update` subcommand refuses to run under
npm, because it would install a second, script-managed copy.

**Script installs** — run the update subcommand:

```sh
perfetto-mcp-rs update
```

It pulls the latest release, safely overwrites the existing binary (with Windows
file-lock retry), and re-registers the MCP server with Claude Code / Codex
idempotently. No auto-update daemon — upgrades are explicit.

Pin to a specific version with the `--version` flag:

```sh
perfetto-mcp-rs update --version v0.7.0
```

For Claude local/project registrations, re-run from the original project
directory and pass the same scope:

```sh
perfetto-mcp-rs update --scope local
```

The raw installer one-liners still work if you prefer to drive upgrades
manually or need installer-specific environment overrides.

The `VERSION` env var also works, but **must come immediately before `sh`**
(POSIX `VAR=value cmd` only scopes to the next command — `VERSION=v0.7.0 curl
... | sh` puts `VERSION` on `curl`, not on the piped `sh`):

```sh
curl -fsSL https://raw.githubusercontent.com/ilicmarko/perfetto-mcp/main/install.sh | VERSION=v0.7.0 sh
```

PowerShell — set `$env:VERSION` in the same line, since `iex` runs in the current
session:

```powershell
$env:VERSION = 'v0.7.0'; irm https://raw.githubusercontent.com/ilicmarko/perfetto-mcp/main/install.ps1 | iex
```

**Check for updates:**

```sh
perfetto-mcp-rs check-update
```

Exits 0 if up to date (or ahead of releases — local dev build), 2 if a newer
release exists, 1 on network or parse error. Useful for shell-prompt integrations
and CI pre-checks. If it reports a newer release, run `perfetto-mcp-rs update`.

**Uninstall** — symmetric one-liner per platform. Deregisters from Claude Code and
Codex, removes the binary, and deletes the cached `trace_processor_shell`.
Idempotent — safe to run if any step was already done by hand.

```sh
# Linux / macOS / Windows (Git Bash, MSYS2, Cygwin)
curl -fsSL https://raw.githubusercontent.com/ilicmarko/perfetto-mcp/main/uninstall.sh | sh
```
```powershell
# Windows (PowerShell) — close Claude Code, Codex, or anything else using the .exe first
irm https://raw.githubusercontent.com/ilicmarko/perfetto-mcp/main/uninstall.ps1 | iex
```

**Scoped installs (local / project)** — `claude` stores local/project entries
keyed by project directory, so uninstall must use the same `SCOPE` AND run from
that directory. Omitting this leaves the scoped Claude entry behind while the
wrapper still removes the binary and cache:

```sh
# Ran `SCOPE=local bash install.sh` in ~/work/foo earlier? Then:
cd ~/work/foo
SCOPE=local bash -c 'curl -fsSL https://raw.githubusercontent.com/ilicmarko/perfetto-mcp/main/uninstall.sh | sh'
```

PowerShell equivalent: `cd <original-project-dir>; $env:SCOPE = 'local'; irm ... | iex`.

`$INSTALL_DIR` (default `~/.local/bin`) is **not** removed from your PATH:

- **Linux / macOS** — the installer only *prints* a `PATH` hint; if you added it
  to your shell rc, remove that line manually.
- **Windows** — the installer *writes* `$INSTALL_DIR` into your user PATH
  (HKCU\Environment); remove it via System Properties → Environment Variables if
  you want it gone.

Other tools may still depend on this directory, which is why uninstall leaves it
in place.

</details>

## Build from source

<details>
<summary>protoc, cargo build, tests</summary>

Requires a Rust toolchain and `protoc` (Protocol Buffers compiler):

```sh
# Ubuntu/Debian
sudo apt install -y protobuf-compiler
# macOS
brew install protobuf
# Windows
choco install protoc
```

Then:

```sh
git clone https://github.com/ilicmarko/perfetto-mcp
cd perfetto-mcp
cargo build --release
# Binary at target/release/perfetto-mcp-rs
```

Development:

```sh
cargo test          # unit tests
cargo clippy        # lint
cargo fmt           # format
```

</details>

## Releasing

<details>
<summary>How a merge to <code>main</code> becomes a release</summary>

`Cargo.toml` is the version source of truth. To ship a release:

1. In your PR, bump `version` in `Cargo.toml` (and run `cargo build` so
   `Cargo.lock` follows) and add a `### [X.Y.Z]` section to `CHANGELOG.md`.
2. Merge to `main`.

[`release.yml`](.github/workflows/release.yml) then notices that `vX.Y.Z` hasn't
been released yet and:

- re-runs the full CI suite (fmt, clippy, tests on Linux/macOS/Windows),
- builds static binaries for linux x64/arm64 (musl), macOS x64/arm64 and
  Windows x64,
- creates the `vX.Y.Z` tag and GitHub release, with the CHANGELOG section as
  notes plus a `SHA256SUMS` file,
- publishes the npm packages: `perfetto-mcp-<os>-<cpu>` (one per platform, each
  with its binary) and then `perfetto-mcp` (the launcher, which picks the right
  one through `optionalDependencies`), with npm provenance.

Pushes that don't change the version are no-ops. Each step skips work that's
already done, so re-running the workflow (or triggering it manually) after a
partial failure only finishes what's missing.

To check the npm packaging locally:

```sh
cargo build --release
mkdir -p /tmp/art && cp target/release/perfetto-mcp-rs /tmp/art/perfetto-mcp-rs-darwin-arm64
# build-packages.mjs requires every platform asset; placeholders are fine locally
for a in darwin-amd64 linux-arm64 linux-amd64 windows-amd64.exe; do echo x > /tmp/art/perfetto-mcp-rs-$a; done
node npm/scripts/build-packages.mjs --artifacts /tmp/art --out npm-dist
```

</details>

## License

Dual-licensed under either of [Apache License, Version 2.0](https://github.com/ilicmarko/perfetto-mcp/blob/main/LICENSE-APACHE) or
[MIT license](https://github.com/ilicmarko/perfetto-mcp/blob/main/LICENSE-MIT) at your option. Contributions are accepted under
the same terms.
