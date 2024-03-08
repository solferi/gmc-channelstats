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
const discordToken = process.env['DISCORD_TOKEN']
const tokenQueryID = process.env['TOKEN_QUERY_ID']
const guildID = process.env['DISCORD_SERVER_ID']
const tokenQueryURL = `${process.env['BASE_URL']}${tokenQueryID}`
const fpQueryURL = process.env['FP_QUERY_URL']
const rigsQueryURL = process.env['RIGS_QUERY_URL']

const nhApiKey = process.env['NH_API_KEY']
const nhApiSecret = process.env['NH_API_SECRET']
const nhOrgId = process.env['NH_ORG_ID']



// Date formatter
const datetime = new Date();
const strftime = require('strftime');
const strftimeLocal = strftime.timezone('+0800')
function now() { return strftimeLocal('%Y-%m-%d %T', new Date()); }

// JSON getter and parser
const axios = require(`axios`)

// File IO
const fs = require("fs");
const path = require('path');

// NiceHash wrapper
const NicehashApiWrapper = require('nicehash-api-wrapper-v2');
const nhApi = new NicehashApiWrapper({
    apiKey: nhApiKey,
    apiSecret: nhApiSecret,
    orgId: nhOrgId
});

// Hard constants

// Global Variables
SETTINGS = {};
TOKEN_PRICES = {};
RIGS_INFO = {};

/**
 * CLOCK COUNT
 * 
 * Counter for delayed updating
 * currently used for nicehash stats
 *      if all of these are updated every 5mins,
 *      need to wait until count 96
 *      which means update every 8 hours (12 = 1hour * 24 = 1 day / 3 = 8 hours)
 *          why 12? there are 12 5-min intervals in an hour. so 12 = 1hour 
 *      if you want daily, remove the "/ 3". that's 24 hours in 5-min intervals 
 */
clockCountLimit = 12 * 24 / 3;
clockCount = clockCountLimit;

// Discord client setup
const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
const { resourceUsage } = require('process');
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.login(discordToken);
client.once("ready", () => {
    console.log(`[INFO] Logged in as ${client.user.tag}`);
    channelUpdateLoop();
});


// Main Loop
const channelUpdateLoop = function () {

    // Say hello
    console.log(`[INFO] Loop routine started at ${strftimeLocal('%Y-%m-%d %T', new Date())}`);

    // Run the functionality once...
    updateChannels();

    // ...and then run repeatedly, until termination
    // 1000ms x 60s x 1min
    setInterval(updateChannels, (1000 * 60 * 5));

}


// Update the labels of all channels. Create chanels if non-existent
async function updateChannels() {

    console.log('');
    console.log('[INFO]', now(), 'Creating/updating channels');

    // Initialize channels folder
    fs.mkdirSync(path.join(__dirname, 'channels'), { recursive: true });

    // Update token prices and save in TOKEN_PRICES global var
    console.log('');
    await updateTokenPrices();

    // If channel doesn't exist, make the channel and save the file
    // File format: <channel_id>.<stattype>
    // i.e. 2342384768687324.hashrate

    // Update price stats
    await createOrUpdateChannel('priceBTC');
    await createOrUpdateChannel('priceLUNA');

    // Update floor stats
    await createOrUpdateChannel('floor');

    // Update mining stats
    console.log('');
    console.log('[INFO] Clock count =', clockCount);
    if (clockCount == clockCountLimit) {

        // Just dump SimpleScraper results to global variable
        await axios.get(`${rigsQueryURL}`).then(res => {
            if (res.data) { RIGS_INFO = res.data; }
        });

        await createOrUpdateChannel('miningHashrate');
        await createOrUpdateChannel('miningDailyProfit');

        // Reset clock count to wait for another 8 hours
        clockCount = 0;

    } else {

        // If not 8 hours yet, just count minutes
        clockCount++;
    }


}

async function updateTokenPrices() {

    await axios.get(`${tokenQueryURL}`).then(res => {

        // Just dump CoinGecko results to global variable
        if (res.data) {
            TOKEN_PRICES = res.data;
            console.log('[INFO] Token prices queried and updated');
        }

    });

}

