// Post-build: wrap the unpacked Windows app in a top-level `Chronoscope/`
// folder and zip it, so extracting yields a clean, self-contained
// `Chronoscope\` folder (exe + resources + a data\ that appears on first run).
// Runs after `electron-builder --win` (dir target -> release/win-unpacked/).
import { readFileSync, existsSync, rmSync, renameSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const { version } = JSON.parse(readFileSync('package.json', 'utf8'))
const releaseDir = 'release'
const unpacked = `${releaseDir}/win-unpacked`
const folder = `${releaseDir}/Chronoscope`
const zipName = `Chronoscope-${version}-win.zip`

if (!existsSync(unpacked)) {
  console.error(`Missing ${unpacked}. Run "electron-builder --win" first.`)
  process.exit(1)
}

// Stage the app under a folder named exactly "Chronoscope".
if (existsSync(folder)) rmSync(folder, { recursive: true, force: true })
renameSync(unpacked, folder)

// Remove any stale archive.
const zipPath = `${releaseDir}/${zipName}`
if (existsSync(zipPath)) rmSync(zipPath)

// Zip so the archive contains a single top-level Chronoscope/ directory.
try {
  execFileSync('7z', ['a', '-tzip', '-mx=5', zipName, 'Chronoscope'], {
    cwd: releaseDir,
    stdio: 'inherit',
  })
} catch {
  console.error('\nFailed to run 7z. Install it with:  sudo apt install -y p7zip-full')
  process.exit(1)
}

console.log(`\nWrote ${zipPath} (extracts to a self-contained Chronoscope/ folder)`)
