/*!
 * IframeClient v0.0.5
 * Copyright 2015, Vox Media
 * Released under MIT license
 */
(function(global, factory) {
  /**
  * IframeClient API
  * All frames must install and create their own instance of this client.
  * @example
  * var client = IframeClient.create('myapp', 'http://aweso.me')
  *  .on('play', function(data) { ... }, this)
  *  .on('pause', function(data) { ... }, this)
  *  .on('host', function(data) { return document.domain; }, this)
  *  .listen();
  */
  var IframeClient = {
    debug: false,

    /**
    * Creates a new IframeClient instance.
    * Seeds the client factory with parameters.
    * @private
    */
    create: function(app, origin) {
      return factory(this, app, origin, global);
    },

    /**
    * Tests if the current window environment is within an iframe.
    */
    isInIframe: function() {
      try {
        return global.parent && global.self !== global.top;
      } catch (e) {
        return true;
      }
    },

    /**
    * Library error handling.
    */
    error: function(err) {
      if (this.debug) throw err;
    }
  };

  /**
  * Module definitions:
  * Supports CommonJS and global namespace.
  */
  if (typeof module === 'object' && module.exports) {
    module.exports = IframeClient;
  } else {
    global.IframeClient = IframeClient;
  }

})(window, function(lib, appId, originHost, global) {

  /**
  * Generates a random GUID (Globally-Unique IDentifier) component.
  * @private
  */
  function s4() { return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1); }

  // Constants
  var CLIENT_GUID = s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
  var PROTOCOL_APP = '@app';
  var PROTOCOL_APP_ID = appId || 'xframe';
  var PROTOCOL_RESPONSE = '@res';
  var POLL_INTERVAL = 200;

  // Encapsulated state
  var handlers = [];
  var requests = {};
  var responses = {};
  var requestId = 0;
  var currentPoll = null;
  var listener = null;

  // Client API:
  return {
    host: originHost || '*',

    /**
    * READONLY
    * Specifies the GUID of the client instance.
    */
    get id() {
      return CLIENT_GUID;
    },

    /**
    * Resolves the source of a client window.
    * @param {String|Element|Window} target selector or iframe/window element.
    * @returns {Window} a resolved window source.
    * @private
    */
    src: function(src) {
      // Query for target when given a string:
      if (typeof src === 'string') {
        src = document.querySelector(src);
      }

      // Check target element (iframe) for a content window:
      if (src && src instanceof Element && src.contentWindow) {
        src = src.contentWindow;
      }

      // Return a resolved source frame:
      return (src && typeof src.postMessage === 'function') ? src : null;
    },

    /**
    * Posts a message and value to a source window.
    * This is a blind post without guarentee that the message will go through
    * (messages may fail if the source is not yet fully initialized).
    * Use `request` to post a message with confirmation of receipt.
    * @param {String|Element|Window} target selector or iframe/window element.
    * @param {String|Object} message string or formatted object (w/ "message" key).
    * @param {Any} [value] an optional value to send with the message.
    */
    post: function(src, message, value) {
      src = this.src(src);
      if (!src || !message) return lib.error('invalid post');

      // Generate the base data object:
      var data = (typeof message === 'string') ? { message: message } : message;

      // Assign a value, if one was provided:
      if (value !== undefined) data.value = value;

      // Validate message and protocol before sending:
      if (data.message) {
        data[PROTOCOL_APP] = PROTOCOL_APP_ID;
        try {
          src.postMessage(JSON.stringify(data), this.host);
        } catch (e) {
          lib.error(e);
        }
      }
    },

    /**
    * Posts a message to a source with request for confirmation.
    * This implementation polls the source frame with the posted message
    * until the frame sends back a confirmation response.
    * Use this method to (better) guarentee delivery.
    * @param {String} message string to send.
    * @param {Any} [value] an optional value to send with the message.
    * @param {Function} [callback] function to call with the response data.
    * @param {Number} [timeout] in milliseconds before request is aborted.
    * @returns {String} id of the newly-created request.
    */
    request: function(src, message, value, callback, timeout) {
      src = this.src(src);
      if (!src || !message) return lib.error('invalid request');

      var self = this;
      var id = CLIENT_GUID +'-'+ ('0000' + requestId++).slice(-4);
      var req = requests[id] = {
        timeout: (timeout || 15000),
        attempts: 0,
        src: src,
        cb: callback,
        data: {
          message: message,
          value: value,
          id: id
        }
      };

      // Runs a single polling cycle to push pending messages.
      // Continues polling calls until the request queue is empty.
      function poll() {
        var running = false;

        for (var id in requests) {
          if (requests.hasOwnProperty(id)) {
            var pending = requests[id];
            if (pending.attempts++ < pending.timeout / POLL_INTERVAL) {
              self.post(pending.src, pending.data);
              running = true;
            } else {
              self.end(id, new Error('request timeout'));
            }
          }
        }

        currentPoll = running ? setTimeout(poll, POLL_INTERVAL) : null;
      }

      // Start polling, or else make an initial request:
      if (!currentPoll) poll();
      else this.post(src, req.data);
      return id;
    },

    /**
    * Ends a pending request.
    * The request is deleted from the queue,
    * and the pending request callback is fulfilled.
    * @param {String|Object} message id or data object to conclude.
    * @param {Error|Object} error or cancelation options.
    * Pass "abort: true" to end without response.
    * @example
    * xframe.end('request-0001', new Error('boom'))
    * xframe.end('request-0001', { abort: true })
    * xframe.end({ id: 'request-0001', value: 'hello' })
    */
    end: function(req, err) {
      var id = req.id || req;
      var isAbort = (err && err.abort);
      if (requests.hasOwnProperty(id)) {
        var pending = requests[id];
        delete requests[id];
        if (!isAbort && typeof pending.cb === 'function') {
          pending.cb(err || null, req.value);
        }
      }
    },

    /**
    * Attaches a response handler to this XFrame Client.
    * Each handler may target a unique message type.
    * @param {String} message name to respond to.
    * @param {Function} handler function for responding.
    * Handler receives any value that was sent with the message,
    * and may return a value that gets sent back to requests.
    * @param {Object} context in which to invoke the handler.
    * @example
    * var xframe = require('xframe');
    * var client = xframe('volume', 'http://aweso.me');
    * client
    *  .on('play', function(data) { ... }, this)
    *  .on('pause', function(data) { ... }, this)
    *  .on('host', function(data) { return document.domain; }, this)
    *  .listen();
    */
    on: function(message, handler, context) {
      handlers.push({ message: message, fn: handler, ctx: context });
      return this;
    },

    /**
    * Enables listening on the client.
    * Call this once after configuring all request handlers.
    */
    listen: function() {
      if (!listener) {
        var self = this;

        // Loops through all handlers, responding to the message type:
        // collects and returns an optional response value from handlers.
        function handleMessage(evt, req) {
          var res;
          for (var i=0; i < handlers.length; i++) {
            var handler = handlers[i];
            if (handler.message === req.message) {
              res = handler.fn.call(handler.ctx, evt, req.value);
            }
          }
          return res;
        }

        // Handle events sent from `postMessage`.
        // This listener delegates all requests and responses.
        listener = function(evt) {
          var origin = (self.host === '*' || String(evt.origin).indexOf(self.host) >= 0);
          var req, res;

          // Parse request data:
          if (origin && /^\{.*\}$/.test(evt.data)) {
            try { req = JSON.parse(evt.data) }
            catch (e) { req = null }
          }

          // Abort for invalid origin, request, or protocol:
          if (!origin || !req || req[PROTOCOL_APP] !== PROTOCOL_APP_ID) return;

          if (req.id) {
            // MESSAGE WITH ID (track request/response cycle)
            // Check if message is a response to a previous request:
            var isResponse = (req.message === PROTOCOL_RESPONSE);

            // MESSAGE RESPONSE (conclude request/response cycle)
            if (isResponse && requests.hasOwnProperty(req.id)) {
              self.end(req);
            }
            // REQUEST FOR RESPONSE (handle message and send response)
            else if (!isResponse && !responses.hasOwnProperty(req.id)) {
              responses[req.id] = true;
              self.post(evt.source, {
                message: PROTOCOL_RESPONSE,
                value: handleMessage(evt, req) || 'success',
                id: req.id
              });
            }
          } else {
            // GENERIC MESSAGE (just handle locally)
            handleMessage(evt, req);
          }
        };

        global.addEventListener('message', listener);
      }
      return this;
    },

    /**
    * Stops listening for message events.
    * Call this while uninstalling the client.
    */
    stopListening: function() {
      if (listener) {
        global.removeEventListener('message', listener);
        listener = null;
      }
      return this;
    },

    /**
    * Stops all pending requests.
    * Call this while uninstalling the client.
    */
    dispose: function() {
      clearInterval(currentPoll);
      this.stopListening();
    }
  };
});
