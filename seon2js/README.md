# seon2js

A transpiler from seon to js

See https://github.com/ayamada/seon2js


## Usage

```sh
npx seon2js --srcDir path/to/src --srcDir more/src --srcDir another/src --dstDir path/to/html/mjs
```

To convert from all `*.s2mjs` and `*.s2js` files in srcDir, to dstDir.

And, if you want to supervise to change src files, add `--watch` option.


## ChangeLog (ALPHA)

正式リリース時に消してまとめます

- 1.0.8-ALPHA: 20231231
    - Expand 'if' more smart
    - Expand 'when' more smart
    - Kill 'cond' temporarily

- 1.0.7-ALPHA: 20231231
    - Mangle from `foo/bar?` to `foo.isBar`, not `isFoo.bar`

- 1.0.6-ALPHA: 20231231
    - Bump up version of seon to 0.4.3
    - Migrate `mangle.mjs` from seon

- 1.0.5-ALPHA: 20231230
    - Add special-form `if-not`

- 1.0.4-ALPHA: 20231230
    - Bump up version of seon to 0.3.1

- 1.0.3-ALPHA: 20231229
    - Rename `throw!` of fn to `throw-fn!`

- 1.0.2-ALPHA: 20231229
    - Bump up version of seon to 0.3.0

- 1.0.1-ALPHA: 20231229
    - Migrate seon-util/postwalk to seon-util/postwalkWithMeta

- 1.0.0-ALPHA: 20231229
    - Change naming rule of some special forms
        - `constfn` -> `const-fn`
        - `constfn-async` -> `const-async-fn`
        - `export-constfn` -> `export-const-fn`
        - `export-constfn-async` -> `export-const-async-fn`
        - These get closer to js literal
            - `(export-const-async-fn foo [] ...)` likes `export const foo = async () => ...;`
    - Remove many fns in s2.s2mjs for future implementations
    - Failed to transpile `example/game01/` now, but will repair in future

## ChangeLog

- 0.1.2: 20231226
    - Bump up version of seon
    - Fix redundant error log
    - Fix test by `npm run test-s2js-once`

- 0.1.1: 20231223
    - Move chokidar from devDependencies to dependencies for cli

- 0.1.0: 20231223
    - Initial Release
