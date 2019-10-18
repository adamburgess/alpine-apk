import axios from 'axios'
import tarStream, { pack } from 'tar-stream'
import { createGunzip } from 'zlib'
import { pipeline as pipelineCb, Readable } from 'stream'
import { promisify } from 'util'
import { StringDecoder } from 'string_decoder'
import iterate from 'iterare'
const pipeline = promisify(pipelineCb);

// export the function as default
module.exports = alpineApk;
// typescript will add the types and also the function to the exports, so set it before that
exports = alpineApk;

export type AlpineRepository = 'main' | 'community' | 'testing';
export type AlpineVersion = 'latest-stable' | 'edge';
export type AlpineArchitecture = 'aarch64' | 'armhf' | 'armv7' | 'ppc64le' | 's390x' | 'x86' | 'x86_64';
export type AlpineDependencyType = 'package' | 'command' | 'library' | 'header';
export interface AlpineDependency {
    type: AlpineDependencyType
    name: string
    version?: string
    link?: AlpinePackage
    anti: boolean
}
export type AlpinePackageMap = {
    [name: string]: AlpinePackage
}

function findLink(map: AlpinePackageMap, dep: AlpineDependency): AlpinePackage | undefined {
    // find it.
    if (dep.type === 'package') {
        if (dep.name in map) {
            return map[dep.name];
        }
    }
    // try to find it instead in the provides
    let provide = iterate(Object.values(map))
        .map(pkg =>
            iterate(pkg.provides)
                .map(prov => ({ pkg, prov }))
        )
        .flatten()
        .find(pp => pp.prov.type === dep.type && pp.prov.name === dep.name);

    if (provide) return provide.pkg;
    return undefined;
}

class AlpineDependencyImpl implements AlpineDependency {
    get link(): AlpinePackage | undefined {
        if (this.resolvedLink === null) {
            this.resolvedLink = findLink(this.map, this);
        }
        return this.resolvedLink;
    }

    private resolvedLink: AlpinePackage | undefined | null;
    private map: AlpinePackageMap;

    constructor(public type: AlpineDependencyType, public name: string, public anti: boolean, public version: string | undefined, map: AlpinePackageMap) {
        Object.defineProperty(this, 'resolvedLink', {
            enumerable: false,
            writable: true
        });
        Object.defineProperty(this, 'map', {
            enumerable: false,
            writable: true
        });
        Object.defineProperty(this, 'link', { ...Object.getOwnPropertyDescriptor(AlpineDependencyImpl.prototype, 'link'), enumerable: true });

        this.resolvedLink = null;
        this.map = map;
    }
}

export interface AlpinePackageProvides {
    type: AlpineDependencyType
    name: string
    version?: string
}
export interface AlpinePackage {
    name: string
    pullChecksum: string
    version: string
    architecture: string
    packageSize: number
    packageSizeInstalled: number
    description: string
    url: string
    license: string
    origin: string
    maintainer: string
    timestamp: Date
    commit: string
    dependencies: AlpineDependency[]
    provides: AlpinePackageProvides[]
    repository: { name: string, version: string }
}

interface APKINDEXEntry {
    /** content hash */
    C: string
    /** name */
    P: string
    /** version */
    V: string
    /** arch */
    A: string
    /** gzip size */
    S: number
    /** install size */
    I: number
    /** description */
    T: string
    /** url */
    U: string
    /** license */
    L: string
    /** origin */
    o: string
    /** maintainer */
    m: string
    /** timestamp */
    t: Date
    /** deps */
    D: string
    /** provides */
    p: string
    /** commit hash */
    c: string
}

