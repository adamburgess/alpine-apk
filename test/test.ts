import 'mocha'
import { expect } from 'chai'

import AlpineApkStatic from '../index.js';

describe('alpine-apk', function () {
    it('can be imported', async function () {
        const { default: AlpineApk } = await import('../index.js');
        expect(AlpineApk).to.be.a('function');
        const alpineApk = new AlpineApk();
        expect(alpineApk.update).to.be.a('function');
    });

    let alpineApk: AlpineApkStatic;

    it('fetches packages', async function () {
        this.timeout(5000);

        const { default: AlpineApk } = await import('../index.js');
        alpineApk = new AlpineApk();

        await alpineApk.update();

        const nodeJsCurrent = alpineApk.get('nodejs-current');
        expect(nodeJsCurrent).to.not.be.undefined;
        expect(alpineApk.getDependencyTree('nodejs-current')).to.include('musl');
        expect(alpineApk.getDependencyTree('nodejs-current', 'build-base')).to.include('musl');
        expect(alpineApk.getDependencyTree('openssh-client')).to.not.be.undefined;
    });
    
});
