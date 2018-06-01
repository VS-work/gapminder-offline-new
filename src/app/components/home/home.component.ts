import * as waterfall from 'async-waterfall';
import { isEmpty } from 'lodash';
import {
  Component,
  OnInit,
  ViewChild,
  ElementRef,
  ViewContainerRef,
  ChangeDetectorRef
} from '@angular/core';
import { Subscription } from 'rxjs/Subscription';
import { ModalDirective } from 'ngx-bootstrap';
import { ChartService } from '../tabs/chart.service';
import { TabModel } from '../tabs/tab.model';
import { MessageService } from '../../message.service';
import {
  CLEAR_EDITABLE_TABS_ACTION,
  OPEN_DDF_FOLDER_ACTION,
  TAB_READY_ACTION,
  SWITCH_MENU_ACTION,
  MODEL_CHANGED, CLEAR_VALIDATION_FORM, ABANDON_VALIDATION
} from '../../constants';
import { initMenuComponent } from '../menu/system-menu';
import { getMenuActions } from '../menu/menu-actions';
import { FreshenerService } from '../tab-freshener/freshener.service';
import Menu = Electron.Menu;
import { ElectronService } from '../../providers/electron.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html'
})
export class HomeComponent implements OnInit {
  public tabsModel: TabModel[] = [];
  public isMenuOpened = false;
  public menuComponent: Menu;
  public menuActions: any = {};

  @ViewChild('ddfModal') public ddfModal: ModalDirective;
  @ViewChild('additionalDataModal') public additionalDataModal: ModalDirective;
  @ViewChild('presetsModal') public presetsModal: ModalDirective;
  @ViewChild('versionsModal') public versionsModal: ModalDirective;
  @ViewChild('validationModal') public validationModal: ModalDirective;
  @ViewChild('ddfDatasetConfigModal') public ddfDatasetConfigModal: ModalDirective;
  @ViewChild('csvConfigModal') public csvConfigModal: ModalDirective;
  @ViewChild('additionalCsvConfigModal') public additionalCsvConfigModal: ModalDirective;
  @ViewChild('addDdfFolder') public addDdfFolderInput: ElementRef;
  public tabsDisabled = false;

  public constructor(
    public chartService: ChartService,
    private viewContainerRef: ViewContainerRef,
    private messageService: MessageService,
    private freshenerService: FreshenerService,
    private ref: ChangeDetectorRef,
    private es: ElectronService
  ) {
    this.menuActions = getMenuActions(this, es);

    initMenuComponent(this, es);
  }

  public ngOnInit(): void {
    this.messageService.getMessage()
      .subscribe((event: any) => {
        if (event.message === OPEN_DDF_FOLDER_ACTION) {
          /*this.ddfDatasetConfigModal.hide();

          if (event.options && event.options.selectedFolder && event.options.chartType) {
            const firstFilePath = event.options.selectedFolder;

            if (firstFilePath) {
              this.chartService.ddfFolderDescriptor.ddfUrl = firstFilePath;
              this.chartService.setReaderDefaults(this.chartService.ddfFolderDescriptor);

              const newTab = new TabModel(event.options.chartType, false);
              const chartIssue = this.chartService.newChart(newTab, this.chartService.ddfFolderDescriptor, false);

              this.tabsModel.forEach((tab: TabModel) => tab.active = false);

              newTab.active = true;

              this.tabsModel.push(newTab);

              if (chartIssue) {
                remote.dialog.showErrorBox('Error',
                  `Could not open DDF folder ${this.chartService.ddfFolderDescriptor.ddfUrl}, because ${chartIssue}`);
              }

              ipcRenderer.send('new-chart', this.getCurrentTab().chartType + ' by DDF folder');
              this.doDetectChanges();
            }
          }*/
        }

        if (event.message === SWITCH_MENU_ACTION) {
          this.switchMenu();
        }

        if (event.message === MODEL_CHANGED) {
          this.dataItemsAvailability();
          this.doDetectChanges();
        }
      });

    this.es.ipcRenderer.on('do-open-completed', (event: any, parameters: any) => {
      this.doOpenCompleted(event, parameters);
    });

    this.es.ipcRenderer.on('do-open-all-completed', (event: any, parameters: any) => {
      this.doOpenAllCompleted(event, parameters);
    });

    this.es.ipcRenderer.on('check-tab-by-default', () => {
      if (this.tabsModel.length <= 0) {
        this.chartService.initTab(this.tabsModel);
        this.doDetectChanges();
      }
    });

    this.dataItemsAvailability();
  }

  public onMenuItemSelected(methodName: string): void {
    this.menuActions[methodName]();
  }

  public dataItemsAvailability(): void {
    /*const currentTab = this.getCurrentTab();
    const isItemEnabled = !!currentTab && !!currentTab.chartType;
    const fileMenu = this.menuComponent.items[0].submenu;
    const menuAddYourData = fileMenu.items[1];
    const csvFileItem = menuAddYourData.submenu.items[0];
    const ddfFolderItem = menuAddYourData.submenu.items[1];
    const saveMenu = fileMenu.items[4];
    const saveAllTabs = fileMenu.items[5];
    const exportMenu = fileMenu.items[7];

    csvFileItem.enabled = isItemEnabled;
    ddfFolderItem.enabled = isItemEnabled;
    saveMenu.enabled = isItemEnabled;
    exportMenu.enabled = isItemEnabled;

    saveAllTabs.enabled = this.areChartsAvailable();*/
  }

