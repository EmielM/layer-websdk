const Query = require('./query');

/**
 * Query builder class generating queries for a set of messages.
 * Used in Creating and Updating layer.Query instances.
 *
 * Using the Query Builder, we should be able to instantiate a Query
 *
 *      var qBuilder = QueryBuilder
 *       .messages()
 *       .forConversation('layer:///conversations/ffffffff-ffff-ffff-ffff-ffffffffffff')
 *       .paginationWindow(100);
 *      var query = client.createQuery(qBuilder);
 *
 *
 * You can then create additional builders and update the query:
 *
 *      var qBuilder2 = QueryBuilder
 *       .messages()
 *       .forConversation('layer:///conversations/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
 *       .paginationWindow(200);
 *      query.update(qBuilder);
 *
 * @class layer.QueryBuilder.MessagesQuery
 */
class MessagesQuery {

  /**
   * Creates a new query builder for a set of messages.
   *
   * Standard use is without any arguments.
   *
   * @method constructor
   * @param  {Object} [query=null]
   */
  constructor(query) {
    if (query) {
      this._query = {
        model: query.model,
        returnType: query.returnType,
        dataType: query.dataType,
        paginationWindow: query.paginationWindow,
      };
    } else {
      this._query = {
        model: Query.Message,
        returnType: 'object',
        dataType: 'object',
        paginationWindow: Query.prototype.paginationWindow,
      };
    }

    // TODO remove when messages can be fetched via query API rather than `GET /messages`
    this._conversationIdSet = false;
  }

  /**
   * Query for messages in this Conversation or Channel.
   *
   * @method forConversation
   * @param  {String} conversationId  Accepts a Conversation ID or Channel ID
   */
  forConversation(conversationId) {
    if (conversationId.indexOf('layer:///channels/') === 0) {
      this._query.predicate = `channel.id = '${conversationId}'`;
      this._conversationIdSet = true;
    } else if (conversationId.indexOf('layer:///conversations/') === 0) {
      this._query.predicate = `conversation.id = '${conversationId}'`;
      this._conversationIdSet = true;
    } else {
      this._query.predicate = '';
      this._conversationIdSet = false;
    }
    return this;
  }

  /**
   * Sets the pagination window/number of messages to fetch from the local cache or server.
   *
   * Currently only positive integers are supported.
   *
   * @method paginationWindow
   * @param  {number} win
   */
  paginationWindow(win) {
    this._query.paginationWindow = win;
    return this;
  }

  /**
   * Returns the built query object to send to the server.
   *
   * Called by layer.QueryBuilder. You should not need to call this.
   *
   * @method build
   */
  build() {
    return this._query;
  }
}

/**
 * Query builder class generating queries for a set of Announcements.
 *
 * To get started:
 *
 *      var qBuilder = QueryBuilder
 *       .announcements()
 *       .paginationWindow(100);
 *      var query = client.createQuery(qBuilder);
 *
 * @class layer.QueryBuilder.AnnouncementsQuery
 * @extends layer.QueryBuilder.MessagesQuery
 */
class AnnouncementsQuery extends MessagesQuery {
  constructor(options) {
    super(options);
    this._query.model = Query.Announcement;
  }
  build() {
    return this._query;
  }
}

/**
 * Query builder class generating queries for a set of Conversations.
 *
 * Used in Creating and Updating layer.Query instances.
 *
 * To get started:
 *
 *      var qBuilder = QueryBuilder
 *       .conversations()
 *       .paginationWindow(100);
 *      var query = client.createQuery(qBuilder);
 *
 * You can then create additional builders and update the query:
 *
 *      var qBuilder2 = QueryBuilder
 *       .conversations()
 *       .paginationWindow(200);
 *      query.update(qBuilder);
 *
 * @class layer.QueryBuilder.ConversationsQuery
 */
class ConversationsQuery {

  /**
   * Creates a new query builder for a set of conversations.
   *
   * Standard use is without any arguments.
   *
   * @method constructor
   * @param  {Object} [query=null]
   */
  constructor(query) {
    if (query) {
      this._query = {
        model: query.model,
        returnType: query.returnType,
        dataType: query.dataType,
        paginationWindow: query.paginationWindow,
        sortBy: query.sortBy,
      };
    } else {
      this._query = {
        model: Query.Conversation,
        returnType: 'object',
        dataType: 'object',
        paginationWindow: Query.prototype.paginationWindow,
        sortBy: null,
      };
    }
  }

