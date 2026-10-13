# Eagle Looms

Eagle Looms userscript installation and automatic updates. This public repository contains release files and installation information only; development is private.

## Install Or Update

[Install the latest Eagle Looms userscript](https://github.com/Extas/eagle-looms/releases/latest/download/eagle-looms.user.js)

Use a userscript manager such as Tampermonkey. Existing Eagle Looms installations keep the same update URLs:

- Update metadata: [eagle-looms.meta.js](https://github.com/Extas/eagle-looms/releases/latest/download/eagle-looms.meta.js)
- Installation script: [eagle-looms.user.js](https://github.com/Extas/eagle-looms/releases/latest/download/eagle-looms.user.js)

Automatic checks follow the script manager's own settings. The installation script is public JavaScript; this is not a code-confidentiality mechanism.

## License

Adapted from [Comic Looms](https://github.com/MapoMagpie/comic-looms). See [LICENSE](LICENSE) and [NOTICE](NOTICE).

## Requirements

Since 1.1.79 the userscript saves selected images to a **local Booru library** (default `http://127.0.0.1:8773`, no login) instead of Eagle. Reading, collecting and ZIP download do not need it; only the save action does. Versions up to 1.1.77 saved to Eagle; see the release notes before updating.
