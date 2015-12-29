# IframeClient

Provides simple and reliable cross-origin JavaScript messaging between iframes and their host pages by wrapping `window.postMessage` in a transactional layer. IframeClient builds atop `postMessage` in the way that TCP builds atop IP. IframeClient provides request/response cycles with polling and timeouts to (better) guarentee that messages will be received and post back responses.

This repo is configured as an NPM module and a Ruby gem for integration into Node-based projects and Rails applications.

## Install

### Node

In package dependencies:

`"iframe-client": "git@github.com:voxmedia/iframe-client.git"`

Then install:

`npm install`

In project script:

`var IframeClient = require('iframe-client');`

### Rails

In Gemfile:

`gem 'iframe-client', :git => 'git@github.com:voxmedia/iframe-client.git'`

In JavaScript manifest:

`//= require iframe-client`

## Usage

### 1. Create client instances

First, create a new `IframeClient` instance on your host page and within each iframe window:

**On http://my-host-page.com/index.html**

```javascript
var hostClient = IframeClient.create('myapp', 'http://my-embed.com');
```

**On http://my-embed.com/embed.html**

```javascript
var embedClient = IframeClient.create('myapp', '*');
```

The `IframeClient.create` factory function accepts an _application namespace_ and a _frame origin_ that the new client may post messages to. It's very important that each window (host and iframes) build their own client instance with a common namespace so they may respond to relevant messages within their window environment.

### 2. Configure message handlers

Next, configure each client with the messages that it should respond to. Message handlers may be chained using calls to the `.on()` method. A handler function receives the message event and a payload of data from each message, and may return response data to pass back to the sender. After configuring all message handlers, call `.listen()` to begin monitoring communication.

```javascript
embedClient
  .on('play', function(evt, data) { ... })
  .on('pause', function(evt, data) { ... })
  .on('getstuff', function(evt, data) { return 'stuff' })
  .listen();
```

### 3. Send messages

Messages may be **posted** or **requested**.

Using `post`, a client sends a one-time message attempt to the target window. This message is posted blindly at the target window, and provides no indication as to whether the message was actually received. Message posts will commonly fail if one window starts sending messages before another window is ready to receive them.

```javascript
hostClient.post('#my-iframe', 'play', 'hello embed!');
```

Using `request`, a client initiates a full request/response cycle with the target window. A request will repeatedly send a message to the target window, and does not stop sending until the target responds or the request times out. This also allows windows to coordinate data passing, and for completed requests to trigger callbacks.

```javascript
hostClient.request('#my-iframe', 'getstuff', 'hello embed!', function(err, res) {
  if (err) return console.log(err.message);
  console.log('Received response:', res);
});
```

## API

#### `IframeClient.isInIframe()`

Checks if the current window environment is displayed in an iframe. Returns true when in an iframe.

#### `var cli = IframeClient.create(appId, [allowedOrigin])`

Creates a new `IframeClient` instance.

* `appId`: required string. A keyword specifying an app-specific messaging channel. Clients across windows must share a common application identifier to respond to one another's messages.

* `[allowedOrigin]`: optional string. Specifies an origin URI that the client is allowed to post messages to. Defaults to `"*"` (allow any origin) when omitted.

#### `cli.on(message, handler, [context])`

Registers a message handler on the client. Handlers will run when the specified message type is received within the window. Returns the client instance to support method chaining.

* `message`: required string. Name of the message to respond to.
* `handler`: required function. Handler function to run in response to the message. Accepts arguments `(evt, value)`, where `evt` is the message event, and `value` is any data value that was sent with the message. This handler may return data to pass back in response to the sender.
* `[context]`: optional object. Context in which to invoke the handler.

#### `cli.listen()`

Starts the client listening for incoming messages. Call this once after registering all message handlers. Returns the client instance to support method chaining.

#### `cli.post(target, message, [value])`

Posts a blind message to another window. This is a convenience wrapper for calling `postMessage` with some added data management. Messages sent via `post` may fail if the receiving window's client has not yet fully initialized. Use this method to send non-critical messages where loss is acceptible.

* `target`: required string, iframe, or window element. Must specify an iframe or window element to post to, or else provide a selector for an iframe or window element.

* `message`: required string. A message keyword that maps to registered message handlers in the target window.

* `[value]`: optional object. Additional data to be sent as a payload with the message.

#### `cli.request(target, message, [value], [callback])`

Initiates a request/response cycle with the target window. The message is repeatedly sent to the target window until the window responds, or until the request times out. Use this method for better guarentee of critical message delivery, or to request a data response from another window.

* `target`: required string, iframe, or window element. Must specify an iframe or window element to post to, or else provide a selector for an iframe or window element.

* `message`: required string. A message keyword that maps to registered message handlers in the target window.

* `[value]`: optional object. Additional data to be sent as a payload with the message.

* `[callback]`: optional function. Callback to run after the request cycle is complete. Accepts arguments `(err, res)`, where `err` is any error that was encountered, and `res` is response data sent back from the target window.

#### `cli.dispose()`

Stops listening and cancels all polling messages. Releases the client for garbage collection.

## Testing

```
npm install
npm test
```

Or, open `test/test.html` in a browser after package installation.

## Contributing

1. Fork it ( https://github.com/voxmedia/iframe-client/fork )
2. Create your feature branch (`git checkout -b my-new-feature`)
3. Commit your changes (`git commit -am 'Add some feature'`)
4. Push to the branch (`git push origin my-new-feature`)
5. Create a new Pull Request
