'use strict'

const { v4: uuidv4 } = require('uuid');
const logger = require('../src/util/logger')
const errors = require('../enums/errors')

const formatErrorMessage = (errorId, statusCode, message) => {
  return {
    uuid: errorId,
    errors: [
      {
        status: statusCode,
        title: message
      }
    ]
  }
}

module.exports = (error, req, res, next) => {
  const requestId = req.headers['request-id']
  const errorId = uuidv4()
  const statusCode = parseInt('500', 10)

  logger.error(`Error while executing route ${req.method} ${req.url} | RequestId: ${requestId} | ErrorId: ${errorId} | ${error.stack}`)

  return res.status(statusCode).json(formatErrorMessage(errorId, statusCode, errors.GENERIC_ERROR))
}
