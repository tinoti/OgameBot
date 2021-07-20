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
  const { data } = await axios.get('/users/me/accounts');
  return data
}

const serverLogin = async (id, language, number) => {
  const { data } = await axios.get(`/users/me/loginLink?id=${id}&server[language]=${language}&server[number]=${number}&clickedButton=account_list`);
  return data
}

module.exports = {
  login,
  setAxiosHeaders,
  getAccountData,
  serverLogin
}
