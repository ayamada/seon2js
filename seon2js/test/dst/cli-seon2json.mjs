import { doThrow, throwNewError, unquote, unquoteSplicing, deref, isArray, isVector, isObject, isString, isNully, _LT_, _LT__EQ_, _GT_, _GT__EQ_, isNonNegativeInteger, aget, car, cdr, cadr, _EQ__EQ__EQ_, _EQ__EQ_, _EQ_, _BANG__EQ_, not_EQ_, not, _PLUS_, str, object } from "./seon2js/lang/v0/s2.mjs";
import { default as fs } from "node:fs";
import { default as process } from "node:process";
import { default as path } from "node:path";
import * as seonUtil from "seon/util";
export const mkdirpOptions = ({recursive: (true), mode: (0o755)});
const mkdirp = ( (path) => ((fs.mkdirSync)((path), (mkdirpOptions))));
const convertSeonToJson = ( (srcPath, dstPath) => {const seonString = (fs.readFileSync)((srcPath), ("utf-8"));
const jsonString = (seonUtil.convertSeonStringToJsonString)((seonString), (dstPath), (srcPath));
(mkdirp)(((path.dirname)((dstPath))));
return (fs.writeFileSync)((dstPath), (jsonString))});
const exchangeExt = ( (targetPath, newExt) => {const pathParsed = {... ((path.parse)((targetPath)))};
(pathParsed.ext)=(newExt);
delete pathParsed.base;
return (path.format)((pathParsed))});
const displayUsageAndExit = ( () => ((console.log)(("usage:\n    node ./cli-seon2json.mjs path/to/src.seon path/to/dst.json")), (process.exit)((1))));
const main = ( (src, dst) => (((!(src)) ? ((displayUsageAndExit)()) : undefined), ((!(dst)) ? ((dst)=((exchangeExt)((src), (".json"))), (((src)===(dst)) ? ((displayUsageAndExit)()) : undefined)) : undefined), ((!((fs.existsSync)((src)))) ? ((console.log)((("")+("src not found: ")+(src))), (process.exit)((1))) : undefined), (convertSeonToJson)((src), (dst))));
(main)(((process.argv)[2]), ((process.argv)[3]))