"use strict"
const logger = require("../util/logger")
const request = require("../util/request")

const getMessagePage = async (data) => {
  const messagePageUrl = "https://s105-de.ogame.gameforge.com/game/index.php?page=messages"

  return await request.ajaxPost(messagePageUrl, data)
}

const getReportData = async (id) => {
  const reportDataUrl = "https://s105-de.ogame.gameforge.com/game/index.php?page=messages&messageId=" + id + "&tabid=20&ajax=1"

  return await request.ajaxGet(reportDataUrl)
}


module.exports = {
  getMessagePage,
  getReportData
}
