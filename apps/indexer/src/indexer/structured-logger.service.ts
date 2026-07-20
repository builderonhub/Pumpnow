import { Injectable } from "@nestjs/common";

@Injectable()
export class StructuredLogger {
  info(event: string, fields: Record<string, unknown> = {}): void {
    process.stdout.write(
      `${JSON.stringify({ level: "info", event, ...fields, timestamp: new Date().toISOString() })}\n`,
    );
  }

  error(
    event: string,
    error: unknown,
    fields: Record<string, unknown> = {},
  ): void {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(
      `${JSON.stringify({ level: "error", event, message, ...fields, timestamp: new Date().toISOString() })}\n`,
    );
  }
}
