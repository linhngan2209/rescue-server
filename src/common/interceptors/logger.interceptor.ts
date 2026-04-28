import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggerInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggerInterceptor.name);
  
  private readonly sensitiveFields = [
    'password',
    'newPassword',
    'currentPassword',
    'passwordConfirmation',
    'token',
    'accessToken',
    'refreshToken',
    'authorization',
    'apiKey',
    'secret',
    'credential',
    'credit_card',
    'cardNumber',
    'cvv',
    'ssn',
  ];

  private readonly sensitiveHeaders = [
    'authorization',
    'x-api-key',
    'api-key',
    'cookie',
    'set-cookie',
  ];

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, params, query } = request;
    const headers = this.filterSensitiveHeaders(request.headers);
    const userAgent = headers['user-agent'] || '';
    const ip = this.getClientIp(request);
    
    this.logger.log(
      `Request: ${method} ${url} - IP: ${ip} - User-Agent: ${userAgent}`
    );

    if (Object.keys(body).length > 0) {
      const filteredBody = this.filterSensitiveData(body);
      this.logger.debug(`Request Body: ${JSON.stringify(filteredBody)}`);
    }

    if (Object.keys(params).length > 0) {
      const filteredParams = this.filterSensitiveData(params);
      this.logger.debug(`Request Params: ${JSON.stringify(filteredParams)}`);
    }

    if (Object.keys(query).length > 0) {
      const filteredQuery = this.filterSensitiveData(query);
      this.logger.debug(`Request Query: ${JSON.stringify(filteredQuery)}`);
    }

    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: (data: any) => {
          const responseTime = Date.now() - startTime;
          this.logger.log(
            `Response: ${method} ${url} - ${context.getHandler().name} - ${responseTime}ms`
          );
          
          if (process.env.NODE_ENV === 'development' && data) {
            const filteredResponseData = this.filterSensitiveData(data);
            const responseDataString = JSON.stringify(filteredResponseData).substring(0, 1000);
            this.logger.debug(`Response Data: ${responseDataString}`);
          }
        },
        error: (error: any) => {
          const responseTime = Date.now() - startTime;
                    this.logger.error(
            `Error: ${method} ${url} - ${context.getHandler().name} - ${responseTime}ms`,
            error.stack
          );
        }
      })
    );
  }

  private filterSensitiveData(data: any): any {
    if (!data) return data;
    if (typeof data === 'string') return data;
    const clonedData = JSON.parse(JSON.stringify(data));  
    this.traverseAndFilterObject(clonedData);   
    return clonedData;
  }
  
 
  private traverseAndFilterObject(obj: any): void {
    if (!obj || typeof obj !== 'object') return;
    
    Object.keys(obj).forEach(key => {
      if (this.isSensitiveField(key)) {
        obj[key] = '[FILTERED]';
      } else if (typeof obj[key] === 'object') {
        this.traverseAndFilterObject(obj[key]);
      }
    });
  }
  
  private isSensitiveField(field: string): boolean {
    return this.sensitiveFields.some(sensitiveField => 
      field.toLowerCase().includes(sensitiveField.toLowerCase())
    );
  }
  
  private filterSensitiveHeaders(headers: any): any {
    const filteredHeaders = { ...headers };
    
    this.sensitiveHeaders.forEach(header => {
      if (filteredHeaders[header]) {
        filteredHeaders[header] = '[FILTERED]';
      }
    });
    
    return filteredHeaders;
  }

  private getClientIp(request: any): string {
    return (
      request.headers['x-forwarded-for']?.split(',')[0] ||
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      request.ip ||
      'unknown'
    );
  }
}