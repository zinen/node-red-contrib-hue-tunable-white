module.exports = function (RED) {
  'use strict'
  const fetch = require('node-fetch')
  function TunableWhiteNode (config) {
    RED.nodes.createNode(this, config)

    this.url = 'http://' + config.url + '/api/' + config.key + '/lights/'
    this.lastColor = 0
    this.forceRun = true
    var node = this

    async function delay (msSec) {
      return new Promise(resolve => {
        setTimeout(() => resolve('DelayTimeout'), msSec)
      })
    }

    node.on('input', async function (msg, send, done) {
      // Used as output to tell which reachable lights was changed
      const lightChanged = []
      // Used as output to tell which reachable lights that was not changed
      const lightNotChanged = []
      try {
        // Calculate the current hour as a decimal number
        const currentHour = (new Date()).getHours()
        const currentMinute = (new Date()).getMinutes()
        // Convert minute to decimal of hour, eg. 15 minutes = 0,25 in decimal
        const convertedTime = currentHour + currentMinute * 0.01667
        // Used as output to to tell the time used by calculations. (mostly relevant for debugging)
        msg.time = String(currentHour).padStart(2, '0') + ':' + String(currentMinute).padStart(2, '0')
        if (msg.reset === true) {
          this.forceRun = true
        }
        // Insert equation from calculated graph below, y = 3,125x2 - 87,5x + 812,5:
        let calculatedTemperature = Math.floor(3.125 * convertedTime ** 2 - 87.5 * convertedTime + 812)
        if (calculatedTemperature < 200) {
          // Don't use lower color temperature value then 200
          calculatedTemperature = 200
        } else if (calculatedTemperature > 400) {
          // Don't use higher color temperature value then 400
          calculatedTemperature = 400
        }
        // Lamp data settings, bri = 1 -254, ct= 153-454
        // ct value lower then 190 does not seem to effect Osram LIGHTIFY
        // transition time of 5 seconds seams to look nice and is still quick
        const dataCycle = { ct: calculatedTemperature, transitiontime: 50 }
        // Make a promise race to make sure longest timeout for fetching data is defined.
        // as the Hue Bridge in most cases is installed on the local LAN a short timeout is used.
        const r = await Promise.race([
          fetch(this.url),
          new Promise((resolve, reject) =>
            setTimeout(() => reject(new Error('Url request timeout')), 5000)
          )
        ])
        const requestData = await r.json()
        // Hue Bridge normally reply with and JSON object. But in case of errors it returns an array
        if (Array.isArray(requestData) && 'error' in requestData[0]) {
          // In case of error from Hue Bridge, throw its description
          throw new Error(requestData[0].error.description)
        }
        // Used to keep track of the amount of request to the Hue bridge during this cycle
        let i = 0
        for (const k in requestData) {
        // Looks if light is reachable and in white mode(eg. not colored).
          if (requestData[k].state.reachable === true && requestData[k].state.colormode === 'ct') {
            const ctState = requestData[k].state.ct
            // Look to see if color should change:
            // If 366 = Philips Hue light default color, then change
            // If 370 = Osram LIGHTIFY light default color, then change
            // If color(ctState) same as last ordered color, then change
            // If light already is the desired, don't change
            if (this.forceRun === true || (((ctState === 366) || (ctState === 370) || (ctState === this.lastColor)) && (ctState !== calculatedTemperature))) {
              i = i + 1
              // Fetch, but don't await since the reply is not relevant
              fetch(this.url + String(k) + '/state/', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataCycle)
              })
              lightChanged.push(requestData[k].name)
              if (i > 9) {
                i = 0
                // 1 second timeout after 10 requests as defined in the Philips Hue API (Core Limitations)
                await delay(1000)
              }
            } else {
              lightNotChanged.push(requestData[k].name)
            }
          }
        }
        this.lastColor = calculatedTemperature
      } catch (error) {
        done(error.message)
        return
      }

      // Clears force run flag
      if (this.forceRun) {
        this.forceRun = false
      }
      msg.payload = { newColor: this.lastColor, lightChanged: lightChanged, lightNotChanged: lightNotChanged }
      send(msg)
      // Listener used in Node-RED 1.0.0 >
      done()
    })
  }
  RED.nodes.registerType('tunable-white', TunableWhiteNode)
}
