/* eslint-disable no-console */
import { join, relative } from 'pathe'
import { customAlphabet } from 'nanoid/non-secure'
import { execa } from 'execa'
import fs from 'fs-extra'
import mm from 'micromatch'
import prompts from 'prompts'

// @ts-expect-error missing types
import launch from 'launch-editor'
import c from 'picocolors'

const nanoid = customAlphabet('1234567890abcdef', 10)

export async function startPatch(name: string, options: string[], distDir?: string) {
  const dir = `node_modules/.patch-edits/patch_edit_${name.replace(/\//g, '+')}_${nanoid()}`

  await execa('pnpm', ['patch', ...options, '--edit-dir', dir, name], { stdio: 'inherit' })

  if (!distDir) {
    await launch(dir)

    console.log(`Edit your patch for ${c.bold(c.yellow(name))} under ${c.green(dir)}\n`)

    const { confirm } = await prompts([{
      name: 'confirm',
      type: 'confirm',
      message: 'Finish editing and commit the patch?',
      initial: true,
    }])

    if (!confirm) {
      console.log(c.yellow('\nOperation cancelled'))
      return
    }
  }
  else {
    const packageJSON = await fs.readJSON(join(distDir, 'package.json'))

    const { confirm } = await prompts([{
      name: 'confirm',
      type: 'confirm',
      message: `Applying patch from ${distDir}?`,
      initial: true,
    }])

    if (!confirm) {
      console.log(c.yellow('\nOperation cancelled'))
      return
    }

    const glob = packageJSON.files
      ? packageJSON.files.flatMap((i: string) => i.includes('*') ? [i] : [i, `${i}/**`])
      : undefined

    const filter = (src: string) => {
      const relativePath = relative(distDir, src)
      if (!relativePath)
        return true
      if (relativePath.includes('node_modules') || relativePath === 'package.json')
        return false
      if (glob)
        return mm.isMatch(relativePath, glob)
      return true
    }

    console.log(c.blue('\nApplying patch...'))
    await fs.copy(distDir, dir, {
      overwrite: true,
      filter: (src) => {
        const result = filter(src)
        if (result)
          console.log(c.green(`  ${src}`))
        return result
      },
    })
  }

  console.log(c.blue('\nCommiting patch...'))

  await execa('pnpm', ['patch-commit', dir], { stdio: 'inherit' })
}
