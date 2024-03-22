function flattenArray (arr) {
  return arr.reduce((acc, val) => Array.isArray(val) ? acc.concat(flattenArray(val)) : acc.concat(val), []).filter(x => x !== undefined)
}

function flattenArrayOfObjects (arr) {
  return flattenArray(arr).reduce((acc, val) => {
    return Object.assign({}, acc, val)
  }, {})
}

module.exports = {
  flattenArray,
  flattenArrayOfObjects
}
