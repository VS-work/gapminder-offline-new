import { Component, Output, EventEmitter, ChangeDetectorRef, OnDestroy, OnInit } from '@angular/core';
import { ChartService } from '../tabs/chart.service';
import { MessageService } from '../../message.service';
import { CLEAR_VALIDATION_FORM, OPEN_NEW_DDF_TAB_FROM_VALIDATOR, ABANDON_VALIDATION } from '../../constants';
import { Subscription } from 'rxjs/Subscription';
import { ElectronService } from '../../providers/electron.service';

interface ChartOption {
  label: string;
  type: string;
}

@Component({
  selector: 'app-validation-form',
  templateUrl: './validation-form.component.html',
  styleUrls: ['./validation-form.component.css']
})
export class ValidationFormComponent implements OnInit, OnDestroy {
  @Output() done: EventEmitter<any> = new EventEmitter();

  ERRORS_LIMIT = 50;
  USE_CURRENT_DATA_PACKAGE = 'useCurrentDataPackage';
  CREATE_NEW_DATA_PACKAGE = 'createNewDataPackage';
  dataPackageMode: string = this.USE_CURRENT_DATA_PACKAGE;
  issues: any[] = [];
  areOptionsVisible = false;
  statusLine = '';
  error = '';
  doesValidationRunning = false;
  isResultReady = false;
  preserveHeaders = false;
  chartsToOpen: ChartOption[] = [
    {label: 'Bubbles', type: 'BubbleChart'},
    {label: 'Rankings', type: 'BarRankChart'},
    {label: 'Lines', type: 'LineChart'}
  ];
  chartTypeToOpen: string = this.chartsToOpen[0].type;
  isChartOpenSectionVisible = false;
  errorCount = 0;
  issuesCount = 0;

  ddfFolder: string;
  subscription: Subscription;

  constructor(
    private ref: ChangeDetectorRef,
    private chartService: ChartService,
    private messageService: MessageService,
    private es: ElectronService) {
  }

  ngOnInit() {
    this.subscription = this.messageService.getMessage().subscribe((event: any) => {
      if (event.message === CLEAR_VALIDATION_FORM) {
        this.reset();
      }

      if (event.message === ABANDON_VALIDATION) {
        this.abandon();
      }
    });

    this.es.ipcRenderer.on('validation-message', (event: any, message: string) => {
      this.statusLine = message;
      this.ref.detectChanges();
    });

    this.es.ipcRenderer.on('validation-error', (event: any, error: any) => {
      this.error = error;
      this.doesValidationRunning = false;
      this.isResultReady = true;
      this.ref.detectChanges();
    });

    this.es.ipcRenderer.on('validation-issue', (event: any, issue: any) => {
      if (!issue.isWarning) {
        this.errorCount++;
      }

      this.issuesCount++;

      if (this.issuesCount <= this.ERRORS_LIMIT) {
        this.issues.push({
          desc: issue.type.replace(/\n/g, '<br>'),
          howToFix: issue.howToFix,
          details: JSON.stringify(issue.data, null, 2)
            .replace(/\n/g, '<br>')
            .replace(/ /g, '&nbsp;')
        });
      }
    });

    this.es.ipcRenderer.on('validation-completed', (event: any, params: any) => {
      this.doesValidationRunning = params.doesValidationRunning;
      this.isResultReady = params.isResultReady;
      this.ref.detectChanges();
    });
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  close() {
    this.done.emit();
  }

  onDirectorySelected(event: any) {
    this.ddfFolder = event.file;
  }

  setDataPackageMode(mode: string) {
    this.dataPackageMode = mode;
  }

  openNewDdfTab() {
    this.messageService.sendMessage(
      OPEN_NEW_DDF_TAB_FROM_VALIDATOR,
      {
        ddfPath: this.ddfFolder,
        chartType: this.chartTypeToOpen
      });
    this.reset();
    this.close();
  }

  openURL(url: string) {
    this.es.shell.openExternal(url);
  }

  validate() {
    if (!this.ddfFolder) {
      return;
    }

    this.doesValidationRunning = true;
    this.isResultReady = false;
    this.issues = [];
    this.error = '';
    this.isChartOpenSectionVisible = false;
    this.errorCount = 0;
    this.issuesCount = 0;

    this.es.ipcRenderer.send('start-validation', {
      createNewDataPackage: this.CREATE_NEW_DATA_PACKAGE,
      dataPackageMode: this.dataPackageMode,
      options: this.getValidatorOptions(),
      ddfFolder: this.ddfFolder
    });
  }

  abandon() {
    if (this.doesValidationRunning) {
      this.statusLine = ' ... abandoning ...';
      this.es.ipcRenderer.send('abandon-validation');
    }
  }

  getValidatorOptions(): any {
    const electronPath = this.chartService.ddfFolderDescriptor.electronPath;
    const validatorPaths = {
      linux: this.es.path.resolve(electronPath, 'node_modules', 'ddf-validation', 'lib'),
      darwin: this.es.path.resolve(electronPath, 'resources', 'app', 'node_modules', 'ddf-validation', 'lib'),
      win32: this.es.path.resolve(electronPath, 'node_modules', 'ddf-validation', 'lib')
    };
    // const appPath = validatorPaths[this.es.process.platform];
    const appPath = '';
    const options: any = {
      silent: true,
      appPath
    };

    if (this.dataPackageMode === this.CREATE_NEW_DATA_PACKAGE && this.preserveHeaders) {
      options.updateDataPackageContent = true;
      options.updateDataPackageTranslations = true;
    }

    return options;
  }

  reset() {
    this.issues = [];
    this.error = '';
    this.dataPackageMode = this.USE_CURRENT_DATA_PACKAGE;
    this.isChartOpenSectionVisible = false;
    this.preserveHeaders = false;
    this.areOptionsVisible = false;
    this.statusLine = '';
    this.doesValidationRunning = false;
    this.isResultReady = false;
    this.ddfFolder = '';
  }
}
