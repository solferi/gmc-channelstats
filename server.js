/**
 * GMC Stats Bot
 * 
 * This bot creates private voice channels in a Discord server
 * and renames them with updated info.
 * 
 * The updated info currently supported are:
 * 
 *  - BTC Price
 *  - GMC NFT Floor Price (in Luna and $) 
 *  - GMC Mining rig hashrate
 * 
 */

// Environment variables
require('dotenv').config({ path: `${__dirname}/.env` });
const currencySymbol = process.env['CURRENCY_SYMBOL']
const decimals = process.env['DECIMALS']
const updateFrequency = process.env['UPDATE_FREQUENCY']
const discordToken = process.env['DISCORD_TOKEN']
const tokenQueryID = process.env['TOKEN_QUERY_ID']
const baseURL = process.env['BASE_URL']
const guildID = process.env['DISCORD_SERVER_ID']
const queryURL = `${process.env['BASE_URL']}${tokenQueryID}`



// Date formatter
const datetime = new Date();
const strftime = require('strftime');
const strftimeLocal = strftime.timezone('+0800')

// JSON getter and parser
const axios = require(`axios`)

// File IO
const fs = require("fs");
const path = require('path');

// Hard constants
const settingsFilePath = path.join(__dirname, 'settings.json');

// Global Variables
SETTINGS = {};


// Discord
const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
    ],
});
client.login(discordToken);

client.once("ready", () => {
    console.log(`[INFO] Logged in as ${client.user.tag}`);
    channelUpdateLoop();
});

const channelUpdateLoop = function () {

    // Say hello
    console.log(`[INFO] Loop routine started at ${strftimeLocal('%Y-%m-%d %T', new Date())}`);

    // Run the functionality once...
    updateChannels();

    // ...and then run repeatedly, until termination
    // 1000ms x 60s x 1min
    setInterval(updateChannels, (1000 * 60 * 1));

}


// Update the labels of all channels. Create chanels if non-existent
async function updateChannels() {

    const guild = client.guilds.cache.get(guildID);

    // Create channels if doesnt exist
    // btc_price_channel, floor_price_channel, hash_rate_chanel
    if (!fs.existsSync(settingsFilePath)) {

        console.log(`[INFO] Settings not found. Creating new settings...`);
        await createNewChannels(guild);

    } else {
        SETTINGS = JSON.parse(fs.readFileSync(settingsFilePath));
        console.log(`[INFO] settings.json found and loaded (initial).`);
    }

    // Update token prices
    SETTINGS.token_prices = await getTokenPrices();

    // Update BTC Price
    SETTINGS.channels.btc_price_channel.name = await generatePriceStatString();

    // Update floor price
    SETTINGS.channels.floor_price_channel.name = await generateFloorPriceStatString();

    // Update hashpower
    SETTINGS.channels.hash_rate_channel.name = await generateHashPowerStatString();


    // Write updated JSON object to file
    fs.writeFileSync(settingsFilePath, JSON.stringify(SETTINGS));
    console.log(`[INFO]    settings.json updated successfully (prices).`);

    /********************************************************************
     * Update channel names with stats
     *******************************************************************/

    // Read the settings and save into memory
    SETTINGS = JSON.parse(fs.readFileSync(settingsFilePath));
    console.log(`[INFO] settings.json found and loaded (refresh).`);

    let channelID = "";
    let channelName = "";
    
    // Construct BTC Price channel name
    channelID = SETTINGS.channels.btc_price_channel.id;
    channelName = SETTINGS.channels.btc_price_channel.name;
    await guild.channels.cache.get(channelID).setName(channelName);
    console.log(`[INFO] ${channelID} => (${channelName})`);

    // Construct Floor Price channel name
    channelID = SETTINGS.channels.floor_price_channel.id;
    channelName = SETTINGS.channels.floor_price_channel.name;
    await guild.channels.cache.get(channelID).setName(channelName);
    console.log(`[INFO] ${channelID} => (${channelName})`);
    
    // Construct BTC Price channel name
    channelID = SETTINGS.channels.hash_rate_channel.id;
    channelName = SETTINGS.channels.hash_rate_channel.name;
    await guild.channels.cache.get(channelID).setName(channelName);
    console.log(`[INFO] ${channelID} => (${channelName})`);
    
}

