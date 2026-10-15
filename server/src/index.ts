/**
 * Node entry point (Railway, Docker, or any VPS): wraps the API handler in a
 * plain HTTP server. The same handler is exported as a Vercel serverless
 * function from `api/[...path].ts`, so the API can run on free hosting with
 * no separate server.
 */

import { createServer } from 'node:http';

import { describeProvider, handleRequest, VERSION } from './app';

const PORT = Number(process.env.PORT ?? 8787);

createServer((req, res) => {
  void handleRequest(req, res);
}).listen(PORT, () => {
  console.log(`medimind-server v${VERSION} listening on port ${PORT} (assistant: ${describeProvider()})`);
});
