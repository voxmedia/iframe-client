# iframe client

Easier and more reliable cross-origin messaging between iframes and their host page via `postMessage`. Iframe Client handles request/response cycles for roundtrip data exchange between frames, and handles polling messages repeatedly until a response comes through. If you think of `postMessage` as a primitive IP, Iframe Client adds a more robust TCP layer to manage communication.

## Usage

### 1. Instance

First, create a new IframeClient instance on the host page and in each iframe window:

**In http://my-host-page.com**

```
var hostClient = iframeClient('myapp', 'http://my-embed.com');
```

**In http://my-embed.com**

```
var embedClient = iframeClient('myapp', '*');
```

The `iframeClient` factory function accepts an application namespace, and a frame origin that the client is allowed to post messages to. You'll need to build an IframeClient instance on your host page, and within each iframe loaded into the host. All client instances must share the same application namespace so they recognize one another's messages as being relevant. Then the frame origin should identify the origin that each client is allowed to send messages to, or use "*" to indicate that any origin may be messaged.

### 2. Configure

Next, configure each client with the messages that it should respond to. Message handlers may be chained using calls to the `.on()` command. Each handler should specify the name of a message, and a handler function that recieves the message event and any data that was sent with the message. Optionally, a handler may return data to send back in the message response. After configuring all message handlers, call `.listen()` to start receiving communication.

```
embedClient
  .on('play', function(evt, data) { ... })
  .on('pause', function(evt, data) { ... })
  .on('position', function(evt, data) { return video.getPosition() })
  .listen();
```

### 3. Send messages

Messages may be sent in two ways: by `post` or `request`. Using `post`, and client sends a one-time message attempt to the specified iframe. This is basically a `postMessage` call with some data management for organizing the message type and additional data. This message is posted blindly at the target frame, and offers no indication as to whether the message was recieved by the frame or not. Message posts will commonly fail if one frame starts sending messages before the other frame is ready to receive them.

```
hostClient.post('#my-iframe', 'play', 'hello embed!');
```

Use the `request` method to (better) guarentee message delivery. Sending a request initiates a full request/response cycle between the two frames, where one frame starts repeatedly posting a message at the other frame, and does not stop until the other frame responds or else the request times out. This also allows frames to request data from one another, which is handed off via the request/response transaction.

```
hostClient.request('#my-iframe', 'position', 'hello embed!', function(err, data) {
  if (err) return console.log(err.message);
  console.log('The current position is:' + data);
});
```

## API

**var cli = IframeClient.create(appId, [allowedOrigin])**

Creates a new IframeClient instance.

**cli.on(message, handler, [context])**

Adds a message handler to the client.

**cli.listen()**

Starts the client listening for incoming messages. Call this once after registering all message handlers.

**cli.post(target, message, [value])**

Posts a blind message to the target window. This is a wrapper for calling `postMessage` with some convenience data management for passing a message string and a data value. Messages sent via `post` may fail if the receiving client has not yet

**cli.request(target, message, [value], [callback])**

**cli.dispose()**

Stops listening and cancels all message polling. The client will now be safe for garbage collection.

## Contributing

1. Fork it ( https://github.com/voxmedia/meme/fork )
2. Create your feature branch (`git checkout -b my-new-feature`)
3. Commit your changes (`git commit -am 'Add some feature'`)
4. Push to the branch (`git push origin my-new-feature`)
5. Create a new Pull Request