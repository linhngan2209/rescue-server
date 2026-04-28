// src/common/interceptors/timezone.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class TimezoneInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map(data => this.convertDatesToKST(data))
    );
  }

  private convertDatesToKST(obj: any): any {
    if (obj instanceof Date) {
      const offset = 9 * 60; 
      const kstDate = new Date(obj.getTime() + (offset * 60 * 1000));
      return kstDate.toISOString().replace('Z', '+09:00');
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.convertDatesToKST(item));
    }
    
    if (obj && typeof obj === 'object' && obj.constructor === Object) {
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.convertDatesToKST(value);
      }
      return result;
    }
    
    return obj;
  }
}