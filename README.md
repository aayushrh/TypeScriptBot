# RG Bot Typescript Template

This template is used to create a very simple bot for the Regression Games: Ultimate Collector challenge using typescript.  
_Not sure what this is? Visit https://regression.gg for some programming fun!_

## Minimum Requirements for Regression Games

Your bot must have an `index.ts` file with the following code:

```javascript
import { RGBot } from "rg-bot";

export function configureBot(bot: RGBot) {
  // Bot logic here
}
```
This defines a `configureBot` function and exposes that function to Regression Games.
Regression Games uses it as an entrypoint to your bot script, and passes a bot for you to interact with.

Here is an example of the `configureBot` function with some basic logic that will make your bot parrot back
anything it sees in chat from other players.

```javascript
export function configureBot(bot: RGBot) {

  // Every time a player says something in the game, 
  // do something with that player's username and their message
  bot.on('chat', (username: string, message: string) => {

    // If the username of the speaker is equal to the username of this bot, 
    // don't do anything else. This is because we don't want the bot to repeat 
    // something that it says itself, or else it will spam the chat and be 
    // kicked from the game!
    if (username === bot.username()) return

    // make the bot chat with the same message the other player sent
    bot.chat("This is what I heard: " + message)
  })
  
}
```