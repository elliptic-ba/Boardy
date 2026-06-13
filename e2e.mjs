/* CDP-driven end-to-end test for Boardy. Run: node e2e.mjs [port] */
import { writeFileSync } from 'fs'

const PORT = process.argv[2] ?? '9223'
const SHOT_DIR = '/tmp/boardy-shots'

async function getPageTarget() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://localhost:${PORT}/json`)
      const targets = await res.json()
      const page = targets.find((t) => t.type === 'page' && !t.url.startsWith('devtools'))
      if (page) return page
    } catch {
      /* app not up yet */
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('No page target found')
}

let msgId = 0
const pending = new Map()
let ws

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })
}

async function evaluate(expression, { awaitPromise = false } = {}) {
  const res = await send('Runtime.evaluate', {
    expression,
    awaitPromise,
    returnByValue: true
  })
  if (res.exceptionDetails) {
    throw new Error('JS error: ' + JSON.stringify(res.exceptionDetails.exception?.description ?? res.exceptionDetails.text))
  }
  return res.result?.value
}

async function waitFor(expression, label, timeoutMs = 15000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const v = await evaluate(expression, { awaitPromise: true })
    if (v) return v
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error(`Timeout waiting for: ${label}`)
}

async function screenshot(name) {
  const res = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(`${SHOT_DIR}/${name}.png`, Buffer.from(res.data, 'base64'))
  console.log(`  📷 ${name}.png`)
}

// set a React-controlled input's value properly
const setInput = (selector, value) => `
  (() => {
    const el = document.querySelector(${JSON.stringify(selector)})
    if (!el) return false
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set
    setter.call(el, ${JSON.stringify(value)})
    el.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  })()
`

const clickByText = (selector, text) => `
  (() => {
    const els = [...document.querySelectorAll(${JSON.stringify(selector)})]
    const el = els.find(e => e.textContent.trim().includes(${JSON.stringify(text)}))
    if (!el) return false
    el.click()
    return true
  })()
`

function assert(cond, label) {
  if (!cond) throw new Error('ASSERT FAILED: ' + label)
  console.log(`  ✓ ${label}`)
}

const PASSWORD = 'correct horse battery'

