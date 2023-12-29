export const nil = null;
export const throwFn = (exc) => { throw exc };
export const throwNewError = ( (msg) => {throw new (Error)((msg))});
export const deref = ( (x) => ((throwNewError)(("not implemented yet"))));
export const isVector = ( (a) => (((Array.isArray)((a)))&&(a['%V'])));
export const isNonNegativeInteger = ( (a) => (((Number.isInteger)((a)))&&((0 <= a))))