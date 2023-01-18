import { startPatch } from '.'

const options = process.argv.slice(2)
const name = options.pop()

if (!name) {
  console.error('$ pnpm-patch-i <package-name>')
  process.exit(1)
}

startPatch(name, options)
