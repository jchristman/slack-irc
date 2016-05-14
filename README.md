slack-irc
=========
A Slack &lt;==> IRC Library

Usage
=====
First create a new Slack bot and get the API token. Then, use this library like so:

```bash
git clone https://github.com/jchristman/slack-irc
cd slack-irc
npm install
node config.js
```

You will want to modify your config.js to put the appropriate options for connecting. Once it's running, you should see a message in your Slack channel with a list of commands you can run to join up to the IRC server.
