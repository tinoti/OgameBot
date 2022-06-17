"use strict"

const cheerio = require('cheerio');
const { attackRequest } = require("../request")
const { extractSpyReportData } = require('../util/extract');
const xml2js = require('xml2js');
const dayjs = require("dayjs");
const logger = require('../util/logger');


let token = ""

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
  const reports = await getSpyReports()
  reports.sort((a, b) => b.availableLoot - a.availableLoot)

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
    expedition: 0
  }

  $(".eventFleet").each((index, fleet) => {
    // This finds the tooltip text of fleet slot, this will tell us whether it is attack, spy, transport or colonisation  ( Angreifen, Spionage and Kolonisieren in German)
    const fleetText = $(fleet).find(".tooltipHTML").attr("title")
    if (fleetText === "Eigene Flotte | Angreifen (R)") fleetSlotsInfo.attack++
    if (fleetText === "Eigene Flotte | Kolonisieren (R)") fleetSlotsInfo.colonisation++
    if (fleetText === "Eigene Flotte | Spionage (R)") fleetSlotsInfo.spy++
    if (fleetText === "Eigene Flotte | Transport (R)") fleetSlotsInfo.transport++
    if (fleetText === "Eigene Flotte | Expedition (R)") fleetSlotsInfo.expedition++
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

  // Sort inactive planets
  inactivePlanets.sort((a, b) => a.galaxy - b.galaxy || a.system - b.system || a.position - b.position)

  return inactivePlanets
}


const spyAndAttack = async () => {

  const mainPlanetId = "39364811"
  const colonyId = "39367010"

  let activePlanetId = "39364811"

  const inactiveTargets = (await getInactiveTargets()).filter(o => o.galaxy > 1)

  while (true) {


    //Get and filter reports
    //TODO: delete all invalid reports
    const reports = (await sortSpyReports()).filter(o => o.availableLoot > 3000000)

    const fleetSlots = await getFleetSlotsInfo()



    // If there is no valid targets, send spy probe to next target
    if (reports.length === 0) {
      const sendSpyProbe = JSON.parse(await attackRequest.sendSpyProbe(inactiveTargets[0].galaxy, inactiveTargets[0].system, inactiveTargets[0].position, token))
      console.log(sendSpyProbe)
      if (sendSpyProbe.response.success) {
        logger.info(`Spy probe sent to ${inactiveTargets[0].galaxy}:${inactiveTargets[0].system}:${inactiveTargets[0].position}\n`)
        token = sendSpyProbe.newToken
        inactiveTargets.shift()
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
      else if (!sendSpyProbe.response.success) {
        logger.info(`Error while attempting to send spy probe: ${sendSpyProbe.response.message}\n Trying again in 5 seconds.\n`)
        token = sendSpyProbe.newToken
        await new Promise(resolve => setTimeout(resolve, 5000))
      }
    }


    const fleetComposition = await attackRequest.getFleetInfoEvent()
    if (reports.length > 0 && fleetSlots.attack + fleetSlots.colonisation + fleetSlots.transport < process.env.FLEET_SLOTS - 1 && fleetComposition.smallTransporter > reports[0].numberOfShipsNeeded) {
      // Set active planet to the target galaxy
      if(reports[0].galaxy === "3" && activePlanetId != mainPlanetId)  {
        console.log("HERE")
        activePlanetId = mainPlanetId
        await attackRequest.setActivePlanet(mainPlanetId)
      }
      if(reports[0].galaxy === "2" && activePlanetId != colonyId) {
        console.log("HERE BEFORE SETING ACTIVE PLANET GALAXY 2")
        activePlanetId = colonyId
        await attackRequest.setActivePlanet(colonyId)
      }
      console.log("REPORT")
      console.log(reports[0].galaxy)
      console.log(activePlanetId)

      const attackResult = JSON.parse(await attackRequest.attack(reports[0].galaxy, reports[0].system, reports[0].position, reports[0].numberOfShipsNeeded, token))
      if (attackResult.success) {
        logger.info(`${reports[0].numberOfShipsNeeded} ships sent to ${reports[0].galaxy}:${reports[0].system}:${reports[0].position}`)
        token = attackResult.newAjaxToken
        const test = await attackRequest.deleteSpyReport(reports[0].messageId, attackResult.newAjaxToken)
        console.log("DELETE SPY REPORT RESULT")
        console.log(test)
        await new Promise(resolve => setTimeout(resolve, 10000))
      } else if (!attackResult.success) {
        console.log("FAILED ATTACK")
        console.log(attackResult)
        token = attackResult.newAjaxToken
        await new Promise(resolve => setTimeout(resolve, 10000))
      }

    } else {
      const sendSpyProbe = JSON.parse(await attackRequest.sendSpyProbe(inactiveTargets[0].galaxy, inactiveTargets[0].system, inactiveTargets[0].position, token))
      console.log(sendSpyProbe)
      if (sendSpyProbe.response.success) {
        logger.info(`Spy probe sent to ${inactiveTargets[0].galaxy}:${inactiveTargets[0].system}:${inactiveTargets[0].position}\n`)
        token = sendSpyProbe.newToken
        inactiveTargets.shift()
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
      else if (!sendSpyProbe.response.success) {
        logger.info(`Error while attempting to send spy probe: ${sendSpyProbe.response.message}\n Trying again in 5 seconds.\n`)
        token = sendSpyProbe.newToken
        await new Promise(resolve => setTimeout(resolve, 5000))
      }
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
  spyAndAttack
}

// TO DO: AUTO attack sa špijuniranjem. Ideja je da se odredi minimalni iznos resursa za loot, te automatski krene špijunirat inaktivne od zadanih koordinata na gore
// npr. od 1:1:1 na više, kada dođe do 1:499:15 pređe na 2:1:1. Kada nađe validni target napadne ga i nastavlja sa špijuniranjem

// IMPLEMENTACIJA
// WHILE LOOP


// Ako ima validnih reportova I AKO IMA SLOBODNIH SLOTOVA ZA NAPAD (jedan slot mora ostat za FS), pošalji JEDAN napad na prvi report, obriši report i opet zavrti loop za par sekundi.
// Ovdje se mora provjeriti da li su slotovi koji su zauzeti ŠPIJUNIRANJE ILI NAPAD. Ako su svi slotovi zauzeti ali su špijuniranje, pričekaj da se prva sonda vrati pa pošalji napad
// prije odlaska u slijedeću iteraciju
// U slijedećoj iteraciji taj report više neće postojati i prvi report će biti slijedeći najveći koji se može opet napasti.

// Ako ima validnih reportova I AKO NEMA SLOBODNIH SLOTOVA, tj. samo je jedan slot slobodan, pošalji špijuniranje na slijedeći target i zavrti opet kada se špija vrati

// Svaki planet bi trebao imati dovoljno sondi i transića za napad. Napad se treba odvijati sa planeta u galaksiji u kojoj je target. Vrlo vjerojatno će doći do situacije da
// u reportovima ima validnih targeta iz dvije galaksije, ili da se špija jedna galaksija a u drugoj još ima validnih targeta. Napad uvijek mora ići iz iste galaksije, što znači
// da ako ima targeta iz više galaksije, prije napada se prebaci na planet u toj galaksiji. Špijuniranje bi isto trebali ići iz iste galaksije. Prije svake akcije bi se
// trebalo provjeriti da je odabran ispravan planet. 