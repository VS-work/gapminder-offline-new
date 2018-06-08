import { app, BrowserWindow, ipcMain as ipc } from 'electron';
import * as path from 'path';
import * as urlLib from 'url';
import * as fs from 'fs';
import * as request from 'request';
import * as semver from 'semver';
import * as fsExtra from 'fs-extra';
import * as childProcess from 'child_process';
import * as onlineBranchExist from 'online-branch-exist';
import * as electronEasyUpdater from 'electron-easy-updater';
import { parallel } from 'async';
import { DdfValidatorWrapper } from './ddf-validator-wrapper';
import { exportForWeb, openFileWhenDoubleClick, openFileWithDialog, saveAllTabs, saveFile } from './file-management';
import { GoogleAnalytics } from './google-analytics';
import {
  DS_FEED_URL_TEMP,
  DS_FEED_VERSION_URL_TEMP,
  DS_TAG_TEMP, FEED_VERSION_URL_TEMP,
  FEED_VERSION_URL_TEST_TEMP,
  FEED_URL_TEMP
} from './auto-update-config';

process.noAsar = true;

const packageJSON = require('./package.json');
const ga = new GoogleAnalytics(packageJSON.googleAnalyticsId, app.getVersion());

const args = process.argv.slice(1);
const devMode = process.argv.length > 1 && process.argv.indexOf('dev') > 0;
// const autoUpdateTestMode = process.argv.length > 1 && process.argv.indexOf('au-test') > 0;
const autoUpdateTestMode = true;

const nonAsarAppPath = app.getAppPath().replace(/app\.asar/, '');
const dataPackage = require(path.resolve(nonAsarAppPath, 'ddf--gapminder--systema_globalis/datapackage.json'));
const serve = args.some(val => val === '--serve');

let mainWindow;
let updateProcessAppDescriptor;
let updateProcessDsDescriptor;
let currentFile;
let ddfValidatorWrapper;

class UpdateProcessDescriptor {
  constructor(public version: string, public url: string = FEED_URL) {
  }
}