async function createNewChannels(guild) {

    // Create BTC Price channel
    console.log(`[INFO] Creating BTC price channel...`);
    const btcPriceChannel = await guild.channels.create({
        name: "BTC Price Channel",
        type: ChannelType.GuildVoice,
    });
    console.log(`[INFO]   Created channel ${btcPriceChannel.id} (${btcPriceChannel.name})`);


    // Create floor price channel
    console.log(`[INFO] Creating floor price channel...`);
    const floorPriceChannel = await guild.channels.create({
        name: "Floor Price Channel",
        type: ChannelType.GuildVoice,
    });
    console.log(`[INFO]   Created channel ${floorPriceChannel.id} (${floorPriceChannel.name})`);


    // Create hash rate channel
    console.log(`[INFO] Creating floor price channel...`);
    const hashRateChannel = await guild.channels.create({
        name: "Hash Rate Channel",
        type: ChannelType.GuildVoice,
    });
    console.log(`[INFO]   Created channel ${hashRateChannel.id} (${hashRateChannel.name})`);


    // Populate "SETTINGS" JSON object
    SETTINGS.channels = {};

    // BTC Price channel
    SETTINGS.channels.btc_price_channel = {};
    SETTINGS.channels.btc_price_channel.id = btcPriceChannel.id;
    SETTINGS.channels.btc_price_channel.name = "";
    
    // Floor Price channel
    SETTINGS.channels.floor_price_channel = {};
    SETTINGS.channels.floor_price_channel.id = floorPriceChannel.id;
    SETTINGS.channels.floor_price_channel.name = "";
    
    // BTC Hash Rate channel
    SETTINGS.channels.hash_rate_channel = {};
    SETTINGS.channels.hash_rate_channel.id = hashRateChannel.id;
    SETTINGS.channels.hash_rate_channel.name = "";

    // Write JSON object to file
    fs.writeFileSync(settingsFilePath, JSON.stringify(SETTINGS));
    console.log(`[INFO]   settings.json saved successfully.`);
}


async function getTokenPrices() {

    // TODO

    let TOKEN_PRICES = {
        'LUNA': 0.98,
        'BTC': 56000.12,
    };
    // axios.get(`${queryURL}`).then(res => {

    //     // Coingecko list
    //     if (res.data) {
    //         res.data.forEach(token => {
    //             // Put inside settings.json
    //             console.log(now(), `INFO: CG`, token.symbol.toUpperCase(), ":", token.current_price);
    //             PRICES[token.symbol.toUpperCase()] = token.current_price;
    //         });
    //     }

    // });
    return TOKEN_PRICES;
}

async function generatePriceStatString() {
    // TODO
    return "56000";
}

async function generateFloorPriceStatString() {

    // TODO
    let BTC_PRICE_CHANNEL = {

    };

    // Dummy
    result = `FP: 980 LUNA ($816.12)`;

    return result;
}

async function generateHashPowerStatString() {

    // TODO

    result = ``;

    // Dummy
    result = `Hashpower: 150TH/s`;

    return result;
}

// Functionality method
function updatePrice() {

    // New line
    console.log(`------------------------`);


    // Query to CoinGecko server
    axios.get(`${queryURL}`).then(res => {

        // If we got a valid response, process the data
        if (res.data) {
            // if (res.data && res.data[0].current_price && res.data[0].price_change_percentage_24h && res.data[0].last_updated) {
            res.data.forEach(token => {

                let currentPrice = res.data[0].current_price || 0
                let priceChange = res.data[0].price_change_24h || 0
                let priceChangePercentage = res.data[0].price_change_percentage_24h || 0
                let queryDate = res.data[0].last_updated || '---'

                // Find or create a channel for price

                // if settings.json doesn't exist, make a new one
                priceChanelID = getSetting("priceChannelID");

                // Prepare "up" or "down" symbol
                var priceDirection
                if (priceChange > 0) {
                    priceDirection = `\u2197`
                } else if (priceChange < 0) {
                    priceDirection = `\u2198`
                } else {
                    priceDirection = `\u2192`
                }

                // Update channel name
                pricedChannelName = `${tickerDisplayID} ${currencySymbol}${currentPrice.toFixed(decimals)} ${priceDirection} (${priceChangePercentage.toFixed(2)}%)`;
                console.log("[CH1]", pricedChannelName);

            });

        } else {
            console.log(`Could not load price data for ${tokenQueryID}`)
        }

    }).catch(err => console.log('Error:', err))

}


