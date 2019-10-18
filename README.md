## alpine-apk

Use this package to read the contents of [Alpine's package repository](https://pkgs.alpinelinux.org/packages).

Usage:

```js
import alpineApk from 'alpine-apk'
// or, const alpineApk = require('alpine-apk')

/* by default:
    version is 'latest-stable'
    repositories is ['main', 'community']
    architecture is 'x86_64'
*/
const pkgs = await alpineApk(version, repositories, architecture);

/* pkgs is a map: package name -> AlpinePackage

    AlpinePackage is an object of:
        name
        version
        description
        url
        packageSize
        packageSizeInstalled
        timestamp
        maintainer
        dependencies: AlpineDependency[]
        provides: AlpineProvides[]

    dependencies is a list of libraries/headers/commands/packages that it depends on:
        name: dependency name
        type: 'library' or 'header' or 'command' or 'package'
        link: AlpinePackage, if resolved, or undefined, if not found

    provides is a list of l/h/c/p that the package provides
        name: provider name
        type: l/h/c/p

*/

```

### Why use this?

I wanted to rebuild my docker images when nodejs _and/or nodejs's dependencies_ updated on alpine.
This allows me to do that:

```js
import alpineApk from 'alpine-apk'
import stringify from 'fast-safe-stringify'

const pkgs = await alpineApk();
const nodeJs = pkgs['nodejs-current'];

const previous = /* load the previous value somehow */
const nodeJsDependencyTree = stringify(nodeJs);

if(nodeJsDependencyTree !== previous) {
    // nodejs, or one of the dependencies of nodejs, has changed.
}

```
