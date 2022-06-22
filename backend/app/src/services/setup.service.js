"use strict"
const { setupRequest } = require("../request")
const puppeteer = require("puppeteer")

let ogamePage

const login = async (email, password) => {
  try {
    //Data needed for login post request, some of this is hardcoded and can be found when you make a regular login request on the ogame page
    const postData = {
      autoGameAccountCreation: false,
      gameEnvironmentId: "0a31d605-ffaf-43e7-aa02-d06df7116fc8",
      gfLang: "de",
      identity: email,
      locale: "de_DE",
      password: password,
      platformGameId: "1dfd8e7e-6e1a-4eb1-8c64-03c3b62efd2f",
    }
    let response
    try {
      
      response = await setupRequest.login(postData)
    } catch (error) {
      console.log("Error while logging in, challenge required")
      const challengeId = error.response.headers["gf-challenge-id"].split(";")[0]
      const response = await setupRequest.tryChallenge(challengeId)
      if(response.status === "presented") {
        console.log("Challenge failed, trying again in 2 sec")
        await new Promise(resolve => setTimeout(resolve, 2000))
        login(email, password)
      }
      else if (response.status === "solved") {
        console.log("Challenge solved, continuing with login")
        await new Promise(resolve => setTimeout(resolve, 2000))
        login(email,password)
      }
    }

    // If successful, login request return data should contain token and cookie
    const { token } = response.data;
    const { xsrfCookieName } = response.config

    //Set axios token and cookie headers
    await setupRequest.setAxiosHeaders(token, xsrfCookieName)

    //This cookie is needed when seting up puppeteer
    return xsrfCookieName

  } catch (error) {

    throw Error("Login failed: " + error)
  }
}

const getLoginUrl = async () => {
  try {
    const serverLanguage = process.env.SERVER_LANGUAGE.toLowerCase()
    const serverNumber = process.env.SERVER_NUMBER

    //Get data for each server the logged in account is playing in
    const accountData = await setupRequest.getAccountData()

    //Find the server
    const server = accountData.find(o => o.server.language == serverLanguage && o.server.number == serverNumber)

    //Log in to server, it returns a login url which we use to setup puppeteer
    const serverLogin = await setupRequest.serverLogin(server.id, serverLanguage, serverNumber)

    return serverLogin.url

  } catch (error) {
    throw Error("Getting login url failed: " + error)
  }
}

const startPuppeteer = async (url, cookie) => {
  try {
    //Start puppeteer and open a new page
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    //Set cookie
    await page.setCookie({
      name: cookie,
      value: cookie,
      url: "https://s" + process.env.SERVER_NUMBER + "-" + process.env.SERVER_LANGUAGE + ".ogame.gameforge.com"
    })

    //Open ogame
    await page.goto(url);

    //Add jquery to page, this needs to be done because we will make jquery ajax request on the ogame page
    //Their backend does not accept XMLHttpRequests, I don't know why but you can only make ajax requests
    await page.addScriptTag({ url: 'https://code.jquery.com/jquery-3.2.1.min.js' });

    //Set global ogame puppeteer
    ogamePage = page

    return page

  } catch (error) {
    throw Error("Puppeteer setup failed: " + error)
  }

}

const getOgamePage = async () => {
  return ogamePage
}

module.exports = {
  login,
  getLoginUrl,
  startPuppeteer,
  getOgamePage
}


// try {
//   // **** LOGIN ****
//   const email = "vatomasic@gmail.com"
//   const password = "strongh0ld"

  // const response = await axios.post('https://gameforge.com/api/v1/auth/thin/sessions', {
      // autoGameAccountCreation: false,
      // gameEnvironmentId: "0a31d605-ffaf-43e7-aa02-d06df7116fc8",
      // gfLang: "de",
      // identity: email,
      // locale: "de_DE",
      // password: password,
      // platformGameId: "1dfd8e7e-6e1a-4eb1-8c64-03c3b62efd2f",
  // });
//   const { token } = response.data;
//   // this.cookie = response.headers['set-cookie'][0];
//   axios.interceptors.request.use(config => {
//       config.headers.cookie = "XSRF-TOKEN";
//       config.headers.authorization = `Bearer ${token}`;
//       return config;
//   });

//   // console.log(response)

//   // **** LOGIN ****

//   // **** ACCOUNT DATA ****
//   let account = await axios.get('/users/me/accounts');
//   console.log("AKAUNTI")
//   console.log(account.data)
//   account = account.data[4]
//   // **** ACCOUNT DATA ***

//   // **** LOGIN URL ****
//   let { data } = await axios.get(`/users/me/loginLink?id=${account.id}&server[language]=${account.server.language}&server[number]=${account.server.number}&clickedButton=account_list`);
//   loginUrl = data.url
//   console.log(loginUrl)
//   // **** LOGIN URL ****


//   // **** BROWSER
//   const browser = await puppeteer.launch();
//   const page = await browser.newPage();


//   // await page.setRequestInterception(true);

//   // page.on('request', async (request) => {
//   //     // console.log("REKVEST URL: " + request.url())
//   //     // console.log("REKVEST POST DATA: " + request.postData())
//   //     // console.log("\n\n")
//   //     if (request.url() == "https://s178-de.ogame.gameforge.com/game/index.php?page=ingame&component=technologydetails&ajax=1&ajax=1&action=getDetails&technology=113") {

//   //         console.log(request.resourceType())
//   //         // request.respond({
//   //         //     status: 404,
//   //         //     contentType: 'text/plain',
//   //         //     body: 'Not Found!',
//   //         // });
//   //     }

//   //     request.continue()
//   // });
//   // page.on('response', async (res) => {
//   //     // if (res.request().resourceType() === "xhr") {
//   //     //     console.log(await res.json())
//   //     // }

//   //     if (res.request().url() == "https://s178-de.ogame.gameforge.com/game/index.php?page=ingame&component=technologydetails&ajax=1&ajax=1&action=getDetails&technology=113") {
//   //         console.log("AYYss")
//   //     }
//   // })

//   await page.setCookie({
//       name: "XSRF-TOKEN",
//       value: "XSRF-TOKEN",
//       url: "https://s" + account.server.number + "-" + account.server.language + ".ogame.gameforge.com"
//   })

//   // Ovo bi vraća browser sa loginanim userom
//   let test = await page.goto(loginUrl);
//   console.log("TEST BROWSER")

//   await page.addScriptTag({ url: 'https://code.jquery.com/jquery-3.2.1.min.js' });
//   const title = await page.evaluate(async () => {
//       const $ = window.$; //otherwise the transpiler will rename it and won't work
//       let test = 3
//       test = await $.get("https://s105-de.ogame.gameforge.com/game/index.php?page=ingame&component=technologydetails&ajax=1&ajax=1&action=getDetails&technology=113")
//       return test

//   });

//   ogame = page

//   //Only when raiding on different planet than Home planet
//   await ogame.goto("https://s105-de.ogame.gameforge.com/game/index.php?page=ingame&component=overview&cp=41632861")

//   // console.log(ogame)
//   res.status(200).send(title)
