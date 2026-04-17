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
import { parse as parseYaml } from 'yaml'

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

  const id = `${name.replace(/\W+/g, '_')}_${nanoid()}`
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
    const originalSourcePath = resolve(cwd, sourceDir)
    let sourcePath = originalSourcePath
    let sourcePkg = await fs.readJSON(join(sourcePath, 'package.json'))

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
      const unpackDir = resolve(dir, `pnpm-patch-i-unpacked_${id}`)
      const tgzPath = resolve(dir, `pnpm-patch-i-packed_${id}.tgz`)
      console.log(c.blue(`Packing ${sourcePath} to ${tgzPath}`))
      await execa('pnpm', ['pack', '--out', tgzPath], { stdio: 'inherit', cwd: sourcePath })
      console.log(c.blue(`Unpacking ${tgzPath} to ${unpackDir}`))
      await fs.mkdir(unpackDir, { recursive: true })
      // TODO: support windows, contribution welcome
      await execa('tar', ['-xzf', tgzPath, '-C', unpackDir])
      sourcePath = join(unpackDir, 'package')
      sourcePkg = await fs.readJSON(join(sourcePath, 'package.json'))
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

    const catalogs = pack ? undefined : await readSourceCatalogs(originalSourcePath)

    if (sourcePkg.dependencies)
      localPkg.dependencies = handleDeps(localPkg.dependencies, sourcePkg.dependencies, catalogs)
    if (sourcePkg.devDependencies)
      localPkg.devDependencies = handleDeps(localPkg.devDependencies, sourcePkg.devDependencies, catalogs)
    if (sourcePkg.peerDependencies)
      localPkg.peerDependencies = handleDeps(localPkg.peerDependencies, sourcePkg.peerDependencies, catalogs)
    if (sourcePkg.optionalDependencies)
      localPkg.optionalDependencies = handleDeps(localPkg.optionalDependencies, sourcePkg.optionalDependencies, catalogs)

    function handleDeps(
      local: Record<string, string> = {},
      overrides: Record<string, string> | undefined,
      catalogs: Catalogs | undefined,
    ) {
      if (!overrides)
        return undefined
      const extraKeys = Object.keys(local).filter(k => !Object.keys(overrides).includes(k))
      for (const key of extraKeys)
        delete local[key]
      for (const [key, value] of Object.entries(overrides))
        local[key] = resolveDepValue(key, value, local[key], catalogs)
      return local
    }

    await fs.writeJSON(join(editDir, 'package.json'), localPkg, { spaces: 2 })
  }

  console.log(c.blue('\nCommiting patch...'))

  await execa('pnpm', ['patch-commit', editDir], { stdio: 'inherit', cwd })
}

interface Catalogs {
  default: Record<string, string>
  named: Record<string, Record<string, string>>
}

async function readSourceCatalogs(sourcePath: string): Promise<Catalogs | undefined> {
  const workspaceFile = await findUp('pnpm-workspace.yaml', { cwd: sourcePath })
  if (!workspaceFile)
    return undefined
  try {
    const raw = await fs.readFile(workspaceFile, 'utf8')
    const data = parseYaml(raw) ?? {}
    return {
      default: data.catalog ?? {},
      named: data.catalogs ?? {},
    }
  }
  catch (err) {
    console.warn(c.yellow(`Failed to read catalogs from ${workspaceFile}: ${(err as Error).message}`))
    return undefined
  }
}

function resolveDepValue(
  name: string,
  value: string,
  localValue: string | undefined,
  catalogs: Catalogs | undefined,
): string {
  if (value.startsWith('workspace:')) {
    if (localValue) {
      console.log(c.dim(`  resolved ${name}: ${value} → ${localValue}`))
      return localValue
    }
    const suffix = value.slice('workspace:'.length)
    if (suffix && !'*^~'.includes(suffix)) {
      console.log(c.dim(`  resolved ${name}: ${value} → ${suffix}`))
      return suffix
    }
    console.warn(c.yellow(`  could not resolve ${name}: ${value} (no local version), keeping literal`))
    return value
  }
  if (value.startsWith('catalog:')) {
    const catalogName = value.slice('catalog:'.length)
    const table = catalogName ? catalogs?.named[catalogName] : catalogs?.default
    const resolved = table?.[name]
    if (resolved) {
      console.log(c.dim(`  resolved ${name}: ${value} → ${resolved}`))
      return resolved
    }
    console.warn(c.yellow(`  could not resolve ${name}: ${value} (no matching catalog entry), keeping literal`))
    return value
  }
  const protocolMatch = value.match(/^([a-z][a-z+-]*):/i)
  if (protocolMatch) {
    console.warn(c.yellow(`  ${name}: ${value} uses unrecognized protocol "${protocolMatch[1]}:", keeping literal — the consumer may not be able to resolve it`))
  }
  return value
}
