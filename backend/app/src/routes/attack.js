"use strict"

const { attack } = require("../controllers")

module.exports = (router) => {
  router.get("/get-spy-reports", attack.getSpyReports)
  router.get("/sort-spy-reports", attack.sortSpyReports)
  router.post("/spy", attack.spy)
  router.post("/attack", attack.attack)
  router.post("/auto-attack", attack.autoAttack)
  router.get("/get-planet-list", attack.getPlanetList)
  router.get("/spy-and-attack", attack.spyAndAttack)
}
