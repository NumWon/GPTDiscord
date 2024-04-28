// need to add payment method, use new api key, and retry
require('dotenv/config');
const { Client, IntentsBitField } = require('discord.js')
const OpenAI = require('openai');

const client = new Client(
	{
		intents: [
			IntentsBitField.Flags.Guilds, // discord server
			IntentsBitField.Flags.GuildMessages, // server messages
			IntentsBitField.Flags.MessageContent, // actual msg content
		]
	}
);

client.on('ready', () => {
	console.log("Bot is online.");
});

const apiKey = process.env.API_KEY;

if (!apiKey) {
	console.error("API key is missing. Please define it in your environment variables.");
	process.exit(1);
}

const openai = new OpenAI({ apiKey });

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 1000;

async function sendOpenAIRequestWithRetry(openaiRequest, retries = 0) {
	try {
		return await openaiRequest();
	} catch (error) {
		if (error.code === 'insufficient_quota' && retries < MAX_RETRIES) {
			console.error(`Rate limit error occurred. Retrying in ${RETRY_DELAY_MS / 1000} seconds...`);
			await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
			return sendOpenAIRequestWithRetry(openaiRequest, retries + 1);
		} else {
			throw error;
		}
	}
}

client.on('messageCreate', async (message) => {
	console.log(message);
	if (message.author.bot) return;
	if (message.channel.id !== process.env.CHANNEL_ID) return;
	if (message.content.startsWith('!')) return;

	let convoLog = [{ role: 'system', content: 'You are a friendly ChatBot.' }];

	convoLog.push({
		role: 'user',
		content: message.content,
	});

	await message.channel.sendTyping();
	
	try {
		const result = await sendOpenAIRequestWithRetry(() => openai.chat.completions.create({ 
			messages: convoLog,
			model: 'gpt-3.5-turbo',
		}));
		
		message.reply(result.choices[0].message);
	} catch (error) {
		console.error('Error occurred while sending OpenAI request: ', error);
		message.reply('Sorry, I encountered an error while processing your request.');
	}
});

client.login(process.env.TOKEN);