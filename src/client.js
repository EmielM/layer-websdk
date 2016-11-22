/**
 * The Layer Client; this is the top level component for any Layer based application.

    var client = new layer.Client({
      appId: 'layer:///apps/staging/ffffffff-ffff-ffff-ffff-ffffffffffff',
      challenge: function(evt) {
        myAuthenticator({
          nonce: evt.nonce,
          onSuccess: evt.callback
        });
      },
      ready: function(client) {
        alert('I am Client; Server: Serve me!');
      }
    }).connect('Fred')
 *
 * You can also initialize this as

    var client = new layer.Client({
      appId: 'layer:///apps/staging/ffffffff-ffff-ffff-ffff-ffffffffffff'
    });

    client.on('challenge', function(evt) {
      myAuthenticator({
        nonce: evt.nonce,
        onSuccess: evt.callback
      });
    });

    client.on('ready', function(client) {
      alert('I am Client; Server: Serve me!');
    });

    client.connect('Fred');
 *
 * ## API Synopsis:
 *
 * The following Properties, Methods and Events are the most commonly used ones.  See the full API below
 * for the rest of the API.
 *
 * ### Properties:
 *
 * * layer.Client.userId: User ID of the authenticated user
 * * layer.Client.appId: The ID for your application
 *
 *
 * ### Methods:
 *
 * * layer.Client.createConversation(): Create a new layer.Conversation.
 * * layer.Client.createQuery(): Create a new layer.Query.
 * * layer.Client.getMessage(): Input a Message ID, and output a layer.Message or layer.Announcement from cache.
 * * layer.Client.getConversation(): Input a Conversation ID, and output a layer.Conversation from cache.
 * * layer.Client.on() and layer.Conversation.off(): event listeners
 * * layer.Client.destroy(): Cleanup all resources used by this client, including all Messages and Conversations.
 *
 * ### Events:
 *
 * * `challenge`: Provides a nonce and a callback; you call the callback once you have an Identity Token.
 * * `ready`: Your application can now start using the Layer services
 * * `messages:notify`: Used to notify your application of new messages for which a local notification may be suitable.
 *
 * ## Logging:
 *
 * There are two ways to change the log level for Layer's logger:
 *
 *     layer.Client.prototype.logLevel = layer.Constants.LOG.INFO;
 *
 * or
 *
 *     var client = new layer.Client({
 *        appId: 'layer:///apps/staging/ffffffff-ffff-ffff-ffff-ffffffffffff',
 *        logLevel: layer.Constants.LOG.INFO
 *     });
 *
 * @class  layer.Client
 * @extends layer.ClientAuthenticator
 * @mixin layer.mixins.ClientIdentities
 * @mixin layer.mixins.ClientConversations
 * @mixin layer.mixins.ClientMessages
 * @mixin layer.mixins.ClientQueries
 */

const ClientAuth = require('./client-authenticator');
const Conversation = require('./messaging/conversation');
const Query = require('./query');
const ErrorDictionary = require('./layer-error').dictionary;
const Syncable = require('./syncable');
const Message = require('./messaging/message');
const Announcement = require('./messaging/announcement');
const Identity = require('./identity');
const TypingIndicatorListener = require('./typing-indicators/typing-indicator-listener');
const Util = require('./client-utils');
const Root = require('./root');
const ClientRegistry = require('./client-registry');
const logger = require('./logger');


class Client extends ClientAuth {

  /*
   * Adds conversations, messages and websockets on top of the authentication client.
   * jsdocs on parent class constructor.
   */
  constructor(options) {
    super(options);
    ClientRegistry.register(this);
    Client.mixins.forEach(mixin => mixin.lifecycle.constructor.apply(this, [options]));

    // Initialize Properties
    this._scheduleCheckAndPurgeCacheItems = [];

    this._initComponents();

    this.on('online', this._connectionRestored.bind(this));

    logger.info(Util.asciiInit(Client.version));
  }

