import process from 'node:process'
import { startPatch } from '.'

const [name, ...rest] = process.argv.slice(2)
const options = rest.filter(i => i.startsWith('-'))
const [dir] = rest.filter(i => !i.startsWith('-'))

if (!name) {
  console.error('$ pnpm-patch-i <package-name> [dir]')
  process.exit(1)
}

startPatch(name, options, dir)
