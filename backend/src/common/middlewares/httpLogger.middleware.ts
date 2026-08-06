import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { Injectable, Logger, NestMiddleware } from '@nestjs/common';

@Injectable()
export class HttpLogger implements NestMiddleware {
  // Reused across every request instead of constructing a new Logger per
  // response — the original created one inside the `finish` handler, so
  // every single request paid that construction cost for no reason.
  private readonly logger = new Logger('HttpLogger');

  use(request: Request, response: Response, next: NextFunction): void {
    const startAt = process.hrtime();
    const { ip, method, originalUrl } = request;
    const userAgent = request.get('user-agent') || '-';

    // Correlation ID: reuse an inbound x-request-id if a proxy/gateway
    // already set one, otherwise mint one. Attached to both the request
    // (so downstream handlers/services can pick it up via
    // request.requestId) and the response header (so the client — or logs
    // on the other side of a proxy — can correlate this exact request).
    const requestId =
      (request.get('x-request-id') as string | undefined) || randomUUID();
    (request as Request & { requestId: string }).requestId = requestId;
    response.setHeader('x-request-id', requestId);

    // A connection can end via 'close' (client disconnected, proxy timed
    // out, etc.) without 'finish' ever firing (which only fires once
    // Express has actually flushed a response). Listening to both means
    // aborted requests still get logged instead of silently vanishing —
    // but both can in principle fire for the same request, so `logged`
    // guards against double-logging the same request twice.
    let logged = false;
    const logOnce = (aborted: boolean) => {
      if (logged) return;
      logged = true;

      const { statusCode } = response;
      const contentLength = response.get('content-length') || '-';
      const diff = process.hrtime(startAt);
      const responseTimeMs = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(1);

      const message = `${method} ${originalUrl} ${
        aborted ? 'ABORTED' : statusCode
      } ${responseTimeMs}ms ${contentLength} - ${userAgent} ${ip} [${requestId}]`;

      if (aborted) {
        this.logger.warn(message);
      } else if (statusCode >= 500) {
        this.logger.error(message);
      } else if (statusCode >= 400) {
        this.logger.warn(message);
      } else {
        this.logger.log(message);
      }
    };

    response.on('finish', () => logOnce(false));
    response.on('close', () => {
      if (!response.writableEnded) {
        logOnce(true);
      }
    });

    next();
  }
}