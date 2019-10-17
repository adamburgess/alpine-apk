import axios from 'axios'
import tarStream, { pack } from 'tar-stream'
import { createGunzip } from 'zlib'
import { pipeline as pipelineCb, Readable } from 'stream'
import { promisify } from 'util'
import { StringDecoder } from 'string_decoder'
import { ok } from 'assert'
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
    const middleStage = packageMetadata.flatMap(meta => {
        const repo: AlpinePackage['repository'] = {
            name: meta.repo,
            version: meta.DESCRIPTION
        };
        const packages = meta.APKINDEX.split('\n\n').map(pkgStr => {
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
                dependencies: [],
                description: index.T,
                license: index.L,
                maintainer: index.m,
                origin: index.o,
                packageSize: index.S,
                packageSizeInstalled: index.I,
                provides: [],
                pullChecksum: index.C,
                repository: repo,
                timestamp: index.t,
                url: index.U,
                version: index.V
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

            return { pkg, depsStr: index.D };
        });

        

        return packages;
    });
    let provides = middleStage.flatMap(p => p.pkg.provides.map(prov => ({ pkg: p.pkg, ...prov })));
    let m1 = provides.flatMap(p => {
        let ret = [[`${p.name}:${p.type}`, p.pkg]];
        if(p.version) ret.push([`${p.name}:${p.type}:${p.version}`, p.pkg]);
        return ret as [[string, AlpinePackage]];
    });
    let m2 = middleStage.map(p => [`${p.pkg.name}:package`, p.pkg] as [string, AlpinePackage]);

    let conc = m1.concat(m2);

    let providesMap = Object.fromEntries(conc);

    for (let { pkg, depsStr } of middleStage) {
        if (!depsStr) continue;

        let deps = depsStr.split(' ');
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

            // resolve.
            if (type === undefined) {
                // search for package
                let link: AlpinePackage | undefined;
                let found = version === undefined ? providesMap[`${name}:package`] : providesMap[`${name}:package:${version}`];
                if (!found) {
                    // attempt to find direct package
                    let foundPackage = middleStage.find(p => p.pkg.name === name &&
                        (version === undefined || p.pkg.version === version));
                    if (!foundPackage) {
                        link = undefined;
                    } else {
                        link = foundPackage.pkg;
                    }
                } else {
                    link = found;
                }

                pkg.dependencies.push({
                    type: 'package',
                    name,
                    version,
                    link,
                    anti
                });
            } else if (type === 'cmd') {
                // search for command
                let found = providesMap[`${name}:command`];
                let link = found ? found : undefined;

                pkg.dependencies.push({
                    type: 'command',
                    name,
                    version,
                    link,
                    anti
                })
            } else {
                // search for library/header
                let aType: AlpineDependencyType = type === 'so' ? 'library' : 'header';
                let found = version === undefined ? providesMap[`${name}:${aType}`] : providesMap[`${name}:${aType}:${version}`];
                let link = found ? found : undefined;

                pkg.dependencies.push({
                    type: aType,
                    name,
                    version,
                    link,
                    anti
                });
            }
        }
    }
    return middleStage.map(p => p.pkg);
}
