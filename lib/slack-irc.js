'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _client = require('@slack/client');

var _irc = require('irc');

var _irc2 = _interopRequireDefault(_irc);

var _underscore = require('underscore');

var _underscore2 = _interopRequireDefault(_underscore);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var SlackIRC = function () {
    function SlackIRC(options) {
        var _this = this;

        _classCallCheck(this, SlackIRC);

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
        this.getSlackInfo().then(this.getUserInfo.bind(this)).then(function () {
            _this.initRTM();
            console.log('Initializing IRC Client');
            _this.irc.options = _underscore2.default.extend(_this.irc.options, {});
            _this.irc.client = new _irc2.default.Client(_this.irc.server, _this.irc.nick, _this.irc.options);
            _this.irc.client.addListener('error', function () {
                return null;
            }); // This is just here to avoid spewing things on stderr
            _this.irc.connected = false;

            _this.slackSpeak('Slack-IRC is current not connected to ' + _this.irc.channel + '. Use $ircjoin to join. For a full list of commands, use $slack-irc.');
            console.log('Ready');
        });
    }

    _createClass(SlackIRC, [{
        key: 'require',
        value: function require(key) {
            if (_underscore2.default.has(key)) console.error('Must define ' + key);
        }
    }, {
        key: 'getSlackInfo',
        value: function getSlackInfo() {
            var _this2 = this;

            return new Promise(function (resolve, reject) {
                _this2.web_client = new _client.WebClient(_this2.slack.token);

                _this2.web_client.channels.list({}, function (err, info) {
                    if (err) {
                        console.error(err);
                    } else {
                        _underscore2.default.each(info.channels, function (channel) {
                            if (_this2.slack.channel === channel.name) _this2.slack.channel = channel;
                        });
                    }
                    resolve();
                });
            });
        }
    }, {
        key: 'getUserInfo',
        value: function getUserInfo() {
            var _this3 = this;

            return new Promise(function (resolve, reject) {
                _this3.slack.members = [];

                Promise.all(_this3.slack.channel.members.map(function (member) {
                    return _this3.webClientGetUser(member);
                })).then(resolve);
            });
        }
    }, {
        key: 'webClientGetUser',
        value: function webClientGetUser(id) {
            var _this4 = this;

            return new Promise(function (resolve) {
                _this4.web_client.users.info(id, function (err, info) {
                    if (err) {
                        console.error('Could not get info on member ' + id);
                    } else {
                        if (info.user.name !== _this4.slack.name) _this4.slack.members.push(info.user);
                    }
                    resolve();
                });
            });
        }
    }, {
        key: 'getUser',
        value: function getUser(id) {
            return _underscore2.default.find(this.slack.members, function (member) {
                return member.id === id;
            });
        }
    }, {
        key: 'getChannel',
        value: function getChannel(id) {
            return id === this.slack.channel.id ? this.slack.channel : false;
        }
    }, {
        key: 'initRTM',
        value: function initRTM() {
            var _this5 = this;

            this.rtm = new _client.RtmClient(this.slack.token);
            this.rtm.start();

            this.rtm.on(_client.RTM_EVENTS.MESSAGE, function (message) {
                if (message.subtype === undefined && _this5.getChannel(message.channel)) {
                    var user = _this5.getUser(message.user);
                    var msg = message.text;

                    if (!_this5.processCommands(msg)) {
                        _this5.ircSpeak(user, msg);
                    }
                } else if (message.subtype === 'channel_leave') {
                    _this5.slack.members = _underscore2.default.reject(_this5.slack.members, function (member) {
                        return member.id === message.user;
                    });
                } else if (message.subtype === 'channel_join') {
                    _this5.webClientGetUser(message.user);
                }
            });
        }
    }, {
        key: 'processCommands',
        value: function processCommands(msg) {
            if (msg.charAt(0) !== '$') return false;

            switch (msg.substr(1)) {
                case 'ircjoin':
                    this.ircJoin();
                    return true;
                case 'ircleave':
                    this.slackSpeak('Leaving IRC channel ' + this.irc.channel);
                    this.ircLeave();
                    return true;
                case 'ircstatus':
                    this.slackSpeak('Current connected to IRC channel: ' + this.irc.connected);
                    return true;
                case 'slack-irc':
                    this.slackSpeak('Valid command: $ircjoin, $ircleave, $ircstatus');
                    return true;
                default:
                    return false;
            }
        }
    }, {
        key: 'slackSpeak',
        value: function slackSpeak(message, from) {
            if (from === undefined) from = '***';
            this.web_client.chat.postMessage(this.slack.channel.id, message, {
                username: from,
                parse: 'full',
                link_names: 1,
                unfurl_links: 1
            });
        }
    }, {
        key: 'ircJoin',
        value: function ircJoin() {
            this.irc.client.join(this.irc.channel);
            this.ircAddListeners();
            this.irc.connected = true;
        }
    }, {
        key: 'ircLeave',
        value: function ircLeave() {
            this.irc.client.part(this.irc.channel);
            this.irc.connected = false;
        }
    }, {
        key: 'ircAddListeners',
        value: function ircAddListeners() {
            var _this6 = this;

            this.irc.client.addListener('message', function (from, to, message) {
                if (to === _this6.irc.nick) message = '<PM> ' + message;
                _this6.slackSpeak(message, from);
            });

            this.irc.client.addListener('join' + this.irc.channel, function (nick, options) {
                var msg = nick + ' has joined ' + options.args[0];
                _this6.slackSpeak(msg);
            });

            this.irc.client.addListener('part' + this.irc.channel, function (nick, reason, options) {
                var msg = nick + ' has left ' + options.args[0];
                _this6.slackSpeak(msg);
            });
        }
    }, {
        key: 'ircSpeak',
        value: function ircSpeak(slack_user, msg) {
            var message = '<' + slack_user.name + '>: ' + msg;
            this.irc.client.say(this.irc.channel, message);
        }
    }]);

    return SlackIRC;
}();

exports.default = SlackIRC;