export type AutoUpdateInstallInput = {
  packageSpec: string;
  timeoutMs: number;
};

export type AutoUpdaterEnvironment = Record<string, string | undefined>;

export type AutoUpdaterInput = {
  args: string[];
  env: AutoUpdaterEnvironment;
  install: (input: AutoUpdateInstallInput) => Promise<void>;
  start: (args: string[]) => Promise<number>;
  warn: (message: string) => void;
};

const DEFAULT_PACKAGE_SPEC = "github:hua65540/A2AMCP";
const DEFAULT_TIMEOUT_MS = 120_000;

export async function runAutoUpdateThenStart(input: AutoUpdaterInput): Promise<number> {
  if (isAutoUpdateEnabled(input.env)) {
    try {
      await input.install({
        packageSpec: readPackageSpec(input.env),
        timeoutMs: readTimeoutMs(input.env)
      });
    } catch (error) {
      const message = `A2A MCP auto-update failed; continuing with installed version. ${formatError(error)}`;
      if (isStrictMode(input.env)) throw new Error(message);
      input.warn(message);
    }
  }

  return input.start(input.args);
}

function isAutoUpdateEnabled(env: AutoUpdaterEnvironment): boolean {
  const raw = env.A2A_MCP_AUTO_UPDATE?.trim().toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "off" && raw !== "no";
}

function isStrictMode(env: AutoUpdaterEnvironment): boolean {
  const raw = env.A2A_MCP_AUTO_UPDATE_STRICT?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "on" || raw === "yes";
}

function readPackageSpec(env: AutoUpdaterEnvironment): string {
  const raw = env.A2A_MCP_AUTO_UPDATE_SPEC?.trim();
  return raw || DEFAULT_PACKAGE_SPEC;
}

function readTimeoutMs(env: AutoUpdaterEnvironment): number {
  const raw = env.A2A_MCP_AUTO_UPDATE_TIMEOUT_MS?.trim();
  if (!raw) return DEFAULT_TIMEOUT_MS;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) return DEFAULT_TIMEOUT_MS;
  return value;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
