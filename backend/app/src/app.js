'use strict'

const http = require('http')
const express = require('express')
const logger = require('./util/logger')
const commonUtil = require('./util/common')
const cors = require("cors")

const app = express()
const server = http.createServer(app)
require('express-async-errors')

app.use(cors())
//Login to ogame server and setup puppeteer
require('../startup/routes')(app)
require("../startup/bot").doLogin()

const port = commonUtil.normalizePort(process.env.PORT || '3031')
app.set('port', port)
if (process.env.APP_ENV === 'undefined') {
  throw Error('App environment not defined')
}

logger.debug(`Log level set to ${process.env.LOG_LEVEL}`)

server.on('error', (error) => {
  if (error.syscall !== 'listen') {
    throw error
  }

  const bind = typeof port === 'string'
    ? `Pipe ${port}`
    : `Port ${port}`

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      logger.error(`${bind} requires elevated privileges`)
      process.exit(1)
    case 'EADDRINUSE':
      logger.error(`${bind} is already in use`)
      process.exit(1)
    default:
      throw error
  }
})
server.listen(port, () => {
  const address = server.address()
  const bind = typeof address === 'string'
    ? 'pipe ' + address
    : 'port ' + address.port
  logger.info(`OgameBot listening on ${bind} | PID: ${process.pid}`)
})
