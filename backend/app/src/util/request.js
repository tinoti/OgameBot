"use strict"

let page

const setPage = async (puppeteerPage) => {
  page = puppeteerPage
}


const goToPage = async (url) => {
  await page.goto(url)
}

const ajaxGet = async (url) => {
  const result = await page.evaluate(async (url) => {
    const $ = window.$; //otherwise the transpiler will rename it and won't work
    return await $.get(url)
  }, url)

  // console.log(result)
  return result
}

const ajaxPost = async (url, data) => {
  const result = await page.evaluate(async (url, data) => {
    try {
      const $ = window.$ //otherwise the transpiler will rename it and won't work
      return await $.post(url, data)
      
    } catch (error) {
      return error
    }
  }, url, data)

  // console.log(result)
  return result
}

const getNewTokenFromDom = async () => {
  return await page.evaluate(async () => {
    const $ = window.$ //otherwise the transpiler will rename it and won't work

    const data = await $.get("https://s115-de.ogame.gameforge.com/game/index.php?page=messages&tab=20&ajax=1")
    const tempDom = $('<div></div>').append($.parseHTML(data));
    const token = tempDom.find("input").val()
    return token
  })
}


const getFleetInfo = async () => {
  return await page.evaluate(async () => {
    const $ = window.$ //otherwise the transpiler will rename it and won't work
    const data = await $.get("https://s115-de.ogame.gameforge.com/game/index.php?page=ingame&component=fleetdispatch")
    const tempDom = $('<div></div>').append($.parseHTML(data));
    const largeTransporter = tempDom.find(".transporterLarge .amount").attr("data-value")
    const smallTransporter = tempDom.find(".transporterSmall .amount").attr("data-value")
    return { largeTransporter: parseInt(largeTransporter), smallTransporter: parseInt(smallTransporter) }
  })
}


// const data = await $.get("https://s115-de.ogame.gameforge.com/game/index.php?page=ingame&component=fleetdispatch")
//  const tempDom = $('<div></div>').append($.parseHTML(data));
//   console.log(tempDom.find(".transporterLarge .amount").attr("data-value"))


module.exports = {
  setPage,
  ajaxGet,
  ajaxPost,
  goToPage,
  getNewTokenFromDom,
  getFleetInfo
}

