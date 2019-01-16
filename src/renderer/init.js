if (typeof process === 'undefined' || typeof process.versions !== 'object' || !process.versions.electron) {
  // TODO(spell): Can renderer content run outside from electron?
  throw new Error('Non-Electron environment detected!')
}

// NOTE: "SPELLCHECKER_PREFER_HUNSPELL" environment variable must be set before
//       initializing "SpellCheckHandler" from "electron-spellchecker".
if (process.env.MT_PREFER_HUNSPELL) {
  process.env['SPELLCHECKER_PREFER_HUNSPELL'] = 1
}