  /* See parent method docs */
  _initComponents() {
    super._initComponents();

    this._typingIndicators = new TypingIndicatorListener({
      clientId: this.appId,
    });

    // Instantiate Plugins
    Object.keys(Client.plugins).forEach(propertyName => {
      this[propertyName] = new Client.plugins[propertyName](this);
    });
  }

  /**
   * Cleanup all resources (Conversations, Messages, etc...) prior to destroy or reauthentication.
   *
   * @method _cleanup
   * @private
   */
  _cleanup() {
    if (this.isDestroyed) return;
    this._inCleanup = true;

    Client.mixins.forEach(mixin => mixin.lifecycle.cleanup.apply(this));

    if (this.socketManager) this.socketManager.close();
  }

  destroy() {
    // Cleanup all plugins
    Object.keys(Client.plugins).forEach(propertyName => {
      if (this[propertyName]) {
        this[propertyName].destroy();
        delete this[propertyName];
      }
    });

    // Cleanup all resources (Conversations, Messages, etc...)
    this._cleanup();

    this._destroyComponents();

    ClientRegistry.unregister(this);

    super.destroy();
    this._inCleanup = false;
  }

  __adjustAppId() {
    if (this.appId) throw new Error(ErrorDictionary.appIdImmutable);
  }






  /**
   * Takes an array of Identity instances, User IDs, Identity IDs, Identity objects,
   * or Server formatted Identity Objects and returns an array of Identity instances.
   *
   * @method _fixIdentities
   * @private
   * @param {Mixed[]} identities - Something that tells us what Identity to return
   * @return {layer.Identity[]}
   */
  _fixIdentities(identities) {
    return identities.map((identity) => {
      if (identity instanceof Identity) return identity;
      if (typeof identity === 'string') {
        return this.getIdentity(identity, true);
      } else if (identity && typeof identity === 'object') {
        if ('userId' in identity) {
          return this.getIdentity(identity.id || identity.userId);
        } else if ('user_id' in identity) {
          return this._createObject(identity);
        }
      }
    });
  }



  /**
   * Takes as input an object id, and either calls getConversation() or getMessage() as needed.
   *
   * Will only get cached objects, will not get objects from the server.
   *
   * This is not a public method mostly so there's no ambiguity over using getXXX
   * or _getObject.  getXXX typically has an option to load the resource, which this
   * does not.
   *
   * @method _getObject
   * @protected
   * @param  {string} id - Message, Conversation or Query id
   * @return {layer.Message|layer.Conversation|layer.Query}
   */
  _getObject(id) {
    switch (Util.typeFromID(id)) {
      case 'messages':
      case 'announcements':
        return this.getMessage(id);
      case 'conversations':
        return this.getConversation(id);
      case 'queries':
        return this.getQuery(id);
      case 'identities':
        return this.getIdentity(id);
    }
    return null;
  }


  /**
   * Takes an object description from the server and either updates it (if cached)
   * or creates and caches it .
   *
   * @method _createObject
   * @protected
   * @param  {Object} obj - Plain javascript object representing a Message or Conversation
   */
  _createObject(obj) {
    const item = this._getObject(obj.id);
    if (item) {
      item._populateFromServer(obj);
      return item;
    } else {
      switch (Util.typeFromID(obj.id)) {
        case 'messages':
          return Message._createFromServer(obj, this);
        case 'announcements':
          return Announcement._createFromServer(obj, this);
        case 'conversations':
          return Conversation._createFromServer(obj, this);
        case 'identities':
          return Identity._createFromServer(obj, this);
      }
    }
    return null;
  }

