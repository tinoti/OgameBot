"use strict"

const cheerio = require('cheerio');
const { attackRequest, setupRequest } = require("../request")
const { extractSpyReportData } = require('../util/extract');
const xml2js = require('xml2js');
const dayjs = require("dayjs");
const logger = require('../util/logger');
const { setActivePlanet } = require('../request/attack.request');




let token = ""

const userPlanets = [
  {
    galaxy: 1,
    startSystem: 109,
    systemLeftCurrent: 109,
    systemRightCurrent: 109,
    systemLeft: 99,
    systemRight: 119,
    position: 8,
    id: 39376278,
    expeditionsSent: 0
  },
  {
    galaxy: 2,
    startSystem: 226,
    systemLeftCurrent: 226,
    systemRightCurrent: 226,
    systemLeft: 216,
    systemRight: 236,
    position: 8,
    id: 39367010,
    expeditionsSent: 0
  },
  {
    galaxy: 3,
    startSystem: 206,
    systemLeftCurrent: 206,
    systemRightCurrent: 206,
    systemLeft: 196,
    systemRight: 226,
    position: 8,
    id: 39370115,
    expeditionsSent: 0
  },
  {
    galaxy: 5,
    startSystem: 33,
    systemLeftCurrent: 33,
    systemRightCurrent: 33,
    systemLeft: 23,
    systemRight: 43,
    position: 8,
    id: 39369860,
    expeditionsSent: 0
  }
]

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
      //Parse int to get round number of ships, 20 extra ships just to be sure
      report.numberOfShipsNeeded = parseInt(report.availableLoot / process.env.SMALL_CARGO_STORAGE) + 20
    });

    reportArray = reportArray.concat(reports)
  }

  // console.log(reportArray)
  return reportArray
}


//Sorts all the reports. Currently it only sorts by highest number of resources
//TODO: Add more sorting option (calculation of flight time, resource importance ...)
// Sorting options needs to be done by adding a ResourceUnit(RU). Each resource has a value of resource unit.
//If you look at the importance of resources being 1:2:3 (metal, crystal, deut) then metal is 1 RU, crystal 2 RU and deut 3 RU
//If you can also get flight time then you can divide total RU with flight time and get RU gain per minute for each potentional attack
//That way we can find the best targets
const sortSpyReports = async () => {
  let reports = await getSpyReports()


  reports.forEach(report => {
    // Calculate resource units
    report.resourceUnits = report.metal + report.crystal * 2 + report.deut * 3

    // Get distance
    const attackingPlanet = userPlanets.find(o => o.galaxy === report.galaxy)
    report.distance = 2700 + 95 * Math.abs(attackingPlanet.startSystem - report.system)
    if (report.system === attackingPlanet.startSystem) report.distance = 1000 + 5 * (Math.abs(report.position - attackingPlanet.position))
    report.flightDuration = (((10 + 3500 * Math.sqrt((10 * report.distance) / 28000)) / 4) / 60) * 2
    report.resourceUnitsPerMinute = report.resourceUnits / report.flightDuration
    report.resourcesPerMinute = report.availableLoot / report.flightDuration
  })


  reports.sort((a, b) => b.resourceUnitsPerMinute - a.resourceUnitsPerMinute)


  // reports.sort((a, b) => b.deut - a.deut)
  return reports
}


