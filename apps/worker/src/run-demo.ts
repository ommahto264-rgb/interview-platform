import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";

const execFileAsync = promisify(execFile);

async function main() {
  const name = `interview-demo-${randomUUID()}`;
  const slowTest = process.argv.includes("--slow");

  const createArgs = [
    "create",
    "--name", name,
    "-i",
    "--pull", "never",
    "--network", "none",
    "--memory", "128m",
    "--memory-swap", "128m",
    "--cpus", "0.5",
    "--pids-limit", "64",
    "--read-only",
    "--cap-drop", "ALL",
    "--security-opt", "no-new-privileges",
    "interview-runner:dev",
  ];

  if (slowTest) {
    createArgs.push(
      "node",
      "-e",
      "setInterval(() => {}, 1000)",
    );
  }

  // Create the container without executing its program yet.
  await execFileAsync("docker", createArgs, {
    maxBuffer: 64 * 1024,
  });

  try {
    const execution = execFileAsync(
      "docker",
      ["start", "-a", "-i", name],
      {
        timeout: 5000,
        killSignal: "SIGKILL",
        maxBuffer: 64 * 1024,
      },
    );

    const inputStream = execution.child.stdin;

    // The container may close stdin early; handle that stream error.
    inputStream?.on("error", (error) => {
      if ((error as NodeJS.ErrnoException).code !== "EPIPE") {
        console.error("Input error:", error.message);
      }
    });

    inputStream?.end(JSON.stringify([2, 3]));

    const { stdout, stderr } = await execution;

    if (stderr) {
      process.stderr.write(stderr);
    }

    process.stdout.write(stdout);
    console.log("Execution succeeded.");
  } finally {
    // Killing the Docker CLI alone does not guarantee the container stops.
    await execFileAsync("docker", ["rm", "-f", name], {
      timeout: 5000,
      maxBuffer: 64 * 1024,
    });

    console.log("Container removed.");
  }
}

main().catch((error) => {
  if (error.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") {
    console.error("Execution output exceeded the allowed size.");
  } else if (error.killed) {
    console.error("A Docker command exceeded its time limit.");
  } else {
    console.error("Runner failed:", error.message);
  }

  process.exitCode = 1;
});