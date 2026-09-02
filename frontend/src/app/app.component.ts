import { Component } from '@angular/core';
import { ProcessFormComponent } from './components/process-form/process-form.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ProcessFormComponent],
  template: `<app-process-form />`,
})
export class AppComponent {}
