import {WebClient, RtmClient, RTM_EVENTS, CLIENT_EVENTS} from '@slack/client';
import irc from 'irc';
import _ from 'underscore';

class SlackIRC {
    constructor(options) {
        this.slack = options.slack;
        this.require('slack.token');
        this.require('slack.name');
        this.require('slack.channel');

        this.irc = options.irc;
        this.require('irc.server');
        this.require('irc.nick');
        this.require('irc.channel');

        if (this.irc.channel.charAt(0) !== '#') this.irc.channel = '#' + this.irc.channel;

        console.log('Initializing Slack Bot');
        this.getSlackInfo().then(
            this.getUserInfo.bind(this)).then(
            () => {
                this.initRTM()
                console.log('Initializing IRC Client');
                this.irc.options = _.extend(this.irc.options, {});
                this.irc.client = new irc.Client(this.irc.server, this.irc.nick, this.irc.options);
                this.irc.client.addListener('error', () => null); // This is just here to avoid spewing things on stderr
                this.irc.connected = false;

                this.slackSpeak(`Slack-IRC is current not connected to ${this.irc.channel}. Use $ircjoin to join. For a full list of commands, use $slack-irc.`);
                console.log('Ready');
            });
    }

    require(key) {
        if (_.has(key)) console.error('Must define ' + key);
    }

    getSlackInfo() {
        return new Promise((resolve, reject) => {
            this.web_client = new WebClient(this.slack.token);

            this.web_client.channels.list({}, (err, info) => {
                if (err) {
                    console.error(err);
                } else {
                    _.each(info.channels, (channel) => {
                        if (this.slack.channel === channel.name) this.slack.channel = channel;  
                    });
                }
                resolve();
            });
        });
    }

    getUserInfo() {
        return new Promise((resolve, reject) => {
            this.slack.members = [];

            Promise.all(this.slack.channel.members.map(
                (member) => this.webClientGetUser(member)
            )).then(resolve);
        });
    }

    webClientGetUser(id) {
        return new Promise((resolve) => {
            this.web_client.users.info(id, (err, info) => {
                if (err) {
                    console.error('Could not get info on member ' + id);
                } else {
                    if (info.user.name !== this.slack.name) this.slack.members.push(info.user);
                }
                resolve();
            });
        });
    }

    getUser(id) {
        return _.find(this.slack.members, (member) => member.id === id);
    }

    getChannel(id) {
        return id === this.slack.channel.id ? this.slack.channel : false;
    }

    initRTM() {
        this.rtm = new RtmClient(this.slack.token);
        this.rtm.start();

        this.rtm.on(RTM_EVENTS.MESSAGE, (message) => {
            if (message.subtype === undefined && this.getChannel(message.channel)) {
                let user = this.getUser(message.user);
                let msg = message.text;

                if (!this.processCommands(msg)) {
                    this.ircSpeak(user, msg);
                }
            } else if (message.subtype === 'channel_leave') {
                this.slack.members = _.reject(this.slack.members, (member) => member.id === message.user);
            } else if (message.subtype === 'channel_join') {
                this.webClientGetUser(message.user);
            }
        });
    }

    processCommands(msg) {
        if (msg.charAt(0) !== '$') return false;

        switch(msg.substr(1)) {
            case 'ircjoin':
                this.ircJoin();
                return true;
            case 'ircleave':
                this.slackSpeak(`Leaving IRC channel ${this.irc.channel}`);
                this.ircLeave();
                return true;
            case 'ircstatus':
                this.slackSpeak(`Current connected to IRC channel: ${this.irc.connected}`);
                return true;
            case 'slack-irc':
                this.slackSpeak('Valid command: $ircjoin, $ircleave, $ircstatus');
                return true;
            default:
                return false;
        }
    }

    slackSpeak(message, from) {
        if (from === undefined) from = '***';
        this.web_client.chat.postMessage(this.slack.channel.id, message, {
            username: from,
            parse: 'full',
            link_names: 1,
            unfurl_links: 1
        });
    }

    ircJoin() {
        this.irc.client.join(this.irc.channel);
        this.ircAddListeners();
        this.irc.connected = true;
    }

    ircLeave() {
        this.irc.client.part(this.irc.channel);
        this.irc.connected = false;
    }

    ircAddListeners() {
        this.irc.client.addListener('message', (from, to, message) => {
            if (to === this.irc.nick) message = `<PM> ${message}`;
            this.slackSpeak(message, from);
        });

        this.irc.client.addListener(`join${this.irc.channel}`, (nick, options) => {
            const msg = `${nick} has joined ${options.args[0]}`;
            this.slackSpeak(msg);
        });

        this.irc.client.addListener(`part${this.irc.channel}`, (nick, reason, options) => {
            const msg = `${nick} has left ${options.args[0]}`;
            this.slackSpeak(msg);
        });
    }

    ircSpeak(slack_user, msg) {
        const message = `<${slack_user.name}>: ${msg}`;
        this.irc.client.say(this.irc.channel, message);
    }
}

export default SlackIRC;
