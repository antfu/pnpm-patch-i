# pnpm-patch-i

[![NPM version](https://img.shields.io/npm/v/pnpm-patch-i?color=a1b858&label=)](https://www.npmjs.com/package/pnpm-patch-i)

A better and interactive `pnpm patch`.

## Usage

```bash
npx pnpm-patch-i [--ignore-existing] package-name
```

This CLI wraps with [`pnpm patch`](https://pnpm.io/cli/patch) and provide a better interactive experience:

- Have the patch dir under your local `node_modules/` folder instead of a global temp folder
- More human-friendly folder name instead of random string
- Open the editing folder in your editor via [`launch-editor`](https://github.com/yyx990803/launch-editor)
- Wait for your changes and automatically run `pnpm commit-patch <dir>` for you
- Support the `--ignore-existing` option to ignore existing patch (requires at least `pnpm@7.25.0`)

## Sponsors

<p align="center">
  <a href="https://cdn.jsdelivr.net/gh/antfu/static/sponsors.svg">
    <img src='https://cdn.jsdelivr.net/gh/antfu/static/sponsors.svg'/>
  </a>
</p>

## License

[MIT](./LICENSE) License © 2023 [Anthony Fu](https://github.com/antfu)
