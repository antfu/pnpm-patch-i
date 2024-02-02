/* eslint-disable no-console */
import { join, relative, resolve } from 'pathe'
import { customAlphabet } from 'nanoid/non-secure'
import { execa } from 'execa'
import fs from 'fs-extra'
import mm from 'micromatch'
import prompts from 'prompts'

// @ts-expect-error missing types
import launch from 'launch-editor'
import c from 'picocolors'

const nanoid = customAlphabet('1234567890abcdef', 10)

export interface StartPatchOptions {
  name: string
  yes?: boolean
  sourceDir?: string
  build?: boolean
  pnpmOptions?: string[]
}

export async function startPatch(options: StartPatchOptions) {
  const {
    name,
    sourceDir,
    yes,
    build,
    pnpmOptions = [],
  } = options

  const editDir = `node_modules/.patch-edits/patch_edit_${name.replace(/\//g, '+')}_${nanoid()}`

  await execa('pnpm', ['patch', ...pnpmOptions, '--edit-dir', editDir, name], { stdio: 'inherit' })

  if (!sourceDir) {
    await launch(editDir)

    if (build)
      throw new Error('--build is not supported when sourceDir is not specified')

    console.log(`Edit your patch for ${c.bold(c.yellow(name))} under ${c.green(editDir)}\n`)

    const confirm = yes || await prompts([{
      name: 'confirm',
      type: 'confirm',
      message: 'Finish editing and commit the patch?',
      initial: true,
    }]).then(r => r.confirm)

    if (!confirm) {
      console.log(c.yellow('\nOperation cancelled'))
      return
    }
  }
  else {
    const sourcePath = resolve(sourceDir)
    const sourcePkg = await fs.readJSON(join(sourcePath, 'package.json'))

    const confirm = yes || await prompts([{
      name: 'confirm',
      type: 'confirm',
      message: `Applying patch from ${options.sourceDir}?`,
      initial: true,
    }]).then(r => r.confirm)

    if (!confirm) {
      console.log(c.yellow('\nOperation cancelled'))
      return
    }

    if (build)
      await execa('npm', ['run', 'build'], { stdio: 'inherit', cwd: sourcePath })

    const glob = sourcePkg.files
      ? sourcePkg.files.flatMap((i: string) => i.includes('*') ? [i] : [i, `${i}/**`])
      : undefined

    const filter = (src: string) => {
      const relativePath = relative(sourcePath, src)
      if (!relativePath)
        return true
      if (relativePath.includes('node_modules') || relativePath === 'package.json')
        return false
      if (glob)
        return mm.isMatch(relativePath, glob)
      return true
    }

    console.log(c.blue('\nApplying patch...'))
    await fs.copy(sourcePath, editDir, {
      overwrite: true,
      filter: (src) => {
        const result = filter(src)
        if (result)
          console.log(c.green(`  ${src}`))
        return result
      },
    })

    const localPkg = await fs.readJSON(join(editDir, 'package.json'))
    const newPkg = { ...sourcePkg }

    newPkg.version = localPkg.version
    if (newPkg.dependencies)
      newPkg.dependencies = handleDeps(localPkg.dependencies, sourcePkg.dependencies)
    if (newPkg.devDependencies)
      newPkg.devDependencies = handleDeps(localPkg.devDependencies, sourcePkg.devDependencies)
    if (newPkg.peerDependencies)
      newPkg.peerDependencies = handleDeps(localPkg.peerDependencies, sourcePkg.peerDependencies)
    if (newPkg.optionalDependencies)
      newPkg.optionalDependencies = handleDeps(localPkg.optionalDependencies, sourcePkg.optionalDependencies)

    function handleDeps(local?: Record<string, string>, overrides?: Record<string, string>) {
      if (!overrides)
        return undefined
      const clone = { ...local || {} }
      Object.entries(overrides).forEach(([key, value]) => {
        if (value.includes(':'))
          clone[key] = '*'
        else
          clone[key] = value
      })
      return clone
    }

    await fs.writeJSON(join(editDir, 'package.json'), newPkg, { spaces: 2 })
  }

  console.log(c.blue('\nCommiting patch...'))

  await execa('pnpm', ['patch-commit', editDir], { stdio: 'inherit' })
}
