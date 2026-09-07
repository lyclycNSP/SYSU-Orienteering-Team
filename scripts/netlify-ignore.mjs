import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// Netlify runs this before installing dependencies. Exit 0 skips; 1 builds.
export function shouldSkipBuild(env = process.env, cwd = process.cwd()) {
  const base = env.CACHED_COMMIT_REF;
  const head = env.COMMIT_REF;
  const isCommit = value => typeof value === 'string' && /^[a-f0-9]{40,64}$/i.test(value);
  if (!isCommit(base) || !isCommit(head)) return false;

  // Disable rename detection so both the old and new paths are checked.
  const result = spawnSync('git', ['diff', '--name-only', '--no-renames', '-z', base, head, '--'], {
    cwd, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) return false;
  const paths = result.stdout.split('\0').filter(Boolean);
  return paths.every(path => path.startsWith('content/') || path.startsWith('uploads/'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const skip = shouldSkipBuild();
  console.log(skip
    ? 'Skip Netlify: only CMS content/media changed (or no changes). GitHub Pages publishes content.'
    : 'Build Netlify: non-content changes or no reliable comparison available.');
  process.exitCode = skip ? 0 : 1;
}
