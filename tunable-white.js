module.exports = function (RED) {
  const fetch = require('node-fetch')
  const { createModel } = require('polynomial-regression')
  function TunableWhiteNode (config) {
    RED.nodes.createNode(this, config)
  
    this.url = 'http://' + config.url + '/api/' + config.key + '/lights/'
    this.colorLast = 0
    const node = this
    this.dataModel = [
      [config.dataPoint1Hour || 7, config.dataPoint1CT || 400],
      [config.dataPoint2Hour || 14, config.dataPoint2CT || 200],
      [config.dataPoint3Hour || 21, config.dataPoint3CT || 400]
    ]
    this.model = createModel()
    this.model.fit(this.dataModel, [2])

    this.CTMin = config.CTMin || 195
    this.CTMax = config.CTMax || 410

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
        let forceRun = false
        if (msg.reset === true) {
          forceRun = true
        }
        // if (msg.newColor) {
        if (msg.newColor && !parseInt(msg.newColor)) {
          throw new Error('New color input is not a number')
        }
        let colorNew = parseInt(msg.newColor) || Math.floor(this.model.estimate(2, convertedTime))
        // Don't use too low or too high a color temperature
        if (colorNew < this.CTMin) {
          colorNew = this.CTMin
        } else if (colorNew > this.CTMax) {
          colorNew = this.CTMax
        }
        // Lamp data settings, bri = 1 -254, ct= 153-500
        // ct value lower then 190 does not seem to effect Osram LIGHTIFY
        // transition time of 5 seconds seams to look nice and is still quick
        const dataCycle = { ct: colorNew, transitiontime: 50 }

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
          this.status({ fill: 'red', shape: 'ring', text: 'bridge error' })
          // In case of error from Hue Bridge, throw its description
          throw new Error(requestData[0].error.description)
        }
        // Used to keep track of the amount of request to the Hue bridge during this cycle
        let i = 0
        for (const k in requestData) {
        // Looks if light is reachable and in white mode(eg. not colored).
          const lightState = requestData[k].state
          if (lightState.reachable === true && lightState.on === true && lightState.colormode === 'ct') {
            const ctState = lightState.ct
            // Look to see if color should change. This means that if someone has changed a bulb this script won't change it.
            // If 366 = Philips Hue light default color, then change
            // If 370 = Osram LIGHTIFY light default color, then change
            // If current color (ctState) is the same as last ordered color, then change
            // If light already is the desired color, don't change
            if (forceRun === true || (((ctState === 366) || (ctState === 370) || (ctState === this.colorLast)) && (ctState !== colorNew))) {
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
        this.colorLast = colorNew
      } catch (error) {
        this.status({ fill: 'red', shape: 'ring', text: 'error' })
        done(error.message)
        return
      }
      msg.newColor = this.colorLast
      msg.payload = { lightChanged: lightChanged, lightNotChanged: lightNotChanged }
      // Clear node status
      this.status({ text: '' })
      send(msg)
      // Listener used in Node-RED 1.0.0 >
      done()
    })
  }
  RED.nodes.registerType('tunable-white', TunableWhiteNode)
}
