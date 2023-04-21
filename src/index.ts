/* eslint-disable no-console */
import { customAlphabet } from 'nanoid/non-secure'
import { execa } from 'execa'
import prompts from 'prompts'

// @ts-expect-error missing types
import launch from 'launch-editor'
import c from 'picocolors'

const nanoid = customAlphabet('1234567890abcdef', 10)

export async function startPatch(name: string, options: string[]) {
  const dir = `node_modules/.patch-edits/patch_edit_${name.replace(/\//g, '+')}_${nanoid()}`

  await execa('pnpm', ['patch', ...options, '--edit-dir', dir, name], { stdio: 'inherit' })
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

  console.log(c.blue('\nCommiting patch...'))

  await execa('pnpm', ['patch-commit', dir], { stdio: 'inherit' })
}
