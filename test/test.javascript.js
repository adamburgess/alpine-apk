require('mocha');
const expect = require('chai').expect;

describe('alpine-apk (javascript)', function() {
    it('can be requried', function() {
        let alpineApk = require('../index.js');
        expect(alpineApk.alpineApk).to.be.a('function');
        expect(alpineApk.findPackages).to.be.a('function');
    });
});