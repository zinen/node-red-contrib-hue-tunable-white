module.exports = function (RED) {
  'use strict'
  const fetch = require('node-fetch')
  function TunableWhiteNode (config) {
    RED.nodes.createNode(this, config)

    this.APIKey = config.key
    this.ipAddress = config.url
    this.url = 'http://' + this.ipAddress + '/api/' + this.APIKey + '/lights/'
    this.lastColor = 0
    this.forceRun = true
    var node = this

    async function delay (msSec) {
      return new Promise(resolve => {
        setTimeout(() => resolve('DelayTimeout'), msSec)
      })
    }

    node.on('input', async function (msg, send, done) {
      const bulbChanged = []
      const bulbNotChanged = []
      try {
        const currentHour = (new Date()).getHours()
        const currentMinute = (new Date()).getMinutes()
        msg.time = String(currentHour).padStart(2, '0') + ':' + String(currentMinute).padStart(2, '0')
        const convertedMinute = currentMinute * 0.01667 // Convert minute to decimal, eg. 15 minutes = 0,25 in decimal
        const convertedTime = currentHour + convertedMinute
        if (msg.reset === true) {
          this.forceRun = true
        }
        // Insert excel equation below, y = 3,125x2 - 87,5x + 812,5:
        let calculatedTemperature = Math.floor(3.125 * convertedTime ** 2 - 87.5 * convertedTime + 812)
        if (calculatedTemperature < 200) {
          calculatedTemperature = 200
        } else if (calculatedTemperature > 400) {
          calculatedTemperature = 400
        }
        // Lamp data settings, bri = 1 -254, ct= 153-454
        // ct value lower then 190 does not seem to effect Osram LIGHTIFY
        const dataCycle = { ct: calculatedTemperature, transitiontime: 50 }
        // const r = await fetch(url)
        const r = await Promise.race([
          fetch(this.url),
          new Promise((resolve, reject) =>
            setTimeout(() => reject(new Error('Url request timeout')), 5000)
          )
        ])
        const requestData = await r.json()
        if (Array.isArray(requestData) && 'error' in requestData[0]) {
          throw new Error(requestData[0].error.description)
        }
        let i = 0 // Used to keep track of amount of request to the Hue bridge during this cycle

        for (const k in requestData) {
        // Looks if bulb is reachable and in white mode(eg. not colored).
          if (requestData[k].state.reachable === true && requestData[k].state.colormode === 'ct') {
            const ctState = requestData[k].state.ct
            // Look to see if color should change:
            // If 366 = Philips Hue bulb default color, then change
            // If 370 = Osram LIGHTIFY bulb default color, then change
            // If color(ctState) same as last ordered color, then change
            // If bulb already is the desired, don't change
            if (this.forceRun || (((ctState === 366) || (ctState === 370) || (ctState === this.lastColor)) && (ctState !== calculatedTemperature))) {
              i = i + 1
              fetch(this.url + toString(k) + '/state/', {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(dataCycle)
              })
              bulbChanged.push(requestData[k].name)
              if (i > 9) {
                i = 0
                await delay(1000) // 1 second timeout as defined in the Phillips Hue API (Core Limitations)
              }
            } else {
              bulbNotChanged.push(requestData[k].name)
            }
          }
        }
        this.lastColor = calculatedTemperature
      } catch (error) {
        done(error.message)
        return
      }

      // Disables force_run command
      if (this.forceRun) {
        this.forceRun = false
      }
      msg.payload = { newColor: this.lastColor, bulbChanged: bulbChanged, bulbNotChanged: bulbNotChanged }
      send(msg)
      // New listener for Node-RED 1.0 >
      done()
    })
  }
  RED.nodes.registerType('tunable-white', TunableWhiteNode)
}