  /**
   * Merge events into smaller numbers of more complete events.
   *
   * Before any delayed triggers are fired, fold together all of the conversations:add
   * and conversations:remove events so that 100 conversations:add events can be fired as
   * a single event.
   *
   * @method _processDelayedTriggers
   * @private
   */
  _processDelayedTriggers() {
    if (this.isDestroyed) return;

    const addConversations = this._delayedTriggers.filter((evt) => evt[0] === 'conversations:add');
    const removeConversations = this._delayedTriggers.filter((evt) => evt[0] === 'conversations:remove');
    this._foldEvents(addConversations, 'conversations', this);
    this._foldEvents(removeConversations, 'conversations', this);

    const addMessages = this._delayedTriggers.filter((evt) => evt[0] === 'messages:add');
    const removeMessages = this._delayedTriggers.filter((evt) => evt[0] === 'messages:remove');

    this._foldEvents(addMessages, 'messages', this);
    this._foldEvents(removeMessages, 'messages', this);

    const addIdentities = this._delayedTriggers.filter((evt) => evt[0] === 'identities:add');
    const removeIdentities = this._delayedTriggers.filter((evt) => evt[0] === 'identities:remove');

    this._foldEvents(addIdentities, 'identities', this);
    this._foldEvents(removeIdentities, 'identities', this);

    super._processDelayedTriggers();
  }

  trigger(eventName, evt) {
    this._triggerLogger(eventName, evt);
    super.trigger(eventName, evt);
  }

  /**
   * Does logging on all triggered events.
   *
   * All logging is done at `debug` or `info` levels.
   *
   * @method _triggerLogger
   * @private
   */
  _triggerLogger(eventName, evt) {
    const infoEvents = [
      'conversations:add', 'conversations:remove', 'conversations:change',
      'messages:add', 'messages:remove', 'messages:change',
      'identities:add', 'identities:remove', 'identities:change',
      'challenge', 'ready',
    ];
    if (infoEvents.indexOf(eventName) !== -1) {
      if (evt && evt.isChange) {
        logger.info(`Client Event: ${eventName} ${evt.changes.map(change => change.property).join(', ')}`);
      } else {
        let text = '';
        if (evt) {
          if (evt.message) text = evt.message.id;
          if (evt.messages) text = evt.messages.length + ' messages';
          if (evt.conversation) text = evt.conversation.id;
          if (evt.conversations) text = evt.conversations.length + ' conversations';
        }
        logger.info(`Client Event: ${eventName} ${text}`);
      }
      if (evt) logger.debug(evt);
    } else {
      logger.debug(eventName, evt);
    }
  }



  /**
   * If the session has been reset, dump all data.
   *
   * @method _resetSession
   * @private
   */
  _resetSession() {
    this._cleanup();
    Client.mixins.forEach(mixin => mixin.lifecycle.reset.apply(this));
    return super._resetSession();
  }


  /**
   * Check to see if the specified objects can safely be removed from cache.
   *
   * Removes from cache if an object is not part of any Query's result set.
   *
   * @method _checkAndPurgeCache
   * @private
   * @param  {layer.Root[]} objects - Array of Messages or Conversations
   */
  _checkAndPurgeCache(objects) {
    objects.forEach(obj => {
      if (!obj.isDestroyed && !this._isCachedObject(obj)) {
        if (obj instanceof Root === false) obj = this._getObject(obj.id);
        if (obj) obj.destroy();
      }
    });
  }

  /**
   * Schedules _runScheduledCheckAndPurgeCache if needed, and adds this object
   * to the list of objects it will validate for uncaching.
   *
   * Note that any object that does not exist on the server (!isSaved()) is an object that the
   * app created and can only be purged by the app and not by the SDK.  Once its been
   * saved, and can be reloaded from the server when needed, its subject to standard caching.
   *
   * @method _scheduleCheckAndPurgeCache
   * @private
   * @param {layer.Root} object
   */
  _scheduleCheckAndPurgeCache(object) {
    if (object.isSaved()) {
      if (this._scheduleCheckAndPurgeCacheAt < Date.now()) {
        this._scheduleCheckAndPurgeCacheAt = Date.now() + Client.CACHE_PURGE_INTERVAL;
        setTimeout(() => this._runScheduledCheckAndPurgeCache(), Client.CACHE_PURGE_INTERVAL);
      }
      this._scheduleCheckAndPurgeCacheItems.push(object);
    }
  }

  /**
   * Calls _checkAndPurgeCache on accumulated objects and resets its state.
   *
   * @method _runScheduledCheckAndPurgeCache
   * @private
   */
  _runScheduledCheckAndPurgeCache() {
    const list = this._scheduleCheckAndPurgeCacheItems;
    this._scheduleCheckAndPurgeCacheItems = [];
    this._checkAndPurgeCache(list);
    this._scheduleCheckAndPurgeCacheAt = 0;
  }

