import { describe, expect, it, vi } from "vitest";
import { runAutoUpdateThenStart } from "../src/autoUpdater.js";

describe("auto updater", () => {
  it("updates from the default GitHub package before starting the MCP server", async () => {
    const install = vi.fn(async () => undefined);
    const start = vi.fn(async () => 0);

    const exitCode = await runAutoUpdateThenStart({
      args: ["--stdio-debug"],
      env: {},
      install,
      start,
      warn: vi.fn()
    });

    expect(exitCode).toBe(0);
    expect(install).toHaveBeenCalledWith({
      packageSpec: "github:hua65540/A2AMCP",
      timeoutMs: 120_000
    });
    expect(start).toHaveBeenCalledWith(["--stdio-debug"]);
  });

  it("continues with the current MCP server when auto-update fails by default", async () => {
    const install = vi.fn(async () => {
      throw new Error("network unavailable");
    });
    const start = vi.fn(async () => 0);
    const warn = vi.fn();

    const exitCode = await runAutoUpdateThenStart({
      args: [],
      env: {},
      install,
      start,
      warn
    });

    expect(exitCode).toBe(0);
    expect(start).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("network unavailable"));
  });

  it("skips auto-update when disabled through the environment", async () => {
    const install = vi.fn(async () => undefined);
    const start = vi.fn(async () => 0);

    await runAutoUpdateThenStart({
      args: [],
      env: { A2A_MCP_AUTO_UPDATE: "0" },
      install,
      start,
      warn: vi.fn()
    });

    expect(install).not.toHaveBeenCalled();
    expect(start).toHaveBeenCalledTimes(1);
  });

  it("allows overriding update source and timeout through the environment", async () => {
    const install = vi.fn(async () => undefined);
    const start = vi.fn(async () => 0);

    await runAutoUpdateThenStart({
      args: [],
      env: {
        A2A_MCP_AUTO_UPDATE_SPEC: "github:example/A2AMCP#main",
        A2A_MCP_AUTO_UPDATE_TIMEOUT_MS: "30000"
      },
      install,
      start,
      warn: vi.fn()
    });

    expect(install).toHaveBeenCalledWith({
      packageSpec: "github:example/A2AMCP#main",
      timeoutMs: 30_000
    });
  });
});
