import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { ElectronService } from '../../providers/electron.service';

export interface ProgressDescriptor {
  progress: string | number;
  cacheDir: string;
}

export interface VersionDescriptor {
  actualVersionDsUpdate?: string;
  actualVersionGenericUpdate?: string;
  os: string;
  arch: string;
}

@Component({
  selector: 'app-auto-update',
  templateUrl: './auto-update.component.html',
  styleUrls: ['./auto-update.component.css']
})
export class AutoUpdateComponent implements OnInit {
  @Output() onAutoUpdateRequested: EventEmitter<any> = new EventEmitter();
  @Output() onAutoUpdateProgress: EventEmitter<any> = new EventEmitter();
  @Output() onAutoUpdateCompleted: EventEmitter<any> = new EventEmitter();

  public requestToUpdate = false;
  public requestToDatasetUpdate = false;
  public requestToProgress = false;
  public requestToExitAndFinishUpdate = false;
  public max = 200;
  public progress = 0;
  public error = false;
  public versionDescriptor: VersionDescriptor;
  /* todo: try to use it later */
  public downloadLinks: any = {
    linux: 'https://s3-eu-west-1.amazonaws.com/gapminder-offline/Gapminder%20Offline-linux.zip',
    darwin: 'https://s3-eu-west-1.amazonaws.com/gapminder-offline/Install%20Gapminder%20Offline.dmg',
    win32x64: 'https://s3-eu-west-1.amazonaws.com/gapminder-offline/Install%20Gapminder%20Offline-64.exe',
    win32ia32: 'https://s3-eu-west-1.amazonaws.com/gapminder-offline/Install%20Gapminder%20Offline-32.exe'
  };

  private progressMap: Map<string, ProgressDescriptor> = new Map<string, ProgressDescriptor>();

  constructor(private es: ElectronService) {
  }

  public ngOnInit(): void {
    this.es.ipcRenderer.send('check-version');

    this.es.ipcRenderer.on('request-and-update', (event: any, versionDescriptor: VersionDescriptor) => {
      this.versionDescriptor = versionDescriptor;

      if (versionDescriptor.actualVersionGenericUpdate) {
        this.requestToUpdate = true;
        this.processUpdateRequest(versionDescriptor.actualVersionGenericUpdate);
      }
    });

    this.es.ipcRenderer.on('request-to-update', (event: any, versionDescriptor: VersionDescriptor) => {
      this.versionDescriptor = versionDescriptor;

      if (versionDescriptor.actualVersionDsUpdate || versionDescriptor.actualVersionGenericUpdate) {
        this.max = versionDescriptor.actualVersionDsUpdate && versionDescriptor.actualVersionGenericUpdate ? 400 : 200;
        this.requestToDatasetUpdate = versionDescriptor.actualVersionDsUpdate && !versionDescriptor.actualVersionGenericUpdate;
        this.requestToUpdate = true;
        this.onAutoUpdateRequested.emit();
      }
    });

    /*ipc.on('request-to-ds-update', (event: any, version: string) => {
      if (version) {
        this.requestToDatasetUpdate = true;
        this.onAutoUpdateRequested.emit();
      }
    });*/

    this.es.ipcRenderer.on('download-progress', (event: any, progressDescriptor: ProgressDescriptor) => {
      progressDescriptor.progress = Number(progressDescriptor.progress);

      this.progressMap.set(progressDescriptor.cacheDir, progressDescriptor);
      this.progress = this.getTotalProgress();
      this.onAutoUpdateProgress.emit();
    });

    this.es.ipcRenderer.on('unpack-progress', (event: any, progressDescriptor: ProgressDescriptor) => {
      progressDescriptor.progress = Number(progressDescriptor.progress) + 100;

      this.progressMap.set(progressDescriptor.cacheDir, progressDescriptor);
      this.progress = this.getTotalProgress();
      this.onAutoUpdateProgress.emit();
    });

    this.es.ipcRenderer.on('unpack-complete', (event: any, error: string) => {
      if (error) {
        console.log(error);
      }

      this.requestToProgress = false;
      this.requestToExitAndFinishUpdate = true;
      this.onAutoUpdateCompleted.emit();
    });

    this.es.ipcRenderer.on('auto-update-error', () => {
      this.error = true;
      this.requestToProgress = false;
      this.onAutoUpdateRequested.emit();
    });
  }

  public processUpdateRequest(version?: string): void {
    this.es.ipcRenderer.send('prepare-update', version);
    this.resetUpdateRequest();

    this.requestToProgress = true;
    this.progressMap.clear();
    this.onAutoUpdateRequested.emit();
  }

  public resetUpdateRequest(): void {
    this.requestToUpdate = false;
  }

  public processExitAndFinishUpdateRequest(): void {
    this.es.ipcRenderer.send('exit-and-update');
  }

  public resetError(): void {
    this.error = false;
  }

  public openURL(url: string): void {
    this.es.shell.openItem(url);
  }

  public cancel(): void {
    this.requestToUpdate = false;
    this.requestToDatasetUpdate = false;
  }

  private getTotalProgress(): number {
    const progressMapValues = Array.from(this.progressMap.values());

    return progressMapValues.reduce((currentProgress: number, progressDescriptor: ProgressDescriptor) =>
      currentProgress + (progressDescriptor.progress as number), 0);
  }
}
