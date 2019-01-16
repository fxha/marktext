import ContentState from './contentState'
import EventCenter from './eventHandler/event'
import Clipboard from './eventHandler/clipboard'
import Keyboard from './eventHandler/keyboard'
import ClickEvent from './eventHandler/clickEvent'
import { CLASS_OR_ID, MUYA_DEFAULT_OPTION } from './config'
import { wordCount } from './utils'
import ExportMarkdown from './utils/exportMarkdown'
import ExportHtml from './utils/exportHtml'
import ToolTip from './ui/tooltip'
import selection from './selection'
import './assets/styles/index.css'

class Muya {
  static plugins = []
  static use (plugin) {
    this.plugins.push(plugin)
  }
  constructor (container, options) {
    this.options = Object.assign({}, MUYA_DEFAULT_OPTION, options)
    const { focusMode, theme, markdown } = this.options
    this.focusMode = focusMode
    this.theme = theme
    this.markdown = markdown
    this.container = getContainer(container, this.options)
    this.eventCenter = new EventCenter()
    this.tooltip = new ToolTip(this)
    // UI plugins
    if (Muya.plugins.length) {
      for (const Plugin of Muya.plugins) {
        this[Plugin.pluginName] = new Plugin(this)
      }
    }

    this.contentState = new ContentState(this, this.options)
    this.clipboard = new Clipboard(this)
    this.clickEvent = new ClickEvent(this)
    this.keyboard = new Keyboard(this)
    this.init()
  }

  init () {
    const { container, contentState, eventCenter } = this
    contentState.stateRender.setContainer(container.children[0])
    eventCenter.subscribe('stateChange', this.dispatchChange.bind(this))
    eventCenter.attachDOMEvent(container, 'contextmenu', event => {
      event.preventDefault()
      event.stopPropagation()

      // Hide format box
      this.eventCenter.dispatch('muya-format-picker', { reference: null })

      // NOTE: When right clicking Chromium selects the underlying word if misspelled.

      // Commit native cursor position
      const cursor = selection.getCursorRange()
      this.contentState.cursor = cursor

      // Use the native cursor
      const sectionChanges = this.contentState.selectionChange(null)
      eventCenter.dispatch('contextmenu', event, sectionChanges)
    })
    contentState.listenForPathChange()
    const { theme, focusMode, markdown } = this
    this.setTheme(theme)
    this.setMarkdown(markdown)
    this.setFocusMode(focusMode)
  }

  dispatchChange () {
    const { eventCenter } = this
    const markdown = this.markdown = this.getMarkdown()
    const wordCount = this.getWordCount(markdown)
    const cursor = this.getCursor()
    const history = this.getHistory()
    eventCenter.dispatch('change', { markdown, wordCount, cursor, history })
  }

  getMarkdown () {
    const blocks = this.contentState.getBlocks()
    return new ExportMarkdown(blocks).generate()
  }

  getHistory () {
    return this.contentState.getHistory()
  }

  setHistory (history) {
    return this.contentState.setHistory(history)
  }

  clearHistory () {
    return this.contentState.history.clearHistory()
  }

  exportStyledHTML (title = '', printOptimization = false) {
    const { markdown } = this
    return new ExportHtml(markdown).generate(title, printOptimization)
  }

  exportHtml () {
    const { markdown } = this
    return new ExportHtml(markdown).renderHtml()
  }

  getWordCount (markdown) {
    return wordCount(markdown)
  }

  getCursor () {
    return this.contentState.getCodeMirrorCursor()
  }

  setMarkdown (markdown, cursor, isRenderCursor = true) {
    let newMarkdown = markdown
    if (cursor) {
      newMarkdown = this.contentState.addCursorToMarkdown(markdown, cursor)
    }
    this.contentState.importMarkdown(newMarkdown)
    this.contentState.importCursor(cursor)
    this.contentState.render(isRenderCursor)
    this.dispatchChange()
  }

  createTable (tableChecker) {
    return this.contentState.createTable(tableChecker)
  }

  getSelection () {
    return this.contentState.selectionChange()
  }

  setFocusMode (bool) {
    const { container, focusMode } = this
    if (bool && !focusMode) {
      container.classList.add(CLASS_OR_ID['AG_FOCUS_MODE'])
    } else {
      container.classList.remove(CLASS_OR_ID['AG_FOCUS_MODE'])
    }
    this.focusMode = bool
  }

  setTheme (name) {
    if (!name) return
    const { eventCenter } = this
    this.theme = name
    // Render cursor and refresh code block
    this.contentState.render(true)
    // notice the ui components to change theme
    eventCenter.dispatch('theme-change', name)
  }

  setFont ({ fontSize, lineHeight }) {
    if (fontSize) this.contentState.fontSize = parseInt(fontSize, 10)
    if (lineHeight) this.contentState.lineHeight = lineHeight
  }

  setListItemPreference (preferLooseListItem) {
    this.contentState.preferLooseListItem = preferLooseListItem
  }

  setTabSize (tabSize) {
    if (!tabSize || typeof tabSize !== 'number') {
      tabSize = 4
    } else if (tabSize < 1) {
      tabSize = 1
    }

    this.contentState.tabSize = tabSize
  }

  updateParagraph (type) {
    this.contentState.updateParagraph(type)
  }

  insertParagraph (location/* before or after */) {
    this.contentState.insertParagraph(location)
  }

