## alpine-apk

[![test](https://github.com/adamburgess/alpine-apk/actions/workflows/workflow.yml/badge.svg)](https://github.com/adamburgess/alpine-apk/actions/workflows/workflow.yml)

Use this package to read the contents of [Alpine's package repository](https://pkgs.alpinelinux.org/packages).

Usage:

```js
import AlpineApk from 'alpine-apk'

/* by default:
    version is 'latest-stable'. See versions here: http://dl-cdn.alpinelinux.org/alpine/
    architecture is 'x86_64'
    repos are ['main', 'community']
*/
const alpineApk = new AlpineApk();
await alpineApk.update(version, architecture, repos);

const nodeJs = alpineApk.get('nodejs');
/* nodeJs.version = '20.3.1-r0'
   nodeJs.deps = [
     'ca-certificates',
     'so:libada.so.2',
     'so:libbrotlidec.so.1',
     'so:libbrotlienc.so.1',
     'so:libc.musl-x86_64.so.1',
     'so:libcares.so.2',
     'so:libcrypto.so.3',
     'so:libgcc_s.so.1',
     'so:libicui18n.so.73',
     'so:libicuuc.so.73',
     'so:libnghttp2.so.14',
     'so:libssl.so.3',
     'so:libstdc++.so.6',
     'so:libuv.so.1',
     'so:libz.so.1'
  ]
*/
const nodeJsHash = alpineApk.getDependencyTree('nodejs');
/* => 'nodejs@18.16.1-r0,ca-certificates@20230506-r0,/bin/sh@2.54-r3,yash@2.54-r3,so:libc.musl-x86_64.so.1@1.2.4-r0,so:libncursesw.so.6@6.4_p20230506-r0,ncurses-terminfo-base@6.4_p20230506-r0,so:libcrypto.so.3@3.1.1-r1,so:libbrotlidec.so.1@1.0.9-r14,so:libcares.so.2@1.19.1-r0,so:libgcc_s.so.1@12.2.1_git20220924-r10,so:libicui18n.so.73@73.2-r1,icu-data@73.2-r1,so:libstdc++.so.6@12.2.1_git20220924-r10,so:libnghttp2.so.14@1.53.0-r0,so:libssl.so.3@3.1.1-r1,so:libz.so.1@1.2.13-r1,'
*/

const allPackages = alpineApk.pkgs;
/*  allPackages = {
        nodejs: ... as above with get(),
        etc, etc, (lots of packages!)
    }
*/
```

### Why use this?

I wanted to rebuild my docker images when nodejs _and/or nodejs's dependencies_ updated on alpine.
This allows me to do that:

```js
import AlpineApk from 'alpine-apk'

const alpineApk = new AlpineApk();
await alpineApk.update();

const current = alpineApk.getDependencyTree('nodejs');
const previous = /* load the previous value somehow */

if (current !== previous) {
    // nodejs, or one of the dependencies of nodejs, has changed.
    // rebuild the image!
}

```
