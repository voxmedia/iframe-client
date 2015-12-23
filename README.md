# IframeClient

Provides simpler and more reliable cross-origin JavaScript messaging between iframes and their host pages by wrapping `window.postMessage` in a transactional layer. IframeClient builds atop `postMessage` in the way that TCP builds atop IP. IframeClient provides request/response cycles with polling and timeouts to (better) guarentee that messages will be received and able to provide response.

Source is configured as an NPM module and a Ruby gem for integration into Node-based projects and Rails applications.

## Usage

### 1. Create client instances

First, create a new IframeClient instance on your host page and in each iframe window:

**On http://my-host-page.com/index.html**

```javascript
var hostClient = IframeClient.create('myapp', 'http://my-embed.com');
```

**On http://my-embed.com/embed.html**

```javascript
var embedClient = IframeClient.create('myapp', '*');
```

The `IframeClient.create` factory function accepts an _application namespace_, and a _frame origin_ that the new client is allowed to post messages to. You'll need to build an IframeClient instance on your host page, and within each iframe loaded into the host.

* The **application namespace** is a keyword identifying the application these client messages pertain to. All clients should use the same application namespace so they'll recognize and respond to one another's messages.

* The **frame origin** identifies the origin that each client is allowed to send messages to. You may specify `"*"` to allow a client to post to any origin.

### 2. Configure message handlers

Next, configure each client with the messages that it should respond to. Message handlers may be chained using calls to the `.on()` command with the name of a message and a handler function to respond to it. A message handler may receive the message event and a payload of data from the message, and may return other data to respond with. After configuring all message handlers, call `.listen()` to start receiving communication.

```javascript
embedClient
  .on('play', function(evt, data) { ... })
  .on('pause', function(evt, data) { ... })
  .on('getstuff', function(evt, data) { return 'stuff' })
  .listen();
```

### 3. Send messages

Messages may be posted or requested.

Using `post`, a client sends a one-time message attempt to the target window. This message is posted blindly at the target frame, and offers no indication as to whether the message was actually received. Message posts will commonly fail if one frame starts sending messages before the other frame is ready to receive them.

```javascript
hostClient.post('#my-iframe', 'play', 'hello embed!');
```

Using `request`, a client initiates a full request/response cycle with the target window. A request starts repeatedly posting a message at the target window, and does not stop until the other window responds or else the request times out. This also allows frames to request data from one another, and for message requests to provide callbacks.

```javascript
hostClient.request('#my-iframe', 'getstuff', 'hello embed!', function(err, data) {
  if (err) return console.log(err.message);
  console.log('Received data:' + data);
});
```

## API

#### var cli = IframeClient.create(appId, [allowedOrigin])

Creates a new IframeClient instance.

#### cli.on(message, handler, [context])

Adds a message handler to the client.

#### cli.listen()

Starts the client listening for incoming messages. Call this once after registering all message handlers.

#### cli.post(target, message, [value])

Posts a blind message to the target window. This is a wrapper for calling `postMessage` with some convenience data management for passing a message string and a data value. Messages sent via `post` may fail if the receiving client has not yet

#### cli.request(target, message, [value], [callback])

Initiates a request/response cycle with the target window frame.

#### cli.dispose()

Stops listening and cancels all message polling. The client will now be safe for garbage collection.

## Contributing

1. Fork it ( https://github.com/voxmedia/iframe-client/fork )
2. Create your feature branch (`git checkout -b my-new-feature`)
3. Commit your changes (`git commit -am 'Add some feature'`)
4. Push to the branch (`git push origin my-new-feature`)
5. Create a new Pull Request