"use strict"


const extractSpyReportData = async ($) => {

  const reports = []
  //Get each message
  $(".msg").each((index, msg) => {
    //Extract location from <a> href query
    const urlQuery = $(msg).find(".msg_title a").attr("href").split("?")[1]
    const location = Object.fromEntries(new URLSearchParams(urlQuery))

    //Get message id, this will be used later to delete message if neccessary
    const messageId = $(msg).attr("data-msg-id")

    const resources = []

    //Check if planet has any fleet or defense, if it does don't add it to the list
    const fleet = $(msg).find(".tooltipLeft").attr("title")
    const defense = $(msg).find(".tooltipRight").not(".tooltipClose").attr("title")

    if (fleet === "Flotten: 0" && defense == "0") {

      //Extract metal crystal and deut, they all have the same "resspan" class
      $(msg).find(".resspan").each((index, result) => {

        const resource = $(result).html().split(": ")[1]

        //If there is more than a million resources, they will be displayed in x,xM x,xxM, x,xxxM or xM format, convert it to number
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
          //x,xM format
          else if (resource.split(",")[1].length == 2) {
            resources.push((parseInt(resource.replace("M", "").replace(",", ""))) * 100000)
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
        galaxy: parseInt(location.galaxy),
        system: parseInt(location.system),
        position: parseInt(location.position),
        metal: resources[0],
        crystal: resources[1],
        deut: resources[2]
      }

      reports.push(reportData)

    }

  })



  return reports
}

module.exports = {
  extractSpyReportData
}
