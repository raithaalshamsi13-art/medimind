/**
 * A failed scan must name what happened. These map the server's answer (or
 * the lack of one) to the one error the screen shows.
 */

import { classifyHttpFailure, classifyTransportFailure, serverErrorCode } from '@/services/scanner/scanErrors';

describe('classifyHttpFailure', () => {
  it('prefers the server’s own code when the body carries one', () => {
    expect(classifyHttpFailure(503, JSON.stringify({ error: 'x', code: 'PROVIDER_KEY_INVALID' }))).toBe('SCAN_PROVIDER_KEY_INVALID');
    expect(classifyHttpFailure(401, JSON.stringify({ code: 'APP_KEY_REJECTED' }))).toBe('SCAN_APP_KEY_REJECTED');
    expect(classifyHttpFailure(501, JSON.stringify({ code: 'NO_VISION_PROVIDER' }))).toBe('SCAN_NO_VISION');
    expect(classifyHttpFailure(413, JSON.stringify({ code: 'IMAGE_TOO_LARGE' }))).toBe('SCAN_IMAGE_TOO_LARGE');
    expect(classifyHttpFailure(429, JSON.stringify({ code: 'PROVIDER_RATE_LIMITED' }))).toBe('SCAN_RATE_LIMITED');
    expect(classifyHttpFailure(504, JSON.stringify({ code: 'PROVIDER_TIMEOUT' }))).toBe('SCAN_TIMEOUT');
    expect(classifyHttpFailure(502, JSON.stringify({ code: 'BAD_REPLY' }))).toBe('SCAN_SERVER_ERROR');
  });

  it('falls back to the HTTP status for an older server or a non-JSON body', () => {
    expect(classifyHttpFailure(401, '')).toBe('SCAN_APP_KEY_REJECTED');
    expect(classifyHttpFailure(404, '')).toBe('SERVER_UNREACHABLE'); // nothing deployed at that address
    expect(classifyHttpFailure(413, '<html>too large</html>')).toBe('SCAN_IMAGE_TOO_LARGE');
    expect(classifyHttpFailure(429, '')).toBe('SCAN_RATE_LIMITED');
    expect(classifyHttpFailure(501, '')).toBe('SCAN_NO_VISION');
    expect(classifyHttpFailure(503, '')).toBe('SCAN_PROVIDER_KEY_INVALID');
    expect(classifyHttpFailure(504, '')).toBe('SCAN_TIMEOUT');
    expect(classifyHttpFailure(500, 'oops')).toBe('SCAN_SERVER_ERROR');
    expect(classifyHttpFailure(502, '')).toBe('SCAN_SERVER_ERROR');
  });

  it('reads a code only from well-formed JSON', () => {
    expect(serverErrorCode('{"code":"RATE_LIMITED"}')).toBe('RATE_LIMITED');
    expect(serverErrorCode('{"code":5}')).toBeNull();
    expect(serverErrorCode('not json')).toBeNull();
  });
});

describe('classifyTransportFailure', () => {
  it('tells offline, server down, and a dropped request apart', () => {
    expect(classifyTransportFailure({ internet: false, server: false }, false)).toBe('NETWORK_UNAVAILABLE');
    expect(classifyTransportFailure({ internet: true, server: false }, false)).toBe('SERVER_UNREACHABLE');
    expect(classifyTransportFailure({ internet: true, server: true }, false)).toBe('SCAN_SERVER_ERROR');
  });

  it('reports a timeout as a timeout whatever the probes say', () => {
    expect(classifyTransportFailure({ internet: false, server: false }, true)).toBe('SCAN_TIMEOUT');
  });
});