  public areChartsAvailable(): boolean {
    return this.chartService.areChartsAvailable(this.tabsModel);
  }

  public getCurrentTab(): TabModel {
    return this.chartService.getCurrentTab(this.tabsModel);
  }

  public appMainClickHandler(event: any): void {
    if (this.isMenuOpened) {
      const elementTarget = event.target;
      const elementMenu = document.getElementsByClassName('btn-group')[0];

      if (!elementMenu.contains(elementTarget)) {
        this.isMenuOpened = false;
      }
    }

    this.messageService.sendMessage(CLEAR_EDITABLE_TABS_ACTION, event);
  }

  public switchMenu(): void {
    if (!this.tabsDisabled) {
      this.isMenuOpened = !this.isMenuOpened;
    }
  }

  public versionsFormComplete(version?: string): void {
    if (version) {
      this.es.ipcRenderer.send('request-custom-update', version);
      this.versionsModal.hide();
    }
  }

  public onValidationModalHide(): void {
    this.messageService.sendMessage(ABANDON_VALIDATION);
    this.messageService.sendMessage(CLEAR_VALIDATION_FORM);
  }

  public validationFormComplete(): void {
    this.messageService.sendMessage(ABANDON_VALIDATION);
    this.validationModal.hide();
  }

  public onChartCreated(): void {
    this.dataItemsAvailability();
  }

  public addData(data: any): void {
    const currentTab = this.getCurrentTab();
    const pathDoesNotExist = isEmpty(currentTab.additionalData.filter((item: any) => item.path === data.path));

    let newAdditionalData = [];

    if (pathDoesNotExist) {
      newAdditionalData.push(data);
    } else {
      newAdditionalData = currentTab.additionalData.map((item: any) => item.path === data.path ? data : item);
    }

    currentTab.additionalData = newAdditionalData;

    this.chartService.log('add data', data, currentTab.additionalData);

    this.es.ipcRenderer.send('modify-chart', `user data was added to ${currentTab.chartType}`);
  }

  public onDdfExtFolderChanged(filePaths: string[]): void {
    const firstFilePath = ChartService.getFirst(filePaths);

    if (firstFilePath) {
      this.addData({reader: 'ddf1-csv-ext', path: firstFilePath});
      this.doDetectChanges();
    }
  }

  public doOpenCompleted(event: any, parameters: any): void {
    this.tabsDisabled = true;

    const subscription: Subscription = this.messageService.getMessage().subscribe((tabEvent: any) => {
      if (tabEvent.message === TAB_READY_ACTION) {
        setTimeout(() => {
          subscription.unsubscribe();

          this.tabsDisabled = false;
          this.doDetectChanges();
        }, 1000);
      }
    });

    const config = parameters.tab;
    const newTab = new TabModel(config.chartType, true, parameters.file);

    delete config.bind;
    delete config.chartType;

    newTab.model = config;

    this.chartService.setReaderDefaults(newTab);
    this.tabsModel.forEach((tab: TabModel) => tab.active = false);
    this.tabsModel.push(newTab);
    this.doDetectChanges();

    this.es.ipcRenderer.send('menu', 'new chart was opened');
  }

  public doOpenAllCompleted(event: any, tabsDescriptor: any): void {
    this.tabsDisabled = true;

    const actions = tabsDescriptor.map((tabDescriptor: any) => (onChartReady: Function) => {
      const subscription: Subscription = this.messageService.getMessage().subscribe((tabEvent: any) => {
        if (tabEvent.message === TAB_READY_ACTION) {
          setTimeout(() => {
            subscription.unsubscribe();
            this.doDetectChanges();

            onChartReady(null);
          }, 1000);
        }
      });

      const newTab = new TabModel(tabDescriptor.type, true, tabDescriptor.title);

      delete tabDescriptor.model.bind;
      delete tabDescriptor.model.type;

      newTab.model = tabDescriptor.model;

      this.chartService.setReaderDefaults(newTab);
      this.tabsModel.forEach((tab: TabModel) => tab.active = false);
      this.tabsModel.push(newTab);

      this.doDetectChanges();
    });

    waterfall(actions, () => {
      this.tabsDisabled = false;

      this.doDetectChanges();

      this.es.ipcRenderer.send('menu', 'charts was opened');
    });
  }

  public completeCsvConfigForm(event: any): void {
    this.csvConfigModal.hide();

    if (event) {
      this.chartService.newSimpleChart(this.tabsModel, event, () => {
        this.doDetectChanges();
      });

      this.es.ipcRenderer.send('new-chart', 'Simple chart: json based');
    }
  }

  public additionalCsvConfigFormComplete(data: any): void {
    this.additionalCsvConfigModal.hide();

    if (data) {
      this.addData(data);
    }
  }

  public onAdditionalCsvConfigModalShown(): void {
    this.chartService.currentTab = this.getCurrentTab();
  }

  public doDetectChanges(): void {
    this.dataItemsAvailability();
    this.ref.detectChanges();
  }

  public onTabReady(): void {
    this.messageService.sendMessage(TAB_READY_ACTION);
  }
}