async function createOrUpdateChannel(statType) {

    // Get guild object for create and update use
    const guild = client.guilds.cache.get(guildID);

    // New line for logging
    console.log('');

    // Find channel if exists
    statChannelID = await getSavedChannel(statType);
    statChannel = {};

    if (!statChannelID) {

        // Create channel and get the ID
        console.log(`[INFO] Creating [${statType}] channel...`);
        statChannel = await guild.channels.create({
            name: statType,
            type: ChannelType.GuildVoice,
        });
        statChannelID = statChannel.id;

        console.log(`[INFO] Created channel ${statChannelID}`);

        // Save chanel to app settings
        fs.writeFileSync(path.join(__dirname, 'channels', `${statChannelID}.${statType}`), '');

    } else {

        // Use the ID to get the channel
        statChannel = guild.channels.cache.get(statChannelID);
        console.log(`[INFO] Found channel ${statChannelID}`);

    }

    // Prepare channel label
    let channelLabelString = await generateChannelLabel(statType);

    // Set channel label
    await statChannel.setName(channelLabelString);
    console.log(`[INFO] Renamed channel ${statChannel.id} to ${channelLabelString}`);

}

async function getSavedChannel(statType) {

    result = ""

    // Get list of files in channels directory
    channelsPath = path.join(__dirname, 'channels');
    const fileNames = fs.readdirSync(channelsPath);

    // Iterate every file
    for (let i = 0; i < fileNames.length; i++) {

        if (fileNames[i].endsWith(statType)) {
            result = fileNames[i].split('.')[0];
            return result;
        }

    }

    // If none found...
    console.log(`[INFO] Channel ${statType} not found`);
}


async function generateChannelLabel(statType) {

    result = ``;

    switch (statType) {

        case 'floor':

            result = makeString_FloorPrice();
            break;

        case 'miningHashrate':

            result = makeString_MiningHashRate();
            break;

        case 'miningDailyProfit':

            result = makeString_MiningDailyProfit();
            break;

        case 'priceBTC':

            result = makeString_Price('btc');
            break;

        case 'priceLUNA':

            result = makeString_Price('luna');
            break;

        default:

    }

    return result;
}


async function makeString_FloorPrice() {

    result = ``;

    token = await getToken('luna');
    luna_price = token.current_price;

    floor_price = 0;
    await axios.get(`${fpQueryURL}`).then(res => {

        if (res.data) {

            floor_price = res.data.floor;

        }

    });

    dollar_price = floor_price * luna_price;

    result = `🟨 Floor: ${floor_price}L ($${dollar_price.toFixed(2)})`;

    return result;
}


async function makeString_MiningHashRate() {

    result = '';

    result = `⛏️: ${RIGS_INFO.data[2].hashrate}`;

    return result;

}

async function makeString_MiningDailyProfit() {

    result = '';

    dailyBTC = RIGS_INFO.data[1].profitability.split(' ')[0] * 1.0;
    token = await getToken('btc');
    btcPrice = token.current_price;
    dailyProfit = dailyBTC * btcPrice;
    result = `⛏️: \u0e3f${dailyBTC.toFixed(4)} ($${dailyProfit.toFixed(2)}) /Day`;

    return result;
}


async function makeString_Price(ticker) {

    result = ``;

    let token = await getToken(ticker)

    let currentPrice = token.current_price || 0
    let priceChange = token.price_change_24h || 0
    let priceChangePercentage = token.price_change_percentage_24h.toFixed(2) || 0

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

    // result = `${alertColor} BTC $${currentPrice} (${priceDirection} ${priceChangePercentage}%)`;
    result = `${alertColor} ${ticker.toUpperCase()}: $${currentPrice} (${priceDirection} ${priceChangePercentage}%)`;

    return result;

}

async function getToken(ticker) {

    result = 0;

    for (var key in TOKEN_PRICES) {
        var token = TOKEN_PRICES[key];
        if (token.symbol == ticker) { result = token; }
    }

    return result;

}


async function generateHashPowerStatString() {

    result = ``;

    // Get rigs info
    await nhApi.MinerPrivate.getRigs()
        .then((res) => {

            totalSpeed = 0;
            for (var key in res.totalSpeedAccepted) {

                var speed = res.totalSpeedAccepted[key];

                totalSpeed += speed;
            }

            activeRigCount = res.minerStatuses.MINING || 0;
            rigCountString = activeRigCount;
            // rigCountString = activeRigCount + (activeRigCount > 1 ? ` miners` : ` miner`);

            result = `Rigs: x${rigCountString} (${totalSpeed.toFixed(2)} GH/s)`;

            console.log(`[    ] ${result}`);

        });



    // Dummy placeholder
    result = `(coming soon)`;
    return result;
}

