import { validate, StreamValidator, createDataPackage, getDataPackageInfo } from 'ddf-validation';

export class DdfValidatorWrapper {
  event;
  params;
  validator;

  start(event, params) {
    this.event = event;
    this.params = params;

    const {exists} = getDataPackageInfo(this.params.ddfFolder);

    if (!exists || (exists && this.params.dataPackageMode === this.params.createNewDataPackage)) {
      const dataPackageCreationParameters = {
        ddfRootFolder: params.ddfFolder,
        newDataPackagePriority: true,
        externalSettings: this.params.options
      };
      createDataPackage(dataPackageCreationParameters, message => {
        this.event.sender.send('validation-message', message);
      }, error => {
        if (error) {
          this.event.sender.send('validation-error', error);
          return;
        }

        this.validationProcess();
      });
    } else {
      this.validationProcess();
    }
  }

  validationProcess() {
    this.validator = new StreamValidator(this.params.ddfFolder, this.params.options);

    this.validator.onMessage(message => {
      this.event.sender.send('validation-message', message);
    });

    this.validator.on('issue', issue => {
      this.event.sender.send('validation-issue', issue);
    });

    this.validator.on('finish', err => {
      if (err) {
        this.event.sender.send('validation-error', err);
      }

      this.event.sender.send('validation-completed', {
        doesValidationRunning: false,
        isResultReady: !this.validator.isAbandoned()
      });
    });

    validate(this.validator);
  }

  abandon() {
    if (this.validator && this.validator.abandon) {
      this.validator.abandon();
    }
  }
}
