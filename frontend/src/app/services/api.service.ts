import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

import {
  ApiErrorBody,
  HealthResponse,
  ProcessRequest,
  ProcessResponse,
  SamplePreset,
  SampleResponse,
} from '../models/api.interface';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://127.0.0.1:8001';

  health(): Observable<HealthResponse> {
    return this.http
      .get<HealthResponse>(`${this.baseUrl}/health`)
      .pipe(catchError(this.handleError));
  }

  process(request: ProcessRequest): Observable<ProcessResponse> {
    return this.http
      .post<ProcessResponse>(`${this.baseUrl}/api/v1/process`, request)
      .pipe(catchError(this.handleError));
  }

  sample(preset: SamplePreset): Observable<SampleResponse> {
    return this.http
      .get<SampleResponse>(`${this.baseUrl}/api/v1/sample/${preset}`)
      .pipe(catchError(this.handleError));
  }

  private handleError(err: HttpErrorResponse): Observable<never> {
    const body = err.error as ApiErrorBody | undefined;
    let message = `HTTP ${err.status}`;
    if (typeof body?.detail === 'string') {
      message = body.detail;
    } else if (Array.isArray(body?.detail)) {
      message = body.detail.map((e) => e.msg).join('; ');
    }
    return throwError(() => new Error(message));
  }
}