  /**
   * Sets the pagination window/number of messages to fetch from the local cache or server.
   *
   * Currently only positive integers are supported.
   *
   * @method paginationWindow
   * @param  {number} win
   * @return {layer.QueryBuilder} this
   */
  paginationWindow(win) {
    this._query.paginationWindow = win;
    return this;
  }

  /**
   * Sets the sorting options for the Conversation.
   *
   * Currently only supports descending order
   * Currently only supports fieldNames of "createdAt" and "lastMessage.sentAt"
   *
   * @method sortBy
   * @param  {string} fieldName  - field to sort by
   * @param  {boolean} asc - Is an ascending sort?
   * @return {layer.QueryBuilder} this
   */
  sortBy(fieldName, asc = false) {
    this._query.sortBy = [{ [fieldName]: asc ? 'asc' : 'desc' }];
    return this;
  }

  /**
   * Returns the built query object to send to the server.
   *
   * Called by layer.QueryBuilder. You should not need to call this.
   *
   * @method build
   */
  build() {
    return this._query;
  }
}

/* Feature is tested but not available on server
 * Query builder class generating queries for a set of Channels.
 *
 * Used in Creating and Updating layer.Query instances.
 *
 * To get started:
 *
 *      var qBuilder = QueryBuilder
 *       .channels()
 *       .paginationWindow(100);
 *      var query = client.createQuery(qBuilder);
 *
 * You can then create additional builders and update the query:
 *
 *      var qBuilder2 = QueryBuilder
 *       .conversations()
 *       .paginationWindow(200);
 *      query.update(qBuilder);
 *
 * @class layer.QueryBuilder.ChannelsQuery
 */
class ChannelsQuery {

  /**
   * Creates a new query builder for a set of conversations.
   *
   * Standard use is without any arguments.
   *
   * @method constructor
   * @param  {Object} [query=null]
   */
  constructor(query) {
    if (query) {
      this._query = {
        model: query.model,
        returnType: query.returnType,
        dataType: query.dataType,
        paginationWindow: query.paginationWindow,
        sortBy: null,
      };
    } else {
      this._query = {
        model: Query.Channel,
        returnType: 'object',
        dataType: 'object',
        paginationWindow: Query.prototype.paginationWindow,
        sortBy: null,
      };
    }
  }

  /**
   * Sets the pagination window/number of messages to fetch from the local cache or server.
   *
   * Currently only positive integers are supported.
   *
   * @method paginationWindow
   * @param  {number} win
   * @return {layer.QueryBuilder} this
   */
  paginationWindow(win) {
    this._query.paginationWindow = win;
    return this;
  }

  /**
   * Returns the built query object to send to the server.
   *
   * Called by layer.QueryBuilder. You should not need to call this.
   *
   * @method build
   */
  build() {
    return this._query;
  }
}


/* Feature is tested but not available on server
 * Query builder class generating queries for getting members of a Channel.
 *
 * Used in Creating and Updating layer.Query instances.
 *
 * To get started:
 *
 *      var qBuilder = QueryBuilder
 *       .members()
 *       .forChannel(channelId)
 *       .paginationWindow(100);
 *      var query = client.createQuery(qBuilder);
 *
 * You can then create additional builders and update the query:
 *
 *      var qBuilder2 = QueryBuilder
 *       .members()
 *       .forChannel(channelId)
 *       .paginationWindow(200);
 *      query.update(qBuilder);
 *
 * @class layer.QueryBuilder.MembersQuery
 */
class MembersQuery {

  /**
   * Creates a new query builder for a set of conversations.
   *
   * Standard use is without any arguments.
   *
   * @method constructor
   * @param  {Object} [query=null]
   */
  constructor(query) {
    if (query) {
      this._query = {
        model: query.model,
        returnType: query.returnType,
        dataType: query.dataType,
        paginationWindow: query.paginationWindow,
        sortBy: null,
      };
    } else {
      this._query = {
        model: Query.Membership,
        returnType: 'object',
        dataType: 'object',
        paginationWindow: Query.prototype.paginationWindow,
        sortBy: null,
      };
    }
  }

  /**
   * Sets the pagination window/number of messages to fetch from the local cache or server.
   *
   * Currently only positive integers are supported.
   *
   * @method paginationWindow
   * @param  {number} win
   * @return {layer.QueryBuilder} this
   */
  paginationWindow(win) {
    this._query.paginationWindow = win;
    return this;
  }

  /**
   * Query for members in this Channel.
   *
   * @method forChannel
   * @param  {String} channelId
   */
  forChannel(channelId) {
    if (channelId.indexOf('layer:///channels/') === 0) {
      this._query.predicate = `channel.id = '${channelId}'`;
    } else {
      this._query.predicate = '';
    }
    return this;
  }

