"use strict"

const { attackService } = require("../services")



const getSpyReports = async (req, res) => {
  const result = await attackService.getSpyReports()

  res.status(200).json(result)
}

const sortSpyReports = async (req, res) => {
  const result = await attackService.sortSpyReports()

  res.status(200).json(result)
}

module.exports = {
  getSpyReports,
  sortSpyReports
}
