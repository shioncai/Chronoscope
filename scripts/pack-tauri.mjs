// Wrap the Tauri exe in a `Chronoscope/` folder and zip it, so unzipping gives the
// same thing the Electron build does: a folder you run the exe inside, with a
// `data\` that appears beside it on first run.
//
// Tauri compiles the whole frontend into the binary, so the folder holds exactly
// one file — where the Electron build's holds 8074.
import { readFileSync, existsSync, rmSync, mkdirSync, copyFileSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const { version } = JSON.parse(readFileSync('package.json', 'utf8'))
const built = 'src-tauri/target/x86_64-pc-windows-msvc/release/chronoscope.exe'
const releaseDir = 'release'
const folder = `${releaseDir}/Chronoscope`
const zipName = `Chronoscope-v${version}-win.zip`
const zipPath = `${releaseDir}/${zipName}`

if (!existsSync(built)) {
  console.error(`Missing ${built}. Run the cargo build first (npm run tauri:build).`)
  process.exit(1)
}

if (existsSync(folder)) rmSync(folder, { recursive: true, force: true })
mkdirSync(folder, { recursive: true })
copyFileSync(built, `${folder}/Chronoscope.exe`)

if (existsSync(zipPath)) rmSync(zipPath)

try {
  execFileSync('7z', ['a', '-tzip', '-mx=9', zipName, 'Chronoscope'], {
    cwd: releaseDir,
    stdio: 'inherit',
  })
} catch {
  console.error('\nFailed to run 7z. Install it with:  sudo apt install -y p7zip-full')
  process.exit(1)
}

rmSync(folder, { recursive: true, force: true })
const mb = (statSync(zipPath).size / 1048576).toFixed(1)
console.log(`\nWrote ${zipPath} (${mb} MB, extracts to a self-contained Chronoscope/ folder)`)
