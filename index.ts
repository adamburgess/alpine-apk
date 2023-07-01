import tarStream from 'tar-stream'
import { createGunzip } from 'zlib'
import { pipeline } from 'stream/promises'
import { StringDecoder } from 'string_decoder'
import { Readable } from 'stream'
import type { ReadableStream } from 'stream/web'

export interface AlpineRepository {
    name: string
    content: string
    description: string
}
export interface AlpinePackage {
    deps: string[]
    version: string
}

export interface AlpinePackageMap {
    [name: string]: AlpinePackage
}

async function downloadRepo(repo: string, version: string, arch: string): Promise<AlpineRepository> {
    const url = `http://dl-cdn.alpinelinux.org/alpine/${version}/${repo}/${arch}/APKINDEX.tar.gz`

    const response = await fetch(url);

    if (response.status !== 200 || response.body === null) throw new Error(`Failed to download ${url}`);

    const unzip = createGunzip();
    const tar = tarStream.extract();

    const fileData = {
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
        Readable.fromWeb(response.body as ReadableStream),
        unzip,
        tar
    );

    if (!fileData.APKINDEX || !fileData.DESCRIPTION) throw new Error(`Failed to download ${url}`);

    return {
        name: repo,
        content: fileData.APKINDEX,
        description: fileData.DESCRIPTION
    };
}

function getDependencyTreeInternal(
    name: string,
    pkg: AlpinePackage,
    seen: Set<AlpinePackage>,
    packages: AlpinePackageMap
) {
    let output = name + '@' + pkg.version + ',';
    for (const dep of pkg.deps) {
        const dPkg = packages[dep];
        if (dPkg === undefined) {
            continue;
        }
        if (!seen.has(dPkg)) {
            seen.add(dPkg);
            output += getDependencyTreeInternal(dep, dPkg, seen, packages);
        }
    }
    return output;
}

export class AlpineApk {
    async update(version = 'latest-stable', arch = 'x86_64', repos = ['main', 'community']) {
        const rawRepos = await Promise.all(repos.map(r => downloadRepo(r, version, arch)));
        this.setRepositories(rawRepos);
        return rawRepos;
    }

    pkgs: AlpinePackageMap = {};

    pkgNames: AlpinePackageMap = {};

    setRepositories(repositories: AlpineRepository[]) {
        for (const repo of repositories) {
            for (const pkgLines of repo.content.split('\n\n')) {
                const pkg: AlpinePackage = {
                    version: '',
                    deps: []
                };
                for (const line of pkgLines.split('\n')) {
                    const c = line[0];
                    const rest = line.substr(2);
                    if (c === 'P') {
                        this.pkgs[rest] = this.pkgNames[rest] = pkg;
                    } else if (c === 'D') {
                        pkg.deps = rest.split(' ').map(d => {
                            if (d.startsWith('!')) d = d.substr(1);
                            [d] = d.split(/[=<>~]/);
                            return d;
                        });
                    } else if (c === 'p') {
                        for (let p of rest.split(' ')) {
                            [p] = p.split('=');
                            this.pkgs[p] = pkg;
                        }
                    } else if (c === 'V') {
                        pkg.version = rest;
                    }
                }
            }
        }
    }

    get(name: string): AlpinePackage | undefined {
        return this.pkgNames[name] ?? this.pkgs[name];
    }

    getDependencyTree(...names: string[]) {
        const seen = new Set<AlpinePackage>();
        let tree = '';
        for (const name of names) {
            const pkg = this.get(name)!;
            if (pkg === undefined) continue;
            tree += getDependencyTreeInternal(name, pkg, seen, this.pkgs);
        }
        return tree;
    }
}

export default AlpineApk;
