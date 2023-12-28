export const nil = null;
export const doThrow = function (exc) { throw exc };
export const doThrowNewError = ( (msg) => ((doThrow)((new (Error)((msg))))));
export const deref = ( (x) => ((doThrowNewError)(("not implemented yet"))));
export const isVector = ( (a) => (((Array.isArray)((a)))&&(a['%V'])));
export const isNonNegativeInteger = ( (a) => (((Number.isInteger)((a)))&&((0 <= a))))