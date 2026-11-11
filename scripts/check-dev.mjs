import 'dotenv/config';
import { spawnSync } from 'node:child_process';

function dockerCheck(args) {
  return spawnSync('docker', args, {
    encoding: 'utf8',
    timeout: 20_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

const docker = dockerCheck(['info', '--format', '{{.ServerVersion}}']);

if (docker.error || docker.status !== 0) {
  console.error(
    'Docker is unavailable. Start Docker Desktop and enable WSL integration, then retry.',
  );
  process.exit(1);
}

const imageName = process.env.RUNNER_IMAGE || 'interview-runner:v1';

const image = dockerCheck(['image', 'inspect', imageName]);

if (image.error || image.status !== 0) {
  console.error(`Runner image "${imageName}" is unavailable.`);
  console.error('Run: npm run runner:build');
  process.exit(1);
}

console.log(`Docker ${docker.stdout.trim()} is ready.`);
console.log(`Runner image "${imageName}" is available.`);