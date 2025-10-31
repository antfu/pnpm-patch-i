import { cac } from 'cac'
import { startPatch } from '.'

const cli = cac('pnpm-patch-i')

cli
  .command('<package-name> [source-dir]', 'Patch a package')
  .option('-y, --yes', 'Skip confirmation')
  .option('-b, --build', 'Build the source package before patching, only available when dir is not specified')
  .option('-p, --pack', 'Pack the source package into a tgz file and patch the package from the tgz file, only available when dir is not specified')
  .action((name, sourceDir, options) => {
    return startPatch({
      name,
      yes: options.yes,
      sourceDir,
      build: options.build,
      pack: options.pack,
    })
  })

cli.help()
cli.parse()
