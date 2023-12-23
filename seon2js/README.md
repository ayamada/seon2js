# seon2js

A transpiler from seon to js

See https://github.com/ayamada/seon2js


## Usage

```sh
npx seon2js --srcDir path/to/src --srcDir more/src --srcDir another/src --dstDir path/to/html/mjs
```

To convert from all `*.s2mjs` and `*.s2js` files in srcDir, to dstDir.

And, if you want to supervise to change src files, add `--watch` option.


## ChangeLog

- 0.1.1: 20231223
    - Move chokidar from devDependencies to dependencies for cli

- 0.1.0: 20231223
    - Initial Release
