## alpine-apk

Use this package to read the contents of [Alpine's package repository](https://pkgs.alpinelinux.org/packages).

Usage:

```js
import { AlpineApk } from 'alpine-apk'
// or, const { AlpineApk } = require('alpine-apk')

/* by default:
    version is 'v3.10'. See versions here: http://dl-cdn.alpinelinux.org/alpine/
    architecture is 'x86_64'
*/
const alpineApk = new AlpineApk();
await alpineApk.update(version, architecture);

const nodeJs = alpineApk.get('nodejs');
/* nodeJs.version = '10.16.3-r0'
   nodeJs.deps = [
       'ca-certificates',
       'so:libc.musl-x86_64.so.1',
       'so:libcares.so.2',
       'so:libcrypto.so.1.1',
       'so:libgcc_s.so.1',
       'so:libhttp_parser.so.2.9',
       'so:libssl.so.1.1',
       'so:libstdc++.so.6',
       'so:libuv.so.1',
       'so:libz.so.1'
    ]
*/
const nodeJsHash = alpineApk.recursiveGetHash('nodejs');
/* => 'nodejs@10.16.3-r0,ca-certificates@20190108-r0,/bin/sh@1.30.1-r3,so:libc.musl-x86_64.so.1@1.1.22-r3,so:libcrypto.so.1.1@1.1.1d-r0,so:libcares.so.2@1.15.0-r0,so:libgcc_s.so.1@8.3.0-r0,so:libhttp_parser.so.2.9@2.9.2-r0,so:libssl.so.1.1@1.1.1d-r0,so:libstdc++.so.6@8.3.0-r0,so:libuv.so.1@1.29.1-r0,so:libz.so.1@1.2.11-r1,'
*/

```

### Why use this?

I wanted to rebuild my docker images when nodejs _and/or nodejs's dependencies_ updated on alpine.
This allows me to do that:

```js
import { AlpineApk } from 'alpine-apk'

const alpineApk = new AlpineApk();
await alpineApk.update();
const nodeJs = alpineApk.recursiveGetHash('nodejs-current');
/* nodeJs now has a big long string containing:
    nodejs's version
    nodejs's immediate dependencies versions
    AND all the dependencies of those, etc, etc.
*/

const previous = /* load the previous value somehow */

if (nodeJsDependencyTree !== previous) {
    // nodejs, or one of the dependencies of nodejs, has changed.
    // rebuild the image!
}

```
