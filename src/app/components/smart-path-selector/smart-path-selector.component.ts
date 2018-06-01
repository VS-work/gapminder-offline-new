import {
  AfterContentChecked,
  Component,
  ElementRef,
  EventEmitter,
  forwardRef,
  Input,
  Output,
  ViewChild
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, NG_VALIDATORS, FormControl, Validator } from '@angular/forms';
import { ChartService } from '../tabs/chart.service';
import { ElectronService } from '../../providers/electron.service';

@Component({
  selector: 'app-smart-path-selector',
  templateUrl: './smart-path-selector.component.html',
  styleUrls: ['./smart-path-selector.component.css'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SmartPathSelectorComponent),
      multi: true
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => SmartPathSelectorComponent),
      multi: true
    }]
})
export class SmartPathSelectorComponent implements ControlValueAccessor, Validator, AfterContentChecked {
  @Input() public isDirectory: boolean;
  @Input() public title = 'Choose CSV file';
  @Input() public accept = '.csv';
  @Input() public clearValueAfterHide: boolean;
  @Output() public done: EventEmitter<any> = new EventEmitter();
  @ViewChild('uploadBtn') public uploadBtn: ElementRef;
  @ViewChild('uploadFileInput') public uploadFileInput: ElementRef;
  public directory = '';
  public file = '';
  public fileDoesNotExistsError: boolean;
  public data: any;

  private filePath = '';
  private lastModified: number;

  constructor(private es: ElectronService) {
  }

  public ngAfterContentChecked(): void {
    if (!this.clearValueAfterHide) {
      return;
    }

    if (this.uploadFileInput && this.uploadFileInput.nativeElement && !this.uploadFileInput.nativeElement.offsetParent) {
      this.uploadFileInput.nativeElement.value = '';
      this.directory = '';
      this.file = '';
      this.fileDoesNotExistsError = false;
    }
  }

  public writeValue(obj: any): void {
    if (obj) {
      this.data = obj;
      this.prepareResultIfOk(this.data);
    }
  }

  public registerOnChange(fn: any): void {
  }

  public validate(c: FormControl): any {
    return (!this.fileDoesNotExistsError) ? null : {
      fileExistsError: {
        valid: false
      }
    };
  }

  public registerOnTouched(): void {
  }

  public onChange(event: any): void {
    const newValue = this.filePath ? this.es.path.resolve(this.filePath, event.target.value) : event.target.value;

    try {
      const stats = this.es.fs.statSync(newValue);

      this.data = newValue;
      this.lastModified = stats.mtime.valueOf();
      this.fileDoesNotExistsError = this.isDirectory ? !stats.isDirectory() : !stats.isFile();
    } catch (err) {
      this.fileDoesNotExistsError = true;
    }

    this.prepareResultIfOk(newValue);
  }

  public onCsvFileChanged(event: any): void {
    const selectedFile = ChartService.getFirst(event.srcElement.files);

    if (selectedFile) {
      this.uploadFileInput.nativeElement.value = selectedFile.path;
      this.uploadFileInput.nativeElement.dispatchEvent(new Event('input'));
      this.onChange({target: {value: selectedFile.path}});
      this.uploadBtn.nativeElement.value = '';
    }
  }

  private prepareResultIfOk(fileOrDirectory: string): void {
    if (!this.fileDoesNotExistsError) {
      if (this.isDirectory) {
        this.directory = fileOrDirectory;
        this.done.emit({file: fileOrDirectory, lastModified: this.lastModified});
      } else {
        const fileDescriptor = this.es.path.parse(fileOrDirectory);
        this.file = fileDescriptor.base;
        this.filePath = fileDescriptor.dir;
        this.done.emit({file: fileOrDirectory, lastModified: this.lastModified});
      }
    } else {
      this.file = fileOrDirectory;
      this.filePath = '';
      this.done.emit();
    }
  }
}
