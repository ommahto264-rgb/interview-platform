const fs = require("node:fs");

function solve(a, b) {
  return a + b;
}

try {
  const text = fs.readFileSync(0, "utf8");
  const input = JSON.parse(text);

  if (
    !Array.isArray(input) ||
    input.length !== 2 ||
    !input.every(Number.isFinite)
  ) {
    throw new Error("Input must be an array containing two finite numbers.");
  }

  const result = solve(...input);

  if (!Number.isFinite(result)) {
    throw new Error("Result is outside the supported numeric range.");
  }

  console.log(JSON.stringify({ result }));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}