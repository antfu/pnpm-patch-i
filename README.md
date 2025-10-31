# pnpm-patch-i

[![NPM version](https://img.shields.io/npm/v/pnpm-patch-i?color=a1b858&label=)](https://www.npmjs.com/package/pnpm-patch-i)

A better and interactive `pnpm patch`.

## Usage

```bash
npx pnpm-patch-i package-name
```

This CLI wraps with [`pnpm patch`](https://pnpm.io/cli/patch) and provides a better interactive experience:

- Have the patch dir under your local `node_modules/` folder instead of a global temp folder
- More human-friendly folder name instead of random string
- Open the editing folder in your editor via [`launch-editor`](https://github.com/yyx990803/launch-editor)
- Wait for your changes and automatically run `pnpm commit-patch <dir>` for you
- Always runs at where `pnpm-lock.yaml` is located

### Apply Patch from a directory

It's also possible to apply a patch directly from a directory, for example:

```bash
npx pnpm-patch-i vite ../vite/packages/vite
```

You can also use `--build` (`-b`) flag to invoke `npm run build` in the source directory before applying the patch.

> [!NOTE]
> If the source package is in a monorepo with custom linking, or using catalogs, directly applying the patch from a directory might resulting copying the linking where the current project might not be able to resolve.
> In that case, it's recommended to pack the source package into a tgz file and apply the patch from the tgz file with `--pack` (`-p`) flag.

## Sponsors

<p align="center">
  <a href="https://cdn.jsdelivr.net/gh/antfu/static/sponsors.svg">
    <img src='https://cdn.jsdelivr.net/gh/antfu/static/sponsors.svg'/>
  </a>
</p>

## License

[MIT](./LICENSE) License © 2023 [Anthony Fu](https://github.com/antfu)
