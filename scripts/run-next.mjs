import { spawn } from "node:child_process";
import path from "node:path";

const mode = process.argv[2];

if (mode !== "dev" && mode !== "start") {
  console.error("Usage: node scripts/run-next.mjs <dev|start>");
  process.exit(1);
}

const binExtension = process.platform === "win32" ? ".cmd" : "";
const binDir = path.join(process.cwd(), "node_modules", ".bin");
const host = process.env.HOST || "0.0.0.0";
const port = process.env.PORT || "3000";

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env: process.env,
      shell: process.platform === "win32"
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`${command} exited with signal ${signal}`));
        return;
      }

      resolve(code ?? 1);
    });
  });
}

const prismaBin = path.join(binDir, `prisma${binExtension}`);
const nextBin = path.join(binDir, `next${binExtension}`);
const nextArgs = [mode, "-H", host, "-p", String(port)];

try {
  if (mode === "dev") {
    const prismaExitCode = await run(prismaBin, ["generate"]);
    if (prismaExitCode !== 0) {
      process.exit(prismaExitCode);
    }
  }

  const nextExitCode = await run(nextBin, nextArgs);
  process.exit(nextExitCode);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