async function main() {
  const { mkdirSync } = await import('fs')
  mkdirSync(SHOT_DIR, { recursive: true })

  const target = await getPageTarget()
  ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((res, rej) => {
    ws.onopen = res
    ws.onerror = rej
  })
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id).resolve(msg.result ?? msg)
      pending.delete(msg.id)
    }
  }
  await send('Page.enable')
  await send('Runtime.enable')

  console.log('— First-run setup —')
  await waitFor(`!!document.querySelector('.auth-title')`, 'setup screen')
  const title = await evaluate(`document.querySelector('.auth-title').textContent`)
  assert(title.includes('Welcome'), 'setup screen shown on first run')
  await screenshot('01-setup')

  await evaluate(setInput('input[placeholder="At least 8 characters"]', PASSWORD))
  await evaluate(setInput('input[placeholder="Repeat your password"]', PASSWORD))
  await evaluate(clickByText('button', 'Create workspace'))

  console.log('— Recovery key —')
  await waitFor(`!!document.querySelector('.recovery-key-box')`, 'recovery key screen', 30000)
  const recoveryKey = await evaluate(`document.querySelector('.recovery-key-box').textContent`)
  assert(/^[0-9A-Z]{5}(-[0-9A-Z]{5}){7}$/.test(recoveryKey), `recovery key format (${recoveryKey})`)
  await screenshot('02-recovery-key')
  await evaluate(`(() => { const cb = document.querySelector('.checkbox-row input'); cb.click(); return true })()`)
  await evaluate(clickByText('button', 'Open my workspace'))

  console.log('— Workspace —')
  await waitFor(`!!document.querySelector('.sidebar')`, 'workspace shell')
  await waitFor(`[...document.querySelectorAll('.tree-title')].some(e => e.textContent.includes('Getting started'))`, 'welcome page in sidebar')
  assert(true, 'workspace loaded with welcome page')
  await evaluate(clickByText('.tree-title', 'Getting started'))
  await waitFor(`!!document.querySelector('.bn-editor')`, 'BlockNote editor mounted')
  const editorText = await waitFor(
    `(document.querySelector('.bn-editor')?.textContent || '').includes('Welcome to Boardy') && document.querySelector('.bn-editor').textContent`,
    'welcome content rendered'
  )
  assert(editorText.includes('markdown shortcuts'), 'welcome page content rendered in editor')
  await screenshot('03-welcome-page')

  console.log('— Database: table view —')
  // open add menu in sidebar section and create a database
  await evaluate(`(() => { document.querySelector('.sidebar-section-label .icon-btn').click(); return true })()`)
  await waitFor(`!!document.querySelector('.menu')`, 'add menu open')
  await evaluate(clickByText('.menu .menu-item', 'New database'))
  await waitFor(`!!document.querySelector('.db-table')`, 'table view rendered')
  const headers = await evaluate(`[...document.querySelectorAll('.db-table th .th-inner')].map(e => e.textContent.trim())`)
  assert(headers.includes('Status'), 'seeded Status column present')
  const rowCount = await evaluate(`document.querySelectorAll('.db-table tbody tr').length`)
  assert(rowCount === 3, `3 seeded rows (got ${rowCount})`)

  // name the database
  await evaluate(setInput('.page-title-input', 'Projects'))
  // set title of first row
  await evaluate(`(() => { document.querySelector('.db-table tbody .title-cell').click(); return true })()`)
  await waitFor(`!!document.querySelector('.db-table .cell-input')`, 'title cell editing')
  await evaluate(setInput('.db-table .cell-input', 'Launch website'))
  await evaluate(
    `(() => { const el = document.querySelector('.db-table .cell-input'); el.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); return true })()`
  )
  // set Status of first row via select cell
  await evaluate(`(() => { const tr = document.querySelector('.db-table tbody tr'); tr.querySelectorAll('td')[1].querySelector('.cell').click(); return true })()`)
  await waitFor(`!!document.querySelector('.menu')`, 'select editor open')
  await evaluate(clickByText('.menu .menu-item', 'In progress'))
  await waitFor(`[...document.querySelectorAll('.db-table .tag')].some(t => t.textContent === 'In progress')`, 'tag set in table')
  assert(true, 'row title + select value editable')
  await waitFor(
    `window.boardy.pages.list().then(ps => ps.some(p => p.title === 'Launch website'))`,
    'row title persisted to DB'
  )
  assert(true, 'row rename persisted to encrypted DB')
  await screenshot('04-table-view')

  console.log('— Board view —')
  await evaluate(clickByText('.view-tabs > .view-tab', ''))
  // add a board view via the + tab
  await evaluate(`(() => { const tabs = [...document.querySelectorAll('.view-tabs > .view-tab')]; tabs[tabs.length-1].click(); return true })()`)
  await waitFor(`!!document.querySelector('.menu')`, 'add view menu')
  await evaluate(clickByText('.menu .menu-item', 'Board'))
  await waitFor(`!!document.querySelector('.board')`, 'board rendered')
  const cols = await evaluate(`document.querySelectorAll('.board-col').length`)
  assert(cols >= 4, `board has status columns (got ${cols})`)
  const inProgressCards = await evaluate(`(() => {
    const col = [...document.querySelectorAll('.board-col')].find(c => c.querySelector('.board-col-header')?.textContent.includes('In progress'))
    return col ? col.querySelectorAll('.board-card').length : -1
  })()`)
  assert(inProgressCards === 1, `card grouped under In progress (got ${inProgressCards})`)
  await screenshot('05-board-view')

  console.log('— List + gallery views —')
  await evaluate(`(() => { const tabs = [...document.querySelectorAll('.view-tabs > .view-tab')]; tabs[tabs.length-1].click(); return true })()`)
  await waitFor(`!!document.querySelector('.menu')`, 'add view menu')
  await evaluate(clickByText('.menu .menu-item', 'List'))
  await waitFor(`document.querySelectorAll('.list-item').length === 3`, 'list view rendered')
  assert(true, 'list view shows 3 rows')
  await evaluate(`(() => { const tabs = [...document.querySelectorAll('.view-tabs > .view-tab')]; tabs[tabs.length-1].click(); return true })()`)
  await waitFor(`!!document.querySelector('.menu')`, 'add view menu')
  await evaluate(clickByText('.menu .menu-item', 'Gallery'))
  await waitFor(`document.querySelectorAll('.gallery-card').length >= 3`, 'gallery view rendered')
  assert(true, 'gallery view shows cards')
  await screenshot('06-gallery-view')

  console.log('— Row page with properties —')
  await evaluate(clickByText('.gallery-card .card-title', 'Launch website'))
  await waitFor(`!!document.querySelector('.props-panel')`, 'row page props panel')
  const propNames = await evaluate(`[...document.querySelectorAll('.prop-row .prop-name')].map(e => e.textContent.trim())`)
  assert(propNames.includes('Status'), 'row page shows Status property')
  const crumbs = await evaluate(`[...document.querySelectorAll('.breadcrumb')].map(e => e.textContent.trim())`)
  assert(crumbs.some((c) => c.includes('Projects')), `breadcrumbs include database (${crumbs.join(' / ')})`)
  await screenshot('07-row-page')

  console.log('— Search —')
  await evaluate(clickByText('.sidebar-action', 'Search'))
  await waitFor(`!!document.querySelector('.search-input-row input')`, 'search modal')
  await evaluate(setInput('.search-input-row input', 'launch'))
  await waitFor(`[...document.querySelectorAll('.search-result .sr-title')].some(e => e.textContent.includes('Launch website'))`, 'search hit')
  assert(true, 'Ctrl+K search finds row page by title')
  await screenshot('08-search')
  await evaluate(`(() => { document.querySelector('.modal-backdrop').dispatchEvent(new MouseEvent('mousedown', {bubbles:true})); return true })()`)

  console.log('— Dark theme —')
  await evaluate(clickByText('.sidebar-action', 'Settings'))
  await waitFor(`!!document.querySelector('.settings-body')`, 'settings modal')
  // theme is the first Select control; open it and pick "Dark"
  await evaluate(`(() => { document.querySelectorAll('.settings-row .select')[0].click(); return true })()`)
  await waitFor(`!!document.querySelector('.menu')`, 'theme dropdown open')
  await evaluate(clickByText('.menu .menu-item', 'Dark'))
  await waitFor(`document.documentElement.getAttribute('data-theme') === 'dark'`, 'dark theme applied')
  assert(true, 'dark theme applies')
  await screenshot('09-dark-settings')
  await evaluate(`(() => { document.querySelector('.modal-backdrop').dispatchEvent(new MouseEvent('mousedown', {bubbles:true})); return true })()`)
  await new Promise((r) => setTimeout(r, 300))
  await screenshot('10-dark-workspace')

  console.log('— Lock / unlock —')
  await evaluate(clickByText('.sidebar-footer .sidebar-action', 'Lock'))
  await waitFor(`!!document.querySelector('.auth-title')`, 'lock screen')
  const lockTitle = await evaluate(`document.querySelector('.auth-title').textContent`)
  assert(lockTitle.includes('locked'), 'lock screen shown')
  await screenshot('11-locked-dark')
  // wrong password rejected
  await evaluate(setInput('.auth-card input[type=password]', 'wrong password'))
  await evaluate(clickByText('button', 'Unlock'))
  await waitFor(`(document.querySelector('.auth-error')?.textContent || '').includes('Incorrect')`, 'wrong password error')
  assert(true, 'wrong password rejected')
  // correct password
  await evaluate(setInput('.auth-card input[type=password]', PASSWORD))
  await evaluate(clickByText('button', 'Unlock'))
  await waitFor(`!!document.querySelector('.sidebar')`, 'unlocked back to workspace')
  const treeTitles = await evaluate(`[...document.querySelectorAll('.tree-title')].map(e => e.textContent)`)
  assert(treeTitles.some((t) => t.includes('Projects')), 'data intact after lock/unlock')

  console.log('\nALL E2E TESTS PASSED')
  ws.close()
  process.exit(0)
}

main().catch(async (e) => {
  console.error('\nE2E FAILED:', e.message)
  try {
    await screenshot('failure')
  } catch {
    /* ignore */
  }
  process.exit(1)
})
