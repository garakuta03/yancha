export type LogLevel = "debug" | "info" | "warn" | "error";

const levelPriority: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

export class Logger {
  constructor(private readonly level: LogLevel) {}

  debug(message: string, context?: Record<string, unknown>): void {
    this.write("debug", message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.write("info", message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.write("warn", message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.write("error", message, context);
  }

  private write(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (levelPriority[level] < levelPriority[this.level]) {
      return;
    }

    const payload = context === undefined ? "" : ` ${JSON.stringify(context)}`;
    const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}${payload}`;

    if (level === "error") {
      console.error(line);
      return;
    }
    console.log(line);
  }
}
