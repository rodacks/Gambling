import { spawn } from "node:child_process";
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--hostname",
    "0.0.0.0",
    ...process.argv.slice(2),
  ],
  { stdio: "inherit", env: { ...process.env, NEXT_PUBLIC_DEMO_MODE: "true" } },
);
child.on("exit", (code) => process.exit(code ?? 0));
