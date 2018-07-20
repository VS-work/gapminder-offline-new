'use strict';

const isWin = require('os').platform() === 'win32';
const progExtension = isWin ? '.exe' : '';

exports.config = {
  seleniumAddress: 'http://localhost:9515/', // default port for electron-chromedriver

  specs: [
    './**/*.e2e-spec.ts'
  ],

  framework: 'jasmine',

  allScriptsTimeout: 60000,

  jasmineNodeOpts: {
    showTiming: true,
    showColors: true,
    isVerbose: false,
    includeStackTrace: false,
    defaultTimeoutInterval: 60000,
    print: function () {
    }
  },

  multiCapabilities: [
    {
      browserName: 'chrome',
      chromeOptions: {
        binary: `${__dirname}/../app-builds/Gapminder Offline-linux/Gapminder Offline${progExtension}`,
        args: ['no-sandbox', 'disable-infobars']
      }
    }
  ],

  onPrepare: function () {
    browser.waitForAngularEnabled(false);

    require('ts-node').register({project: `${__dirname}/../e2e/tsconfig.json`});

    let SpecReporter = require('jasmine-spec-reporter').SpecReporter;

    jasmine.getEnv().addReporter(new SpecReporter({
      spec: {
        displayStacktrace: true
      }
    }));
  }
};
