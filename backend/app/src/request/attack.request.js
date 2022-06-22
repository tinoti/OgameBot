"use strict"
const logger = require("../util/logger")
const request = require("../util/request")
const axios = require("axios")

const getMessagePage = async (data) => {
  const messagePageUrl = "https://s115-de.ogame.gameforge.com/game/index.php?page=messages"

  return await request.ajaxPost(messagePageUrl, data)
}

const getReportData = async (id) => {
  const reportDataUrl = "https://s115-de.ogame.gameforge.com/game/index.php?page=messages&messageId=" + id + "&tabid=20&ajax=1"

  return await request.ajaxGet(reportDataUrl)
}

const getUniPlanets = async () => {
  return (await axios.get("https://s115-de.ogame.gameforge.com/api/universe.xml")).data
}

const getUniPlayers = async () => {
  return (await axios.get("https://s115-de.ogame.gameforge.com/api/players.xml")).data
}

const sendSpyProbe = async (galaxy, system, position, token) => {
  const url = "https://s115-de.ogame.gameforge.com/game/index.php?page=ingame&component=fleetdispatch&action=miniFleet&ajax=1&asJson=1"

  return await request.ajaxPost(url, { mission: 6, galaxy: galaxy, system: system, position: position, type: 1, shipCount: 200, token: token })
}

const attack = async (galaxy, system, position, numberOfShipsNeeded, token) => {
  const url = "https://s115-de.ogame.gameforge.com/game/index.php?page=ingame&component=fleetdispatch&action=sendFleet&ajax=1&asJson=1"

  return await request.ajaxPost(url, {
    token: token,
    am202: numberOfShipsNeeded,
    galaxy: galaxy,
    system: system,
    position: position,
    type: 1,
    metal: 0,
    crystal: 0,
    deuterium: 0,
    prioMetal: 1,
    prioCrystal: 2,
    prioDeuterium: 3,
    mission: 1,
    speed: 10,
    retreatAfterDefenderRetreat: 0,
    union: 0,
    holdingTime: 0,
  })

}

const deleteSpyReport = async (messageId) => {
  const url = "https://s115-de.ogame.gameforge.com/game/index.php?page=messages"

  const newToken = await request.getNewTokenFromDom()

  return await request.ajaxPost(url, {
    messageId: messageId,
    action: 103,
    token: newToken,
    ajax: 1
  })
}

const getEventList = async () => {
  const url = "https://s115-de.ogame.gameforge.com/game/index.php?page=componentOnly&component=eventList&action=fetchEventBox&ajax=1&asJson=1"

  return await request.ajaxGet(url)
}

const getFleetInfoEvent = async () => {

  return await request.getFleetInfo()
}

const getPlanetList = async () => {
  const url = "https://s115-de.ogame.gameforge.com/game/index.php?page=ingame&component=overview"

  return await request.ajaxGet(url)
}

const setActivePlanet = async (selectedPlanetId) => {
  const url = `https://s115-de.ogame.gameforge.com/game/index.php?page=ingame&component=research&cp=${selectedPlanetId}`
  await request.goToPage(url)
}


const getFleetSlotsInfo = async () => {
  const url = "https://s115-de.ogame.gameforge.com/game/index.php?page=componentOnly&component=eventList&ajax=1"

  return await request.ajaxGet(url)
}

const sendExpedition = async (galaxy, system, token) => {
  const url = "https://s115-de.ogame.gameforge.com/game/index.php?page=ingame&component=fleetdispatch&action=sendFleet&ajax=1&asJson=1"


  return await request.ajaxPost(url, {
    token: token,
    am204: 1000,
    am203: 500,
    galaxy: galaxy,
    system: system,
    position: 16,
    type: 1,
    metal: 0,
    crystal: 0,
    deuterium: 0,
    prioMetal: 1,
    prioCrystal: 2,
    prioDeuterium: 3,
    mission: 15,
    speed: 10,
    retreatAfterDefenderRetreat: 0,
    union: 0,
    holdingtime: 1
  })
}

module.exports = {
  getMessagePage,
  getReportData,
  getUniPlanets,
  getUniPlayers,
  sendSpyProbe,
  attack,
  deleteSpyReport,
  getEventList,
  getFleetSlotsInfo,
  getPlanetList,
  setActivePlanet,
  getFleetInfoEvent,
  sendExpedition
}
