import {FindResult, RGBot} from 'rg-bot';

import {Item} from 'prismarine-item';
import {Entity} from 'prismarine-entity';
import {Vec3} from 'vec3';
import RGCTFUtils from 'rg-ctf-utils';

const {
    moveTowardPosition,
    usePotionOfType,
    getPotionOfType,
    usePotion
} = require('./HelperFunctions')


export async function handleLowHealth(bot: RGBot, rgctfUtils: RGCTFUtils, opponents: Entity[], teamMates: Entity[]): Promise<boolean> {
    if (bot.mineflayer().health <= 7) {
        // near death, see if I can use a potion to make the opponent die with me
        const nearOpponent: Entity = opponents.find(them => {
            // within ~4 blocks away
            return them.position.distanceSquared(bot.position()) <= 16
        })
        if (nearOpponent) {
            const potion: Item = getPotionOfType(bot, 'ninja')
            if (potion) {
                // look at their feet before throwing down a ninja potion
                await bot.mineflayer().lookAt(nearOpponent.position.offset(0, -1, 0))
                return await usePotion(bot, potion)
            }
        }
    } else if( bot.mineflayer().health <= 15) {
        // just need a top up
        console.log(`[Health] Need to use potion while my health is low`)
        return await usePotionOfType('health')
    }
    return false
}

export async function handleAttackFlagCarrier(bot: RGBot, rgctfUtils: RGCTFUtils, opponents: Entity[], teamMates: Entity[]): Promise<boolean> {
    // find out if the flag is available
    const flagLocation: Vec3 = rgctfUtils.getFlagLocation()
    if (!flagLocation) {
        console.log(`Checking ${opponents.length} opponents in range for flag carriers`)
        // see if one of these opponents is holding the flag
        const opponentWithFlag = opponents.filter(them => {
            if (them.heldItem && them.heldItem.name.includes(rgctfUtils.FLAG_SUFFIX)) {
                console.log(`Player ${them.name} is holding the flag`)
                return true
            }
        })?.shift()

        if (opponentWithFlag) {
            console.log(`Attacking flag carrier ${opponentWithFlag.name} at position: ${bot.vecToString(opponentWithFlag.position)}`)
            await usePotionOfType('movement') // run faster to get them
            // TODO: Once I get in range of attack, should I use a combat potion ? should I equip a shield ?
            await bot.attackEntity(opponentWithFlag)
            return true
        }
    }
    return false
}

export async function handleAttackNearbyOpponent(bot: RGBot, rgctfUtils: RGCTFUtils, opponents: Entity[], teamMates: Entity[]): Promise<boolean> {
    const outnumbered: boolean = teamMates.length + 1 < opponents.length
    const yolo: boolean = teamMates.length == 0

    const myPosition = bot.position()

    // opportunistically kill any player in close range even if that means dropping the flag to do it
    const theOpponents: Entity[] = opponents.filter(a => {
        // within range 10 regular, 5 if I have the flag
        return a.position.distanceSquared(myPosition) <= (rgctfUtils.hasFlag() ? 25 : 100)
    })

    console.log(`Checking ${theOpponents.length} opponents in range to murder`)
    if (theOpponents.length > 0) {
        const firstOpponent = theOpponents[0]

        //Attack if a teammate is nearby only, otherwise move toward team-mate
        if (!outnumbered || yolo) {
            console.log(`Attacking opponent at position: ${bot.vecToString(firstOpponent.position)}`)
            // TODO: Once I get in range of attack, should I use a combat potion ? should I equip a shield ?
            await bot.attackEntity(firstOpponent)
            return true
        } else {
            console.log(`Outnumbered, running to nearest team-mate for help`)
            //TODO: Do I need to use potions ? un-equip my shield to run faster ?
            await moveTowardPosition(bot, teamMates[0].position, 3)
            return true
        }
    }
    return false
}

export async function handleScoringFlag(bot: RGBot, rgctfUtils: RGCTFUtils, opponents: Entity[], teamMates: Entity[]): Promise<boolean> {
    if( rgctfUtils.hasFlag()) {
        //TODO: Do I need to use potions ? un-equip my shield to run faster ?
        console.log(`I have the flag, running to score`)
        const myTeamName = bot.getMyTeam()
        const myScoreLocation: Vec3 =
            myTeamName == 'BLUE' ? rgctfUtils.BLUE_SCORE_LOCATION : rgctfUtils.RED_SCORE_LOCATION
        await moveTowardPosition(bot, myScoreLocation, 1)
        return true
    }
    return false
}

export async function handleCollectingFlag(bot: RGBot, rgctfUtils: RGCTFUtils, opponents: Entity[], teamMates: Entity[]): Promise<boolean> {
    const flagLocation: Vec3 = rgctfUtils.getFlagLocation()
    if (flagLocation) {
        console.log(`Moving toward the flag at ${bot.vecToString(flagLocation)}`)
        //TODO: Do I need to use potions ? un-equip my shield to run faster ?
        await moveTowardPosition(bot, flagLocation, 1)
        return true
    }
    return false
}

