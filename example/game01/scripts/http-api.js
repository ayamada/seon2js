"use strict";


const koa = require('koa');
const koaCors = require('@koa/cors');
const koaStatic = require('koa-static');
const { koaBody } = require('koa-body');
const fs = require('node:fs');
const process = require("node:process");


const handleApi = async (ctx, next) => {
  if ('/path-to-api' != ctx.url) { return await next() }
  if (ctx.request.method != "POST") {
    // TODO: 本当は400とか返すようにした方がよい
    return await next();
  }
  ctx.body = {result: {a: 1, b: 2}};
};


const main = () => {
  const staticHtmlPath = process.argv[2];
  if (staticHtmlPath == null) {
    console.log("usage:\n  node scripts/http-api.js [staticHtmlPath]");
    process.exit(1);
  }
  if (!fs.existsSync(staticHtmlPath)) {
    console.log(`not found staticHtmlPath ${staticHtmlPath}`);
    process.exit(1);
  }
  const port = 3001; // TODO: 本当はこれも引数から取れた方がよい

  const app = new koa();
  app.use(koaBody());
  app.use(koaCors({origin: '*'}));
  app.use(handleApi);
  app.use(koaStatic(staticHtmlPath));
  app.listen(port);
  console.log(`start server on port ${port} from staticHtmlPath ${staticHtmlPath}`);
};


main();
