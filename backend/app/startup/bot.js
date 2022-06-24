"use strict"
const logger = require('../src/util/logger')
const { setupService } = require("../src/services")
const request = require("../src/util/request")
const puppeteer = require("puppeteer")



//IIFE so we can await
//Errors in the startup service are not handled since there is no point in the app running if setup failed
const doLogin = async () => {
const cookie = await setupService.login(process.env.EMAIL, process.env.PASSWORD)
  logger.info("Successfully logged in with account: " + process.env.EMAIL)

  const loginUrl = await setupService.getLoginUrl()
  logger.info("Successfully logged in to server: " + loginUrl)

  const page = await setupService.startPuppeteer(loginUrl, cookie)
  request.setPage(page)
  logger.info("Successfully started puppeteer page")
  logger.info("Setup complete!")
};


const startBot = async () => {
  //Start puppeteer and open a new page
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // //Set cookie
  // await page.setCookie({
  //   name: cookie,
  //   value: cookie,
  //   url: "https://s" + process.env.SERVER_NUMBER + "-" + process.env.SERVER_LANGUAGE + ".ogame.gameforge.com"
  // })

  //Open ogame
  await page.goto("https://lobby.ogame.gameforge.com/de_DE/");

  //Add jquery to page, this needs to be done because we will make jquery ajax request on the ogame page
  //Their backend does not accept XMLHttpRequests, I don't know why but you can only make ajax requests
  await page.addScriptTag({ url: 'https://code.jquery.com/jquery-3.2.1.min.js' });


  const url = "https://gameforge.com/api/v1/auth/thin/sessions"

  const data = {
    autoGameAccountCreation: false,
    gameEnvironmentId: "0a31d605-ffaf-43e7-aa02-d06df7116fc8",
    gfLang: "de",
    identity: process.env.email,
    locale: "de_DE",
    password: process.env.password,
    platformGameId: "1dfd8e7e-6e1a-4eb1-8c64-03c3b62efd2f",
  }

  const result = await page.evaluate(async (url, data) => {
    const $ = window.$ //otherwise the transpiler will rename it and won't work
    try {
      return await $.post(url, data)
    } catch (error) {
      return { status: 409, challengeId: error.getResponseHeader("gf-challenge-id").split(";")[0] }
    }
  }, url, data)

  if (result.status === 409) {
    console.log("Login failed, challenge required")
    await new Promise(resolve => setTimeout(resolve, 2000))

    //Get challenge, as far as I can tell we first need to call GET on the challenge to have the status presented, then call post to have it solved.
    const challengeUrl = `https://image-drop-challenge.gameforge.com/challenge/${result.challengeId}/de_DE`
    const getChallenge = await page.evaluate(async (challengeUrl) => {
      const $ = window.$ //otherwise the transpiler will rename it and won't work
      return await $.get(challengeUrl)
    }, challengeUrl)

    if (getChallenge.status === "presented") {
      let solved = false
      while (!solved) {
        console.log("Trying to solve")
        const challenge = await page.evaluate(async (challengeUrl) => {
          const $ = window.$ //otherwise the transpiler will rename it and won't work
          const rndInt = Math.floor(Math.random() * 4) + 1
          return await $.ajax({
            url: challengeUrl,
            type: "POST",
            data: JSON.stringify({answer: 1}),
            contentType: "application/json"
          }) // there are 4 answers so 25% chance of success, we will keep repeating until we hit
        }, challengeUrl)

        console.log(challenge)
        if (challenge.status === "presented") {
          console.log("Trying again in 2 sec")
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
        else if (challenge.status === "solved") {
          console.log("Solved, logging in again")
          solved = true
          doLogin()
        }

      }
    }
  }
  else {
    doLogin()
  }


};


module.exports = {
  startBot
}