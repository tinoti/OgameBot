"use strict"
const logger = require('../src/util/logger')
const { setupService } = require("../src/services")
const request = require("../src/util/request")


//IIFE so we can await
//Errors in the startup service are not handled since there is no point in the app running if setup failed
;(async () => {
  const cookie = await setupService.login(process.env.EMAIL, process.env.PASSWORD)
  logger.info("Successfully logged in with account: " + process.env.EMAIL)

  const loginUrl = await setupService.getLoginUrl()
  logger.info("Successfully logged in to server: " + loginUrl)

  const page = await setupService.startPuppeteer(loginUrl, cookie)
  request.setPage(page)
  logger.info("Successfully started puppeteer page")
  logger.info("Setup complete!")
})();


