"use strict"

let page

const setPage = async (puppeteerPage) => {
  page = puppeteerPage
}

const ajaxGet = async (url) => {
  return await page.evaluate(async (url) => {
    const $ = window.$; //otherwise the transpiler will rename it and won't work
    return await $.get(url)
  }, url)

}

const ajaxPost = async (url, data) => {
  return await page.evaluate(async (url, data) => {
    const $ = window.$ //otherwise the transpiler will rename it and won't work
    return await $.post(url, data)
  }, url, data)
}


module.exports = {
  setPage,
  ajaxGet,
  ajaxPost
}

