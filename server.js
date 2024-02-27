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
const fpQueryURL = process.env['FP_QUERY_URL']



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
TOKEN_PRICES = {};


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

    // Update token prices and save in TOKEN_PRICES global var
    await updateTokenPrices();

    // Update BTC Price channel string
    SETTINGS.channels.btc_price_channel.name = await generateBtcPriceStatString();

    // Update floor price
    SETTINGS.channels.floor_price_channel.name = await generateFloorPriceStatString();

    // Update hashpower
    SETTINGS.channels.hash_rate_channel.name = await generateHashPowerStatString();


    // Write updated JSON object to file
    fs.writeFileSync(settingsFilePath, JSON.stringify(SETTINGS));
    console.log(`[INFO] settings.json updated successfully (prices).`);

    /********************************************************************
     * Update channel names with stats
     *******************************************************************/

    // Read the settings and save into memory
    SETTINGS = JSON.parse(fs.readFileSync(settingsFilePath));
    console.log(`[INFO] settings.json found and loaded (refresh).`);

    // Update all channel labels
    for (var key in SETTINGS.channels) {
        var channel = SETTINGS.channels[key];
        await guild.channels.cache.get(channel.id).setName(channel.name);
        console.log(`[INFO] ${channel.id} => "${channel.name}"`);
    }
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


async function updateTokenPrices() {

    await axios.get(`${queryURL}`).then(res => {

        // Just dump CoinGecko results to global variable
        if (res.data) {
            TOKEN_PRICES = res.data;
        }

    });

}

async function generateBtcPriceStatString() {

    result = ``;

    let currentPrice = TOKEN_PRICES[0].current_price || 0
    let priceChange = TOKEN_PRICES[0].price_change_24h || 0
    let priceChangePercentage = TOKEN_PRICES[0].price_change_percentage_24h.toFixed(2) || 0
    // let queryDate = TOKEN_PRICES[0].last_updated || '---'

    // Prepare "up" or "down" symbol
    var priceDirection;
    var alertColor;
    if (priceChange > 0) {
        priceDirection = `\u2197`;
        alertColor = `🟢`;
    } else if (priceChange < 0) {
        priceDirection = `\u2198`;
        alertColor = `🔴`;
    } else {
        priceDirection = `\u2192`;
        alertColor = `⚪`;
    }

    result = `${alertColor}BTC ${priceDirection} ${currentPrice} (${priceChangePercentage}%)`;

    return result;
}

async function generateFloorPriceStatString() {

    result = `asdFP: 980 LUNA ($816.12)`;
    result = ``;

    luna_price = 0;
    for (var key in TOKEN_PRICES) {

        var token = TOKEN_PRICES[key];

        if (token.symbol == 'luna') {

            luna_price = token.current_price;

        }
    }
    
    
    floor_price = 0;
    await axios.get(`${fpQueryURL}`).then(res => {
        
        // Just dump CoinGecko results to global variable
        if (res.data) {

            floor_price = res.data.floor;
            
        }
        
    });
    
    dollar_price = floor_price * luna_price;

    result = `🟡${floor_price} Floor ($${dollar_price.toFixed(2)})`;

    return result;
}

async function generateHashPowerStatString() {

    // TODO

    result = ``;

    // Dummy
    result = `asdHashpower: 150TH/s`;

    return result;
}


