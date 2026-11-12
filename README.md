# Eagle Looms

Read web galleries with Comic Looms, import selected images into **Eagle**, or download an independent ZIP. This public repository distributes the built userscript and installation information; development source is private.

## Install Or Update

[Install the latest Eagle Looms userscript](https://github.com/Extas/eagle-looms/releases/latest/download/eagle-looms.user.js)

Use Tampermonkey or Violentmonkey. Existing installations keep their update URLs:

- [Update metadata](https://github.com/Extas/eagle-looms/releases/latest/download/eagle-looms.meta.js)
- [Installation script](https://github.com/Extas/eagle-looms/releases/latest/download/eagle-looms.user.js)

Version **2.0.3 restores Eagle import**. Versions 2.0.1 and 2.0.2 incorrectly targeted Booru; use the latest corrective release for Eagle.

## Import Into Eagle

1. Open the Eagle desktop application. Its default local API address is `http://127.0.0.1:41595`.
2. In the userscript, open **CONF → Eagle 连接设置**, read the Eagle folder list, choose an optional destination folder, and save the connection.
3. Select chapters and image ranges in the download panel, then click **存入 Eagle**. For original-quality images, enable the upstream **Raw Image** setting first.

The script sends image bytes already obtained in the browser, preserving image names, source-page URLs and source tags. Source-site cookies are not forwarded. Stop-next waits for the current request; a network interruption with an unknown write outcome stops further imports without automatic replay.

Reading and ZIP downloads do not require Eagle or Booru.

## License

Adapted from [Comic Looms](https://github.com/MapoMagpie/comic-looms). See [LICENSE](LICENSE) and [NOTICE](NOTICE).