export async function alpineApk(version: AlpineVersion = 'latest-stable', repositories: AlpineRepository[] = ['main', 'community'], architecture: AlpineArchitecture = 'x86_64') {
    let packageMetadata = await Promise.all(repositories.map(async repo => {
        const url = `http://dl-cdn.alpinelinux.org/alpine/${version}/${repo}/${architecture}/APKINDEX.tar.gz`

        let response = await axios(url, {
            responseType: 'stream'
        });

        let responseStream = response.data as Readable;
        let unzip = createGunzip();
        let tar = tarStream.extract();

        let fileData = {
            APKINDEX: '',
            DESCRIPTION: ''
        };

        tar.on('entry', (header, stream, next) => {
            if (header.name in fileData) {
                const stringDec = new StringDecoder();
                stream.on('data', chunk => {
                    fileData[header.name as keyof typeof fileData] += stringDec.write(chunk);
                });
                stream.on('end', () => {
                    fileData[header.name as keyof typeof fileData] += stringDec.end();
                    next();
                });
            } else {
                stream.on('end', next);
            }
            stream.resume();
        });

        await pipeline(
            responseStream,
            unzip,
            tar
        );

        if (!fileData.APKINDEX || !fileData.DESCRIPTION) throw new Error(`Failed to download ${url}`);

        return { repo, ...fileData };
    }));

    const packageMap: {
        [name: string]: AlpinePackage
    } = {};

    for (const meta of packageMetadata) {
        const repo: AlpinePackage['repository'] = {
            name: meta.repo,
            version: meta.DESCRIPTION
        };

        meta.APKINDEX.split('\n\n').forEach(pkgStr => {
            let lines = pkgStr.split('\n');
            let index: APKINDEXEntry = {} as APKINDEXEntry;
            for (let line of lines) {
                let c = line[0] as keyof APKINDEXEntry;
                let rest = line.substr(2);
                if (c == 'S' || c == 'I') {
                    index[c] = parseInt(rest, 10);
                } else if (c == 't') {
                    index[c] = new Date(parseInt(rest, 10) * 1000);
                } else {
                    index[c] = rest;
                }
            }

            let pkg: AlpinePackage = {
                name: index.P,
                architecture: index.A,
                commit: index.c,
                description: index.T,
                license: index.L,
                maintainer: index.m,
                origin: index.o,
                packageSize: index.S,
                packageSizeInstalled: index.I,
                pullChecksum: index.C,
                repository: repo,
                timestamp: index.t,
                url: index.U,
                version: index.V,
                dependencies: [],
                provides: [],
            };

            if (index.p) {
                let provides = index.p.split(' ');
                for (let p of provides) {
                    let type: string | undefined;
                    let version: string | undefined;
                    let name: string;
                    if (p.includes(':'))
                        [type, p] = p.split(':');
                    if (p.includes('='))
                        [name, version] = p.split('=');
                    else
                        name = p;


                    if (!type) {
                        pkg.provides.push({
                            type: 'package',
                            name,
                            version: version || ''
                        });
                    } else if ((type == 'so' || type == 'pc') && version !== undefined) {
                        pkg.provides.push({
                            type: type == 'so' ? 'library' : 'header',
                            name,
                            version: version
                        });
                    } else {
                        pkg.provides.push({
                            type: 'command',
                            name
                        });
                    }
                }
            }

            packageMap[pkg.name] = pkg;

            if (index.D) {
                let deps = index.D.split(' ');
                for (let dep of deps) {
                    let anti: boolean
                    let type: string | undefined;
                    let version: string | undefined;
                    let name: string;

                    let dOrig = dep;

                    anti = dep.startsWith('!');
                    if (anti) dep = dep.substr(1);
                    if (dep.includes(':'))
                        [type, dep] = dep.split(':');
                    if (dep.includes('>') || dep.includes('<'))
                        [name] = dep.split(/[<>]/);
                    else if (dep.includes('='))
                        [name, version] = dep.split('=');
                    else
                        name = dep;

                    pkg.dependencies.push(new AlpineDependencyImpl(
                        type === undefined ? 'package' :
                            type === 'cmd' ? 'command' :
                                type === 'so' ? 'library' : 'header',
                        name,
                        anti,
                        version,
                        packageMap
                    ));
                }
            }
        });
    }

    return packageMap;
}