const spy = async (galaxy, systemFrom, systemTo, selectedPlanetId) => {

  const parser = new xml2js.Parser(/* options */);

  // Get a list of all planets in the universe. This calls OGame API and returns XML
  // https://board.origin.ogame.gameforge.com/index.php/Thread/3927-OGame-API/?s=188c4b5606b3ee4c1380e7e3212774c671efda20
  const xmlPlanets = await attackRequest.getUniPlanets()
  // Get a list of all players in the universe.
  const xmlPlayers = await attackRequest.getUniPlayers()

  // Convert it to JSON ()
  const planets = (await parser.parseStringPromise(xmlPlanets)).universe.planet
  const players = (await parser.parseStringPromise(xmlPlayers)).players.player

  let inactivePlanets = []
  // Find all inactive planets in the given range
  planets.forEach(planet => {
    const coords = planet.$.coords.split(":")
    if (parseInt(coords[0]) === parseInt(galaxy) && parseInt(coords[1]) >= parseInt(systemFrom) && parseInt(coords[1]) <= parseInt(systemTo)) {
      const playerFound = players.find(o => o.$.id === planet.$.player)
      if (playerFound?.$.status === "I") inactivePlanets.push({
        galaxy: parseInt(coords[0]),
        system: parseInt(coords[1]),
        position: parseInt(coords[2])
      })
    }
  })

  // Sort inactive planets
  inactivePlanets.sort((a, b) => a.system - b.system || a.planet - b.planet)

  // Set the planet that was selected as active
  await attackRequest.setActivePlanet(selectedPlanetId)

  for (let i = 0; i < inactivePlanets.length; i++) {
    const result = JSON.parse(await attackRequest.sendSpyProbe(inactivePlanets[i].galaxy, inactivePlanets[i].system, inactivePlanets[i].position, token))
    if (!result.response.success) {
      i--
      token = result.newToken
      logger.info(`Error while attempting to send spy probe: ${result.response.message}\n Trying again in 5 seconds.`)
      await new Promise(resolve => setTimeout(resolve, 5000))
    }
    else if (result.response.success) {
      console.log(`Spy probe sent to ${inactivePlanets[i].galaxy}:${inactivePlanets[i].system}:${inactivePlanets[i].position}`)
      token = result.newToken
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }

  console.log("Done!")

  return inactivePlanets

}

const attack = async (galaxy, system, position, numberOfShipsNeeded, messageId) => {
  const result = JSON.parse(await attackRequest.attack(galaxy, system, position, numberOfShipsNeeded, token))
  console.log(result)
  if (!result.success) {
    console.log("Token failed, trying again in 10 sec with new token")
    token = result.newAjaxToken
    await new Promise(resolve => setTimeout(resolve, 10000))
    attack(galaxy, system, position, numberOfShipsNeeded, messageId)
  } else if (result.success) {
    console.log(`${dayjs().format("HH:mm:ss")}: ${numberOfShipsNeeded} ships sent to ${galaxy}:${system}:${position}`)
    token = result.newAjaxToken

    // Delete the spy report after succesfull attack
    const test = await attackRequest.deleteSpyReport(messageId, result.newAjaxToken)
    console.log("DELETE SPY REPORT RESULT")
    console.log(test)
  }


  return "Ok"

}

// Return true if there are available fleet slots
const checkAvailableFleetSlots = async () => {
  const result = JSON.parse(await attackRequest.getEventList())

  return (process.env.FLEET_SLOTS - 1) > result.friendly ? true : false
}



const autoAttack = async (selectedPlanetId) => {

  let attackCount = 0

  // Set the planet that was selected as active
  await attackRequest.setActivePlanet(selectedPlanetId)

  const reports = await sortSpyReports()

  for (let i = 0; i < reports.length; i++) {
    const isFleetSlotAvailable = await checkAvailableFleetSlots()
    const fleet = await attackRequest.getFleetInfoEvent()

    if (isFleetSlotAvailable) {
      if (fleet.smallTransporter > reports[i].numberOfShipsNeeded) {
        await attack(reports[i].galaxy, reports[i].system, reports[i].position, reports[i].numberOfShipsNeeded, reports[i].messageId)
        attackCount++
        console.log(`Attack count: ${attackCount}`)
        await new Promise(resolve => setTimeout(resolve, 5000))

      }
      else {
        console.log(`${dayjs().format("HH:mm:ss")}: Number of ships exceeded, waiting 5 min before trying again`)
        await new Promise(resolve => setTimeout(resolve, 300000))
        i--
      }
    }
    else {
      console.log(`${dayjs().format("HH:mm:ss")}: No available fleet slots, trying again in 5 min`)
      await new Promise(resolve => setTimeout(resolve, 300000))
      i--
    }
  }

  console.log("Done!")

}

const getPlanetList = async () => {
  const html = await attackRequest.getPlanetList()
  const $ = cheerio.load(html)

  const planetList = []
  // const tempDom = $('<div></div>').append($.parseHTML(data));
  // const token = tempDom.find("input").val()
  $(".smallplanet").each((index, planet) => {

    planetList.push({
      id: $(planet).attr("id").split("-")[1],
      name: $(planet).find(".planet-name").text(),
      coordinates: $(planet).find(".planet-koords").text()
    })

  })

  return planetList
}

const getFleetSlotsInfo = async () => {
  const html = await attackRequest.getFleetSlotsInfo()
  const $ = cheerio.load(html)

  let fleetSlotsInfo = {
    attack: 0,
    spy: 0,
    colonisation: 0,
    transport: 0,
    expedition: 0,
    enemyAttack: []
  }

  $(".eventFleet").each((index, fleet) => {
    // This finds the tooltip text of fleet slot, this will tell us whether it is attack, spy, transport or colonisation  ( Angreifen, Spionage and Kolonisieren in German)
    const fleetText = $(fleet).find(".tooltipHTML").attr("title")
    if (fleetText === "Eigene Flotte | Angreifen (R)") fleetSlotsInfo.attack++
    if (fleetText === "Eigene Flotte | Kolonisieren (R)") fleetSlotsInfo.colonisation++
    if (fleetText === "Eigene Flotte | Spionage (R)") fleetSlotsInfo.spy++
    if (fleetText === "Eigene Flotte | Transport (R)") fleetSlotsInfo.transport++
    if (fleetText === "Eigene Flotte | Expedition (R)") fleetSlotsInfo.expedition++

    if (fleetText === "Feindliche Flotte | Angreifen") {
      let destinationPlanet = $(fleet).find(".destCoords a").text()
      destinationPlanet = destinationPlanet.trim().replace("[", "").replace("]", "").split(":")
      fleetSlotsInfo.enemyAttack.push({
        galaxy: parseInt(destinationPlanet[0]),
        system: parseInt(destinationPlanet[1]),
        position: parseInt(destinationPlanet[2])
      })
    }

  })

  return fleetSlotsInfo
}

// Returns list of all inactive planets in the universe
const getInactiveTargets = async () => {
  const parser = new xml2js.Parser(/* options */);

  // Get a list of all planets in the universe. This calls OGame API and returns XML
  // https://board.origin.ogame.gameforge.com/index.php/Thread/3927-OGame-API/?s=188c4b5606b3ee4c1380e7e3212774c671efda20
  const xmlPlanets = await attackRequest.getUniPlanets()
  // Get a list of all players in the universe.
  const xmlPlayers = await attackRequest.getUniPlayers()

  // Convert it to JSON ()
  const planets = (await parser.parseStringPromise(xmlPlanets)).universe.planet
  const players = (await parser.parseStringPromise(xmlPlayers)).players.player

  let inactivePlanets = []
  // Find all inactive planets in the given range
  planets.forEach(planet => {
    const coords = planet.$.coords.split(":")
    const playerFound = players.find(o => o.$.id === planet.$.player)
    if (playerFound?.$.status === "I") inactivePlanets.push({
      galaxy: parseInt(coords[0]),
      system: parseInt(coords[1]),
      position: parseInt(coords[2])
    })
  })

  // Sort inactive planets in "rings" of 20 fields left and right from each planet in the galaxy. 
  let systemModifier = 10
  let sortedInactivePlanets = []

  // const userPlanets = [
  //   {
  //     galaxy: 1,
  //     startSystem: 155,
  //     systemLeftCurrent: 155,
  //     systemRightCurrent: 155,
  //     systemLeft: 135,
  //     systemRight: 175,
  //     position: 8
  //   },
  //   // {
  //   //   galaxy: 2,
  //   //   startSystem: 226,
  //   //   systemLeftCurrent: 226,
  //   //   systemRightCurrent: 226,
  //   //   systemLeft: 206,
  //   //   systemRight: 246,
  //   //   position: 8
  //   // }
  //   {
  //     galaxy: 5,
  //     startSystem: 33,
  //     systemLeftCurrent: 33,
  //     systemRightCurrent: 33,
  //     systemLeft: 13,
  //     systemRight: 53,
  //     position: 8
  //   }
  // ]

  inactivePlanets.sort((a, b) => a.galaxy - b.galaxy || a.system - b.system || a.position - b.position)

  for (let i = 0; i < 5; i++) {
    userPlanets.forEach(planet => {

      // If we went around the galaxy, from 1 to 499
      if (planet.systemLeft <= 0) {
        planet.systemLeft = 499 + planet.systemLeft
        const leftInactives = inactivePlanets.filter(o => o.galaxy === planet.galaxy && ((o.system >= 1 && o.system <= planet.systemLeftCurrent) || (o.system >= planet.systemLeft && o.system <= 499)))
        sortedInactivePlanets = sortedInactivePlanets.concat(leftInactives)
        planet.systemLeftCurrent = planet.systemLeft
        planet.systemLeft -= systemModifier
      } else {
        const leftInactives = inactivePlanets.filter(o => o.galaxy === planet.galaxy && o.system >= planet.systemLeft && o.system < planet.systemLeftCurrent)
        sortedInactivePlanets = sortedInactivePlanets.concat(leftInactives)
        planet.systemLeftCurrent -= systemModifier
        planet.systemLeft -= systemModifier
      }

      // If we went from 499 to 1
      if (planet.systemRight > 499) {
        planet.systemRight = planet.systemRight - 499
        const rightInactives = inactivePlanets.filter(o => o.galaxy && ((o.system >= planet.systemRight && o.system <= 499) || (o.system >= 1 && o.system <= planet.systemRight)))
        sortedInactivePlanets = sortedInactivePlanets.concat(rightInactives)
        planet.systemRightCurrent = planet.systemRight
        planet.systemRight += systemModifier
      } else {
        const rightInactives = inactivePlanets.filter(o => o.galaxy === planet.galaxy && o.system >= planet.systemRightCurrent && o.system < planet.systemRight)
        sortedInactivePlanets = sortedInactivePlanets.concat(rightInactives)
        planet.systemRightCurrent += systemModifier
        planet.systemRight += systemModifier
      }


    })
  }



  return sortedInactivePlanets
}

const getFleetComposition = async () => {
  const html = await attackRequest.getFleetComposition()
  const $ = cheerio.load(html)
  return {
    smallTransporter: { amount: parseInt($(".transporterSmall .amount").attr("data-value")), cargo: 5000 + 5000 * 0.05 * process.env.HYPERSPACE_TECHNOLOGY, id: "am202" },
    largeTransporter: { amount: parseInt($(".transporterLarge .amount").attr("data-value")), cargo: 25000 + 25000 * 0.05 * process.env.HYPERSPACE_TECHNOLOGY, id: "am203" },
    lightFighter: { amount: parseInt($(".fighterLight .amount").attr("data-value")), cargo: 50 + 50 * 0.05 * process.env.HYPERSPACE_TECHNOLOGY, id: "am204" },
    heavyFighter: { amount: parseInt($(".fighterHeavy .amount").attr("data-value")), cargo: 100 + 100 * 0.05 * process.env.HYPERSPACE_TECHNOLOGY, id: "am205" },
    cruiser: { amount: parseInt($(".cruiser .amount").attr("data-value")), cargo: 800 + 800 * 0.05 * process.env.HYPERSPACE_TECHNOLOGY, id: "am206" },
    battleship: { amount: parseInt($(".battleship .amount").attr("data-value")), cargo: 1500 + 1500 * 0.05 * process.env.HYPERSPACE_TECHNOLOGY, id: "am207" },
    pathfinder: { amount: parseInt($(".explorer .amount").attr("data-value")), cargo: 10000 + 10000 * 0.05 * process.env.HYPERSPACE_TECHNOLOGY, id: "am219" },
    spyProbe: { amount: parseInt($(".espionageProbe .amount").attr("data-value")), cargo: 0, id: "am210" },
  }
}

const getPlanetResources = async () => {
  const html = await attackRequest.getPlanetResources()
  const $ = cheerio.load(html)

  return {
    metal: parseInt($("#resources_metal").attr("data-raw")),
    crystal: parseInt($("#resources_crystal").attr("data-raw")),
    deut: parseInt($("#resources_deuterium").attr("data-raw")),
  }
}

const calculateTotalCargo = (fleetComposition) => {
  let totalCargo = 0
  for (const ship in fleetComposition) {
    console.log(fleetComposition[ship].cargo)
    console.log(fleetComposition[ship].amount)
    totalCargo += fleetComposition[ship].cargo * fleetComposition[ship].amount
  }

  return totalCargo - 20000 // 20k for deut consuption
}


const calculateTotalCarriableResources = (totalCargo, planetResources) => {
  let total = {
    metal: 0,
    crystal: 0,
    deut: 0
  }

  if(planetResources.deut + planetResources.crystal + planetResources.metal < totalCargo) {
    total.deut = planetResources.deut
    total.metal = planetResources.metal
    total.crystal = planetResources.crystal

    return total
  }

  if(planetResources.deut > totalCargo) {
    total.deut = totalCargo
    return total
  }

  total.deut = planetResources.deut - 10000 // for consumption
  totalCargo -= planetResources.deut

  if(planetResources.crystal > totalCargo) {
    total.crystal = totalCargo
    return total
  }

  total.crystal = planetResources.crystal
  totalCargo -= planetResources.crystal

  if(planetResources.metal > totalCargo) {
    total.metal = totalCargo
    return total
  }



}

const spyAndAttack = async () => {

  const reports = await sortSpyReports()

  // If there already is a report of inactive target, it means that it was already scanned so we don't have to spy that target again
  const inactiveTargets = (await getInactiveTargets()).filter(o => !(reports.find(report => report.galaxy === o.galaxy && report.system === o.system && report.position === o.position)))

  let activePlanet = userPlanets[0]

  let errorCount = 0
  let attackCount = 0
  let expeditionCount = 0

  const fleetSlotsInfo = await getFleetSlotsInfo()
  if (fleetSlotsInfo.enemyAttack.length > 0) {
    fleetSlotsInfo.enemyAttack.forEach(async attack => {
      activePlanet = userPlanets.find(o => o.galaxy === attack.galaxy && o.startSystem === attack.system && o.position === attack.position)
      await setActivePlanet(activePlanet.id)
      const fleetComposition = await getFleetComposition()
      const planetResources = await getPlanetResources()

      const totalCargo = calculateTotalCargo(fleetComposition) // If there is no fleet on planet, this will return NaN
      const totalCarriableResources = calculateTotalCarriableResources(totalCargo, planetResources)
      if (!totalCargo) {
        console.log("No fleet on planet")
      } else {
        let fleetSavePostData = {
          galaxy: activePlanet.galaxy,
          system: activePlanet.systemStart,
          position: activePlanet.position,
          type: 3,
          token: token,
          union: 0
        }
        for (const ship in fleetComposition) {
          fleetSavePostData[fleetComposition[ship].id] = fleetComposition[ship].amount
        }

        console.log("FLEET POST")
        console.log(fleetSavePostData)
        console.log(totalCarriableResources)

      }
    })
  }

  while (false) {
    try {
      //Get and filter reports
      //TODO: delete all invalid reports
      const reports = (await sortSpyReports()).filter(o => o.resourceUnitsPerMinute > 150000)

      const fleetSlots = await getFleetSlotsInfo()

      // First, check for free expedition and send one if possible
      if (fleetSlots.expedition < 4 && fleetSlots.attack + fleetSlots.transport + fleetSlots.colonisation + fleetSlots.expedition - 1 < process.env.FLEET_SLOTS) {

        // Sort by planet which has least expedition sent, that way each solar system will have time to recharge expeditions
        userPlanets.sort((a, b) => a.expeditionsSent - b.expeditionsSent)
        activePlanet = userPlanets[0]
        await setActivePlanet(activePlanet.id)
        const expeditionResult = JSON.parse(await attackRequest.sendExpedition(activePlanet.galaxy, activePlanet.startSystem, token))
        if (expeditionResult.success) {
          logger.info(`Expedition sent to ${activePlanet.galaxy}:${activePlanet.startSystem}:16,`)
          expeditionCount++
          userPlanets[0].expeditionsSent++
          console.log(`Error count: ${errorCount}, attack count: ${attackCount}, expedition count: ${expeditionCount}\n`)
          token = expeditionResult.newAjaxToken
          await new Promise(resolve => setTimeout(resolve, 2000))
        } else if (!expeditionResult.success) {
          token = expeditionResult.newAjaxToken
          await new Promise(resolve => setTimeout(resolve, 5000))
        }

        continue
      }

      // If there is no valid targets, send spy probe to next target
      if (reports.length === 0) {
        if (activePlanet.galaxy != inactiveTargets[0].galaxy) {
          activePlanet = userPlanets.find(o => o.galaxy === inactiveTargets[0].galaxy)
          await setActivePlanet(activePlanet.id)
        }
        const sendSpyProbe = JSON.parse(await attackRequest.sendSpyProbe(inactiveTargets[0].galaxy, inactiveTargets[0].system, inactiveTargets[0].position, token))
        if (sendSpyProbe.response.success) {
          logger.info(`Spy probe sent to ${inactiveTargets[0].galaxy}:${inactiveTargets[0].system}:${inactiveTargets[0].position}`)
          console.log(`Error count: ${errorCount}, attack count: ${attackCount}, expedition count: ${expeditionCount}\n`)
          token = sendSpyProbe.newToken
          inactiveTargets.shift()
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
        else if (!sendSpyProbe.response.success) {
          // logger.info(`Error while attempting to send spy probe: ${sendSpyProbe.response.message}\n Trying again in 5 seconds.\n`)
          token = sendSpyProbe.newToken
          await new Promise(resolve => setTimeout(resolve, 5000))
        }
      }


      const fleetComposition = await attackRequest.getFleetInfoEvent()
      if (reports.length > 0 && fleetSlots.attack + fleetSlots.colonisation + fleetSlots.transport < process.env.FLEET_SLOTS - 1 && fleetComposition.smallTransporter > reports[0].numberOfShipsNeeded) {
        // Set active planet to the target galaxy
        if (activePlanet.galaxy != reports[0].galaxy) {
          activePlanet = userPlanets.find(o => o.galaxy === reports[0].galaxy)
          await setActivePlanet(activePlanet.id)
        }

        const attackResult = JSON.parse(await attackRequest.attack(reports[0].galaxy, reports[0].system, reports[0].position, reports[0].numberOfShipsNeeded, token))
        if (attackResult.success) {
          logger.info(`${reports[0].numberOfShipsNeeded} ships sent to ${reports[0].galaxy}:${reports[0].system}:${reports[0].position},\nLoot: ${reports[0].availableLoot}\nFlight time: ${reports[0].flightDuration}\nResource per minute: ${reports[0].resourcesPerMinute}`)
          attackCount++
          console.log(`Error count: ${errorCount}, attack count: ${attackCount}, expedition count: ${expeditionCount}\n`)
          token = attackResult.newAjaxToken
          const test = await attackRequest.deleteSpyReport(reports[0].messageId, attackResult.newAjaxToken)
          await new Promise(resolve => setTimeout(resolve, 5000))
        } else if (!attackResult.success) {
          token = attackResult.newAjaxToken
          await new Promise(resolve => setTimeout(resolve, 5000))
        }

      } else {
        if (activePlanet.galaxy != inactiveTargets[0].galaxy) {
          activePlanet = userPlanets.find(o => o.galaxy === inactiveTargets[0].galaxy)
          await setActivePlanet(activePlanet.id)
        }
        const sendSpyProbe = JSON.parse(await attackRequest.sendSpyProbe(inactiveTargets[0].galaxy, inactiveTargets[0].system, inactiveTargets[0].position, token))
        if (sendSpyProbe.response.success) {
          logger.info(`Spy probe sent to ${inactiveTargets[0].galaxy}:${inactiveTargets[0].system}:${inactiveTargets[0].position}\n`)
          console.log(`Error count: ${errorCount}, attack count: ${attackCount}, expedition count: ${expeditionCount}\n`)
          token = sendSpyProbe.newToken
          inactiveTargets.shift()
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
        else if (!sendSpyProbe.response.success) {
          // logger.info(`Error while attempting to send spy probe: ${sendSpyProbe.response.message}\n Trying again in 5 seconds.\n`)
          token = sendSpyProbe.newToken
          await new Promise(resolve => setTimeout(resolve, 5000))
        }
      }
    } catch (error) {
      console.log("Error, trying to login again")
      const bot = require('../../startup/bot');

      bot.startBot()
    }



  }
}


// const result = JSON.parse(await attackRequest.attack(galaxy, system, position, numberOfShipsNeeded, token))
// console.log(result)
// if (!result.success) {
//   console.log("Token failed, trying again in 10 sec with new token")
// token = result.newAjaxToken
// await new Promise(resolve => setTimeout(resolve, 10000))
//   attack(galaxy, system, position, numberOfShipsNeeded, messageId)
// } else if (result.success) {
// console.log(`${dayjs().format("HH:mm:ss")}: ${numberOfShipsNeeded} ships sent to ${galaxy}:${system}:${position}`)
// token = result.newAjaxToken

//   // Delete the spy report after succesfull attack
// const test = await attackRequest.deleteSpyReport(messageId, result.newAjaxToken)
// console.log("DELETE SPY REPORT RESULT")
// console.log(test)
// }

module.exports = {
  getSpyReports,
  sortSpyReports,
  spy,
  attack,
  autoAttack,
  getPlanetList,
  spyAndAttack,
  getInactiveTargets
}

// TO DO: AUTO attack sa ??pijuniranjem. Ideja je da se odredi minimalni iznos resursa za loot, te automatski krene ??pijunirat inaktivne od zadanih koordinata na gore
// npr. od 1:1:1 na vi??e, kada do??e do 1:499:15 pre??e na 2:1:1. Kada na??e validni target napadne ga i nastavlja sa ??pijuniranjem

// IMPLEMENTACIJA
// WHILE LOOP


// Ako ima validnih reportova I AKO IMA SLOBODNIH SLOTOVA ZA NAPAD (jedan slot mora ostat za FS), po??alji JEDAN napad na prvi report, obri??i report i opet zavrti loop za par sekundi.
// Ovdje se mora provjeriti da li su slotovi koji su zauzeti ??PIJUNIRANJE ILI NAPAD. Ako su svi slotovi zauzeti ali su ??pijuniranje, pri??ekaj da se prva sonda vrati pa po??alji napad
// prije odlaska u slijede??u iteraciju
// U slijede??oj iteraciji taj report vi??e ne??e postojati i prvi report ??e biti slijede??i najve??i koji se mo??e opet napasti.

// Ako ima validnih reportova I AKO NEMA SLOBODNIH SLOTOVA, tj. samo je jedan slot slobodan, po??alji ??pijuniranje na slijede??i target i zavrti opet kada se ??pija vrati

// Svaki planet bi trebao imati dovoljno sondi i transi??a za napad. Napad se treba odvijati sa planeta u galaksiji u kojoj je target. Vrlo vjerojatno ??e do??i do situacije da
// u reportovima ima validnih targeta iz dvije galaksije, ili da se ??pija jedna galaksija a u drugoj jo?? ima validnih targeta. Napad uvijek mora i??i iz iste galaksije, ??to zna??i
// da ako ima targeta iz vi??e galaksije, prije napada se prebaci na planet u toj galaksiji. ??pijuniranje bi isto trebali i??i iz iste galaksije. Prije svake akcije bi se
// trebalo provjeriti da je odabran ispravan planet. 