  /**
   * Returns true if the specified object should continue to be part of the cache.
   *
   * Result is based on whether the object is part of the data for a Query.
   *
   * @method _isCachedObject
   * @private
   * @param  {layer.Root} obj - A Message or Conversation Instance
   * @return {Boolean}
   */
  _isCachedObject(obj) {
    const list = Object.keys(this._queriesHash);
    for (let i = 0; i < list.length; i++) {
      const query = this._queriesHash[list[i]];
      if (query._getItem(obj.id)) return true;
    }
    return false;
  }

  /**
   * On restoring a connection, determine what steps need to be taken to update our data.
   *
   * A reset boolean property is passed; set based on  layer.ClientAuthenticator.ResetAfterOfflineDuration.
   *
   * Note it is possible for an application to have logic that causes queries to be created/destroyed
   * as a side-effect of layer.Query.reset destroying all data. So we must test to see if queries exist.
   *
   * @method _connectionRestored
   * @private
   * @param {boolean} reset - Should the session reset/reload all data or attempt to resume where it left off?
   */
  _connectionRestored(evt) {
    if (evt.reset) {
      logger.debug('Client Connection Restored; Resetting all Queries');
      this.dbManager.deleteTables(() => {
        this.dbManager._open();
        Object.keys(this._queriesHash).forEach(id => {
          const query = this._queriesHash[id];
          if (query) query.reset();
        });
      });
    }
  }

  /**
   * Remove the specified object from cache
   *
   * @method _removeObject
   * @private
   * @param  {layer.Root}  obj - A Message or Conversation Instance
   */
  _removeObject(obj) {
    if (obj) obj.destroy();
  }

  /**
   * Creates a layer.TypingIndicators.TypingListener instance
   * bound to the specified dom node.
   *
   *      var typingListener = client.createTypingListener(document.getElementById('myTextBox'));
   *      typingListener.setConversation(mySelectedConversation);
   *
   * Use this method to instantiate a listener, and call
   * layer.TypingIndicators.TypingListener.setConversation every time you want to change which Conversation
   * it reports your user is typing into.
   *
   * @method createTypingListener
   * @param  {HTMLElement} inputNode - Text input to watch for keystrokes
   * @return {layer.TypingIndicators.TypingListener}
   */
  createTypingListener(inputNode) {
    const TypingListener = require('./typing-indicators/typing-listener');
    return new TypingListener({
      clientId: this.appId,
      input: inputNode,
    });
  }

  /**
   * Creates a layer.TypingIndicators.TypingPublisher.
   *
   * The TypingPublisher lets you manage your Typing Indicators without using
   * the layer.TypingIndicators.TypingListener.
   *
   *      var typingPublisher = client.createTypingPublisher();
   *      typingPublisher.setConversation(mySelectedConversation);
   *      typingPublisher.setState(layer.TypingIndicators.STARTED);
   *
   * Use this method to instantiate a listener, and call
   * layer.TypingIndicators.TypingPublisher.setConversation every time you want to change which Conversation
   * it reports your user is typing into.
   *
   * Use layer.TypingIndicators.TypingPublisher.setState to inform other users of your current state.
   * Note that the `STARTED` state only lasts for 2.5 seconds, so you
   * must repeatedly call setState for as long as this state should continue.
   * This is typically done by simply calling it every time a user hits
   * a key.
   *
   * @method createTypingPublisher
   * @return {layer.TypingIndicators.TypingPublisher}
   */
  createTypingPublisher() {
    const TypingPublisher = require('./typing-indicators/typing-publisher');
    return new TypingPublisher({
      clientId: this.appId,
    });
  }

  /**
   * Get the current typing indicator state of a specified Conversation.
   *
   * Typically used to see if anyone is currently typing when first opening a Conversation.
   *
   * @method getTypingState
   * @param {String} conversationId
   */
  getTypingState(conversationId) {
    return this._typingIndicators.getState(conversationId);
  }

