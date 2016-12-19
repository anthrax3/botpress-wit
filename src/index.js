import path from 'path'
import fs from 'fs'

import Wit from './wit'

let wit = null
let configFile = null

const saveConfig = (config) => {
  fs.writeFileSync(configFile, JSON.stringify(config))
}

const loadConfig = () => {
  if (!fs.existsSync(configFile)) {
    const config = { accessToken : '', selectedMode: 'understanding' }
    saveConfig(config, configFile)
  }

  const overrides = {}
  if (process.env.WIT_TOKEN) overrides.accessToken = process.env.WIT_TOKEN

  return Object.assign(JSON.parse(fs.readFileSync(configFile, 'utf-8')), overrides)
}

const incomingMiddleware = (event, next) => {
  if (event.type === 'message') {
    if (event.bp.wit.mode === 'understanding') {
      Object.assign(wit.getUserContext(event.user.id).context, {
        botpress_platform: event.platform,
        botpress_type: event.type
      })
      wit.getEntities(event.user.id, event.text)
      .then(entities => {
        event.wit = { entities, context: wit.getUserContext(event.user.id) }
        next()
      })
      .catch(err => next(err))
    } else {
      Object.assign(wit.getUserContext(event.user.id).context, {
        botpress_platform: event.platform,
        botpress_type: event.type
      })

      wit.runActions(event.user.id, event.text)
      .then(() => {
        event.wit = { run: true, context: wit.getUserContext(event.user.id) }
      })
      .catch(err => next(err))
    }
  } else {
    next()
  }
}

module.exports = {
  init: function(bp) {
    wit = Wit(bp)

    configFile = path.join(bp.projectLocation, bp.botfile.modulesConfigDir, 'botpress-wit.json')

    bp.middlewares.register({
      name: 'wit.incoming',
      module: 'botpress-wit',
      type: 'incoming',
      handler: incomingMiddleware,
      order: 10,
      description: 'Understands entities from incoming message and suggests or executes actions.'
    })

    wit.setConfiguration(loadConfig())
  },

  ready: function(bp) {

    const router = bp.getRouter('botpress-wit')

    router.get('/config', (req, res) => {
      res.send(loadConfig())
    })

    router.post('/config', (req, res) => {
      const { accessToken, selectedMode } = req.body
      saveConfig({ accessToken, selectedMode })
      wit.setConfiguration(loadConfig())
      res.sendStatus(200)
    })
  }
}
