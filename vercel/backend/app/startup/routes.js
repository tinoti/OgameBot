'use strict'

const router = require('express').Router({})

const express = require("express")
const logger = require('../src/util/logger')
const error = require('../middleware/error')

const attackRoutes = require("../src/routes/attack")


const morganFormat = process.env.MORGAN_LOG_FORMAT || 'dev'

module.exports = (app) => {
  app.use((req, res, next) => {
    // Log every request
    logger.info(`Requested resource: ${req.method} ${req.protocol}://${req.get('host')}${req.originalUrl} | Request-Id: ${req.headers['request-id']}`)

    // Continue the req/res cycle
    next()
  })

  app.use(express.json({ limit: '50mb' }))
  app.use(express.urlencoded({ limit: '50mb', extended: true }))


  app.use('/bot', router)


  attackRoutes(router)

  // Handle invalid requests
  app.use((req, res, next) => {
    logger.debug(`Handle invalid request ${JSON.stringify(req.headers)}`)

    return res.status(404).json({
      errors: [
        {
          status: '404',
          title: 'Resource not found!'
        }
      ]
    })
  })
  // Default handling for all kinds of error
  app.use(error)
}
