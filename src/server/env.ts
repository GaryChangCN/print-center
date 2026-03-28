export const config = {
  port: Number(process.env.SERVER_PORT || process.env.PORT || 3000),
  cupsServer: process.env.CUPS_SERVER || 'http://localhost:631',
  printerName: process.env.PRINTER_NAME || 'Brother_DCP-1618W',
  dataDir: process.env.DATA_DIR || './data',
  maxFileSize: Number(process.env.MAX_FILE_SIZE || 50) * 1024 * 1024, // MB -> bytes
  historyRetentionDays: Number(process.env.HISTORY_RETENTION_DAYS || 30),
  mockMode: process.env.MOCK_MODE === 'true',
}
