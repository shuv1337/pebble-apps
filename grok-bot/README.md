# Grok Bot Pebble plugin

*Uses the Grok Bot apps' private API, reverse engineered.*

An Index agent destination (see `agent` in CoreApp's `plugins.md`).

- `send_to_agent({ message, chat_id? })` sends to a bot and returns a receipt. `chat_id` is an
  `instanceId` from `agent/chats` (the bot id), a nickname or a bot name, matched in that order:
  exact id, exact nickname, exact name, then a unique partial nickname or name. Ambiguous or
  unknown names fail without sending, including a nickname that another bot has since been
  renamed to; nicknames of bots that no longer exist are ignored. With no `chat_id` it goes to the default bot. It does not
  wait for the reply: stock CoreApp gives plugins no timers and a 20 s action limit.
- `read_grok_bot({ limit?, chat_id? })` returns a bot's latest replies; `chat_id` resolves the
  same way, defaulting to the default bot.
- `agent/chats`: one instance per bot or group; `instanceId` is its id, `name` its nickname when
  set, else its name. A bot list under 5 minutes old (kept in `localStorage`, apart from
  credentials, per sign-in) is served without the network; otherwise the read relists, falling
  back to the old list if that fails. Disconnecting or signing in again clears it.
- `agent/configured`: true once signed in and a default bot is chosen; `name` is that bot's
  nickname or name.

## Settings

- **Your default bot**: search the account's bots and groups and pick where messages go when no
  bot is named. The first bot is the default after sign-in.
- **Nicknames**: give a bot a short name you can say ("Send to work…"), up to 40 characters. A
  nickname names one bot (giving it to another moves it); another bot's name or id is refused,
  since those would resolve first. Clear the field to remove one.
- **Account & connection**: sign in, when you signed in, whether your Grok Bot computer is
  reachable, **Sign in again** (to renew an expired sign-in), and sign out. Collapsed once signed in.

The default bot and nicknames belong to the signed-in Cursor account (the access token's JWT
`sub`; for a token that isn't a readable JWT, the Grok Bot computer's host name). Signing in again
as the same account keeps them; another account starts fresh. Ones saved without an account are
adopted by the next sign-in. Signing out removes them.

## How it reaches Grok Bot

This uses no desktop app and no bridge. It is the same private API the Grok Bot apps use.

1. **Sign-in** is the Grok Bot app's own login:
   - The settings page opens `cursor.com/loginDeepControl?challenge=…&uuid=…&mode=login&redirectTarget=sand`
     through `Pebble.webSignIn`, which returns once Cursor's `WorkosCursorSessionToken` cookie exists.
   - The plugin then polls `api2.cursor.sh/auth/poll` until it returns a Cursor access token (up to 15 minutes; network failures just retry),
     and keeps it in `Pebble.secureStorage`.
   - Grok Bot accounts are Cursor accounts. The token lasts about 60 days and cannot be
     refreshed, so when it expires the user signs in again.
2. Each action calls `POST api2.cursor.sh/aiserver.v1.GrokBotService/EnsureSandBox` with that
   token. The reply gives the user's box (`https://…cursorvm.com`), a gateway token and
   network headers.
3. The action then calls `POST {box}/api/<method>`:
   - `listAgents` for bots and groups.
   - `sendPrompt {agentId, prompt, clientNonce}` to send.
   - `getAgentTranscriptTail {id, limit}` to read. Bot replies are
     `{kind: "send-message", message: {content}}` entries.

Delivery rules:

- A whole send is capped at 18s, below the host's 20s action limit. With under 8s left, it
  refuses to send at all. These caps need a host timer; without one the host's limit applies.
- Once Grok Bot accepts a message, the action always answers with a receipt, never a
  retryable error.
- A send that may or may not have landed reports "delivery uncertain" and is never retried.

The box URL must be https on `*.cursorvm.com`. Tokens, box URLs and server bodies never
leave the plugin in results or errors. The host's XHR logger records only the exception
type of a failed request, because exception text can carry the private host name.

This API is unofficial and undocumented, so it can change with any Grok Bot update. Method
names follow the open-source clients
[grok-bot-cli](https://github.com/ScriptedAlchemy/grok-bot-cli) and
[grokbot-sdk](https://github.com/adam91holt/grokbot-sdk).

## Build and test

`src/plugin/index.js` is plain JS with no build step and no dependencies.

```sh
cd grok-bot
npm test
pebble build
```

