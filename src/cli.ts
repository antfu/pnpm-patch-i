import { startPatch } from '.'

if (!process.argv[2]) {
  console.error('$ pnpm-patch-i <package-name>')
  process.exit(1)
}

startPatch(process.argv[2])