const currentDir = path.resolve(__dirname, '..', '..');
const dirs = {
  linux: currentDir,
  darwin: path.resolve(__dirname.replace(/\/app\.asar/, ''), '..', '..'),
  win32: path.resolve(__dirname.replace(/\/app\.asar/, ''), '..', '..')
};
const getTypeByOsAndArch = (os, arch) => {
  if (os === 'win32' && arch === 'x64') {
    return 'win64';
  }

  if (os === 'win32' && arch === 'ia32') {
    return 'win32';
  }

  if (os === 'darwin') {
    return 'mac';
  }

  return os;
};
const RELEASE_APP_ARCHIVE = 'release-app.zip';
const RELEASE_DS_ARCHIVE = 'release-ds.zip';
const FEED_VERSION_URL = autoUpdateTestMode ? FEED_VERSION_URL_TEST_TEMP : FEED_VERSION_URL_TEMP;
const FEED_URL = FEED_URL_TEMP.replace(/#type#/g, getTypeByOsAndArch(process.platform, process.arch));
const DS_FEED_VERSION_URL = DS_FEED_VERSION_URL_TEMP;
const DS_FEED_URL = DS_FEED_URL_TEMP;
// const SAVED_APP = `${dirs[process.platform]}/saved-app`;
const CACHE_APP_DIR = `${dirs[process.platform]}/cache-app`;
const CACHE_DS_DIR = `${dirs[process.platform]}/cache-ds`;
const UPDATE_PROCESS_FLAG_FILE = `${dirs[process.platform]}/updating`;
const UPDATE_FLAG_FILE = `${dirs[process.platform]}/update-required`;

function rollback() {
  try {
    fsExtra.removeSync(CACHE_APP_DIR);
    fsExtra.removeSync(CACHE_DS_DIR);
  } catch (e) {
    console.log(e);
  }
}

function finishUpdate() {
  fs.writeFileSync(UPDATE_PROCESS_FLAG_FILE, 'updating');

  if (process.platform !== 'win32') {
    const updateCommand = dirs[process.platform] + '/updater';

    childProcess.spawn(
      updateCommand,
      [],
      {
        cwd: dirs[process.platform],
        stdio: 'ignore',
        detached: true
      }
    ).unref();
  }

  if (process.platform === 'win32') {
    childProcess.spawn(
      'wscript.exe',
      ['"invisible.vbs"', '"updater-' + getTypeByOsAndArch(process.platform, process.arch) + '.exe"'],
      {
        windowsVerbatimArguments: true,
        cwd: dirs[process.platform],
        stdio: 'ignore',
        detached: true
      }
    ).unref();
  }

  app.quit();
}

function startUpdate(event) {
  const getLoader = (cacheDir, releaseArchive, updateProcessDescriptor) => cb => {
    if (!updateProcessDescriptor || !updateProcessDescriptor.version) {
      cb();
      return;
    }

    const releaseUrl = updateProcessDescriptor.url.replace('#version#', updateProcessDescriptor.version);

    ga.event('Run', `starting and trying auto update from ${app.getVersion()} to ${updateProcessDescriptor.version}`);

    electronEasyUpdater.download({
        url: releaseUrl,
        version: app.getVersion(),
        path: cacheDir,
        file: releaseArchive
      }, progress => {
        event.sender.send('download-progress', {progress, cacheDir});
      },
      err => {
        if (err) {
          event.sender.send('auto-update-error', err);
          ga.error('auto update -> download error: ' + err);

          cb(err);
          return;
        }

        electronEasyUpdater.unpack({
            directory: cacheDir,
            file: releaseArchive
          },
          progress => {
            event.sender.send('unpack-progress', {progress, cacheDir});
          },
          unpackErr => {
            if (unpackErr) {
              ga.error('auto update -> unpacking error: ' + unpackErr);
              event.sender.send('auto-update-error', unpackErr);
            }

            cb(unpackErr);
          });
      }
    );
  };

  parallel([
    getLoader(CACHE_APP_DIR, RELEASE_APP_ARCHIVE, updateProcessAppDescriptor),
    getLoader(CACHE_DS_DIR, RELEASE_DS_ARCHIVE, updateProcessDsDescriptor)
  ], err => {
    if (err) {
      rollback();
      return;
    }

    fs.writeFile(UPDATE_FLAG_FILE, 'need-to-update', () => {
      event.sender.send('unpack-complete', null);
    });
  });
}

function createWindow() {
  const isFileArgumentValid = fileName => fs.existsSync(fileName) && fileName.indexOf('-psn_') === -1;

  mainWindow = new BrowserWindow({width: 1200, height: 800});

  if (serve) {
    require('electron-reload')(__dirname, {
      electron: require(`${__dirname}/node_modules/electron`)
    });
    mainWindow.loadURL('http://localhost:4200');
  } else {
    mainWindow.loadURL(urlLib.format({
      pathname: path.join(__dirname, 'dist/index.html'),
      protocol: 'file:',
      slashes: true
    }));
  }

  if (devMode) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  ipc.on('get-dev-mode', event => {
    event.sender.send('got-dev-mode', devMode);
  });

  ipc.on('get-versions-info', () => {
    mainWindow.setTitle(`Gapminder Tools Offline v.${app.getVersion()} (dataset v.${dataPackage.version})`);
  });

  ipc.on('get-app-path', event => {
    event.sender.send('got-app-path', nonAsarAppPath);
  });

  ipc.on('get-app-arguments', event => {
    if (!devMode && !autoUpdateTestMode && (process.argv.length > 1 || currentFile)) {
      const fileName = currentFile || process.argv[1];

      if (isFileArgumentValid(fileName)) {
        event.sender.send('got-app-file-argument', {fileName});
        return;
      }
    }

    event.sender.send('got-app-file-argument', {});
  });

  ipc.on('open-file-after-start', event => {
    if (!devMode && !autoUpdateTestMode && (process.argv.length > 1 || currentFile)) {
      const fileName = currentFile || process.argv[1];

      if (isFileArgumentValid(fileName)) {
        openFileWhenDoubleClick(event, fileName);
      }
    }
  });

  ipc.on('get-supported-versions', event => {
    request.get(FEED_VERSION_URL, (error, response, body) => {
      if (!error && response.statusCode === 200) {
        try {
          const config = JSON.parse(body);

          event.sender.send('got-supported-versions', config.modern.supported, config.modern.version, app.getVersion());
        } catch (e) {
        }
      }
    });
  });

  ipc.on('request-custom-update', (event, actualVersionGenericUpdate) => {
    event.sender.send('request-and-update', {actualVersionGenericUpdate, os: process.platform, arch: process.arch});
  });

  ipc.on('do-open-validation-window', event => {
    event.sender.send('open-validation-window', 'open-validation-window');
  });

  ipc.on('open-dev-tools', () => {
    mainWindow.webContents.openDevTools();
  });

  ipc.on('check-version', event => {
    electronEasyUpdater.versionCheck({
      url: FEED_VERSION_URL,
      version: app.getVersion()
    }, (errGenericUpdate, actualVersionGenericUpdate, versionDiffType) => {
      if (errGenericUpdate) {
        return;
      }

      if (actualVersionGenericUpdate) {
        if (versionDiffType === 'major' || versionDiffType === 'minor') {
          event.sender.send('full-update-request', {
            actualVersionGenericUpdate,
            os: process.platform,
            arch: process.arch
          });
        }

        updateProcessAppDescriptor = new UpdateProcessDescriptor(actualVersionGenericUpdate, FEED_URL);
      }

      electronEasyUpdater.versionCheck({
        url: DS_FEED_VERSION_URL,
        version: dataPackage.version
      }, (errDsUpdate, actualVersionDsUpdateParam) => {
        if (errDsUpdate) {
          return;
        }

        let actualVersionDsUpdate = null;

        if (actualVersionDsUpdateParam || actualVersionGenericUpdate) {
          if (actualVersionDsUpdateParam && semver.valid(actualVersionDsUpdateParam)) {
            const tagVersion = DS_TAG_TEMP.replace(/#version#/, actualVersionDsUpdateParam);

            onlineBranchExist.tag(tagVersion, (err, res) => {
              if (res) {
                actualVersionDsUpdate = actualVersionDsUpdateParam;
              }

              updateProcessDsDescriptor = new UpdateProcessDescriptor(actualVersionDsUpdate, DS_FEED_URL);

              event.sender.send('request-to-update', {
                actualVersionDsUpdate,
                actualVersionGenericUpdate,
                os: process.platform,
                arch: process.arch
              });
            });
          } else {
            event.sender.send('request-to-update', {
              actualVersionGenericUpdate,
              os: process.platform,
              arch: process.arch
            });
          }
        }
      });
    });
  });

  ipc.on('prepare-update', (event, version) => {
    if (version) {
      updateProcessAppDescriptor = new UpdateProcessDescriptor(version, FEED_URL);
    }

    startUpdate(event);
  });

  ipc.on('exit-and-update', () => {
    finishUpdate();
  });

  ipc.on('do-open', openFileWithDialog);
  ipc.on('do-save', saveFile);
  ipc.on('do-save-all-tabs', saveAllTabs);
  ipc.on('do-export-for-web', exportForWeb);

  ipc.on('new-chart', (event, chartType) => {
    ga.chartEvent(chartType);
  });
  ipc.on('new-chart', (event, chartType) => {
    ga.chartEvent(chartType);
  });

  ipc.on('modify-chart', (event, action) => {
    ga.chartChangingEvent(action);
  });

  ipc.on('start-validation', (event, params) => {
    if (ddfValidatorWrapper) {
      ddfValidatorWrapper.abandon();
    }

    ddfValidatorWrapper = new DdfValidatorWrapper();
    ddfValidatorWrapper.start(event, params);
  });

  ipc.on('abandon-validation', () => {
    if (ddfValidatorWrapper) {
      ddfValidatorWrapper.abandon();
    }
  });
}

app.on('ready', () => {
  fs.readFile(UPDATE_PROCESS_FLAG_FILE, 'utf8', updatingFileDoesNotExist => {
    if (updatingFileDoesNotExist) {
      fs.readFile(UPDATE_FLAG_FILE, 'utf8', updateFileDoesNotExist => {
        if (updateFileDoesNotExist) {
          rollback();

          ga.runEvent(false);

          createWindow();
          return;
        }

        ga.runEvent(true);

        finishUpdate();
      });
    } else {
      // don't run during update process!
      app.quit();
    }
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

const isSecondInstance = app.makeSingleInstance((commandLine) => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }

    mainWindow.focus();

    if (commandLine.length > 1) {
      openFileWhenDoubleClick(mainWindow, commandLine[1]);
    }
  }
});

if (isSecondInstance) {
  app.quit();
}

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('open-file', (event, filePath) => {
  event.preventDefault();

  if (mainWindow && mainWindow.webContents) {
    openFileWhenDoubleClick(mainWindow, filePath);
  } else {
    if (!devMode && !autoUpdateTestMode) {
      currentFile = filePath;
    }
  }
});
