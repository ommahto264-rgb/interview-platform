// This file runs ONLY in the disposable container. It is not a host sandbox.
const fs = require('node:fs');
const write = fs.writeSync.bind(fs);
const stringify = JSON.stringify;

(async () => {
  try {
    const request = JSON.parse(fs.readFileSync(0, 'utf8'));
    if (typeof request.source !== 'string' || !Array.isArray(request.input)) process.exit(1);
    // Keep normal console output separate from the single JSON return value.
    console.log = console.info = console.debug = (...args) => console.error(...args);
    const solve = new Function('require', `${request.source}\n;return typeof solve === 'function' ? solve : null;`)(require);
    if (typeof solve !== 'function') process.exit(1);
    const value = await solve(...request.input);
    const output = stringify({ value }, (_key, item) => {
      if (item === undefined || typeof item === 'bigint' || typeof item === 'function' ||
          typeof item === 'symbol' || (typeof item === 'number' && !Number.isFinite(item))) {
        throw new Error('Return a JSON-compatible value.');
      }
      return item;
    });
    write(1, output);
    process.exit(0);
  } catch {
    // No stack traces or source echoed to the host.
    process.exit(1);
  }
})();
