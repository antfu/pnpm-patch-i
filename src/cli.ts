import { startPatch } from '.'

const args = process.argv.slice(2)
const name = args[args.length === 1 ? 0 : 1]
const ignoreExisting = args[0] === '--ignore-existing'

if (!name) {
  console.error('$ pnpm-patch-i [--ignore-existing] <package-name>')
  process.exit(1)
}

startPatch(name, ignoreExisting)
