import 'zone.js/dist/zone-mix';
import 'reflect-metadata';
import '../polyfills';
import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { HttpClientModule, HttpClient } from '@angular/common/http';

import { AppRoutingModule } from './app-routing.module';

// NG Translate
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';

import { ElectronService } from './providers/electron.service';

import { WebviewDirective } from './directives/webview.directive';

import { ModalModule, ProgressbarModule, AlertModule } from 'ngx-bootstrap';
import { VizabiModule } from 'ng2-vizabi';

import { AppComponent } from './app.component';
import { HomeComponent } from './components/home/home.component';
import { AutoUpdateComponent } from './components/auto-update/auto-update.component';
import { TabFreshenerComponent } from './components/tab-freshener/tab-freshener.component';
import { HamburgerMenuComponent } from './components/menu/hamburger-menu.component';
import { VersionsFormComponent } from './components/versions-form/versions-form.component';
import { ValidationFormComponent } from './components/validation-form/validation-form.component';
import { DdfDatasetConfigFormComponent } from './components/ddf-dataset-config-form/ddf-dataset-config-form.component';
import { CsvConfigFormComponent } from './components/csv-config-form/csv-config-form.component';
import { TabsNewComponent } from './components/tabs-new/tabs.component';
import { TabNewComponent } from './components/tabs-new/tab.component';
import { TabTitleEditComponent } from './components/tabs-new/tab-title-edit.component';
import { TabsComponent } from './components/tabs/tabs.component';
import { SmartPathSelectorComponent } from './components/smart-path-selector/smart-path-selector.component';
import { ChartService } from './components/tabs/chart.service';
import { MessageService } from './message.service';
import { FreshenerService } from './components/tab-freshener/freshener.service';

// AoT requires an exported function for factories
export function HttpLoaderFactory(http: HttpClient) {
  return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    AutoUpdateComponent,
    TabFreshenerComponent,
    HamburgerMenuComponent,
    VersionsFormComponent,
    ValidationFormComponent,
    DdfDatasetConfigFormComponent,
    CsvConfigFormComponent,
    TabsNewComponent,
    TabNewComponent,
    TabTitleEditComponent,
    TabsComponent,
    SmartPathSelectorComponent,
    WebviewDirective
  ],
  imports: [
    BrowserModule,
    FormsModule,
    HttpClientModule,
    AppRoutingModule,
    AlertModule.forRoot(),
    ModalModule.forRoot(),
    ProgressbarModule.forRoot(),
    TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: (HttpLoaderFactory),
        deps: [HttpClient]
      }
    }),
    VizabiModule
  ],
  providers: [
    ElectronService,
    ChartService,
    MessageService,
    FreshenerService
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
}