  editTable (data) {
    this.contentState.editTable(data)
  }

  hasFocus () {
    return document.activeElement === this.container
  }

  focus () {
    this.contentState.setCursor()
    this.container.focus()
  }

  blur () {
    this.container.blur()
  }

  showAutoImagePath (files) {
    const list = files.map(f => {
      const iconClass = f.type === 'directory' ? 'icon-folder' : 'icon-image'
      return Object.assign(f, { iconClass, text: f.file + (f.type === 'directory' ? '/' : '') })
    })
    this.contentState.showAutoImagePath(list)
  }

  format (type) {
    this.contentState.format(type)
  }

  insertImage (url) {
    this.contentState.insertImage(url)
  }

  search (value, opt) {
    const { selectHighlight } = opt
    this.contentState.search(value, opt)
    this.contentState.render(!!selectHighlight)
    return this.contentState.searchMatches
  }

  replace (value, opt) {
    this.contentState.replace(value, opt)
    this.contentState.render(false)
    return this.contentState.searchMatches
  }

  find (action/* pre or next */) {
    this.contentState.find(action)
    this.contentState.render(false)
    return this.contentState.searchMatches
  }

  on (event, listener) {
    this.eventCenter.subscribe(event, listener)
  }

  off (event, listener) {
    this.eventCenter.unsubscribe(event, listener)
  }

  once (event, listener) {
    this.eventCenter.subscribeOnce(event, listener)
  }

  undo () {
    this.contentState.history.undo()
  }

  redo () {
    this.contentState.history.redo()
  }

  copyAsMarkdown () {
    this.clipboard.copyAsMarkdown()
  }

  copyAsHtml () {
    this.clipboard.copyAsHtml()
  }

  pasteAsPlainText () {
    this.clipboard.pasteAsPlainText()
  }

  copy (name) {
    this.clipboard.copy(name)
  }

  destroy () {
    this.contentState.clear()
    this.quickInsert.destroy()
    this.codePicker.destroy()
    this.tablePicker.destroy()
    this.emojiPicker.destroy()
    this.imagePathPicker.destroy()
    this.eventCenter.detachAllDomEvents()
  }

  /**
   * Replace the word range with the given replacement.
   * 
   * NOTE: It's very likely that this method can have side effects because of none existing synchronization.
   * 
   * @param {*} line Line block reference - must be a valid reference!
   * @param {*} wordCursor Replace this range with the replacement
   * @param {*} replacement Replacement
   * @param {*} setCursor Shoud we update the cursor
   */
  _replaceWordInline (line, wordCursor, replacement, setCursor=false) {
    // TODO(spell): Move this to utils
    const cursorToString = c => {
      // Create shallow copy
      const start = Object.assign({}, c.start)
      const end = Object.assign({}, c.start)

      // TODO(spell): Print only `start`, `end` and text length
      // start.block = end.block = null

      return JSON.stringify({ start, end })
    }

    if (wordCursor.start.key !== wordCursor.end.key) {
      throw new Error('Expects a single line word cursor: start.key != end.key.')
    } else if (line.start.key !== line.end.key) {
      // TODO(spell): Not necessary, change `end` to `start`?
      // line.end = line.start
      throw new Error('Expects a single line cursor: start.key != end.key.')
    } else if (wordCursor.start.offset > wordCursor.end.offset) {
      throw new Error(`Invalid cursor:\n\n${cursorToString(wordCursor)}\n`)
    } else if (line.start.key !== wordCursor.end.key) {
      throw new Error(`Cursor mismatch:\n\n${cursorToString(line)}\n\n${cursorToString(wordCursor)}\n`)
    } else if (line.start.block.text.length < wordCursor.end.offset) {
      throw new Error(`Invalid cursor:\n\n${cursorToString(line)}\n\n${cursorToString(wordCursor)}\n`)
    }

    // Replace word
    const { block } = line.start
    const { offset: left } = wordCursor.start
    const { offset: right } = wordCursor.end

    block.text = block.text.substr(0, left) + replacement + block.text.substr(right)

    // Update cursor
    if (setCursor) {
      const cursor = Object.assign({}, wordCursor.start, {
        offset: left + replacement.length
      })
      this.contentState.cursor.start = cursor
      this.contentState.cursor.end = cursor
      line.start = cursor
      line.end = cursor
    }
    this.contentState.partialRender()
    this.dispatchChange()
  }
}

/**
  * [ensureContainerDiv ensure container element is div]
  */
function getContainer (originContainer, options) {
  const { hideQuickInsertHint } = options
  const container = document.createElement('div')
  const rootDom = document.createElement('div')
  const attrs = originContainer.attributes
  // copy attrs from origin container to new div element
  Array.from(attrs).forEach(attr => {
    container.setAttribute(attr.name, attr.value)
  })

  if (!hideQuickInsertHint) {
    container.classList.add('ag-show-quick-insert-hint')
  }

  // TODO(spell): Disable spellchecking on elements like code blocks etc

  container.setAttribute('contenteditable', true)
  container.setAttribute('autocorrect', false)
  container.setAttribute('autocomplete', 'off')
  // TODO(spell): Allow disabling spellchecking
  container.setAttribute('spellcheck', true)
  container.appendChild(rootDom)
  originContainer.replaceWith(container)
  return container
}

export default Muya
