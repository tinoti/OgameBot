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

const spy = async (req, res) => {
  const { galaxy, systemFrom, systemTo, selectedPlanetId } = req.body
  const result = await attackService.spy(galaxy, systemFrom, systemTo, selectedPlanetId)
  res.status(200).json(result)
}

const attack = async (req, res) => {

  const { galaxy, system, position, numberOfShipsNeeded, messageId } = req.body
  const result = await attackService.attack(galaxy, system, position, numberOfShipsNeeded, messageId)

  res.status(200).json()
}

const autoAttack = async (req, res) => {

  const { selectedPlanetId } = req.body

  attackService.autoAttack(selectedPlanetId)

  res.status(200).json()
}

const getPlanetList = async (req, res) => {
  const result = await attackService.getPlanetList()

  res.status(200).json(result)
}

const spyAndAttack = async (req, res) => {
  attackService.spyAndAttack()

  res.status(200).json()
}

module.exports = {
  getSpyReports,
  sortSpyReports,
  spy,
  attack,
  autoAttack,
  getPlanetList,
  spyAndAttack
}
