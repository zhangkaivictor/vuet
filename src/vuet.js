import { _Vue } from './install'
import utils from './utils'
import debug from './debug'
export const plugins = {}

const pluginCallHook = (vuet, hook) => {
  for (let k in plugins) {
    if (utils.isFunction(plugins[k][hook])) {
      plugins[k][hook](vuet)
    }
  }
}

export default class Vuet {
  constructor (options) {
    if (!utils.isObject(options)) {
      debug.error('Parameter is the object type')
    }
    this.options = options || {}
    this.app = null
    this.store = {}
    this.beforeHooks = [] // Before the request begins
    this.afterHooks = [] // After the request begins
    this.vm = null
  }
  beforeEach (fn) {
    this.beforeHooks.push(fn)
  }
  afterEach (fn) {
    this.afterHooks.push(fn)
  }
  init (app) {
    if (this.app) return
    this.app = app
    this.vm = new _Vue({
      data: {
        store: this.store
      }
    })
    this._options = {
      data: this.options.data || function data () { return {} },
      modules: {}
    }
    utils.forEachObj(this.options.modules, (myModule, myModuleName) => {
      utils.forEachObj(myModule, (plugin, pluginName) => {
        utils.forEachObj(plugin, (store, storeName) => {
          const path = `${myModuleName}/${pluginName}/${storeName}`
          this._options.modules[path] = this.options.modules[myModuleName][pluginName][storeName]
          this.reset(path)
        })
      })
    })
    pluginCallHook(this, 'init')
  }
  setState (path, data) {
    if (!this.store[path]) {
      return _Vue.set(this.store, path, data)
    }
    Object.assign(this.store[path], data)
  }
  getState (path) {
    return this.store[path] || {}
  }
  reset (path) {
    const data = this.options.data()
    const store = this._options.modules[path]
    if (utils.isFunction(store.data)) {
      Object.assign(data, store.data.call(this, path))
    }
    this.setState(path, data)
  }
  fetch (path, params) {
    const store = this._options.modules[path]
    if (!utils.isFunction(store.fetch)) return false
    const data = {
      path,
      params,
      store: this.getState(path)
    }
    const callHook = (hook, ...arg) => {
      for (let i = 0; i < this[hook].length; i++) {
        if (this[hook][i].call(this, ...arg)) {
          return false
        }
      }
    }
    if (callHook('beforeHooks', data) === false) return Promise.resolve(data.store)
    return store.fetch.call(this)
    .then(res => {
      if (callHook('afterHooks', null, data, res) === false) return data.store
      this.setState(path, res)
      return data.store
    })
    .catch(e => {
      if (callHook('afterHooks', e, data) === false) return Promise.resolve(data.store)
      return Promise.reject(e)
    })
  }
  destroy () {
    this.vm.$destroy()
    pluginCallHook(this, 'destroy')
  }
}

Vuet.use = function use (plugin, opt) {
  if (utils.isFunction(plugin.install)) {
    plugin.install(_Vue, Vuet, opt)
  }
  if (typeof plugin.name !== 'string' && !plugin.name) return this
  plugins[plugin.name] = plugin
  return this
}
