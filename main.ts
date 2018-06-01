import { app, BrowserWindow, ipcMain as ipc, screen } from 'electron';
import * as path from 'path';
import * as url from 'url';
import * as fs from 'fs';
// import * as semver from 'semver';
import { DdfValidatorWrapper } from './ddf-validator-wrapper';
import { exportForWeb, openFileWhenDoubleClick, openFileWithDialog, saveAllTabs, saveFile } from './file-management';

const args = process.argv.slice(1);
const PRESETS_FILE = __dirname + '/presets.json';
const devMode = process.argv.length > 1 && process.argv.indexOf('dev') > 0;
const autoUpdateTestMode = process.argv.length > 1 && process.argv.indexOf('au-test') > 0;

const nonAsarAppPath = app.getAppPath().replace(/app\.asar/, '');
const dataPackage = require(path.resolve(nonAsarAppPath, 'ddf--gapminder--systema_globalis/datapackage.json'));

let mainWindow;
let serve;
let currentFile;
let ddfValidatorWrapper;


serve = args.some(val => val === '--serve');

function createWindow() {
  const isFileArgumentValid = fileName => fs.existsSync(fileName) && fileName.indexOf('-psn_') === -1;

  mainWindow = new BrowserWindow({width: 1200, height: 800});

  if (serve) {
    require('electron-reload')(__dirname, {
      electron: require(`${__dirname}/node_modules/electron`)
    });
    mainWindow.loadURL('http://localhost:4200');
  } else {
    mainWindow.loadURL(url.format({
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
    /*request.get(FEED_VERSION_URL, (error, response, body) => {
      if (!error && response.statusCode == 200) {
        try {
          const config = JSON.parse(body);

          event.sender.send('got-supported-versions', config.modern.supported, config.modern.version, app.getVersion());
        } catch (e) {
        }
      }
    });*/
  });

  ipc.on('request-custom-update', (event, actualVersionGenericUpdate) => {
    event.sender.send('request-and-update', {actualVersionGenericUpdate, os: process.platform, arch: process.arch});
  });

  ipc.on('presets-export', (event, content) => {
    fs.writeFile(PRESETS_FILE, content, err => {
      event.sender.send('presets-export-end', err);
    });
  });

  ipc.on('do-presets-import', event => {
    fs.readFile(PRESETS_FILE, 'utf8', (err, content) => {
      event.sender.send('presets-import', {err, content});
    });
  });

  ipc.on('do-open-validation-window', event => {
    event.sender.send('open-validation-window', 'open-validation-window');
  });

  ipc.on('open-dev-tools', () => {
    mainWindow.webContents.openDevTools();
  });

  ipc.on('prepare-update', (event, version) => {
    /*if (version) {
      const url = semver.diff(app.getVersion(), version) === 'patch' ? PARTIAL_FEED_URL : FEED_URL;

      updateProcessAppDescriptor = new UpdateProcessDescriptor(version, url);
    }

    startUpdate(event);*/
  });

  ipc.on('do-open', openFileWithDialog);
  ipc.on('do-save', saveFile);
  ipc.on('do-save-all-tabs', saveAllTabs);
  ipc.on('do-export-for-web', exportForWeb);

  ipc.on('new-chart', (event, chartType) => {
    // ga.chartEvent(chartType);
  });
  ipc.on('new-chart', (event, chartType) => {
    // ga.chartEvent(chartType);
  });

  ipc.on('modify-chart', (event, action) => {
    // ga.chartChangingEvent(action);
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

try {
  app.on('ready', createWindow);

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

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
} catch (e) {
  // Catch Error
  // throw e;
}
