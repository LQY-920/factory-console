import process from 'node:process'
import console from 'node:console'
const args = process.argv.slice(2)
const command = args.slice(0, 2).join(' ')
if (command === 'auth status') process.exit(0)
if (command === 'issue list') console.log(JSON.stringify([{ number: 1, title: 'Review fixture', labels: [{ name: 'status:todo' }], url: 'https://example.invalid/issues/1' }]))
else if (command === 'pr list') console.log('[]')
else if (command === 'release view') process.exit(1)
else process.exit(2)
