# seon

A reader for S-Expression-Object-Notation

See https://github.com/ayamada/seon2js


## Usage

```sh
npx seon2json [path/to/src.seon] [path/to/dst.json]
```

To read from seon file, and write to json file.

See `package.seon`.


## Syntax

Almost the same as [edn](https://github.com/edn-format/edn),
but different below.

- `,` is `unquote`, NOT spacer.
- `()` is js-array for list expr. It have `%L=1` extra property.
- `[]` is js-array for vector expr. It have `%V=1` extra property.
- `{}` is js-array for block expr. It have `%B=1` extra property.
- Symbol and keyword are represented by encoded string in internal.
  Type of symbols and keywords are js-string.
  A keyword `:foo` is not equal `":foo"`,
  and a symbol `bar` is not equal `"bar"` too, because these are encoded.
  But `seon2json` outputs these to `"foo"` and `"bar"`,
  because JSON is not support neither symbol nor keyword. Poorly.
  In addition, symbol and keyword has to suport namespace like clojure.
- `#_` is provided as skip-next-one-element like clojure.


## TODO

- Writer function will be provide in future, but not now.
- Scheme's SRFI-38 like syntax will provide in future, but not now.


## ChangeLog

- 5.0.0: 20240315
    - Migrate almost dispatch fns to seon2js (without `#_`)

- 4.2.1: 20240314
    - Fix mangle/string2mangledString to treat slash character

- 4.2.0: 20240207
    - `SYM` and `KW` can also use as normal function

- 4.1.0: 20240206
    - Add `SYM` and `KW` for js backtick shortcut notation

- 4.0.0: 20240205
    - Deprecate `renameNamespacesForStruct` and provide `rewriteAllSymbols`

- 3.0.3: 20240131
    - Refine error message by unmatched parenthesis

- 3.0.2: 20240131
    - Add `makeDenotation` and `isDenotation` to `seon/seon`

- 3.0.1: 20240130
    - Add `throwErrorIfInvalidSymbolName` to `seon/seon`

- 3.0.0: 20240130
    - BREAKING CHANGES:
        - Remove `renameInternalSeonNamespaces` and
          add `renameNamespacesForStruct` in `seon/util`
    - Add `seonCode2exprs` to `seon/util`

- 2.0.0: 20240128
    - BREAKING CHANGES: Renew almost codes
        - Remove src/seon/sym.mjs
        - Remove `sastring` supports
        - Treat `{}` to array marked as `block` for recreate js-block
        - Modify `mangle` process
            - Remove to conversion from `?` to `is` prefix
            - Through `?` and `.` to js-varname for shortcut
        - Support `#()` `#[]` `#{}` syntax
        - Add `#empty` for js skipped value like `[1,,3]`

- 1.0.1: 20240106
    - Correct to mangle from `->` to `2`

- 1.0.0: 20240103
    - Breaking changes: `npx seon2json` mangles symbols and keywords now
      (for example: `{:foo-bar? 1}` -> `{"isFooBar": 1}`)
      If you don't want this, you should use string literal
      (for example: `{"foo-bar?" 1}` -> `{"foo-bar?": 1}`)
    - Migrate `seon/mangle` module from seon2js
    - Hide error stacktrace of `npx seon2json`,
      and display error stacktrace by `--show-error-stacktrace` option
    - Display line number in message of object literal errors

- 0.4.3: 20231231
    - Change order of arguments of `sym.sk2stringUnchecked`

- 0.4.2: 20231231
    - `sym.sk2stringUnchecked` returns undefined by received non-sa

- 0.4.1: 20231231
    - Export `sk2stringUnchecked` by seon/sym

- 0.4.0: 20231231
    - Move out `kebab2camel` `symbol2mangledName` `keyword2mangledName`
      from seon/sym to seon2js

- 0.3.1: 20231230
    - `sym.kebab2camel` changes from `->` to `2`
    - `sym.kebab2camel` changes from start letter as number, to prepend `x`

- 0.3.0: 20231229
    - `sym.kebab2camel` changes from `foo!` to `foo`, not `doFoo` now

- 0.2.0: 20231226
    - Keep line number information by passing util.renameInternalSeonNamespaces

- 0.1.0: 20231223
    - Initial Release
