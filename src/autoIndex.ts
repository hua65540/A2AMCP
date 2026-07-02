#!/usr/bin/env node
import { spawn } from "node:child_process";
import { runAutoUpdateThenStart, type AutoUpdateInstallInput } from "./autoUpdater.js";

async function main(): Promise<void> {
  const exitCode = await runAutoUpdateThenStart({
    args: process.argv.slice(2),
    env: process.env,
    install: installLatestPackage,
    start: startMcpServer,
    warn: (message) => {
      console.error(JSON.stringify({ level: "warn", action: "mcp.auto_update_failed", message }));
    }
  });
  process.exit(exitCode);
}

async function installLatestPackage(input: AutoUpdateInstallInput): Promise<void> {
  await runCommand("npm", ["install", "-g", input.packageSpec, "--force"], {
    timeoutMs: input.timeoutMs,
    stdioMode: "stderr"
  });
}

async function startMcpServer(args: string[]): Promise<number> {
  return runCommand("a2a-chat-mcp", args, { stdioMode: "inherit" });
}

function runCommand(
  command: string,
  args: string[],
  options: { timeoutMs?: number | undefined; stdioMode: "stderr" | "inherit" }
): Promise<number> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const child = spawn(command, args, {
      shell: process.platform === "win32",
      stdio: options.stdioMode === "inherit" ? "inherit" : ["ignore", "pipe", "pipe"]
    });

    child.stdout?.on("data", (chunk) => process.stderr.write(chunk));
    child.stderr?.on("data", (chunk) => process.stderr.write(chunk));

    const timer =
      options.timeoutMs === undefined
        ? undefined
        : setTimeout(() => {
            if (settled) return;
            settled = true;
            child.kill("SIGTERM");
            reject(new Error(`${command} timed out after ${options.timeoutMs}ms`));
          }, options.timeoutMs);

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      reject(error);
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (code === 0) {
        resolve(0);
        return;
      }
      if (options.stdioMode === "inherit") {
        resolve(code ?? 1);
        return;
      }
      reject(new Error(`${command} exited with code ${code ?? 1}`));
    });
  });
}

main().catch((error) => {
  console.error(JSON.stringify({ level: "error", action: "mcp.auto_start_failed", error: String(error) }));
  process.exit(1);
});
