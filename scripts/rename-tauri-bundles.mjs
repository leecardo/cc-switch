import { readdir, rename } from 'node:fs/promises';
import path from 'node:path';

const BUNDLE_DIR = path.resolve('src-tauri/target/release/bundle');
const ARTIFACT_EXTS = new Set([
  '.deb',
  '.rpm',
  '.AppImage',
  '.dmg',
  '.msi',
  '.exe',
  '.zip',
  '.tar.gz',
]);

function hasArtifactExt(name) {
  return [...ARTIFACT_EXTS].some((ext) => name.endsWith(ext));
}

function sanitize(name) {
  return name.replace(/\s+/g, '_');
}

async function main() {
  const renamed = [];
  const entries = await readdir(BUNDLE_DIR, { recursive: true, withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!hasArtifactExt(entry.name)) continue;

    const relDir = entry.parentPath
      ? path.relative(BUNDLE_DIR, entry.parentPath)
      : '';
    const oldPath = path.join(BUNDLE_DIR, relDir, entry.name);
    const newName = sanitize(entry.name);
    if (newName === entry.name) continue;

    const newPath = path.join(BUNDLE_DIR, relDir, newName);
    await rename(oldPath, newPath);
    renamed.push({ oldPath, newPath });
  }

  if (renamed.length === 0) {
    console.log('No bundle artifacts needed renaming.');
    return;
  }

  console.log('Renamed bundle artifacts:');
  for (const { oldPath, newPath } of renamed) {
    console.log(`- ${path.relative(process.cwd(), oldPath)} -> ${path.relative(process.cwd(), newPath)}`);
  }
}

main().catch((error) => {
  console.error('Failed to rename bundle artifacts:', error);
  process.exit(1);
});
