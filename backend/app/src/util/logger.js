'use strict'

const { createLogger, format, transports } = require('winston')
const fs = require('fs')
const path = require('path')

require('winston-daily-rotate-file')

const env = process.env.APP_ENV || 'local'
const logDir = 'logs'

// Create the log directory if it does not exist
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir)
}

const dailyRotateFileTransport = new transports.DailyRotateFile({
  filename: `${logDir}/%DATE%-results.log`,
  datePattern: 'DD-MM-YYYY'
})

const logger = createLogger({
  // change log level if in local dev environment versus production
  level: env === 'prod' ? 'info' : 'debug',
  format: format.combine(
    format.label({ label: path.basename(require.main.filename) }),
    format.timestamp({ format: 'DD.MM.YYYY HH:mm:ss' }),
    format.errors({ stack: true }),
    format.json()
  ),
  defaultMeta: { service: 'OgameBot' },
  transports: [
    new transports.Console({
      level: process.env.LOG_LEVEL,
      format: format.combine(
        format.colorize({ all: true }),
        format.printf(info => `${info.timestamp} ${info.level} |${info.service}| [${info.label}]: ${info.message}`),
        format.errors({ stack: true })
      ),
      handleExceptions: true
    }),
    dailyRotateFileTransport
  ]
})

module.exports = logger
