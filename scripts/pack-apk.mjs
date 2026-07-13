// Copy the signed APK out of Gradle's output tree under the same v-prefixed name
// the Windows zip uses, so both assets on a release read alike.
// Runs after `gradlew assembleRelease`.
import { readFileSync, existsSync, copyFileSync, mkdirSync } from 'node:fs'

const { version } = JSON.parse(readFileSync('package.json', 'utf8'))
const built = 'android/app/build/outputs/apk/release/app-release.apk'
const out = `release/Chronoscope-v${version}.apk`

if (!existsSync(built)) {
  console.error(`Missing ${built}. Run "gradlew assembleRelease" first.`)
  process.exit(1)
}

mkdirSync('release', { recursive: true })
copyFileSync(built, out)
console.log(`\nWrote ${out}`)
