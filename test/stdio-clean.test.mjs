import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

test('stdio server startup keeps stdout clean', async () => {
  const child = spawn(process.execPath, ['src/index.js'], {
    cwd: process.cwd(),
    env: { ...process.env },
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });

  let stdout = '';
  let stderr = '';
  const secretFragments = [process.env.DAMENG_PASSWORD].filter(Boolean);

  function redact(text) {
    return secretFragments.reduce(
      (current, fragment) => current.split(fragment).join('<redacted>'),
      text,
    );
  }

  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');

  child.stdout.on('data', (chunk) => {
    stdout += chunk;
  });

  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });

  await new Promise((resolve) => setTimeout(resolve, 1500));

  const stillRunning = child.exitCode === null;
  if (stillRunning) {
    child.kill();
  }

  await new Promise((resolve) => {
    if (child.exitCode !== null) {
      resolve();
      return;
    }
    child.once('exit', () => resolve());
    setTimeout(resolve, 1000);
  });

  assert.equal(stdout.trim(), '', `Expected clean stdout, got: ${redact(stdout)}`);
  assert.equal(
    stillRunning,
    true,
    `Expected process to still be running. stderr: ${redact(stderr)}`,
  );
});