  /**
   * Accessor for getting a Client by appId.
   *
   * Most apps will only have one client,
   * and will not need this method.
   *
   * @method getClient
   * @static
   * @param  {string} appId
   * @return {layer.Client}
   */
  static getClient(appId) {
    return ClientRegistry.get(appId);
  }

  static destroyAllClients() {
    ClientRegistry.getAll().forEach(client => client.destroy());
  }

  /*
   * Registers a plugin which can add capabilities to the Client.
   *
   * Capabilities must be triggered by Events/Event Listeners.
   *
   * This concept is a bit premature and unused/untested...
   * As implemented, it provides for a plugin that will be
   * instantiated by the Client and passed the Client as its parameter.
   * This allows for a library of plugins that can be shared among
   * different companies/projects but that are outside of the core
   * app logic.
   *
   *      // Define the plugin
   *      function MyPlugin(client) {
   *          this.client = client;
   *          client.on('messages:add', this.onMessagesAdd, this);
   *      }
   *
   *      MyPlugin.prototype.onMessagesAdd = function(event) {
   *          var messages = event.messages;
   *          alert('You now have ' + messages.length  + ' messages');
   *      }
   *
   *      // Register the Plugin
   *      Client.registerPlugin('myPlugin34', MyPlugin);
   *
   *      var client = new Client({appId: 'layer:///apps/staging/uuid'});
   *
   *      // Trigger the plugin's behavior
   *      client.myPlugin34.addMessages({messages:[]});
   *
   * @method registerPlugin
   * @static
   * @param  {string} name     [description]
   * @param  {Function} classDef [description]
   */
  static registerPlugin(name, classDef) {
    Client.plugins[name] = classDef;
  }
}

/**
 * Array of items to be checked to see if they can be uncached.
 *
 * @private
 * @type {layer.Root[]}
 */
Client.prototype._scheduleCheckAndPurgeCacheItems = null;

/**
 * Time that the next call to _runCheckAndPurgeCache() is scheduled for in ms since 1970.
 *
 * @private
 * @type {number}
 */
Client.prototype._scheduleCheckAndPurgeCacheAt = 0;

/**
 * Get the version of the Client library.
 *
 * @static
 * @type {String}
 */
Client.version = '3.0.2';

/**
 * Any Conversation or Message that is part of a Query's results are kept in memory for as long as it
 * remains in that Query.  However, when a websocket event delivers new Messages and Conversations that
 * are NOT part of a Query, how long should they stick around in memory?  Why have them stick around?
 * Perhaps an app wants to post a notification of a new Message or Conversation... and wants to keep
 * the object local for a little while.  Default is 10 minutes before checking to see if
 * the object is part of a Query or can be uncached.  Value is in miliseconds.
 * @static
 * @type {number}
 */
Client.CACHE_PURGE_INTERVAL = 10 * 60 * 1000;

Client._ignoredEvents = [
  'conversations:loaded',
  'conversations:loaded-error',
];

Client._supportedEvents = [
  /**
   * A Typing Indicator state has changed.
   *
   * Either a change has been received
   * from the server, or a typing indicator state has expired.
   *
   *      client.on('typing-indicator-change', function(evt) {
   *          if (evt.conversationId === myConversationId) {
   *              alert(evt.typing.join(', ') + ' are typing');
   *              alert(evt.paused.join(', ') + ' are paused');
   *          }
   *      });
   *
   * @event
   * @param {layer.LayerEvent} evt
   * @param {string} conversationId - ID of the Conversation users are typing into
   * @param {string[]} typing - Array of user IDs who are currently typing
   * @param {string[]} paused - Array of user IDs who are currently paused;
   *                            A paused user still has text in their text box.
   */
  'typing-indicator-change',


].concat(ClientAuth._supportedEvents);

Client.plugins = {};
Client.mixins = [
  require('./mixins/client-queries'),
  require('./mixins/client-identities'),
  require('./mixins/client-conversations'),
  require('./mixins/client-messages'),
];
Root.initClass.apply(Client, [Client, 'Client']);
module.exports = Client;

