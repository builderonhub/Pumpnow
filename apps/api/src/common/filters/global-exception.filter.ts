import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(error: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();
    const status =
      error instanceof HttpException
        ? error.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload =
      error instanceof HttpException
        ? error.getResponse()
        : 'Internal server error';
    if (status >= 500)
      this.logger.error(error instanceof Error ? error.stack : String(error));
    response.status(status).json({
      statusCode: status,
      error: payload,
      path: request.originalUrl,
      timestamp: new Date().toISOString(),
    });
  }
}
