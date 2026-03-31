const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  PermissionFlagsBits
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

const SERVER2_ID = '1488203493633294471';
const SERVER1_ID = '1472361414474727434';
const BOOSTER_ROLE_ID = '1488206021796298774';
const REWARD_ROLE_ID = '1488350841353277542';
const TOKEN = process.env.TOKEN;

async function syncBoosters() {
  try {
    console.log('Starting booster sync...');

    const sourceGuild = await client.guilds.fetch(SERVER2_ID);
    const targetGuild = await client.guilds.fetch(SERVER1_ID);

    await sourceGuild.members.fetch();
    await targetGuild.members.fetch();

    const sourceBoosters = sourceGuild.members.cache.filter(member =>
      member.roles.cache.has(BOOSTER_ROLE_ID)
    );

    const targetRewardMembers = targetGuild.members.cache.filter(member =>
      member.roles.cache.has(REWARD_ROLE_ID)
    );

    let added = 0;
    let removed = 0;

    for (const [userId] of sourceBoosters) {
      const targetMember = targetGuild.members.cache.get(userId);
      if (!targetMember) continue;

      if (!targetMember.roles.cache.has(REWARD_ROLE_ID)) {
        await targetMember.roles.add(REWARD_ROLE_ID).catch(console.error);
        console.log(`Synced role to ${targetMember.user.tag}`);
        added++;
      }
    }

    for (const [userId, targetMember] of targetRewardMembers) {
      const sourceMember = sourceGuild.members.cache.get(userId);
      const isBoosting = sourceMember?.roles.cache.has(BOOSTER_ROLE_ID);

      if (!isBoosting) {
        await targetMember.roles.remove(REWARD_ROLE_ID).catch(console.error);
        console.log(`Removed synced role from ${targetMember.user.tag}`);
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

client.once('clientReady', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  try {
    const command = new SlashCommandBuilder()
      .setName('syncboosters')
      .setDescription('Sync booster roles from Server 2 to Server 1')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

    const guild1 = await client.guilds.fetch(SERVER1_ID);
    await guild1.commands.create(command);
    console.log('Slash command /syncboosters registered in Server 1');
  } catch (err) {
    console.error('Failed to register slash command:', err);
  }

  await syncBoosters();
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
  try {
    if (newMember.guild.id !== SERVER2_ID) return;

    const hadBoost = oldMember.roles.cache.has(BOOSTER_ROLE_ID);
    const hasBoost = newMember.roles.cache.has(BOOSTER_ROLE_ID);

    const targetGuild = await client.guilds.fetch(SERVER1_ID);
    const targetMember = await targetGuild.members.fetch(newMember.id).catch(() => null);

    if (!targetMember) {
      console.log(`${newMember.user.tag} is not in Server 1`);
      return;
    }

    if (!hadBoost && hasBoost) {
      await targetMember.roles.add(REWARD_ROLE_ID).catch(console.error);
      console.log(`Gave role to ${newMember.user.tag}`);
    }

    if (hadBoost && !hasBoost) {
      await targetMember.roles.remove(REWARD_ROLE_ID).catch(console.error);
      console.log(`Removed role from ${newMember.user.tag}`);
    }
  } catch (err) {
    console.error(err);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'syncboosters') return;

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: 'You do not have permission to use this command.',
      ephemeral: true
    });
    return;
  }

  await interaction.reply({
    content: 'Syncing boosters now...',
    ephemeral: true
  });

  const result = await syncBoosters();

  if (!result) {
    await interaction.editReply('Sync failed. Check logs.');
    return;
  }

  await interaction.editReply(
    `Sync complete. Added: ${result.added}, Removed: ${result.removed}`
  );
});

setInterval(() => {
  console.log(`Bot alive: ${new Date().toISOString()}`);
}, 60000);

client.login(TOKEN).catch(console.error);
