import { Component, OnInit, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { Observable } from 'rxjs';
import { ChartService } from './chart.service';
import { TabModel } from './tab.model';
import { TabDataDescriptor } from '../descriptors/tab-data.descriptor';
import { ITabActionsSynchronizer } from '../tabs-new/tabs.common';
import { AlertModel } from './alert.model';
import { TABS_LOGO_ACTION, TABS_ADD_TAB_ACTION, MODEL_CHANGED, OPEN_NEW_DDF_TAB_FROM_VALIDATOR } from '../../constants';
import { MessageService } from '../../message.service';
import { FreshenerService } from '../tab-freshener/freshener.service';

import 'rxjs/add/observable/fromEvent';
import 'rxjs/add/observable/combineLatest';
import 'rxjs/add/operator/take';
import { ElectronService } from '../../providers/electron.service';

declare const d3: any;

@Component({
  selector: 'app-tabs',
  templateUrl: './tabs.component.html'
})
export class TabsComponent implements OnInit {
  @Input() public tabsModel: TabModel[] = [];
  @Input() public disabled: boolean;
  @Output() public onTabsInit: EventEmitter<any> = new EventEmitter();
  @Output() public onTabRemoved: EventEmitter<any> = new EventEmitter();
  @Output() public onTabReady: EventEmitter<any> = new EventEmitter();
  @Output() public onTabSetActive: EventEmitter<any> = new EventEmitter();
  @Output() public onChartCreated: EventEmitter<any> = new EventEmitter();
  @Output() public onChartChanged: EventEmitter<any> = new EventEmitter();
  @Output() public onChartClicked: EventEmitter<any> = new EventEmitter();

  public tabDataDescriptor: TabDataDescriptor = {};

  public constructor(
    private chartService: ChartService,
    private messageService: MessageService,
    private freshenerService: FreshenerService,
    private es: ElectronService
  ) {
  }

  @HostListener('window:focus')
  onFocus(): void {
    this.freshenerService.checkCurrentTabModification(this.getCurrentTab());
  }

  public ngOnInit(): void {
    this.es.ipcRenderer.send('get-app-path');
    this.es.ipcRenderer.send('get-versions-info');
    this.es.ipcRenderer.send('get-dev-mode');
    this.es.ipcRenderer.send('get-app-arguments');

    const gotAppPathStream = Observable
      .fromEvent(this.es.ipcRenderer, 'got-app-path', (event: any, path: string) => path);
    const devModeStream = Observable
      .fromEvent(this.es.ipcRenderer, 'got-dev-mode', (event: any, isDevMode: boolean) => isDevMode);
    const appArgumentsStream = Observable
      .fromEvent(this.es.ipcRenderer, 'got-app-file-argument', (event: any, appArguments: string[]) => appArguments);

    Observable.combineLatest(
      gotAppPathStream,
      devModeStream,
      appArgumentsStream
    ).take(1).subscribe((result: any[]) => {
      let fileName = null;

      result.forEach((resultRecord: any) => {
        if (typeof resultRecord === 'string') {
          this.chartService.ddfFolderDescriptor.electronPath = resultRecord;
        }

        if (typeof resultRecord === 'boolean') {
          this.chartService.isDevMode = resultRecord;
        }

        if (typeof resultRecord === 'object') {
          fileName = resultRecord.fileName;
        }
      });

      if (!fileName) {
        this.chartService.ddfFolderDescriptor.defaults();
        this.chartService.setReaderDefaults(this.tabDataDescriptor);
        this.chartService.initTab(this.tabsModel);
        this.onTabsInit.emit();
      }

      if (fileName) {
        this.es.ipcRenderer.send('open-file-after-start');
      }
    });

    this.messageService.getMessage().subscribe((event: any) => {
      if (event.message === TABS_LOGO_ACTION) {
        this.openGapminder();
      }

      if (event.message === TABS_ADD_TAB_ACTION) {
        this.newTab();
      }

      if (event.message === OPEN_NEW_DDF_TAB_FROM_VALIDATOR) {
        /*this.chartService.setReaderDefaults(this.chartService.ddfFolderDescriptor);
        this.chartService.ddfFolderDescriptor.ddfUrl = event.options.ddfPath;

        const newTab = new TabModel(event.options.chartType, false);

        this.chartService.newChart(newTab, this.chartService.ddfFolderDescriptor, false);
        this.tabsModel.forEach((tab: TabModel) => tab.active = false);

        newTab.active = true;

        this.tabsModel.push(newTab);*/
      }
    });
  }

  public getSyncActions(): ITabActionsSynchronizer {
    return {
      onSetTabActive: (index: number) => {
        this.tabsModel.forEach((tab: TabModel) => tab.active = false);
        this.tabsModel[index].active = true;
        this.onTabSetActive.emit();
      },
      onTabRemove: (index: number) => {
        this.tabsModel.splice(index, 1);
        this.onTabRemoved.emit();
        this.sendCurrentPathToFreshener();

        this.messageService.sendMessage(MODEL_CHANGED);
      },
      onTabChanged: (tabDescriptor: any, index: number) => {
        this.tabsModel[index].title = tabDescriptor.title;
      }
    };
  }

  public getCurrentTab(): TabModel {
    return this.tabsModel.find((tab: TabModel) => tab.active);
  }

  public newTab(): void {
    if (!this.disabled) {
      this.chartService.initTab(this.tabsModel);
    }
  }

  public selectTab(tab: TabModel): void {
    if (!this.disabled) {
      tab.active = true;

      this.freshenerService.checkCurrentTabModification(tab);
      this.forceResize();
    }
  }

  public sendCurrentPathToFreshener(): void {
    const currentTab = this.getCurrentTab();

    if (currentTab.chartType) {
      this.freshenerService.checkCurrentTabModification(currentTab);
    }
  }

  public deselectTab(tab: TabModel): void {
    if (!this.disabled) {
      tab.active = false;
    }
  }

  public removeTab(data?: any): void {
    if (!this.disabled) {
      this.forceResize();

      setTimeout(() => {
        if (this.tabsModel.length <= 0) {
          this.chartService.initTab(this.tabsModel);
          this.onTabsInit.emit();
        }
      }, 300);
    }
  }

  public selectChart(chartType: string, isDefault: boolean = true): void {
    const tab = this.getCurrentTab();
    tab.chartType = chartType;

    if (isDefault) {
      this.defaultChart();
    }
  }

  public openGapminder(): void {
    this.es.shell.openExternal('http://www.gapminder.org');
  }

  private defaultChart(): void {
    this.chartService.newChart(this.getCurrentTab(), this.tabDataDescriptor);
    this.es.ipcRenderer.send('new-chart', this.getCurrentTab().chartType);
  }

  private forceResize(): void {
    setTimeout(() => {
      const event: any = document.createEvent('HTMLEvents');

      event.initEvent('resize', true, true);
      event.eventName = 'resize';
      event.force = true;
      window.dispatchEvent(event);
    }, 10);
  }

  private chartCreated(data: any, tab: TabModel): void {
    this.chartService.log('chartCreated', data);
    tab.component = data.model;
    tab.instance = data.component;
    this.sendCurrentPathToFreshener();
    this.onChartCreated.emit();
  }

  private redefineHrefs(): void {
    d3.selectAll('.vzb-dialogs-dialog, .vzb-data-warning-box, .vzb-tool-datanotes').selectAll('a').each(function () {
      const view = d3.select(this);
      const href = view.attr('_href') || view.attr('href');

      view
        .attr('_href', href)
        .attr('target', null)
        .attr('href', '#')
        .on('click', () => {
          this.es.shell.openExternal(href);
        });
    });
  }

  private ready(data: any, tab: TabModel): void {
    this.onTabReady.emit({data, tab});
  }

  private chartChanged(data: any, tab: TabModel): void {
    tab.component = data.component;

    this.onChartChanged.emit();
    this.redefineHrefs();
    this.chartService.log('chartChanged', data);
  }

  private clickHandler(event: any): void {
    this.chartService.log('chart clickHandler', event);
  }

  private errorHandler(error: Error): void {
    console.log(error);
  }
}
