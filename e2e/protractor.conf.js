'use strict';

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
        binary: '/home/vs/projects2/gapminder-offline-new/app-builds/Gapminder Offline-linux/Gapminder Offline', // path to GOffline executable
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
