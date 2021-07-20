"use strict"

const extractSpyReportData = async ($) => {

  const reports = []
  //Get each message
  $(".msg").each((index, result) => {
    //Extract location from <a> href query
    const urlQuery = $(result).find(".msg_title a").attr("href").split("?")[1]
    const location = Object.fromEntries(new URLSearchParams(urlQuery))

    //Get message id, this will be used later to delete message if neccessary
    const messageId = $(result).attr("data-msg-id")

    const resources = []
    //Extract metal crystal and deut, they all have the same "resspan" class
    $(result).find(".resspan").each((index, result) => {
      const resource = $(result).html().split(": ")[1]
      //If there is more than a million resources, they will be displayed in x,xxM, x,xxxM or xM format, convert it to number
      if (resource.includes("M")) {
        //xM format
        if (resource.indexOf(",") == -1) {
          resources.push(parseInt((resource.replace("M", "") * 1000000)))
        }
        //x,xxxM format
        else if (resource.split(",")[1].length == 4) {
          resources.push((parseInt(resource.replace("M", "").replace(",", ""))) * 1000)
        }
        //x,xxM format
        else if (resource.split(",")[1].length == 3) {
          resources.push((parseInt(resource.replace("M", "").replace(",", ""))) * 10000)
        }
      }
      //Less than million resources
      else {
        resources.push(parseFloat(resource.replace(".", "")))
      }
    })

    //Format object
    const reportData = {
      messageId: messageId,
      galaxy: location.galaxy,
      system: location.system,
      position: location.position,
      metal: resources[0],
      crystal: resources[1],
      deut: resources[2]
    }

    reports.push(reportData)
  })

  return reports
}

module.exports = {
  extractSpyReportData
}
