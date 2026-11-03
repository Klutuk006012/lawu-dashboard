#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Convert lawu-setup-guide.html → lawu-setup-guide.pdf via Chromium print-to-PDF.
 * CSS @page A4 di HTML sudah handle layout; printBackground wajib ON untuk cover.
 */
const path = require('path')
const { chromium } = require('playwright')

const HTML = path.resolve('/home/z/my-project/upload/lawu-setup-guide.html')
const OUT = path.resolve('/home/z/my-project/upload/lawu-setup-guide.pdf')

;(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] })
  const page = await browser.newPage()
  await page.goto('file://' + HTML, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.pdf({
    path: OUT,
    format: 'A4',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
    displayHeaderFooter: false,
  })
  await browser.close()
  console.log('PDF written:', OUT)
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
