export declare type AlpineRepository = 'main' | 'community' | 'testing';
export declare type AlpineVersion = 'latest-stable' | 'edge';
export declare type AlpineArchitecture = 'aarch64' | 'armhf' | 'armv7' | 'ppc64le' | 's390x' | 'x86' | 'x86_64';
export declare type AlpineDependencyType = 'package' | 'command' | 'library' | 'header';
export interface AlpineDependency {
    type: AlpineDependencyType;
    name: string;
    version?: string;
    link?: AlpinePackage;
    anti: boolean;
}
export interface AlpinePackageProvides {
    type: AlpineDependencyType;
    name: string;
    version?: string;
}
export interface AlpinePackage {
    name: string;
    pullChecksum: string;
    version: string;
    architecture: string;
    packageSize: number;
    packageSizeInstalled: number;
    description: string;
    url: string;
    license: string;
    origin: string;
    maintainer: string;
    timestamp: Date;
    commit: string;
    dependencies: AlpineDependency[];
    provides: AlpinePackageProvides[];
    repository: {
        name: string;
        version: string;
    };
}
export declare function alpineApk(version?: AlpineVersion, repositories?: AlpineRepository[], architecture?: AlpineArchitecture): Promise<AlpinePackage[]>;
