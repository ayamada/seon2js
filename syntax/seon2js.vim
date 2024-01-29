let s:specials =<< END
sp/eval-js-at-compile-time!
sp/defsp-js
sp/raw-js
sp/defalias
sp/defsp
sp/defspecial
sp/rigidify-namespace-for-s2sp!
sp/defstatement1
sp/delete
sp/delete!
delete
delete!
sp/await
sp/await!
await
await!
sp/throw
sp/throw!
throw
throw!
sp/new
new
sp/defstatement0-1
sp/return
sp/return!
return
return!
sp/break
sp/break!
break
break!
sp/continue
sp/continue!
continue
continue!
sp/if
if
sp/if-not
if-not
sp/cond
cond
sp/when
when
sp/when-not
when-not
sp/fn
fn
sp/fn-async
sp/async-fn
fn-async
async-fn
sp/do
do
sp/??=
??=
sp/import
import
sp/export
export
sp/let
let
sp/const
const
sp/const-fn
const-fn
sp/const-fn-async
const-fn-async
sp/const-async-fn
const-async-fn
sp/export-const
export-const
sp/export-const-fn
export-const-fn
sp/export-const-fn-async
export-const-fn-async
sp/export-const-async-fn
export-const-async-fn
sp/definfix2
sp/definfix
sp/definfix+
sp/=
=
sp/set!
set!
sp/===
===
sp/==
==
sp/not===
not===
sp/!==
!==
sp/not==
not==
sp/!=
!=
sp/not=
not=
sp/<
<
sp/<=
<=
sp/>
>
sp/>=
>=
sp/in
in
sp/&&
&&
sp/and
and
sp/\|\|
\|\|
sp/or
or
sp/??
??
sp/undefined-or
undefined-or
sp/+
+
sp/add
add
sp/str
str
sp/-
-
sp/sub
sub
sp/*
*
sp/mul
mul
sp//
/
sp/div
div
sp/%
%
sp/rem
rem
sp/**
**
sp/pow
pow
sp/&&=
&&=
sp/and!
and!
sp/\|\|=
\|\|=
sp/or!
or!
sp/undefined-or!
undefined-or!
sp/+=
+=
sp/add!
add!
sp/str!
str!
sp/-=
-=
sp/sub!
sub!
sp/*=
*=
sp/mul!
mul!
sp//=
/=
sp/div!
div!
sp/%=
%=
sp/rem!
rem!
sp/**=
**=
sp/pow!
pow!
sp/!
!
sp/not
not
sp/!!
!!
sp/coerce-boolean
coerce-boolean
sp/++
++
sp/++!
++!
sp/inc!
inc!
sp/inc0!
inc0!
sp/--
--
sp/--!
--!
sp/dec!
dec!
sp/dec0!
dec0!
sp/\|0
\|0
sp/sint32
sint32
sp/coerce-sint32
coerce-sint32
sp/\|=0
\|=0
sp/sint32!
sint32!
sp/coerce-sint32!
coerce-sint32!
sp/.
.
sp/?.
?.
sp/try
try
sp/import-s2sp
import-s2sp
sp/is-prod
is-prod
sp/is-dev
is-dev
sp/is-eliminate-assert
is-eliminate-assert
sp/is-rename-const-let
is-rename-const-let
sp/assert
assert
sp/assert!
assert!
sp/assert-empty-object
assert-empty-object
sp/assert-empty-object!
assert-empty-object!
sp/all-special-names
npm-util/resolve-package-name
npm-util/resolve-package-version
npm-util/resolve
END
function! s:SetupSeon2jsSyntax() abort
  setlocal filetype=clojure
  setlocal lispwords=
  for sp in s:specials
    execute 'setlocal lispwords+=' . sp
    execute 'syntax keyword clojureMacro ' . sp
  endfor
endfunction
augroup seon2js
  autocmd!
  autocmd BufReadPost,BufNewFile *.s2sp,*.s2mjs,*.s2js call s:SetupSeon2jsSyntax()
augroup END
