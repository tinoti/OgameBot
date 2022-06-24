"use strict"
const Axios = require("axios")

const axios = Axios.create({
  withCredentials: true,
  baseURL: 'https://lobby.ogame.gameforge.com/api',
});

const login = async (postData) => {
  return await axios.post('https://gameforge.com/api/v1/auth/thin/sessions', postData)

}

const setAxiosHeaders = async (token, xsrfCookieName) => {
  axios.interceptors.request.use(config => {
    config.headers.cookie = "XSRF-TOKEN";
    config.headers.authorization = `Bearer ${token}`;
    return config;
  });
}

const getAccountData = async () => {
  const { data } = await axios.get('https://lobby.ogame.gameforge.com/api/users/me/accounts');
  return data
}

const serverLogin = async (id, language, number) => {
  const { data } = await axios.get(`https://lobby.ogame.gameforge.com/api/users/me/loginLink?id=${id}&server[language]=${language}&server[number]=${number}&clickedButton=account_list`);
  return data
}

const tryChallenge = async (challengeId) => {
  const url = `https://image-drop-challenge.gameforge.com/challenge/74231ce0-d666-4505-9e4c-83918844ea29/en-GB`
  console.log(url)
  return await axios.get(url)
}

module.exports = {
  login,
  setAxiosHeaders,
  getAccountData,
  serverLogin,
  tryChallenge
}
