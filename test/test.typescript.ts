import 'mocha'
import { expect } from 'chai'

import { AlpineApk } from '../index.js';

describe('alpine-apk (typescript)', function () {
    it('can be requried', async function () {
        let { AlpineApk } = await import('../index.js');
        expect(AlpineApk).to.be.a('function');
    });

    let pkgs: any;

    let alpineApk: AlpineApk;

    it('fetches packages', async function () {
        this.timeout(5000);

        let { AlpineApk } = await import('../index.js');
        alpineApk = new AlpineApk();

        await alpineApk.update();

        let nodeJsCurrent = alpineApk.get('nodejs-current');
        expect(nodeJsCurrent).to.not.be.undefined;
        expect(alpineApk.recursiveGetHash('nodejs-current')).to.include('musl');
    });
    
});
