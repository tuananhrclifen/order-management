#!/usr/bin/env node
// Simple utility to import plain-text drink lists into the drinks table.
// Each non-empty line is treated as a drink name. All drinks share the provided price.

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

function parseArgs(argv) {
  const args = { price: 20000 }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const next = () => argv[++i]
    if (!arg.startsWith('--')) continue
    switch (arg) {
      case '--file':
        args.file = next()
        break
      case '--event-id':
        args.eventId = next()
        break
      case '--price':
        args.price = Number(next())
        break
      case '--category':
        args.category = next()
        break
      case '--source':
        args.source = next()
        break
      case '--supabase-url':
        args.supabaseUrl = next()
        break
      case '--supabase-key':
        args.supabaseKey = next()
        break
      case '--help':
      case '-h':
        args.help = true
        break
      default:
        console.warn(`Unknown option: ${arg}`)
        break
    }
  }
  return args
}

function usage() {
  return `\nUsage:\n  node tools/import-text-menu.mjs --file menunuoccam.txt --event-id <uuid> [--price 20000] [--category "Tea"] [--source <url>]\n\nEnvironment:\n  Requires Supabase service access. Provide --supabase-url/--supabase-key or set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.\n`
}

function normalizeName(name) {
  return name.replace(/\s+/g, ' ').trim()
}

function normKey(name, price) {
  return `${normalizeName(name).toLowerCase()}|${Number(price)}`
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log(usage())
    process.exit(0)
  }
  if (!args.file || !args.eventId) {
    console.error('Missing required --file or --event-id option.')
    console.log(usage())
    process.exit(1)
  }
  if (!Number.isFinite(args.price) || args.price <= 0) {
    console.error('Price must be a positive number.')
    process.exit(1)
  }

  const filePath = path.resolve(process.cwd(), args.file)
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`)
    process.exit(1)
  }

  const raw = fs.readFileSync(filePath, 'utf8')
  const names = raw
    .split(/\r?\n/)
    .map((line) => normalizeName(line))
    .filter((line) => line.length > 0)

  if (names.length === 0) {
    console.error('No drink names found in file.')
    process.exit(1)
  }

  const supabaseUrl = args.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseKey = args.supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase credentials are required. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or pass --supabase-url/--supabase-key.')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })

  const { data: existing, error: existingError } = await supabase
    .from('drinks')
    .select('id, name, price')
    .eq('event_id', args.eventId)
    .limit(5000)
  if (existingError) {
    console.error('Failed to load existing drinks:', existingError.message)
    process.exit(1)
  }

  const existingKeys = new Set((existing || []).map((row) => normKey(row.name, row.price)))
  const uniqueNames = Array.from(new Set(names))

  const rows = uniqueNames
    .map((name) => ({
      event_id: args.eventId,
      name,
      price: Number(args.price),
      category: args.category || null,
      description: null,
      image_url: null,
      source_url: args.source || null,
      is_available: true,
    }))
    .filter((row) => !existingKeys.has(normKey(row.name, row.price)))

  if (rows.length === 0) {
    console.log('Nothing to insert. All drinks already exist with the same price.')
    process.exit(0)
  }

  const chunkSize = 100
  let inserted = 0
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const { error } = await supabase.from('drinks').insert(chunk)
    if (error) {
      console.error('Insert failed:', error.message)
      process.exit(1)
    }
    inserted += chunk.length
  }

  console.log(`Inserted ${inserted} drinks into event ${args.eventId}.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
