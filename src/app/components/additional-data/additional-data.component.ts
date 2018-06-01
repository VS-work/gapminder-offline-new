import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { IAdditionalDataItem } from '../descriptors/additional-data-item.descriptor';
import { ChartService } from '../tabs/chart.service';

@Component({
  selector: 'app-additional-data',
  templateUrl: './additional-data.component.html'
})
export class AdditionalDataComponent implements OnInit {
  @Output() additionalData: EventEmitter<any> = new EventEmitter();

  data: IAdditionalDataItem[] = [];
  pathToAdd: string;
  readerToAdd: string;

  ngOnInit() {
    this.resetDataToAdd();
  }

  onReaderSelect(value: string) {
    this.readerToAdd = value;
  }

  resetDataToAdd() {
    this.readerToAdd = 'csv';
    this.pathToAdd = '';
  }

  addNewItem() {
    if (this.pathToAdd) {
      this.data.push({reader: this.readerToAdd, path: this.pathToAdd});
      this.additionalData.emit(this.data);

      this.resetDataToAdd();
    }
  }

  onFileChanged(event: any) {
    const selectedFile = ChartService.getFirst(event.srcElement.files);

    if (selectedFile) {
      this.pathToAdd = selectedFile.path;

      this.addNewItem();
    }
  }

  deleteAdditionalItem(itemToDelete: IAdditionalDataItem) {
    const index = this.data.indexOf(itemToDelete);

    if (index >= 0) {
      this.data.splice(index, 1);
    }
  }
}
