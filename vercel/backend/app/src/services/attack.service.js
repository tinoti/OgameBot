"use strict"

const cheerio = require('cheerio');
const { attackRequest } = require("../request")
const { extractSpyReportData } = require('../util/extract');


// Goes through all pages in the messages tab and returns all spy reports data in array of JSON objects
//TODO: extract formating total loot and number of ships to different function so it can be passed any ship (here it only calculates for small cargoes)
const getSpyReports = async () => {

  // Request object for first page of messages
  const postData = {
    messageId: -1,
    tabid: 20,
    action: 107,
    pagination: 1,
    ajax: 1
  }

  //Get first page of messages, from which we will be able to determine number of pages
  const responseHtml = await attackRequest.getMessagePage(postData)
  const $ = cheerio.load(responseHtml)

  //Extract number of report pages
  const pages = $(".curPage").html().split("/")[1]

  let reportArray = []
  for (let i = 1; i <= pages; i++) {
    postData.pagination = i

    const responseHtml = await attackRequest.getMessagePage(postData)
    const $ = cheerio.load(responseHtml)

    //This returns array of json objects for each spy report there is on the current page
    const reports = await extractSpyReportData($)

    //Add total loot and number of ships needed for each report
    reports.forEach(report => {

      report.availableLoot = (report.metal + report.crystal + report.deut) * process.env.LOOT_PERCENTAGE
      //Parse int to get round number of ships
      report.numberOfShipsNeeded = parseInt(report.availableLoot / process.env.SMALL_CARGO_STORAGE) + 20
    });

    reportArray = reportArray.concat(reports)
  }

  return reportArray
}


//Sorts all the reports. Currently it only sorts by highest number of resources
//TODO: Add more sorting option (calculation of flight time, resource importance ...)
// Sorting options needs to be done by adding a ResourceUnit(RU). Each resource has a value of resource unit.
//If you look at the importance of resources being 1:2:3 (metal, crystal, deut) then metal is 1 RU, crystal 2 RU and deut 3 RU
//If you can also get flight time then you can divide total RU with flight time and get RU gain per minute for each potentional attack
//That way we can find the best targets
const sortSpyReports = async () => {
  const reports = await getSpyReports()
  reports.sort((a, b) => b.availableLoot - a.availableLoot )

  console.log("REPORTS ARE DONE")

  return reports
}

module.exports = {
  getSpyReports,
  sortSpyReports
}
