/* eslint-disable no-console */
import { tmpdir } from 'node:os'
import { dirname } from 'node:path'
import c from 'ansis'
import { execa } from 'execa'
import { findUp } from 'find-up'
import fs from 'fs-extra'
import launch from 'launch-editor'
import mm from 'micromatch'
import { customAlphabet } from 'nanoid/non-secure'
import { join, relative, resolve } from 'pathe'
import prompts from 'prompts'

const nanoid = customAlphabet('1234567890abcdef', 10)

export interface StartPatchOptions {
  name: string
  yes?: boolean
  sourceDir?: string
  build?: boolean
  pack?: boolean
  pnpmOptions?: string[]
}

export async function startPatch(options: StartPatchOptions) {
  const {
    name,
    sourceDir,
    yes,
    build,
    pack,
    pnpmOptions = [],
  } = options

  const lockfile = await findUp('pnpm-lock.yaml')
  if (!lockfile)
    throw new Error('Failed to locate pnpm-lock.yaml')
  const cwd = dirname(lockfile)

  const id = `${name.replace(/\//g, '+')}-${nanoid()}`
  const editDir = join(cwd, `node_modules/.patch-edits/patch_edit_${id}`)

  await execa('pnpm', ['patch', ...pnpmOptions, '--edit-dir', editDir, name], { stdio: 'inherit', cwd })

  if (!sourceDir) {
    await launch(editDir)

    if (build)
      throw new Error('--build is not supported when sourceDir is not specified')

    if (pack)
      throw new Error('--pack is not supported when sourceDir is not specified')

    console.log(`Edit your patch for ${c.bold.yellow(name)} under ${c.green(editDir)}\n`)

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
    let sourcePath = resolve(cwd, sourceDir)
    const sourcePkg = await fs.readJSON(join(sourcePath, 'package.json'))

    const confirm = yes || await prompts([{
      name: 'confirm',
      type: 'confirm',
      message: `Applying patch from ${sourcePath}?`,
      initial: true,
    }]).then(r => r.confirm)

    if (!confirm) {
      console.log(c.yellow('\nOperation cancelled'))
      return
    }

    if (build) {
      console.log(c.blue(`Building ${sourcePath}`))
      await execa('npm', ['run', 'build'], { stdio: 'inherit', cwd: sourcePath })
    }

    let glob = sourcePkg.files
      ? sourcePkg.files.flatMap((i: string) => i.includes('*') ? [i] : [i, `${i}/**`])
      : undefined

    if (pack) {
      const dir = tmpdir()
      const folderName = `pnpm-patch-i-${id}`
      const packPath = resolve(dir, `${folderName}.tgz`)
      console.log(c.blue(`Packing ${sourcePath} to ${packPath}`))
      await execa('pnpm', ['pack', '--pack-destination', packPath], { stdio: 'inherit', cwd: sourcePath })
      console.log(c.blue(`Unpacking ${packPath} to ${resolve(dir, folderName)}`))
      // TODO: support windows, contribution welcome
      await execa('tar', ['-xzf', packPath, '-C', resolve(dir, folderName)])
      sourcePath = resolve(dir, folderName)
      glob = undefined
    }

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

    if (sourcePkg.dependencies)
      localPkg.dependencies = handleDeps(localPkg.dependencies, sourcePkg.dependencies)
    if (sourcePkg.devDependencies)
      localPkg.devDependencies = handleDeps(localPkg.devDependencies, sourcePkg.devDependencies)
    if (sourcePkg.peerDependencies)
      localPkg.peerDependencies = handleDeps(localPkg.peerDependencies, sourcePkg.peerDependencies)
    if (sourcePkg.optionalDependencies)
      localPkg.optionalDependencies = handleDeps(localPkg.optionalDependencies, sourcePkg.optionalDependencies)

    function handleDeps(local: Record<string, string> = {}, overrides?: Record<string, string>) {
      if (!overrides)
        return undefined
      const extraKeys = Object.keys(local).filter(k => !Object.keys(overrides).includes(k))
      for (const key of extraKeys)
        delete local[key]
      for (const [key, value] of Object.entries(overrides))
        local[key] = value
      return local
    }

    await fs.writeJSON(join(editDir, 'package.json'), localPkg, { spaces: 2 })
  }

  console.log(c.blue('\nCommiting patch...'))

  await execa('pnpm', ['patch-commit', editDir], { stdio: 'inherit', cwd })
}
