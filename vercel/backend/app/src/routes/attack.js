"use strict"

const { attack } = require("../controllers")

module.exports = (router) => {
  router.get("/get-spy-reports", attack.getSpyReports)
  router.get("/sort-spy-reports", attack.sortSpyReports)
}
