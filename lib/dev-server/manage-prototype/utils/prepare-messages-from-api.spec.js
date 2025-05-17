const { prepareMessagesFromApi } = require('./prepare-messsages-from-api')

function unchnagedInputInOutputFormat (input) {
  return input.map(text => ({ html: text }))
}

describe('prepareMessagesFromApi', () => {
  describe('documentation', () => {
    it('should process bold, italic and links while adding the standard message for outdated kits', () => {
      expect(prepareMessagesFromApi({
        version: '0.0.0',
        upgradeAvailable: true,
        messages: [
          'This is **bold**, *italic*, and a (link:/link). Links have to contain **the same** *URL* and *innerText*, this is to *protect* against malicious data coming from the server which **we do not expect**, but it would be *naive* to ignore the possibility. Find out more by reading about defence in depth (link:https://en.wikipedia.org/wiki/Defense_in_depth_(computing))',
          'Plain text messages are just treated as plain text.',
          'Three ***asterisks*** produces some not ideal, but acceptable behaviour.'
        ]
      })).toEqual([
        { html: '<a href="/manage-prototype/plugin/npm:nowprototypeit">An update is available, you can now install that directly from the plugin page.</a>' },
        { html: 'This is <strong>bold</strong>, <em>italic</em>, and a <a href="/link">/link</a>. Links have to contain <strong>the same</strong> <em>URL</em> and <em>innerText</em>, this is to <em>protect</em> against malicious data coming from the server which <strong>we do not expect</strong>, but it would be <em>naive</em> to ignore the possibility. Find out more by reading about defence in depth <a href="https://en.wikipedia.org/wiki/Defense_in_depth_(computing)">https://en.wikipedia.org/wiki/Defense_in_depth_(computing)</a>' },
        { html: 'Plain text messages are just treated as plain text.' },
        { html: 'Three *<strong>asterisks</strong>* produces some not ideal, but acceptable behaviour.' }
      ])
    })
  })
  it('should pass on basic valuse', () => {
    expect(prepareMessagesFromApi({
      version: '0.0.0',
      upgradeAvailable: false,
      messages: ['hello']
    })).toEqual([{ html: 'hello' }])
  })
  it('should pass on html', () => {
    expect(prepareMessagesFromApi({
      version: '0.0.0',
      upgradeAvailable: false,
      messages: ['<script>alert("hello world")</script>']
    })).toEqual([{ html: '&lt;script&gt;alert("hello world")&lt;/script&gt;' }])
  })
  it('should format bold text', () => {
    expect(prepareMessagesFromApi({
      version: '0.0.0',
      upgradeAvailable: false,
      messages: ['Hello **there**']
    })).toEqual([{ html: 'Hello <strong>there</strong>' }])
  })
  it('should not recognise double asterisks disconnected from words', () => {
    const input = ['Hello ** there**', 'Hello ** there **', 'Hello **there **']
    expect(prepareMessagesFromApi({
      version: '0.0.0',
      upgradeAvailable: false,
      messages: [...input]
    })).toEqual(unchnagedInputInOutputFormat(input))
  })
  it('should format italic text', () => {
    expect(prepareMessagesFromApi({
      version: '0.0.0',
      upgradeAvailable: false,
      messages: ['Hello *there*']
    })).toEqual([{ html: 'Hello <em>there</em>' }])
  })
  it('should not recognise single asterisks disconnected from words', () => {
    const input = ['Hello * there*', 'Hello * there *', 'Hello *there *', 'Some* information about a* product']
    expect(prepareMessagesFromApi({
      version: '0.0.0',
      upgradeAvailable: false,
      messages: input
    })).toEqual(unchnagedInputInOutputFormat(input))
  })
  it('should format links', () => {
    expect(prepareMessagesFromApi({
      version: '0.0.0',
      upgradeAvailable: false,
      messages: ['You really need to see this cat (link:https://docs.nowprototype.it/latest/test-helpers/cat?typeOfCat=housecat&quality=high). I hope that improved your day.']
    })).toEqual([{ html: 'You really need to see this cat <a href="https://docs.nowprototype.it/latest/test-helpers/cat?typeOfCat=housecat&quality=high">https://docs.nowprototype.it/latest/test-helpers/cat?typeOfCat=housecat&quality=high</a>. I hope that improved your day.' }])
  })
  it('should not recognise single asterisks disconnected from words', () => {
    const input = [
      'You really need to see this cat ( link:https://docs.nowprototype.it/latest/test-helpers/cat?typeOfCat=housecat&quality=high). I hope that improved your day.',
      'You really need to see this cat (link: https://docs.nowprototype.it/latest/test-helpers/cat?typeOfCat=housecat&quality=high). I hope that improved your day.',
      'You really need to see this cat (link:https://docs.nowprototype.it/latest/test-helpers/cat?typeOfCat=housecat&quality=high ). I hope that improved your day.',
      'You really need to see this cat (link:https://docs.no"wprototype.it/latest/test-helpers/cat?typeOfCat=housecat&quality=high ). I hope that improved your day.',
      'You really need to see this cat (link:). I hope that improved your day.',
      'You really need to see this cat (link:abc def). I hope that improved your day.'
    ]
    expect(prepareMessagesFromApi({
      version: '0.0.0',
      upgradeAvailable: false,
      messages: input
    })).toEqual(unchnagedInputInOutputFormat(input))
  })
  it('should add the standard update message', () => {
    expect(prepareMessagesFromApi({
      version: '0.0.0',
      upgradeAvailable: true,
      messages: []
    })).toEqual([
      { html: '<a href="/manage-prototype/plugin/npm:nowprototypeit">An update is available, you can now install that directly from the plugin page.</a>' }
    ])
  })
})
