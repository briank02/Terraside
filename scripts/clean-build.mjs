import { rm } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const outputDirectories = ['dist', 'dist-electron', 'release', '.test-dist']

for (const directory of outputDirectories) {
  const target = resolve(projectRoot, directory)
  const relativeTarget = relative(projectRoot, target)

  if (!relativeTarget || isAbsolute(relativeTarget) || relativeTarget.startsWith(`..${sep}`)) {
    throw new Error(`Refusing to remove unsafe build target: ${target}`)
  }

  await rm(target, { recursive: true, force: true })
  console.log(`Removed ${relativeTarget}`)
}