  /**
   * Returns the built query object to send to the server.
   *
   * Called by layer.QueryBuilder. You should not need to call this.
   *
   * @method build
   */
  build() {
    return this._query;
  }
}


/**
 * Query builder class generating queries for a set of Identities followed by this user.
 *
 * Used in Creating and Updating layer.Query instances.
 *
 * To get started:
 *
 *      var qBuilder = QueryBuilder
 *       .identities()
 *       .paginationWindow(100);
 *      var query = client.createQuery(qBuilder);
 *
 * @class layer.QueryBuilder.IdentitiesQuery
 */
class IdentitiesQuery {

  /**
   * Creates a new query builder for a set of conversations.
   *
   * Standard use is without any arguments.
   *
   * @method constructor
   * @param  {Object} [query=null]
   */
  constructor(query) {
    if (query) {
      this._query = {
        model: query.model,
        returnType: query.returnType,
        dataType: query.dataType,
        paginationWindow: query.paginationWindow,
      };
    } else {
      this._query = {
        model: Query.Identity,
        returnType: 'object',
        dataType: 'object',
        paginationWindow: Query.prototype.paginationWindow,
      };
    }
  }

  /**
   * Sets the pagination window/number of messages to fetch from the local cache or server.
   *
   * Currently only positive integers are supported.
   *
   * @method paginationWindow
   * @param  {number} win
   * @return {layer.QueryBuilder} this
   */
  paginationWindow(win) {
    this._query.paginationWindow = win;
    return this;
  }

  /**
   * Returns the built query object to send to the server.
   *
   * Called by layer.QueryBuilder. You should not need to call this.
   *
   * @method build
   */
  build() {
    return this._query;
  }
}

/**
 * Query builder class. Used with layer.Query to specify what local/remote
 * data changes to subscribe to.  For examples, see layer.QueryBuilder.MessagesQuery
 * and layer.QueryBuilder.ConversationsQuery.  This static class is used to instantiate
 * MessagesQuery and ConversationsQuery Builder instances:
 *
 *      var conversationsQueryBuilder = QueryBuilder.conversations();
 *      var messagesQueryBuidler = QueryBuilder.messages();
 *
 * Should you use these instead of directly using the layer.Query class?
 * That is a matter of programming style and preference, there is no
 * correct answer.
 *
 * @class layer.QueryBuilder
 */
const QueryBuilder = {

  /**
   * Create a new layer.MessagesQuery instance.
   *
   * @method messages
   * @static
   * @returns {layer.QueryBuilder.MessagesQuery}
   */
  messages() {
    return new MessagesQuery();
  },

  /**
   * Create a new layer.AnnouncementsQuery instance.
   *
   * @method announcements
   * @static
   * @returns {layer.QueryBuilder.AnnouncementsQuery}
   */
  announcements() {
    return new AnnouncementsQuery();
  },

  /**
   * Create a new layer.ConversationsQuery instance.
   *
   * @method conversations
   * @static
   * @returns {layer.QueryBuilder.ConversationsQuery}
   */
  conversations() {
    return new ConversationsQuery();
  },

  /* Feature is tested but not available on server
   * Create a new layer.ChannelsQuery instance.
   *
   * @method channels
   * @static
   * @returns {layer.QueryBuilder.ChannelsQuery}
   */
  channels() {
    return new ChannelsQuery();
  },

  /* Feature is tested but not available on server
   * Create a new layer.MembersQuery instance.
   *
   * @method members
   * @static
   * @returns {layer.QueryBuilder.MembersQuery}
   */
  members() {
    return new MembersQuery();
  },

  /**
   * Create a new layer.IdentitiesQuery instance.
   *
   * @method identities
   * @static
   * @returns {layer.QueryBuilder.IdentitiesQuery}
   */
  identities() {
    return new IdentitiesQuery();
  },

  /**
   * Takes the return value of QueryBuilder.prototype.build and creates a
   * new QueryBuilder.
   *
   * Used within layer.Query.prototype.toBuilder.
   *
   * @method fromQueryObject
   * @private
   * @param {Object} obj
   * @static
   */
  fromQueryObject(obj) {
    switch (obj.model) {
      case Query.Message:
        return new MessagesQuery(obj);
      case Query.Announcement:
        return new AnnouncementsQuery(obj);
      case Query.Conversation:
        return new ConversationsQuery(obj);
      case Query.Channel:
        return new ChannelsQuery(obj);
      case Query.Identity:
        return new IdentitiesQuery(obj);
      case Query.Membership:
        return new MembersQuery(obj);
      default:
        return null;
    }
  },
};

module.exports = QueryBuilder;

