import { cac } from 'cac'
import { startPatch } from '.'

const cli = cac('pnpm-patch-i')

cli
  .command('<package-name> [source-dir]', 'Patch a package')
  .option('-y, --yes', 'Skip confirmation')
  .option('-b, --build', 'Build the source package before patching, only available when dir is not specified')
  .action((name, sourceDir, options) => {
    return startPatch({
      name,
      yes: options.yes,
      sourceDir,
      build: options.build,
    })
  })

cli.help()
cli.parse()
