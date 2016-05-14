var SlackIRC = require('./lib/slack-irc.js').default;

const config = {
    slack: {
        name: 'irc-bot',
        token: 'xxxx-xxxxxxxxxxxxxxxx-xxxxxxxxxxxxxxx',
        channel: 'channel-name-no-hash'
    },

    irc: {
        server: 'irc.freenode.net',
        nick: 'name_to_speak_from', // Messages formatted as: `nick: <slack_name> MESSAGE`
        channel: 'channel-name-no-hash',

        options: {
            port: 6697,             // These options are passed straight to https://github.com/martynsmith/node-irc
            secure: true,
            selfSigned: true
        }
    }
}

const slack_irc = new SlackIRC(config);
