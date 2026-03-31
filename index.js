const { Client, GatewayIntentBits, SlashCommandBuilder } = require('discord.js');
const http = require('http');

// 🌐 KEEP RAILWAY ALIVE (fake web server)
http.createServer((req, res) => {
  res.write("Bot is running");
  res.end();
}).listen(3000);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// 🔧 YOUR IDs (already filled)
const SERVER2_ID = '1488203493633294471';
const SERVER1_ID = '1472361414474727434';
const BOOSTER_ROLE_ID = '1488206021796298774';
const REWARD_ROLE_ID = '1488350841353277542';

// 🔴 PUT YOUR NEW TOKEN HERE
const TOKEN = process.env.TOKEN;

// 🔁 SYNC FUNCTION
async function syncBoosters() {
  try {
    console.log('Starting booster sync...');

    const sourceGuild = await client.guilds.fetch(SERVER2_ID);
    const targetGuild = await client.guilds.fetch(SERVER1_ID);

    await sourceGuild.members.fetch();
    await targetGuild.members.fetch();

    const sourceBoosters = sourceGuild.members.cache.filter(m =>
      m.roles.cache.has(BOOSTER_ROLE_ID)
    );

    const targetMembers = targetGuild.members.cache;

    let added = 0;
    let removed = 0;

    for (const [id, sourceMember] of sourceBoosters) {
      const targetMember = targetMembers.get(id);
      if (!targetMember) continue;

      if (!targetMember.roles.cache.has(REWARD_ROLE_ID)) {
        await targetMember.roles.add(REWARD_ROLE_ID).catch(console.error);
        added++;
      }
    }

    for (const [id, targetMember] of targetMembers) {
      const sourceMember = sourceGuild.members.cache.get(id);
      const isBoosting = sourceMember?.roles.cache.has(BOOSTER_ROLE_ID);

      if (!isBoosting && targetMember.roles.cache.has(REWARD_ROLE_ID)) {
        await targetMember.roles.remove(REWARD_ROLE_ID).catch(console.error);
        removed++;
      }
    }

    console.log(`Sync complete. Added: ${added}, Removed: ${removed}`);
    return { added, removed };

  } catch (err) {
    console.error('Sync failed:', err);
    return null;
  }
}

// 🚀 READY EVENT
client.once('clientReady', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  // Register slash command
  const command = new SlashCommandBuilder()
    .setName('syncboosters')
    .setDescription('Sync booster roles');

  const guild = await client.guilds.fetch(SERVER1_ID);
  await guild.commands.create(command);

  await syncBoosters();
});

// 🔄 BOOST / UNBOOST DETECTION
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  try {
    if (newMember.guild.id !== SERVER2_ID) return;

    const hadBoost = oldMember.roles.cache.has(BOOSTER_ROLE_ID);
    const hasBoost = newMember.roles.cache.has(BOOSTER_ROLE_ID);

    const targetGuild = await client.guilds.fetch(SERVER1_ID);
    const targetMember = await targetGuild.members.fetch(newMember.id).catch(() => null);

    if (!targetMember) return;

    if (!hadBoost && hasBoost) {
      await targetMember.roles.add(REWARD_ROLE_ID);
      console.log(`Gave role to ${newMember.user.tag}`);
    }

    if (hadBoost && !hasBoost) {
      await targetMember.roles.remove(REWARD_ROLE_ID);
      console.log(`Removed role from ${newMember.user.tag}`);
    }

  } catch (err) {
    console.error(err);
  }
});

// 🔧 SLASH COMMAND
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'syncboosters') return;

  await interaction.reply({ content: 'Syncing...', ephemeral: true });

  const result = await syncBoosters();

  if (!result) {
    await interaction.editReply('Sync failed.');
    return;
  }

  await interaction.editReply(`Added: ${result.added}, Removed: ${result.removed}`);
});

// 🔁 KEEP ALIVE LOOP
setInterval(() => {
  console.log("Bot alive:", new Date().toISOString());
}, 60000);

// 🔑 LOGIN
client.login(TOKEN).catch(console.error);