const placeableBlockDisplayNames = ['Gravel', 'Grass Block', 'Dirt', 'Stripped Dark Oak Wood']

const blue_block_placements = [
    // bridge blockade
    new Vec3(81,65,-387), new Vec3(81, 66, -387), new Vec3(81,65,-385), new Vec3(81, 66, -385)
]

const red_block_placements = [
    // bridge blockade
    new Vec3(111,65,-387), new Vec3(111, 66, -387), new Vec3(111,65,-385), new Vec3(111, 66, -385)

]

export async function handlePlacingBlocks(bot: RGBot, rgctfUtils: RGCTFUtils, opponents: Entity[], teamMates: Entity[]): Promise<boolean> {
    const myPosition = bot.position()
    const myTeamName = bot.getMyTeam()

    const theOpponents = opponents.filter((op) => {
        // only consider bots on the same y plane not those down in the tunnel
        return (Math.abs(op.position.y - myPosition.y) < 5)
    }).filter(a => {
        // only consider opponents within range ~15
        return a.position.distanceSquared(myPosition) <= 225
    })

    console.log(`Checking ${theOpponents.length} opponents in range before getting items or placing blocks`)
    if (theOpponents.length == 0) {

        // If I have blocks to place, go place blocks at strategic locations if they aren't already filled
        const blockInInventory = bot.getAllInventoryItems().find(item => {
            return placeableBlockDisplayNames.includes(item.displayName)
        })

        if (blockInInventory) {
            console.log(`I have a '${blockInInventory.displayName}' block to place`)
            const block_placements = myTeamName == 'BLUE' ? blue_block_placements : red_block_placements
            for (const location of block_placements) {
                // if I'm within 20 blocks of a place to put blocks
                const block = bot.mineflayer().blockAt(location)
                const rangeSq = location.distanceSquared(myPosition)
                console.log(`Checking for block: ${block && block.type} at rangeSq: ${rangeSq}`)
                if (rangeSq <= 400) {
                    if (!block || block.type == 0 /*air*/) {
                        console.log(`Moving to place block '${blockInInventory.displayName}' at: ${location}`)
                        await moveTowardPosition(bot, location, 3)
                        // if I'm close, then place the block
                        if (location.distanceSquared(myPosition) < 15) {
                            console.log(`Placing block '${blockInInventory.displayName}' at: ${location}`)
                            // TODO: RGBot.placeBlock should handle this for us once a defect is fixed
                            await bot.mineflayer().equip(blockInInventory, 'hand')
                            // place block on top face of the block under our target
                            await bot.mineflayer().placeBlock(bot.mineflayer().blockAt(location.offset(0, -1, 0)), new Vec3(0, 1, 0))
                        }
                        return true
                    }
                }
            }
        } else {
            console.log(`No placeable blocks in inventory`)
        }
    }
    return false
}

export async function handleLootingItems(bot: RGBot, rgctfUtils: RGCTFUtils, opponents: Entity[], teamMates: Entity[]): Promise<boolean> {
    const myPosition = bot.position()
    const item: Item = bot.findItemsOnGround({
        maxDistance: 33,
        maxCount: 5,
        // prioritize items I don't have that are the closest
        itemValueFunction: (blockName) => {
            return bot.inventoryContainsItem(blockName) ? 999999 : 1
        },
        sortValueFunction: (distance, pointValue) => {
            return distance * pointValue
        }
    }).filter((theItem: FindResult<Item>) => {
        // @ts-ignore
        // TODO: Should I let my bots run down into the tunnel for better loot ?
        // or keep them on the top only
        return (Math.abs(theItem.result.position.y - myPosition.y) < 5)
    }).map(t => t.result)?.shift()

    if (item) {
        // @ts-ignore
        console.log(`Going to collect item: ${item.name} at: ${bot.vecToString(item.position)}`)
        //TODO: Do I need to use potions ? un-equip my shield to run faster ?

        // @ts-ignore
        await moveTowardPosition(bot, item.position, 1)
        return true
    }
    return false
}

export async function handleBotIdlePosition(bot: RGBot, rgctfUtils: RGCTFUtils, opponents: Entity[], teamMates: Entity[]): Promise<boolean> {
    // TODO: Is this really the best place to move my bot towards ?
    // Hint: This is where most of Macro game strategy gets implemented
    // Do my bots spread out to key points looking for items or opponents ?
    // Do my bots group up to control key areas of the map ?
    // Do those areas of the map change dependent on where the flag currently is ?
    console.log(`Moving toward center point: ${bot.vecToString(rgctfUtils.FLAG_SPAWN)}`)
    await moveTowardPosition(bot, rgctfUtils.FLAG_SPAWN, 1)
    return true
}