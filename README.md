# Hart Law PLLC Discord Bot

A full-featured intake, case management, and billing Discord bot for Hart Law PLLC. The bot is built with Node.js, TypeScript, discord.js v14, and SQLite (better-sqlite3).

## Requirements

- Node.js 18 LTS or later (tested on Node 18)
- npm 9+
- Discord bot token with privileged gateway intents (Guild Members, Message Content)

## Installation

1. Clone the repository and install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and populate the secrets:

   ```bash
   cp .env.example .env
   ```

   Required values:

   - `DISCORD_TOKEN` – bot token
   - `CLIENT_ID` – Discord application client ID
   - `GUILD_ID` – Optional; set for per-guild command registration
   - `REGISTER_COMMANDS` – `true` to register slash commands on startup

3. Adjust `config.json` with your guild channel, category, and role IDs. Defaults use Hart Law production IDs:

   ```json
   {
     "intakeChannelId": "1422395937447481494",
     "archiveCategoryId": "1181653600942964796",
     "reviewChannelId": "1423342238301421730",
     "staffRoleIds": [
       "1181963739365376020",
       "1214709829701079131",
       "1422403992771625122",
       "1181963769514049677"
     ],
     "billing": {
       "invoiceCadenceDays": 14,
       "invoiceDueDays": 7,
       "latePolicy": { "type": "apr", "value": 18.0 },
       "minIncrementHours": 0.1,
       "travelHalfRate": true,
       "internalConferenceCapPerDay": 0.3,
       "maxSimultaneousBillable": 3,
       "requireRetainer": true
     }
   }
   ```

4. Run the database migrations and seeds:

   ```bash
   npm run migrate
   ```

   This creates `data/hartlaw.db`, seeds USD hourly rates, and stores default runtime settings.

## Development & Scripts

- `npm run dev` – Start the bot with ts-node-dev hot reloading
- `npm run build` – Compile TypeScript into `dist/`
- `npm run start` – Run the compiled bot (`node dist/index.js`)
- `npm run migrate` – Create database tables and seed initial data
- `npm test` – Run Jest unit tests

### Slash Command Registration

The bot automatically registers slash commands when `REGISTER_COMMANDS=true`. With `GUILD_ID` set, commands register in that guild instantly; without it, commands register globally (may take up to an hour to propagate).

## Data & Storage

- SQLite database: `./data/hartlaw.db`
- Archive files: `./data/archives/<case_id>_<category>_<client>/`
- Rotating logs: `./logs/hartlaw-YYYY-MM-DD.log`

All persistence is local to disk; no external services are required.

## Features

### Ticketing

- `/ticket new type:(civil|criminal|appellate)` – Launches an intake modal. Creates a private intake thread in channel `1422395937447481494` (falls back to a private text channel if threads are unavailable).
- Ticket threads contain an embed, action buttons (Assign, Claim, Convert to Case, Close), and database persistence with IDs formatted as `TKT-YYYYMMDD-####`.
- `/ticket assign`, `/ticket claim`, `/ticket close` – Staff-only ticket management tools.
- `/ticket appellate-from-case` – Creates an appellate ticket linked to an existing case.

### Case Management

- Convert tickets to cases via the “Convert to Case” button. Case channels are named `CASE-<shortid>-<client>` and inherit staff/client permissions.
- `/case archive` – Moves the case channel to archive category `1181653600942964796`, renames channels to `CV|CR|SC - <client>`, updates database status, and creates a matching local archive folder.
- `/case set-currency`, `/case set-contingency` – Configure billing currency and contingency percentages.
- Archived case channels automatically mirror uploaded attachments into the local archive folder while recording metadata in the database.

### Reviews

- `/review rating:(1..5) text:(<=1000)` – Only in channel `1423342238301421730`. Posts a public embed and saves the review in SQLite while acknowledging the user ephemerally.

### Billing & Invoicing

- `/rate show tier:(standard|high-profile|scotus)` – Displays the USD rate table and Robux formulas.
- `/retainer quote tier:... currency:(USD|R$)` – Calculates 10 hours at the lead-partner rate (USD) or the fixed Robux retainers (400/600/750 R$).
- `/time add` – Staff-only. Enforces 0.1 hour minimum increments, optional travel half rate, internal conference cap (0.3 hr/day/team), and a max of 3 simultaneous billable professionals unless overridden. Robux rates follow the tier formulas (Lead 40/60/75 R$ plus additional 20/30/35 per extra team member).
- `/invoice summary` – Summaries billable entries by case in USD or Robux, including contingency indicators.
- Billing defaults honour retainers (10 hours at lead-partner rate) and late-fee rules from `config.json`. Runtime toggles are accessible through `/settings`.

### Settings

- `/settings show` – View current runtime settings stored in SQLite.
- `/settings set key:<whitelisted> value:<value>` – Update safe toggles (invoice cadence, late fee style, conference cap, etc.).

### Logging & Reliability

- Structured console + rotating file logs (14-day retention)
- Defensive error handling keeps the bot responsive; users receive ephemeral error notifications.
- Rate limit friendly: Discord operations are performed sequentially and failures are logged.

## Archived File Mirroring

When a case is archived and files are uploaded into the archived channel, the bot downloads each attachment to the corresponding local archive folder (`./data/archives/...`) with ISO timestamp prefixes and records them in the `files` table. Filenames are sanitised to prevent path traversal.

## Testing

Unit tests (Jest) cover billing utilities and permission guards:

```bash
npm test
```

Tests write to an isolated SQLite database under `tests/tmp/`.

## Troubleshooting

- **Slash commands missing:** ensure `REGISTER_COMMANDS=true` and the bot has the `applications.commands` scope and manage commands permissions.
- **Thread creation fails:** grant the bot `Create Private Threads`. The bot will fall back to creating a private text channel if necessary.
- **Permission errors:** verify the IDs in `config.json` and confirm staff roles have view/send permissions for intake and case channels.
- **Attachment mirroring fails:** confirm the host machine has outbound HTTPS access and write permissions to `./data/archives`.
- **Database issues:** delete the local `data/hartlaw.db` (after taking backups) and rerun `npm run migrate`.

## Security Notes

- Tokens and secrets are loaded from `.env` and never logged or echoed.
- Filenames and user input are validated/sanitised before interacting with the filesystem or Discord APIs.
- The bot operates entirely on local storage with SQLite and filesystem archives; no external persistence is used.

## License

Proprietary – internal Hart Law PLLC use only.
