const net = require('node:net')

async function findAvailablePortWithoutUser () {
  return await new Promise((resolve) => {
    let port
    const tmpServer = net.createServer(function (sock) {
      sock.end('Hello world\n')
    })
    tmpServer.listen(0, function () {
      port = tmpServer.address().port
      tmpServer.close(() => {
        resolve(port)
      })
    })
  })
}

module.exports = {
  findAvailablePortWithoutUser
}
