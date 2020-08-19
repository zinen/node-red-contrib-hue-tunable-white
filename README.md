# node-red-contrib-hue-tunable-white
Node-RED node automatic change white color temperature of lights as the day progress.

A tiny script just to give you a feeling of varying daylight. It's used to take advantage of a function that can be automated for the connected lights. 

Give the node an input every so often to make it do its thing. Eg. every 15 minutes seams to work good. Also i recommend sending a ``msg.reset`` once a day, eg. at night, to overrule any manually changed lamps back to having its color temperature automated.

*I'm using this script to fight of winter depression, and it has been running successfully in my home for some time now, since winter 2016*


# How it works
At first run all lights are controlled to the right color temperature for the current time. Once this first run is completed the node will do a more careful update of the color temperature.
It will only change the color if the lights currently has the default startup color temperature or has the value has this node specified last. This means you can still change you lights and this node will respect that you manually took control of the light.

## Calculating the color
The node will use system time of the server to do a calculation of the color. A caveat to only relying on time is the color does not follow the real state of the sun at your location, as I found it more usable to control the light according to a fix schema.

So this is how its calculated:
At 6:00 and again at 22:00 the color will be the most orange. At 14:00 the color will be white-blueish.

The graph below shows how the color will change according to the current hour.

![alt](./img/graph.png)

# Supported devices
Tested with these lights:
* Philips hue white ambiance
* Philips hue color
* Osram LIGHTIFY

*Not tested with lights that only does dimming, as I don't got access to any*


## Requirements
Requires a Hue Bridge and for you to grab a API key from it:
[Official guide to getting the API key (aka. *username*)](https://developers.meethue.com/develop/get-started-2/)
