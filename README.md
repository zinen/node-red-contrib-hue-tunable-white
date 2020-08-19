# node-red-contrib-hue-tunable-white
Node-RED node automatic change white color temperature of lights as the day progress.

A tiny script just to give you a feeling of varying daylight. It's used to take advantage of a function that can be automated for the connected lights. 

*I'm using this script to fight of winter depression, and it has been running in my home for more than 4 years (as of summer 2020) with great results.*


# How it works
At first run all light are controlled to the right color temperature for the current time. Once this first run is completed the node will do a more careful update of the color temperature.
It will only change the color if the light currently has the default startup value(color temperature), or has the value has this node specified last.

# Supported devices
Tested with these lights:
* Philips hue white ambiance
* Philips hue color
* Osram LIGHTIFY


## Requirements
Requires a Hue Bridge and for you to grab a API key from it.
[Official to getting the API key (aka. *username*)](https://developers.meethue.com/develop/get-started-2/)
