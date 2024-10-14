module.exports =  {
  bold: (text) => `\u001b[1m${text}\u001b[22m`,
  red: (text) => `\u001b[31m${text}\u001b[39m`,
  yellow: (text) => `\u001b[33m${text}\u001b[39m`,
  green: (text) => `\u001b[32m${text}\u001b[39m`
}
