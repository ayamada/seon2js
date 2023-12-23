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
- `()` is js-array.
- `[]` is js-array but that has `%V` property.
- `{}` is js-object.
- Symbol and keyword are represented by encoded string in internal.
  Type of symbols and keywords are js-string.
  A keyword `:foo` is not equal `":foo"`,
  and a symbol `bar` is not equal `"bar"` too, because these are encoded.
  But `seon2json` outputs these to `"foo"` and `"bar"`,
  because JSON is not support neither symbol nor keyword. Poorly.
  In addition, symbol and keyword has to suport namespace like clojure.
- `#{}` `#!` `#:` `#'` `#=` `#^` `#?` are NOT provided.
- `#""` is provided as js-regexp like clojure.
- `#_` is provided as skip-next-one-element like clojure.
- `#t` `#true` `#f` `#false` `#nil` `#null` `#inf` `#+inf` `#-inf` `#nan`
  are provided as corresponded values. These will NOT affect by `quote`.
  You can use symbols of `true` `false` `nil` `null` also,
  but will affect by `quote`.
- `#()` as nameless-function will provide in future, but not now.
- Scheme's SRFI-38 like syntax will provide in future, but not now.


## TODO

- Writer function will provide in future, but not now.


## ChangeLog

- 0.1.0: 20231223
    - Initial Release
